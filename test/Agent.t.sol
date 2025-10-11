// SPDX-License-Identifier: MIT

// test/Agent.t.sol
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Agent} from "../src/Agent.sol";
import {MockEndpoint} from "./MockEndpoint.sol";

contract AgentTest is Test {
    Agent public agent;

    address user1;
    address session1;
    address session2;

    MockEndpoint public mockEndpoint;

    function setUp() public {
        mockEndpoint = new MockEndpoint();  // Deploy mock endpoint.
        agent = new Agent(address(0), address(mockEndpoint)); // Dummy oracle/endpoint for non-bridging tests.

        user1 = address(0x123);
        session1 = address(0xABC);  
        session2 = address(0xDEF);
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

    // ============================================
    // DEPRECATED DELEGATION TESTS
    // These test the old manual delegation system
    // Kept for reference but no longer used in production
    // ============================================

    // function testStoreDelegation_SetsCorrectly() public {
    //     address delegator = address(0xABC);
    //     Agent.Caveat[] memory caveats = new Agent.Caveat[](1);
    //     caveats[0] = Agent.Caveat({enforcer: address(0xDEF), data: abi.encode(50)});

    //     Agent.Delegation memory del = Agent.Delegation({
    //         delegator: delegator,
    //         delegatee: address(agent),
    //         authority: keccak256(abi.encode("root")), // Proper hash for authority
    //         caveats: caveats,
    //         salt: 1,
    //         expiration: block.timestamp + 1 days
    //     });

    //     agent._setDelegation(delegator, del); // Use setter for assignment

    //     Agent.Delegation memory stored = agent.getDelegation(delegator); // Use explicit getter
    //     assertEq(stored.delegator, delegator);
    //     assertEq(stored.delegatee, address(agent));
    //     assertEq(stored.caveats[0].enforcer, address(0xDEF));
    //     assertEq(stored.salt, 1);
    // }

    // function testStoreDelegation_DefaultsToEmpty() public view {
    //     address unset = address(0x999);
    //     Agent.Delegation memory del = agent.getDelegation(unset); // Use explicit getter
    //     assertEq(del.delegator, address(0)); // Defaults to zero/empty
    //     assertEq(del.caveats.length, 0);
    // }

    // function testRedeemDelegation_StoresAndVerifies() public {
    //     uint256 privateKey = 0x123; // Mock private key
    //     address delegator = vm.addr(privateKey); // Derive delegator from key for sig match
    //     Agent.Caveat[] memory caveats = new Agent.Caveat[](0); // Empty array to simplify ABI encoding for hash match

    //     Agent.Delegation memory del = Agent.Delegation({
    //         delegator: delegator, // Matches derived address
    //         delegatee: address(agent),
    //         authority: keccak256(abi.encodePacked("root")), // Fixed bytes32 hash for consistency
    //         caveats: caveats,
    //         salt: 1,
    //         expiration: block.timestamp + 1 days
    //     });

    //     // Mock signature from delegator on payload hash (matches contract's abi.encode)
    //     bytes32 payloadHash = keccak256(abi.encode(del));
    //     bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
    //     (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethHash);
    //     bytes memory sig = abi.encodePacked(r, s, v);

    //     // Expect event before call (single check to avoid log mismatch)
    //     vm.expectEmit(true, true, false, true);
    //     emit Agent.DelegationRedeemed(delegator, address(agent), del.authority); // Qualified for test context

    //     // Prank as frontend caller to redeem
    //     vm.prank(address(0x1234567890123456789012345678901234567890));
    //     agent.redeemDelegation(del, sig);

    //     // Assert stored after successful redemption (confirms no revert, sig verified)
    //     Agent.Delegation memory stored = agent.getDelegation(delegator);
    //     assertEq(stored.delegator, delegator);
    //     assertEq(stored.salt, 1);
    //     assertEq(stored.expiration, del.expiration); // Verify full struct stored
    // }

    // function testRedeemDelegation_RevertsInvalidSig() public {
    //     address delegator = address(0xABC);
    //     Agent.Caveat[] memory caveats = new Agent.Caveat[](1);
    //     caveats[0] = Agent.Caveat({enforcer: address(0xDEF), data: abi.encode(50)});

    //     Agent.Delegation memory del = Agent.Delegation({
    //         delegator: delegator,
    //         delegatee: address(agent),
    //         authority: keccak256(abi.encode("root")),
    //         caveats: caveats,
    //         salt: 1,
    //         expiration: block.timestamp + 1 days
    //     });

    //     // Invalid sig (wrong private key)
    //     bytes32 payloadHash = keccak256(abi.encode(del));
    //     bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
    //     uint256 wrongKey = 0x456;
    //     (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
    //     bytes memory sig = abi.encodePacked(r, s, v);

    //     vm.prank(address(0x1234567890123456789012345678901234567890));
    //     vm.expectRevert("Invalid signature");
    //     agent.redeemDelegation(del, sig);
    // }

    // function testRedeemDelegation_RevertsExpired() public {
    //     address delegator = address(0xABC);
    //     Agent.Caveat[] memory caveats = new Agent.Caveat[](0); // Empty for simple

    //     Agent.Delegation memory del = Agent.Delegation({
    //         delegator: delegator,
    //         delegatee: address(agent),
    //         authority: keccak256(abi.encode("root")),
    //         caveats: caveats,
    //         salt: 1,
    //         expiration: block.timestamp - 1 // Expired
    //     });

    //     // Mock valid sig but expired
    //     bytes32 payloadHash = keccak256(abi.encode(del));
    //     bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
    //     uint256 privateKey = 0x123;
    //     (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethHash);
    //     bytes memory sig = abi.encodePacked(r, s, v);

    //     vm.prank(address(0x1234567890123456789012345678901234567890));
    //     vm.expectRevert("Delegation expired");
    //     agent.redeemDelegation(del, sig);
    // }

    // ============ SESSION AUTHORIZATION TESTS ============

    function testAuthorizeSession_Success() public {
        // User authorizes a session account
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // Verify session is authorized
        assertTrue(agent.isSessionAuthorized(user1, session1));
        
        // Verify timestamp was recorded
        assertGt(agent.sessionAuthorizedAt(user1, session1), 0);
    }

    function testAuthorizeSession_EmitsEvent() public {
        vm.prank(user1);
        
        // Expect event with correct parameters
        vm.expectEmit(true, true, false, true);
        emit Agent.SessionAuthorized(user1, session1, block.timestamp);
        
        agent.authorizeSession(session1);
    }

    function testAuthorizeSession_RevertsZeroAddress() public {
        vm.prank(user1);
        vm.expectRevert("Invalid session address");
        agent.authorizeSession(address(0));
    }

    function testAuthorizeSession_RevertsSelfAuthorization() public {
        vm.prank(user1);
        vm.expectRevert("Cannot authorize self as session");
        agent.authorizeSession(user1);  // Trying to authorize self
    }

    function testRevokeSession_Success() public {
        // First authorize
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // Then revoke
        vm.prank(user1);
        agent.revokeSession(session1);
        
        // Verify no longer authorized
        assertFalse(agent.isSessionAuthorized(user1, session1));
    }

    function testRevokeSession_RevertsIfNotAuthorized() public {
        vm.prank(user1);
        vm.expectRevert("Session not authorized");
        agent.revokeSession(session1);  // Never authorized
    }

    function testAuthorizeSession_MultipleSessionsPerUser() public {
        vm.startPrank(user1);
        
        // Authorize two different sessions
        agent.authorizeSession(session1);
        agent.authorizeSession(session2);
        
        vm.stopPrank();
        
        // Both should be authorized independently
        assertTrue(agent.isSessionAuthorized(user1, session1));
        assertTrue(agent.isSessionAuthorized(user1, session2));
    }

    function testIsSessionAuthorized_DefaultsFalse() public view {
        // Uninitialized session should return false
        assertFalse(agent.isSessionAuthorized(user1, session1));
    }

    // ============ HELPER FUNCTION TESTS ============

    function testGetBridgeStatus_AllFalseForNewUser() public view {
        // Brand new user with no setup
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session1);
        
        assertFalse(hasThreshold, "Should have no threshold");
        assertFalse(isAuthorized, "Should not be authorized");
        assertFalse(shouldTrigger, "Should not trigger");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    function testGetBridgeStatus_WithThresholdOnly() public {
        // User sets threshold but no authorization
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session1);
        
        assertTrue(hasThreshold, "Should have threshold");
        assertFalse(isAuthorized, "Should not be authorized");
        assertTrue(shouldTrigger, "Should trigger (50 > 40)");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    function testGetBridgeStatus_WithAuthorizationOnly() public {
        // User authorizes but no threshold
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session1);
        
        assertFalse(hasThreshold, "Should have no threshold");
        assertTrue(isAuthorized, "Should be authorized");
        assertFalse(shouldTrigger, "Should not trigger (no threshold)");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    function testGetBridgeStatus_FullyConfigured() public {
        // User sets everything up correctly
        vm.startPrank(user1);
        agent.setGasThreshold(40);
        agent.authorizeSession(session1);
        vm.stopPrank();
        
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session1);
        
        assertTrue(hasThreshold, "Should have threshold");
        assertTrue(isAuthorized, "Should be authorized");
        assertTrue(shouldTrigger, "Should trigger (50 > 40)");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    function testGetBridgeStatus_HighThresholdNoTrigger() public {
        // User sets high threshold that won't trigger
        vm.startPrank(user1);
        agent.setGasThreshold(70); // Higher than mock gas of 50
        agent.authorizeSession(session1);
        vm.stopPrank();
        
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session1);
        
        assertTrue(hasThreshold, "Should have threshold");
        assertTrue(isAuthorized, "Should be authorized");
        assertFalse(shouldTrigger, "Should NOT trigger (50 < 70)");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    function testGetBridgeStatus_DifferentSessionsIndependent() public {
        // User authorizes session1 but checks session2
        vm.startPrank(user1);
        agent.setGasThreshold(40);
        agent.authorizeSession(session1);
        vm.stopPrank();
        
        // Check with session2 (not authorized)
        (bool hasThreshold, bool isAuthorized, bool shouldTrigger, uint256 currentGas) = 
            agent.getBridgeStatus(user1, session2);
        
        assertTrue(hasThreshold, "Should have threshold");
        assertFalse(isAuthorized, "Session2 should NOT be authorized");
        assertTrue(shouldTrigger, "Should trigger (gas check independent)");
        assertEq(currentGas, 50, "Should return mock gas");
    }

    // ============ BRIDGE WITH SESSION AUTH TESTS ============

    function testCheckGasAndBridge_RevertsUnauthorizedSession() public {
        // Setup: User sets threshold
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        // Fund the SESSION account, not the test contract
        vm.deal(session1, 1 ether);
        
        // Try to bridge from unauthorized session
        vm.prank(session1); // Not authorized yet
        vm.expectRevert("Caller not authorized session");
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
    }

    function testCheckGasAndBridge_SucceedsWithAuthorization() public {
        // Setup: Threshold + authorization
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // NEW: User deposits funds for bridging
        vm.deal(user1, 1 ether); // Give user1 some ETH
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}(); // Deposit 0.5 ETH
        
        // Fund the SESSION account (for LZ fees)
        vm.deal(session1, 1 ether);
        
        // Expect events in the ORDER they will be emitted
        // MockLzSend comes FIRST (from the endpoint call)
        vm.expectEmit(true, false, false, true);
        emit MockEndpoint.MockLzSend(40204, abi.encode(user1, 0.1 ether, block.timestamp, "BRIDGE_TO_MONAD"), "");
        
        // BridgeInitiated comes SECOND (from the agent contract)
        vm.expectEmit(true, true, false, true);
        emit Agent.BridgeInitiated(user1, 40204, 0.1 ether, 0.01 ether); // Changed to 0.1 ETH
        
        // Bridge as authorized session
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        
        // NEW: Verify deposit was deducted
        assertEq(agent.getDeposit(user1), 0.4 ether, "Deposit should be reduced by 0.1 ETH");
    }

    function testCheckGasAndBridge_RevertsAfterRevocation() public {
        // Setup: Authorize then revoke
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        vm.prank(user1);
        agent.revokeSession(session1);
        
        // Fund SESSION account
        vm.deal(session1, 1 ether);
        
        // Try to bridge after revocation
        vm.prank(session1);
        vm.expectRevert("Caller not authorized session");
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
    }

    function testCheckGasAndBridge_SessionCanBridgeForCorrectUser() public {
        address user2 = address(0x456);
        
        // User1 authorizes session1
        vm.prank(user1);
        agent.setGasThreshold(40);
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // User2 sets their threshold but does NOT authorize session1
        vm.prank(user2);
        agent.setGasThreshold(40);
        
        // Fund SESSION account
        vm.deal(session1, 1 ether);
        
        // Session1 should NOT be able to bridge for user2
        vm.prank(session1);
        vm.expectRevert("Caller not authorized session");
        agent.checkGasAndBridge{value: 0.01 ether}(user2);
    }

    function testCheckGasAndBridge_RevertsNoTrigger() public {
        // Setup: High threshold (won't trigger with mock gas of 50)
        vm.prank(user1);
        agent.setGasThreshold(70);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // Fund SESSION account
        vm.deal(session1, 1 ether);
        
        // Should revert because gas is below threshold
        vm.prank(session1);
        vm.expectRevert("No trigger: gas below threshold");
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
    }

    function testCheckGasAndBridge_RevertsInsufficientFee() public {
        // Setup authorized bridge
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // Fund SESSION account
        vm.deal(session1, 1 ether);
        
        // Try to bridge with too little value (mock requires 0.01 ETH)
        vm.prank(session1);
        vm.expectRevert("Insufficient deposit for bridge");
        agent.checkGasAndBridge{value: 0.005 ether}(user1); // Only half
    }

    // ============ DEPOSIT SYSTEM TESTS ============

    function testDeposit_Success() public {
        // Give user1 some ETH to deposit
        vm.deal(user1, 1 ether);
        
        // User deposits 0.5 ETH
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        
        // Check deposit was recorded
        assertEq(agent.getDeposit(user1), 0.5 ether, "Deposit should be 0.5 ETH");
    }

    function testDeposit_EmitsEvent() public {
        vm.deal(user1, 1 ether);
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit Agent.Deposited(user1, 0.3 ether, 0.3 ether);
        
        agent.deposit{value: 0.3 ether}();
    }

    function testDeposit_MultipleDeposits() public {
        vm.deal(user1, 2 ether);
        
        // First deposit
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        assertEq(agent.getDeposit(user1), 0.5 ether);
        
        // Second deposit (should accumulate)
        vm.prank(user1);
        agent.deposit{value: 0.3 ether}();
        assertEq(agent.getDeposit(user1), 0.8 ether, "Should accumulate to 0.8 ETH");
    }

    function testDeposit_RevertsOnZero() public {
        vm.prank(user1);
        vm.expectRevert("Must deposit at least some ETH");
        agent.deposit{value: 0}();
    }

    function testWithdraw_Success() public {
        // Setup: User deposits first
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        
        // Withdraw 0.3 ETH
        uint256 balanceBefore = user1.balance;
        
        vm.prank(user1);
        agent.withdraw(0.3 ether);
        
        // Check deposit was reduced
        assertEq(agent.getDeposit(user1), 0.2 ether, "Deposit should be 0.2 ETH");
        
        // Check user received the ETH
        assertEq(user1.balance, balanceBefore + 0.3 ether, "User should receive 0.3 ETH");
    }

    function testWithdraw_EmitsEvent() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit Agent.Withdrawn(user1, 0.2 ether, 0.3 ether); // Withdrawn 0.2, balance now 0.3
        
        agent.withdraw(0.2 ether);
    }

    function testWithdraw_RevertsOnZero() public {
        vm.prank(user1);
        vm.expectRevert("Must withdraw something");
        agent.withdraw(0);
    }

    function testWithdraw_RevertsInsufficientBalance() public {
        // User tries to withdraw without depositing
        vm.prank(user1);
        vm.expectRevert("Insufficient deposit balance");
        agent.withdraw(1 ether);
    }

    function testWithdraw_RevertsOverdraw() public {
        // User deposits 0.5 ETH but tries to withdraw 1 ETH
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        
        vm.prank(user1);
        vm.expectRevert("Insufficient deposit balance");
        agent.withdraw(1 ether);
    }

    function testCheckGasAndBridge_RevertsInsufficientDeposit() public {
        // Setup authorized session but NO deposit
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        vm.deal(session1, 1 ether);
        
        // Should revert because user hasn't deposited
        vm.prank(session1);
        vm.expectRevert("Insufficient deposit for bridge");
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
    }

    function testCheckGasAndBridge_DeductsDeposit() public {
        // Setup with deposit
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        agent.deposit{value: 1 ether}();
        
        vm.deal(session1, 1 ether);
        
        // Bridge 0.1 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        
        // Verify deposit reduced by 0.1 ETH
        assertEq(agent.getDeposit(user1), 0.9 ether, "Deposit should be 0.9 ETH after bridge");
    }

    function testCheckGasAndBridge_MultipleBridges() public {
        // Setup
        vm.prank(user1);
        agent.setGasThreshold(40);
        
        vm.prank(user1);
        agent.authorizeSession(session1);
        
        // Deposit 0.5 ETH
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        agent.deposit{value: 0.5 ether}();
        
        vm.deal(session1, 1 ether);
        
        // First bridge: 0.5 -> 0.4 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        assertEq(agent.getDeposit(user1), 0.4 ether);
        
        // Second bridge: 0.4 -> 0.3 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        assertEq(agent.getDeposit(user1), 0.3 ether);
        
        // Third bridge: 0.3 -> 0.2 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        assertEq(agent.getDeposit(user1), 0.2 ether);
        
        // Fourth bridge: 0.2 -> 0.1 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        assertEq(agent.getDeposit(user1), 0.1 ether);
        
        // Fifth bridge: 0.1 -> 0 ETH
        vm.prank(session1);
        agent.checkGasAndBridge{value: 0.01 ether}(user1);
        assertEq(agent.getDeposit(user1), 0, "Should be fully depleted");
    }

    function testGetDeposit_DefaultsToZero() public view {
        // User who never deposited should have 0 balance
        assertEq(agent.getDeposit(address(0x999)), 0);
    }
}
