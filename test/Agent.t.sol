// SPDX-License-Identifier: MIT

// test/Agent.t.sol
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Agent} from "../src/Agent.sol";

contract AgentTest is Test {
    Agent public agent;

    function setUp() public {
        agent = new Agent(address(0), address(0)); // Dummy oracle/endpoint for non-bridging tests.
    }

    function testConstructor_SetsOwnerCorrectly() public view {
        assertEq(agent.owner(), address(this)); // Owner should be the test contract (deployer)
    }

    function testSetGasThreshold_UpdatesValue() public {
        address user = address(0x123); // Simulate a user
        vm.prank(user);
        agent.setGasThreshold(50);
        assertEq(agent.gasThresholds(user), 50);
    }

    function testSetGasThreshold_EmitsEvent() public {
        address user = address(0x123);
        vm.prank(user);
        vm.expectEmit(true, true, false, true); // Check indexed topics and data
        emit Agent.ThresholdSet(user, 50); // Qualified event name to resolve in test context
        agent.setGasThreshold(50);
    }

    function testSetGasThreshold_RevertsIfZero() public {
        vm.expectRevert("Threshold must be greater than zero");
        agent.setGasThreshold(0);
    }

    function testGetGasThreshold_ReturnsCorrectValue() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(50); // Set first to test read
        assertEq(agent.getGasThreshold(user), 50);
    }

    function testGetGasThreshold_ReturnsZeroForUnsetUser() public view {
        address unsetUser = address(0x456);
        assertEq(agent.getGasThreshold(unsetUser), 0); // Default mapping value
    }

    function testStoreDelegation_SetsCorrectly() public {
        address delegator = address(0xABC);
        Agent.Caveat[] memory caveats = new Agent.Caveat[](1);
        caveats[0] = Agent.Caveat({enforcer: address(0xDEF), data: abi.encode(50)});

        Agent.Delegation memory del = Agent.Delegation({
            delegator: delegator,
            delegatee: address(agent),
            authority: keccak256(abi.encode("root")), // Proper hash for authority
            caveats: caveats,
            salt: 1,
            expiration: block.timestamp + 1 days
        });

        agent._setDelegation(delegator, del); // Use setter for assignment

        Agent.Delegation memory stored = agent.getDelegation(delegator); // Use explicit getter
        assertEq(stored.delegator, delegator);
        assertEq(stored.delegatee, address(agent));
        assertEq(stored.caveats[0].enforcer, address(0xDEF));
        assertEq(stored.salt, 1);
    }

    function testStoreDelegation_DefaultsToEmpty() public view {
        address unset = address(0x999);
        Agent.Delegation memory del = agent.getDelegation(unset); // Use explicit getter
        assertEq(del.delegator, address(0)); // Defaults to zero/empty
        assertEq(del.caveats.length, 0);
    }

    function testRedeemDelegation_StoresAndVerifies() public {
        uint256 privateKey = 0x123; // Mock private key
        address delegator = vm.addr(privateKey); // Derive delegator from key for sig match
        Agent.Caveat[] memory caveats = new Agent.Caveat[](0); // Empty array to simplify ABI encoding for hash match

        Agent.Delegation memory del = Agent.Delegation({
            delegator: delegator, // Matches derived address
            delegatee: address(agent),
            authority: keccak256(abi.encodePacked("root")), // Fixed bytes32 hash for consistency
            caveats: caveats,
            salt: 1,
            expiration: block.timestamp + 1 days
        });

        // Mock signature from delegator on payload hash (matches contract's abi.encode)
        bytes32 payloadHash = keccak256(abi.encode(del));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Expect event before call (single check to avoid log mismatch)
        vm.expectEmit(true, true, false, true);
        emit Agent.DelegationRedeemed(delegator, address(agent), del.authority); // Qualified for test context

        // Prank as frontend caller to redeem
        vm.prank(address(0x1234567890123456789012345678901234567890));
        agent.redeemDelegation(del, sig);

        // Assert stored after successful redemption (confirms no revert, sig verified)
        Agent.Delegation memory stored = agent.getDelegation(delegator);
        assertEq(stored.delegator, delegator);
        assertEq(stored.salt, 1);
        assertEq(stored.expiration, del.expiration); // Verify full struct stored
    }

    function testRedeemDelegation_RevertsInvalidSig() public {
        address delegator = address(0xABC);
        Agent.Caveat[] memory caveats = new Agent.Caveat[](1);
        caveats[0] = Agent.Caveat({enforcer: address(0xDEF), data: abi.encode(50)});

        Agent.Delegation memory del = Agent.Delegation({
            delegator: delegator,
            delegatee: address(agent),
            authority: keccak256(abi.encode("root")),
            caveats: caveats,
            salt: 1,
            expiration: block.timestamp + 1 days
        });

        // Invalid sig (wrong private key)
        bytes32 payloadHash = keccak256(abi.encode(del));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        uint256 wrongKey = 0x456;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(address(0x1234567890123456789012345678901234567890));
        vm.expectRevert("Invalid signature");
        agent.redeemDelegation(del, sig);
    }

    function testRedeemDelegation_RevertsExpired() public {
        address delegator = address(0xABC);
        Agent.Caveat[] memory caveats = new Agent.Caveat[](0); // Empty for simple

        Agent.Delegation memory del = Agent.Delegation({
            delegator: delegator,
            delegatee: address(agent),
            authority: keccak256(abi.encode("root")),
            caveats: caveats,
            salt: 1,
            expiration: block.timestamp - 1 // Expired
        });

        // Mock valid sig but expired
        bytes32 payloadHash = keccak256(abi.encode(del));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        uint256 privateKey = 0x123;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(address(0x1234567890123456789012345678901234567890));
        vm.expectRevert("Delegation expired");
        agent.redeemDelegation(del, sig);
    }
}
