// SPDX-License-Identifier: MIT

// test/Agent.t.sol
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Agent} from "../src/Agent.sol";
import {MockEndpoint} from "./MockEndpoint.sol";

contract AgentTest is Test {
    Agent public agent;

    MockEndpoint public mockEndpoint;

    function setUp() public {
        mockEndpoint = new MockEndpoint();  // Deploy mock endpoint.
        agent = new Agent(address(0), address(mockEndpoint)); // Dummy oracle/endpoint for non-bridging tests.
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

    function testCheckGasAndBridge_RevertsNoTrigger() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(70); // Set 70 gwei threshold

        // Sim low gas (mock 50 <  70 → no trigger)
        // Assume mock in checkGas returns 50, call expects revert.
        vm.expectRevert("No trigger: gas below threshold");
        agent.checkGasAndBridge{value: 0}(user); // Call with zero value (payable ok). 
    }

    // Test 1: No delegation—expect revert (no perm stored).
    function testCheckGasAndBridge_RevertsNoDelegation() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(40);  // Low threshold for trigger sim.

        // Sim high gas (80 >40 → trigger true).
        // Assume mock in checkGas returns 80—passes trigger, but no delegation.
        vm.expectRevert("Not delegator");
        agent.checkGasAndBridge{value: 0}(user);  // Call payable with 0 value.
    }

    // Test 2: Active delegation—passes (no revert).
    function testCheckGasAndBridge_PassesWithActiveDelegation() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(40);  // Low threshold for trigger.

        // Sim high gas (80 >40).
        // Assume mock 80 gwei—trigger true.

        // Set active delegation (sim Phase 2 redeem).
        Agent.Delegation memory del = Agent.Delegation({
            delegator: user,
            delegatee: address(agent),
            authority: bytes32(0),
            caveats: new Agent.Caveat[](0),
            salt: 1,
            expiration: block.timestamp + 1 days  // Active for 1 day.
        });
        vm.prank(user);
        agent.redeemDelegationSimple(del);  // Store delegation.

        // Call—passes (no revert, checks delegator/expiration ok).
        agent.checkGasAndBridge{value: 0.01 ether}(user);
    }

    // Test 3: Expired delegation—revert.
    function testCheckGasAndBridge_RevertsExpiredDelegation() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(40);  // Low threshold for trigger sim.

        // Sim high gas (80 >40 → trigger true).
        // Assume mock in checkGas returns 80.

        // Set expired delegation (use _setDelegation to bypass redeemSimple check).
        Agent.Delegation memory del = Agent.Delegation({
            delegator: user,
            delegatee: address(agent),
            authority: bytes32(0),
            caveats: new Agent.Caveat[](0),
            salt: 1,
            expiration: block.timestamp - 1  // Expired.
        });
        agent._setDelegation(user, del);  // Direct store for test (temp fn from Phase 2).

        vm.expectRevert("No active delegation");
        agent.checkGasAndBridge{value: 0}(user);
    }

    // Test lzSend call—expects endpoint called with correct dstEid/payload/options when checks pass.
    function testCheckGasAndBridge_CallsLzSendOnTrigger() public {
        address user = address(0x123);
        
        // Setup: Set threshold and delegation
        vm.prank(user);
        agent.setGasThreshold(40);

        Agent.Delegation memory del = Agent.Delegation({
            delegator: user,
            delegatee: address(agent),
            authority: bytes32(0),
            caveats: new Agent.Caveat[](0),
            salt: 1,
            expiration: block.timestamp + 1 days
        });
        
        vm.prank(user);
        agent.redeemDelegationSimple(del);

        // Expect BOTH events now
        vm.expectEmit(true, true, true, true);
        emit MockEndpoint.MockLzSend(40204, abi.encode(user, 1 ether, block.timestamp, "BRIDGE_TO_MONAD"), "");

        vm.expectEmit(true, true, false, true);
        emit Agent.BridgeInitiated(user, 40204, 1 ether, 0.01 ether);

        // Execute the function
        agent.checkGasAndBridge{value: 0.01 ether}(user);
    }

    // Test fee quote and require—revert if msg.value < nativeFee, pass if enough.
    function testCheckGasAndBridge_RevertsInsufficientFee() public {
        address user = address(0x123);
        vm.prank(user);
        agent.setGasThreshold(40);  // Low threshold for trigger.

        // Sim high gas (80 >40 → trigger true).
        // Assume mock 80 gwei.

        // Set active delegation.
        Agent.Delegation memory del = Agent.Delegation({
            delegator: user,
            delegatee: address(agent),
            authority: bytes32(0),
            caveats: new Agent.Caveat[](0),
            salt: 1,
            expiration: block.timestamp + 1 days
        });
        vm.prank(user);
        agent.redeemDelegationSimple(del);

        // Case 1: Low value < nativeFee (0.01 ether from mock)—expect revert.
        vm.expectRevert("Insufficient fee");
        agent.checkGasAndBridge{value: 0.005 ether}(user);  // Half fee—reverts at require.

        // Case 2: Enough value >= nativeFee—passes (no revert, calls lzSend).
        agent.checkGasAndBridge{value: 0.01 ether}(user);  // Matches mock quote—succeeds.
    }
}
