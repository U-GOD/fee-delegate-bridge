// SPDX-License-Identifier: MIT

// test/Agent.t.sol
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Agent.sol";

contract AgentTest is Test {
    Agent public agent;

    function setUp() public {
        agent = new Agent();  // Deploy the contract in each test
    }

    function testConstructor_SetsOwnerCorrectly() public {
        assertEq(agent.owner(), address(this));  // Owner should be the test contract (deployer)
    }
}