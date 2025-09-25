// SPDX-License-Identifier: MIT

// src/Agent.sol
pragma solidity ^0.8.20;

// Interface for Chainlink oracle (standard for gas/price feeds—enables external contract calls like any address).
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function version() external view returns (uint256);

    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract Agent {
    address public owner; // Contract owner for access control in future phases

    // Chainlink gas feed proxy—configurable for chains (e.g., Sepolia ETH proxy for Monad testnet sim).
    AggregatorV3Interface public immutable gasOracle;

    // Constructor: Initializes owner and oracle (pass proxy addr on deploy for chain flexibility).
    constructor(address _gasOracle) {
        owner = msg.sender;
        gasOracle = AggregatorV3Interface(_gasOracle);
    }

    // Mapping for user-specific gas thresholds to enable personalized automation
    mapping(address => uint256) public gasThresholds;

    // Struct for caveat rules (e.g., limits on actions like max amount to bridge)
    struct Caveat {
        address enforcer; // Contract enforcing the caveat
        bytes data; // Encoded rule data (e.g., ABI-encoded threshold)
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

    // Public getter to return full delegation struct for queries
    function getDelegation(address _delegator) external view returns (Delegation memory) {
        return delegations[_delegator];
    }

    // Event emitted on successful delegation redemption for tracking
    event DelegationRedeemed(address indexed delegator, address delegatee, bytes32 authority);

    // Redeem a signed delegation per ERC-7710: Verify sig, check expiration, store for automation
    function redeemDelegation(Delegation memory _del, bytes memory _signature) external {
        // Memory for simple split
        require(_del.expiration > block.timestamp, "Delegation expired");

        // Hash the delegation payload for signature verification
        bytes32 payloadHash = keccak256(abi.encode(_del));
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

    // Helper to split signature (v, r, s) for ecrecover from memory (standard OpenZeppelin style)
    function splitSignature(bytes memory _signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(_signature.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(_signature, 32)) // r at bytes[0:32]
            s := mload(add(_signature, 64)) // s at bytes[32:64]
            v := byte(0, mload(add(_signature, 96))) // v at bytes[64]
        }
        if (v < 27) {
            v += 27; // Normalize v to 27/28
        }
    }

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

    function getGasThreshold(address _user) external view returns (uint256) {
        return gasThresholds[_user]; // Simple read for querying user settings
    }


    // Add this NEW function for Phase 2 testing (we'll remove it later)
    function redeemDelegationSimple(Delegation memory _del) external {
        require(_del.expiration > block.timestamp, "Delegation expired");
        require(_del.delegator == msg.sender, "Only delegator can redeem");
        
        // Skip signature verification for Phase 2 testing
        // require(signer == _del.delegator, "Invalid signature");
        
        // Store the delegation
        delegations[_del.delegator] = _del;
        emit DelegationRedeemed(_del.delegator, _del.delegatee, _del.authority);
    }
}
