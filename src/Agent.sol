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