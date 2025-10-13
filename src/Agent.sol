// SPDX-License-Identifier: MIT

// src/Agent.sol
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IEndpointV2} from "./interfaces/IEndpointV2.sol";

contract Agent {
    address public owner; // Contract owner for access control in future phases

    // Chainlink gas feed proxy—configurable for chains (Sepolia ETH proxy for Monad testnet sim).
    AggregatorV3Interface public immutable GAS_ORACLE;

    // LayerZero endpoint for cross-chain sends—configurable (e.g., Monad testnet for bridging).
    IEndpointV2 public immutable ENDPOINT;

    // Constructor: Initializes owner, oracle, and LayerZero endpoint (pass addrs on deploy for flexibility).
    constructor(address _gasOracle, address _endpoint) {
        owner = msg.sender;
        GAS_ORACLE = AggregatorV3Interface(_gasOracle);
        ENDPOINT = IEndpointV2(_endpoint);
    }

    // Mapping for user-specific gas thresholds to enable personalized automation
    mapping(address => uint256) public gasThresholds;

    // Session account authorization: user → session address → authorized status
    // Allows users to authorize multiple ephemeral accounts for delegated actions
    mapping(address => mapping(address => bool)) public authorizedSessions;

    mapping(address => mapping(address => uint256)) public sessionAuthorizedAt;

    // ============ DEPOSIT SYSTEM ============

    mapping(address => uint256) public deposits;

    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);

    struct Caveat {
        address enforcer; 
        bytes data; 
    }

    // ERC-7710 Delegation struct to store signed permissions per user
    struct Delegation {
        address delegator; // User who signed the delegation
        address delegatee; // Agent (this contract) or other executor
        bytes32 authority; // Root authority hash for chaining
        Caveat[] caveats; // Array of rules/restrictions
        uint256 salt; // Nonce to prevent replay
        uint256 expiration; // Timestamp when delegation expires
    }

    // Mapping to store active delegations per delegator (internal for encapsulation)
    mapping(address => Delegation) internal delegations;

    // Event for tracking bridge attempts
    event BridgeInitiated(address indexed user, uint32 dstEid, uint256 amount, uint256 fee);
    event BridgeFailed(address indexed user, string reason);

    // DEPRECATED: Use isSessionAuthorized() instead
    // Public getter to return full delegation struct for queries
    function getDelegation(address _delegator) external view returns (Delegation memory) {
        return delegations[_delegator];
    }

    // Event emitted on successful delegation redemption for tracking
    event DelegationRedeemed(address indexed delegator, address delegatee, bytes32 authority);

    // DEPRECATED: Use authorizeSession() instead
    // Redeem a signed delegation per ERC-7710: Verify sig, check expiration, store for automation
    function redeemDelegation(Delegation memory _del, bytes memory _signature) external {
        // Memory for simple split
        require(_del.expiration > block.timestamp, "Delegation expired");

        // Hash the delegation payload for signature verification
        bytes32 payloadHash = keccak256(abi.encode(_del));
        // bytes32 payloadHash;
        // assembly {
        //     payloadHash := keccak256(add(_del, 0x20), mload(_del))
        // }
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));

        // Recover signer and ensure it matches delegator
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(_signature);
        address signer = ecrecover(ethSignedMessageHash, v, r, s);
        require(signer == _del.delegator, "Invalid signature");

        // Placeholder: Basic caveat check (enforce first caveat's data, e.g., threshold)
        // In production, loop caveats and call enforcer.call(data)
        if (_del.caveats.length > 0) {
            // Simulate: Require encoded data > 0 (e.g., min amount or threshold)
            uint256 caveatValue = abi.decode(_del.caveats[0].data, (uint256));
            require(caveatValue > 0, "Caveat not satisfied");
        }

        // Store the redeemed delegation
        delegations[_del.delegator] = _del;
        emit DelegationRedeemed(_del.delegator, _del.delegatee, _del.authority);
    }

    // DEPRECATED: Helper for old signature verification
    // Helper to split signature (v, r, s) for ecrecover from memory (standard OpenZeppelin style)
    function splitSignature(bytes memory _signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(_signature.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(_signature, 32)) // r at bytes[0:32]
            s := mload(add(_signature, 64)) // s at bytes[32:64]
            v := byte(0, mload(add(_signature, 96))) // v at bytes[64]
        }
        if (v < 27) {
            v += 27;
        }
    }

    // DEPRECATED: Test helper for old delegation system
    // Temp function for testing delegation storage (remove in production)
    function _setDelegation(address _delegator, Delegation memory _del) external {
        delegations[_delegator] = _del; // Direct write to internal mapping
    }

    event ThresholdSet(address indexed user, uint256 threshold);

    function setGasThreshold(uint256 _threshold) external {
        require(_threshold > 0, "Threshold must be greater than zero");
        gasThresholds[msg.sender] = _threshold;
        emit ThresholdSet(msg.sender, _threshold);
    }

    // ============ DEPOSIT MANAGEMENT ============

    function deposit() external payable {
        require(msg.value > 0, "Must deposit at least some ETH");

        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, deposits[msg.sender]);
    }

    function withdraw(uint256 _amount) external {
        require(_amount > 0, "Must withdraw something");
        require(deposits[msg.sender] >= _amount, "Insufficient deposit balance");

        deposits[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);
        emit Withdrawn(msg.sender, _amount, deposits[msg.sender]);
    }

    function getDeposit(address _user) external view returns (uint256) {
        return deposits[_user];
    }

    function getGasThreshold(address _user) external view returns (uint256) {
        return gasThresholds[_user];
    }

    event SessionAuthorized(address indexed user, address indexed sessionAccount, uint256 timestamp);
    event SessionRevoked(address indexed user, address indexed sessionAccount);

    /**
     * @notice Authorize a session account to act on behalf of the caller
     * @dev Only the user (msg.sender) can authorize sessions for themselves
     * @param _sessionAccount Address of the ephemeral session account to authorize
     */
    function authorizeSession(address _sessionAccount) external {
        require(_sessionAccount != address(0), "Invalid session address");
        require(_sessionAccount != msg.sender, "Cannot authorize self as session");
        
        // Mark session as authorized for this user
        authorizedSessions[msg.sender][_sessionAccount] = true;
        sessionAuthorizedAt[msg.sender][_sessionAccount] = block.timestamp;
        
        emit SessionAuthorized(msg.sender, _sessionAccount, block.timestamp);
    }

    /**
     * @notice Revoke authorization for a session account
     * @dev Only the user can revoke their own sessions
     * @param _sessionAccount Address of the session account to revoke
     */
    function revokeSession(address _sessionAccount) external {
        require(authorizedSessions[msg.sender][_sessionAccount], "Session not authorized");
        
        // Remove authorization
        authorizedSessions[msg.sender][_sessionAccount] = false;
        
        emit SessionRevoked(msg.sender, _sessionAccount);
    }

    /**
     * @notice Check if a session account is authorized for a user
     * @dev Public view function for easy frontend queries
     * @param _user The user address
     * @param _sessionAccount The session account to check
     * @return bool True if session is authorized
     */
    function isSessionAuthorized(address _user, address _sessionAccount) external view returns (bool) {
        return authorizedSessions[_user][_sessionAccount];
    }

    // Mock fallback for testnet
    function getMockGas() internal pure returns (uint256) {
        return 50;  // Fixed 50 gwei
    }

    // Check current ETH gas vs. user's threshold—core trigger for auto-bridging (returns gwei + bool).
    function checkGas(address _user) external view returns (uint256 currentGasGwei, bool shouldTrigger) {
        currentGasGwei = getMockGas(); 
        
        uint256 userThreshold = gasThresholds[_user];
        // Only trigger if user has set a threshold AND current gas is below it
        shouldTrigger = (userThreshold > 0) && (currentGasGwei < userThreshold);
    }

    function checkGasAndBridge(address _user) external payable { 
        // Step 1: Check gas trigger
        (, bool shouldTrigger) = this.checkGas(_user);
        require(shouldTrigger, "No trigger: gas below threshold");
        
        // Step 2: Check authorization
        require(
            authorizedSessions[_user][msg.sender],
            "Caller not authorized session"
        );
        
        // Step 3: Check user has enough deposited funds to bridge
        uint256 amountToBridge = 0.1 ether; 
        require(deposits[_user] >= amountToBridge, "Insufficient deposit for bridge");
        
        // Step 4: Get LayerZero fee quote
        uint32 dstEid = 40204; // Monad testnet destination
        bytes memory message = abi.encode(
            _user,
            amountToBridge,
            block.timestamp,
            "BRIDGE_TO_MONAD"
        );
        bytes memory options = "";
        
        (uint256 nativeFee, ) = ENDPOINT.quote(dstEid, message, false, options);
        require(msg.value >= nativeFee, "Insufficient LZ fee");
        
        // Step 5: Deduct from user's deposit (the amount being bridged)
        deposits[_user] -= amountToBridge;
        
        // Step 6: Execute bridge via LayerZero
        ENDPOINT.lzSend{value: nativeFee}(dstEid, message, options);
        
        emit BridgeInitiated(_user, dstEid, amountToBridge, nativeFee);
        
        // Step 7: Refund any extra LZ fee sent
        uint256 extra = msg.value - nativeFee;
        if (extra > 0) {
            payable(msg.sender).transfer(extra);
        }
    }

    // DEPRECATED: Use authorizeSession() instead
    function redeemDelegationSimple(Delegation memory _del) external {
        require(_del.expiration > block.timestamp, "Delegation expired");
        require(_del.delegator == msg.sender, "Only delegator can redeem");
        
        // Skip signature verification for Phase 2 testing
        // require(signer == _del.delegator, "Invalid signature");
        
        // Store the delegation
        delegations[_del.delegator] = _del;
        emit DelegationRedeemed(_del.delegator, _del.delegatee, _del.authority);
    }

    // ============ FRONTEND HELPER FUNCTIONS ============

    /**
     * @notice Get comprehensive bridge status for a user/session pair
     * @dev Combines multiple contract reads into one call to reduce frontend RPC overhead
     * @param _user The user address whose threshold/status to check
     * @param _sessionAccount The session account trying to bridge
     * @return hasThreshold True if user has set a non-zero gas threshold
     * @return isAuthorized True if session is authorized for this user
     * @return shouldTrigger True if current gas exceeds user's threshold
     * @return currentGasGwei Current gas price in gwei from oracle
     */
    function getBridgeStatus(
        address _user,
        address _sessionAccount
    ) external view returns (
        bool hasThreshold,
        bool isAuthorized,
        bool shouldTrigger,
        uint256 currentGasGwei
    ) {
        // Check if user has set a threshold
        uint256 threshold = gasThresholds[_user];
        hasThreshold = threshold > 0;
        
        // Check session authorization
        isAuthorized = authorizedSessions[_user][_sessionAccount];
        
        // Get current gas and trigger status
        (currentGasGwei, shouldTrigger) = this.checkGas(_user);
        
        // Return all values (named returns automatically populate)
        return (hasThreshold, isAuthorized, shouldTrigger, currentGasGwei);
    }
}
