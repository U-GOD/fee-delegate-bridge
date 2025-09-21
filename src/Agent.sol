// SPDX-License-Identifier: MIT

// src/Agent.sol
pragma solidity ^0.8.20;

contract Agent {
    address public owner;  // Contract owner for access control in future phases

    constructor() {
        owner = msg.sender;  // Set deployer as owner on initialization
    }

    // Mapping for user-specific gas thresholds to enable personalized automation
    mapping(address => uint256) public gasThresholds;

    // Struct for caveat rules (e.g., limits on actions like max amount to bridge)
    struct Caveat {
        address enforcer;  // Contract enforcing the caveat
        bytes data;        // Encoded rule data (e.g., ABI-encoded threshold)
    }

    // ERC-7710 Delegation struct to store signed permissions per user
    struct Delegation {
        address delegator;     // User who signed the delegation
        address delegatee;     // Agent (this contract) or other executor
        bytes32 authority;     // Root authority hash for chaining
        Caveat[] caveats;      // Array of rules/restrictions
        uint256 salt;          // Nonce to prevent replay
        uint256 expiration;    // Timestamp when delegation expires
    }

    // Mapping to store active delegations per delegator
    mapping(address => Delegation) public delegations;

    event ThresholdSet(address indexed user, uint256 threshold);

    function setGasThreshold(uint256 _threshold) external {
        require(_threshold > 0, "Threshold must be greater than zero");
        gasThresholds[msg.sender] = _threshold;
        emit ThresholdSet(msg.sender, _threshold);
    }

    function getGasThreshold(address _user) external view returns (uint256) {
        return gasThresholds[_user];  // Simple read for querying user settings
    }
}