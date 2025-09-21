// SPDX-License-Identifier: MIT

// test/Agent.t.sol
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Agent} from "../src/Agent.sol";

contract AgentTest is Test {
    Agent public agent;

    function setUp() public {
        agent = new Agent();  // Deploy the contract in each test
    }

    function testConstructor_SetsOwnerCorrectly() public view {
        assertEq(agent.owner(), address(this));  // Owner should be the test contract (deployer)
    }

    function testSetGasThreshold_UpdatesValue() public {
        address user = address(0x123);  // Simulate a user
        vm.prank(user);
        agent.setGasThreshold(50);
        assertEq(agent.gasThresholds(user), 50);
    }

    function testSetGasThreshold_EmitsEvent() public {
        address user = address(0x123);
        vm.prank(user);
        vm.expectEmit(true, true, false, true);  // Check indexed topics and data
        emit Agent.ThresholdSet(user, 50);  // Qualified event name to resolve in test context
        agent.setGasThreshold(50);
    }

    function testSetGasThreshold_RevertsIfZero() public {
        vm.expectRevert("Threshold must be greater than zero");
        agent.setGasThreshold(0);
    }

    function testGetGasThreshold_ReturnsCorrectValue() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(50);  // Set first to test read
        assertEq(agent.getGasThreshold(user), 50);
    }

    function testGetGasThreshold_ReturnsZeroForUnsetUser() public {
        address unsetUser = address(0x456);
        assertEq(agent.getGasThreshold(unsetUser), 0);  // Default mapping value
    }

    function testStoreDelegation_SetsCorrectly() public {
        address delegator = address(0xABC);
        Agent.Caveat[] memory caveats = new Agent.Caveat[](1);
        caveats[0] = Agent.Caveat({enforcer: address(0xDEF), data: abi.encode(50)});

        Agent.Delegation memory del = Agent.Delegation({
            delegator: delegator,
            delegatee: address(agent),
            authority: keccak256("root"),
            caveats: caveats,
            salt: 1,
            expiration: block.timestamp + 1 days
        });

        // Temp setter for testing storage (remove in production)
        agent.delegations[delegator] = del;

        Agent.Delegation memory stored = agent.delegations(delegator);
        assertEq(stored.delegator, delegator);
        assertEq(stored.delegatee, address(agent));
        assertEq(stored.caveats[0].enforcer, address(0xDEF));
        assertEq(stored.salt, 1);
    }

    function testStoreDelegation_DefaultsToEmpty() public view {
        address unset = address(0x999);
        Agent.Delegation memory del = agent.delegations(unset);
        assertEq(del.delegator, address(0));  // Defaults to zero/empty
        assertEq(del.caveats.length, 0);
    }
}