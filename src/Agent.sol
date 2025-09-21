// SPDX-License-Identifier: MIT

// src/Agent.sol
pragma solidity ^0.8.20;

contract Agent {
    address public owner;  // Contract owner for access control in future phases

    constructor() {
        owner = msg.sender;  // Set deployer as owner on initialization
    }
}