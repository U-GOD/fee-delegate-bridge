// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IEndpointV2} from "./interfaces/IEndpointV2.sol";

/**
 * @title Agent - Cross-Chain Gas Fee Optimizer
 * @notice Automatically bridges user funds from Base Sepolia to Monad when gas is cheap
 * @dev Uses LayerZero V2 for cross-chain messaging and session-based authorization
 * 
 * ARCHITECTURE:
 * - Deployed on BASE SEPOLIA (source chain with high gas)
 * - Monitors Base Sepolia gas prices via oracle/mock
 * - Bridges TO Monad Testnet (destination chain with low gas)
 * - Users deposit funds, set threshold, authorize session account
 * - When gas < threshold → automated bridge triggers
 */
contract Agent {
    // ============ STATE VARIABLES ============
    
    address public owner;
    AggregatorV3Interface public immutable GAS_ORACLE;
    IEndpointV2 public immutable ENDPOINT;
    
    // LayerZero V2 Endpoint IDs (immutable for gas savings)
    // Source: Base Sepolia EID = 40245 (where this contract is deployed)
    // Destination: Monad Testnet EID = 40204 (where funds are sent)
    uint32 public constant DESTINATION_EID = 40204;
    
    // Peer contract on destination chain (MonadReceiver address)
    mapping(uint32 => bytes32) public peers;
    
    // User configurations
    mapping(address => uint256) public gasThresholds;      // User's max acceptable gas price
    mapping(address => uint256) public deposits;           // User's deposited funds for bridging
    
    // Session account authorization for automated bridging
    mapping(address => mapping(address => bool)) public authorizedSessions;
    mapping(address => mapping(address => uint256)) public sessionAuthorizedAt;
    
    // ============ EVENTS ============
    
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event ThresholdSet(address indexed user, uint256 threshold);
    event SessionAuthorized(address indexed user, address indexed sessionAccount, uint256 timestamp);
    event SessionRevoked(address indexed user, address indexed sessionAccount);
    event BridgeInitiated(address indexed user, uint32 dstEid, uint256 amount, uint256 fee);
    event BridgeFailed(address indexed user, string reason);
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy the Agent contract on Base Sepolia
     * @param _gasOracle Chainlink gas price oracle address (or 0x0 for mock)
     * @param _endpoint LayerZero V2 Endpoint address on Base Sepolia
     * 
     * Base Sepolia LayerZero Endpoint: 0x6EDCE65403992e310A62460808c4b910D972f10f
     */
    constructor(address _gasOracle, address _endpoint) {
        owner = msg.sender;
        GAS_ORACLE = AggregatorV3Interface(_gasOracle);
        ENDPOINT = IEndpointV2(_endpoint);
    }
    
    // ============ USER CONFIGURATION ============
    
    /**
     * @notice Set your gas threshold for automated bridging
     * @param _threshold Maximum gas price (in gwei) you're willing to pay
     * 
     * HOW IT WORKS:
     * - If you set threshold = 50 gwei
     * - When Base gas drops to 40 gwei (below threshold)
     * - Agent automatically bridges your funds to Monad
     * - You save money by bridging during cheap gas!
     */
    function setGasThreshold(uint256 _threshold) external {
        require(_threshold > 0, "Threshold must be greater than zero");
        gasThresholds[msg.sender] = _threshold;
        emit ThresholdSet(msg.sender, _threshold);
    }
    
    function getGasThreshold(address _user) external view returns (uint256) {
        return gasThresholds[_user];
    }
    
    // ============ DEPOSIT SYSTEM ============
    
    /**
     * @notice Deposit ETH to be bridged when gas is cheap
     * @dev Funds are held in contract until bridge trigger
     * 
     * IMPORTANT: Deposit on Base Sepolia (this chain)
     * Your funds will be bridged TO Monad when conditions are met
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit at least some ETH");
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, deposits[msg.sender]);
    }
    
    /**
     * @notice Withdraw your deposited funds (before bridging)
     * @param _amount Amount in wei to withdraw
     */
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
    
    // ============ SESSION AUTHORIZATION ============
    
    /**
     * @notice Authorize a session account to bridge on your behalf
     * @param _sessionAccount MetaMask Smart Account address
     * 
     * WHY?
     * Session accounts enable automated bridging without requiring
     * your approval signature every time. You grant permission once,
     * the session account monitors gas and bridges automatically.
     */
    function authorizeSession(address _sessionAccount) external {
        require(_sessionAccount != address(0), "Invalid session address");
        require(_sessionAccount != msg.sender, "Cannot authorize self as session");
        
        authorizedSessions[msg.sender][_sessionAccount] = true;
        sessionAuthorizedAt[msg.sender][_sessionAccount] = block.timestamp;
        
        emit SessionAuthorized(msg.sender, _sessionAccount, block.timestamp);
    }
    
    /**
     * @notice Revoke a session account's authorization
     * @param _sessionAccount Session account address to revoke
     */
    function revokeSession(address _sessionAccount) external {
        require(authorizedSessions[msg.sender][_sessionAccount], "Session not authorized");
        authorizedSessions[msg.sender][_sessionAccount] = false;
        emit SessionRevoked(msg.sender, _sessionAccount);
    }
    
    function isSessionAuthorized(address _user, address _sessionAccount) external view returns (bool) {
        return authorizedSessions[_user][_sessionAccount];
    }
    
    // ============ GAS MONITORING & BRIDGING ============
    
    /**
     * @notice Mock gas oracle for testnet demo
     * @dev Returns fixed 15 gwei to simulate "cheap gas" scenario
     * 
     * PRODUCTION: Replace with real Chainlink oracle call:
     * (, int256 answer, , ,) = GAS_ORACLE.latestRoundData();
     * return uint256(answer) / 1e9; // Convert to gwei
     */
    function getMockGas() internal pure returns (uint256) {
        return 15;  // Low gas price to trigger bridge in demo
    }
    
    /**
     * @notice Check if bridging should trigger for a user
     * @param _user User address to check
     * @return currentGasGwei Current gas price on Base Sepolia
     * @return shouldTrigger True if gas is below user's threshold
     * 
     * LOGIC EXPLANATION:
     * - User sets threshold = 50 gwei (max acceptable)
     * - Current gas = 15 gwei (what mock returns)
     * - Since 15 < 50 → shouldTrigger = TRUE
     * - This means: "Gas is cheap enough, bridge now!"
     * 
     * ⚠️ KEY FIX: Changed from currentGas > threshold to currentGas < threshold
     * Because we want to bridge when gas is CHEAP, not expensive!
     */
    function checkGas(address _user) external view returns (uint256 currentGasGwei, bool shouldTrigger) {
        currentGasGwei = getMockGas(); 
        
        uint256 userThreshold = gasThresholds[_user];
        // ✅ CORRECTED LOGIC: Bridge when gas is BELOW threshold
        shouldTrigger = (userThreshold > 0) && (currentGasGwei < userThreshold);
    }
    
    /**
     * @notice Execute automated bridge when conditions are met
     * @param _user User whose funds to bridge
     * 
     * FLOW:
     * 1. Check gas price < user's threshold
     * 2. Verify caller is authorized session account
     * 3. Check user has sufficient deposit
     * 4. Get LayerZero fee quote
     * 5. Deduct 0.1 ETH from user's deposit
     * 6. Send cross-chain message to Monad
     * 7. Refund any excess LZ fees to session account
     */
    function checkGasAndBridge(address _user) external payable { 
        // Step 1: Verify gas is cheap enough
        (, bool shouldTrigger) = this.checkGas(_user);
        require(shouldTrigger, "No trigger: gas above threshold"); // Updated error message
        
        // Step 2: Verify caller is authorized (session account or user themselves)
        require(
            authorizedSessions[_user][msg.sender] || msg.sender == _user,
            "Caller not authorized"
        );
        
        // Step 3: Check user has funds to bridge
        uint256 amountToBridge = 0.1 ether; // Fixed amount per bridge
        require(deposits[_user] >= amountToBridge, "Insufficient deposit for bridge");
        
        // Step 4: Prepare LayerZero message
        bytes memory message = abi.encode(
            _user,                      // Recipient on Monad
            amountToBridge,             // Amount to send
            block.timestamp,            // Timestamp for tracking
            "BRIDGE_TO_MONAD"          // Action identifier
        );
        bytes memory options = "";      // Default LZ options
        
        // Get fee quote from LayerZero
        (uint256 nativeFee, ) = ENDPOINT.quote(DESTINATION_EID, message, false, options);
        require(msg.value >= nativeFee, "Insufficient LZ fee");
        
        // Step 5: Deduct from user's deposit
        deposits[_user] -= amountToBridge;
        
        // Step 6: Send cross-chain message
        ENDPOINT.lzSend{value: nativeFee}(DESTINATION_EID, message, options);
        
        emit BridgeInitiated(_user, DESTINATION_EID, amountToBridge, nativeFee);
        
        // Step 7: Refund excess fee
        uint256 excess = msg.value - nativeFee;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
    }
    
    // ============ FRONTEND HELPER ============
    
    /**
     * @notice Get all bridge status info in one call (reduces RPC overhead)
     * @param _user User address
     * @param _sessionAccount Session account to check
     * @return hasThreshold User has set a threshold
     * @return isAuthorized Session is authorized for user
     * @return shouldTrigger Gas conditions met for bridge
     * @return currentGasGwei Current gas price
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
        uint256 threshold = gasThresholds[_user];
        hasThreshold = threshold > 0;
        isAuthorized = authorizedSessions[_user][_sessionAccount];
        (currentGasGwei, shouldTrigger) = this.checkGas(_user);
        
        return (hasThreshold, isAuthorized, shouldTrigger, currentGasGwei);
    }
    
    // ============ DEPRECATED FUNCTIONS ============
    // Kept for backwards compatibility with tests
    
    struct Caveat {
        address enforcer; 
        bytes data; 
    }
    
    struct Delegation {
        address delegator;
        address delegatee;
        bytes32 authority;
        Caveat[] caveats;
        uint256 salt;
        uint256 expiration;
    }
    
    mapping(address => Delegation) internal delegations;
    event DelegationRedeemed(address indexed delegator, address delegatee, bytes32 authority);
    
    function getDelegation(address _delegator) external view returns (Delegation memory) {
        return delegations[_delegator];
    }
    
    function _setDelegation(address _delegator, Delegation memory _del) external {
        delegations[_delegator] = _del;
    }
    
    function redeemDelegationSimple(Delegation memory _del) external {
        require(_del.expiration > block.timestamp, "Delegation expired");
        require(_del.delegator == msg.sender, "Only delegator can redeem");
        delegations[_del.delegator] = _del;
        emit DelegationRedeemed(_del.delegator, _del.delegatee, _del.authority);
    }
}