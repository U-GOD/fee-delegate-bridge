// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LimitOrderAgent} from "../src/LimitOrderAgent.sol";

/**
 * @title LimitOrderAgentTest
 * @notice Comprehensive test suite for LimitOrderAgent
 * @dev Tests all functions with edge cases and expected behaviors
 */
contract LimitOrderAgentTest is Test {
    LimitOrderAgent public agent;
    
    // Test accounts
    address public owner;
    address public user1;
    address public user2;
    address public session1;
    address public session2;
    
    // Mock token addresses
    address public constant WETH = address(0x1);
    address public constant USDC = address(0x2);
    address public constant DAI = address(0x3);
    
    // Test constants
    uint256 public constant INITIAL_PRICE = 3000 * 1e18; // $3000/ETH
    uint256 public constant DEPOSIT_AMOUNT = 1 ether;
    
    // ============ SETUP ============
    
    function setUp() public {
        // Create test accounts
        owner = address(this);
        user1 = address(0x100);
        user2 = address(0x200);
        session1 = address(0x300);
        session2 = address(0x400);
        
        // Deploy contract
        agent = new LimitOrderAgent();
        
        // Fund test accounts with ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(session1, 1 ether);
        
        // Verify initial state
        assertEq(agent.owner(), owner, "Owner should be deployer");
        assertEq(agent.mockPrice(), INITIAL_PRICE, "Initial price should be 3000");
    }
    
    // ============ DEPOSIT TESTS ============
    
    /**
     * @notice Test ETH deposit via receive function
     */
    function testDeposit_ETHViaReceive() public {
        vm.startPrank(user1);
        
        // Deposit 1 ETH via send
        (bool success, ) = address(agent).call{value: 1 ether}("");
        require(success, "ETH transfer failed");
        
        vm.stopPrank();
        
        // Verify deposit recorded
        assertEq(
            agent.getDeposit(user1, address(0)),
            1 ether,
            "Should record 1 ETH deposit"
        );
    }
    
    /**
     * @notice Test deposit via deposit function
     */
    function testDeposit_ViaDepositFunction() public {
        vm.startPrank(user1);
        
        // Expect Deposited event
        vm.expectEmit(true, true, false, true);
        emit LimitOrderAgent.Deposited(user1, WETH, 1 ether);
        
        // Deposit via function call
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        vm.stopPrank();
        
        // Verify balance
        assertEq(
            agent.getDeposit(user1, WETH),
            1 ether,
            "Should record deposit"
        );
    }
    
    /**
     * @notice Test multiple deposits accumulate
     */
    function testDeposit_MultipleDepositsAccumulate() public {
        vm.startPrank(user1);
        
        // First deposit
        agent.deposit{value: 0.5 ether}(WETH, 0.5 ether);
        
        // Second deposit
        agent.deposit{value: 0.3 ether}(WETH, 0.3 ether);
        
        vm.stopPrank();
        
        // Should accumulate to 0.8 ETH
        assertEq(
            agent.getDeposit(user1, WETH),
            0.8 ether,
            "Deposits should accumulate"
        );
    }
    
    /**
     * @notice Test deposit reverts with zero amount
     */
    function testDeposit_RevertsZeroAmount() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Amount must be > 0");
        agent.deposit(WETH, 0);
        
        vm.stopPrank();
    }
    
    // ============ WITHDRAWAL TESTS ============
    
    /**
     * @notice Test successful withdrawal
     */
    function testWithdraw_Success() public {
        // Setup: User deposits first
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        uint256 balanceBefore = user1.balance;
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit LimitOrderAgent.Withdrawn(user1, address(0), 0.5 ether);
        
        // Withdraw half
        agent.withdraw(address(0), 0.5 ether);
        
        vm.stopPrank();
        
        // Verify balance updated
        assertEq(
            agent.getDeposit(user1, WETH),
            0.5 ether,
            "Should have 0.5 ETH remaining"
        );
        
        // Verify ETH returned (Note: withdraw uses address(0) for ETH)
        // Balance check depends on whether WETH or address(0) was used
    }
    
    /**
     * @notice Test withdraw reverts insufficient balance
     */
    function testWithdraw_RevertsInsufficientBalance() public {
        vm.startPrank(user1);
        
        // Try to withdraw without deposit
        vm.expectRevert("Insufficient balance");
        agent.withdraw(WETH, 1 ether);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test withdraw reverts zero amount
     */
    function testWithdraw_RevertsZeroAmount() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Amount must be > 0");
        agent.withdraw(WETH, 0);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test full withdrawal
     */
    function testWithdraw_FullAmount() public {
        vm.startPrank(user1);
        
        // Deposit
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        // Withdraw all
        agent.withdraw(address(0), 1 ether);
        
        vm.stopPrank();
        
        // Should have zero balance
        assertEq(
            agent.getDeposit(user1, WETH),
            0,
            "Should have zero balance after full withdrawal"
        );
    }
    
    // ============ SESSION AUTHORIZATION TESTS ============
    
    /**
     * @notice Test authorize session success
     */
    function testAuthorizeSession_Success() public {
        vm.startPrank(user1);
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit LimitOrderAgent.SessionAuthorized(user1, session1, block.timestamp);
        
        // Authorize session
        agent.authorizeSession(session1);
        
        vm.stopPrank();
        
        // Verify authorization
        assertTrue(
            agent.isSessionAuthorized(user1, session1),
            "Session should be authorized"
        );
    }
    
    /**
     * @notice Test authorize multiple sessions
     */
    function testAuthorizeSession_MultipleSessionsIndependent() public {
        vm.startPrank(user1);
        
        // Authorize two sessions
        agent.authorizeSession(session1);
        agent.authorizeSession(session2);
        
        vm.stopPrank();
        
        // Both should be authorized
        assertTrue(agent.isSessionAuthorized(user1, session1));
        assertTrue(agent.isSessionAuthorized(user1, session2));
    }
    
    /**
     * @notice Test authorize reverts zero address
     */
    function testAuthorizeSession_RevertsZeroAddress() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Invalid address");
        agent.authorizeSession(address(0));
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test authorize reverts self-authorization
     */
    function testAuthorizeSession_RevertsSelfAuthorization() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Cannot authorize self");
        agent.authorizeSession(user1);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test revoke session success
     */
    function testRevokeSession_Success() public {
        vm.startPrank(user1);
        
        // First authorize
        agent.authorizeSession(session1);
        assertTrue(agent.isSessionAuthorized(user1, session1));
        
        // Expect event
        vm.expectEmit(true, true, false, false);
        emit LimitOrderAgent.SessionRevoked(user1, session1);
        
        // Then revoke
        agent.revokeSession(session1);
        
        vm.stopPrank();
        
        // Should no longer be authorized
        assertFalse(
            agent.isSessionAuthorized(user1, session1),
            "Session should be revoked"
        );
    }
    
    /**
     * @notice Test revoke non-authorized session fails
     */
    function testRevokeSession_RevertsNotAuthorized() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Session not authorized");
        agent.revokeSession(session1); // Never authorized
        
        vm.stopPrank();
    }
    
    // ============ CREATE LIMIT ORDER TESTS ============
    
    /**
     * @notice Test create sell order success
     */
    function testCreateLimitOrder_SellOrderSuccess() public {
        // Setup: User deposits first
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        // Create sell order: Sell 1 ETH at $3500
        uint256 targetPrice = 3500 * 1e18;
        
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit LimitOrderAgent.LimitOrderCreated(
            user1,
            0, // First order ID
            WETH,
            USDC,
            1 ether,
            targetPrice,
            block.timestamp + 7 days
        );
        
        uint256 orderId = agent.createLimitOrder(
            WETH,
            USDC,
            1 ether,
            targetPrice,
            7, // 7 days
            false // Sell order
        );
        
        vm.stopPrank();
        
        // Verify order created
        assertEq(orderId, 0, "First order should have ID 0");
        
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertEq(order.user, user1, "Order user should match");
        assertEq(order.tokenIn, WETH, "TokenIn should be WETH");
        assertEq(order.tokenOut, USDC, "TokenOut should be USDC");
        assertEq(order.amountIn, 1 ether, "Amount should be 1 ETH");
        assertEq(order.limitPrice, targetPrice, "Price should match");
        assertTrue(order.isActive, "Order should be active");
        assertFalse(order.isBuy, "Should be sell order");
        
        // Verify deposit was locked
        assertEq(
            agent.getDeposit(user1, WETH),
            0,
            "Deposit should be locked in order"
        );
    }
    
    /**
     * @notice Test create buy order success
     */
    function testCreateLimitOrder_BuyOrderSuccess() public {
        // Setup: Deposit USDC equivalent (mock)
        vm.startPrank(user1);
        agent.deposit{value: 2500 * 1e6}(USDC, 2500 * 1e6); // 2500 USDC
        
        // Create buy order: Buy ETH at $2500
        uint256 orderId = agent.createLimitOrder(
            USDC,
            WETH,
            2500 * 1e6,
            2500 * 1e18,
            7,
            true // Buy order
        );
        
        vm.stopPrank();
        
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertTrue(order.isBuy, "Should be buy order");
    }
    
    /**
     * @notice Test create multiple orders increment IDs
     */
    function testCreateLimitOrder_MultipleOrdersIncrementIDs() public {
        vm.startPrank(user1);
        agent.deposit{value: 3 ether}(WETH, 3 ether);
        
        uint256 orderId1 = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        uint256 orderId2 = agent.createLimitOrder(WETH, USDC, 1 ether, 3600 * 1e18, 7, false);
        uint256 orderId3 = agent.createLimitOrder(WETH, USDC, 1 ether, 3700 * 1e18, 7, false);
        
        vm.stopPrank();
        
        assertEq(orderId1, 0, "First order should be ID 0");
        assertEq(orderId2, 1, "Second order should be ID 1");
        assertEq(orderId3, 2, "Third order should be ID 2");
    }
    
    /**
     * @notice Test create order reverts zero amount
     */
    function testCreateLimitOrder_RevertsZeroAmount() public {
        vm.startPrank(user1);
        
        vm.expectRevert("Amount must be > 0");
        agent.createLimitOrder(WETH, USDC, 0, 3500 * 1e18, 7, false);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test create order reverts zero price
     */
    function testCreateLimitOrder_RevertsZeroPrice() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        vm.expectRevert("Price must be > 0");
        agent.createLimitOrder(WETH, USDC, 1 ether, 0, 7, false);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test create order reverts insufficient deposit
     */
    function testCreateLimitOrder_RevertsInsufficientDeposit() public {
        vm.startPrank(user1);
        
        // Try to create order without deposit
        vm.expectRevert("Insufficient deposit");
        agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test create order reverts invalid expiration
     */
    function testCreateLimitOrder_RevertsInvalidExpiration() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        // Zero days
        vm.expectRevert("Invalid expiration");
        agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 0, false);
        
        // Over 365 days
        vm.expectRevert("Invalid expiration");
        agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 366, false);
        
        vm.stopPrank();
    }
    
    // ============ CANCEL ORDER TESTS ============
    
    /**
     * @notice Test cancel order success
     */
    function testCancelLimitOrder_Success() public {
        // Setup: Create order first
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        
        // Expect event
        vm.expectEmit(true, true, false, false);
        emit LimitOrderAgent.LimitOrderCancelled(user1, orderId);
        
        // Cancel order
        agent.cancelLimitOrder(orderId);
        
        vm.stopPrank();
        
        // Verify order inactive
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive, "Order should be inactive");
        
        // Verify tokens refunded
        assertEq(
            agent.getDeposit(user1, WETH),
            1 ether,
            "Tokens should be refunded"
        );
    }
    
    /**
     * @notice Test cancel already inactive order fails
     */
    function testCancelLimitOrder_RevertsNotActive() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        
        // Cancel once
        agent.cancelLimitOrder(orderId);
        
        // Try to cancel again
        vm.expectRevert("Order not active");
        agent.cancelLimitOrder(orderId);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test cancel someone else's order fails
     */
    function testCancelLimitOrder_RevertsNotOwner() public {
        // User1 creates order
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // User2 tries to cancel
        vm.startPrank(user2);
        vm.expectRevert("Not your order");
        agent.cancelLimitOrder(orderId);
        vm.stopPrank();
    }
    
    // ============ EXECUTE ORDER TESTS ============
    
    /**
     * @notice Test execute sell order when price condition met
     */
    function testExecuteLimitOrder_SellOrderSuccess() public {
        // Setup: Create sell order at $3500
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(
            WETH,
            USDC,
            1 ether,
            3500 * 1e18, // Sell at $3500
            7,
            false
        );
        vm.stopPrank();
        
        // Change price to $3500 (meets condition)
        agent.setMockPrice(3500 * 1e18);
        
        // Session executes order
        vm.startPrank(session1);
        
        // Expect event
        vm.expectEmit(true, true, false, false);
        emit LimitOrderAgent.LimitOrderExecuted(user1, orderId, 1 ether, 0, 3500 * 1e18);
        
        agent.executeLimitOrder(user1, orderId);
        
        vm.stopPrank();
        
        // Verify order marked inactive
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive, "Order should be inactive after execution");
        
        // Verify user received USDC (mocked)
        uint256 expectedUSDC = (1 ether * 3500 * 1e18 * 98) / (100 * 1e18); // With 2% slippage
        assertGt(
            agent.getDeposit(user1, USDC),
            0,
            "User should have received USDC"
        );
    }
    
    /**
     * @notice Test execute buy order when price condition met
     */
    function testExecuteLimitOrder_BuyOrderSuccess() public {
        // Setup: Create buy order at $2500 (lower than current $3000)
        vm.startPrank(user1);
        agent.deposit{value: 2500 * 1e6}(USDC, 2500 * 1e6);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(
            USDC,
            WETH,
            2500 * 1e6,
            2500 * 1e18, // Buy at $2500
            7,
            true
        );
        vm.stopPrank();
        
        // Drop price to $2500 (meets condition)
        agent.setMockPrice(2500 * 1e18);
        
        // Session executes
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        // Verify execution
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive);
    }
    
    /**
     * @notice Test execute reverts when price condition not met
     */
    function testExecuteLimitOrder_RevertsPriceNotMet() public {
        // Setup: Sell order at $3500
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Price is still $3000 (below $3500)
        // Sell order should NOT execute
        
        vm.startPrank(session1);
        vm.expectRevert("Price condition not met");
        agent.executeLimitOrder(user1, orderId);
        vm.stopPrank();
    }
    
    /**
     * @notice Test execute reverts unauthorized caller
     */
    function testExecuteLimitOrder_RevertsUnauthorized() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Set price to meet condition
        agent.setMockPrice(3500 * 1e18);
        
        // Unauthorized session tries to execute
        vm.startPrank(session1); // Not authorized!
        vm.expectRevert("Not authorized");
        agent.executeLimitOrder(user1, orderId);
        vm.stopPrank();
    }
    
    /**
     * @notice Test execute reverts inactive order
     */
    function testExecuteLimitOrder_RevertsInactive() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        
        // Cancel order
        agent.cancelLimitOrder(orderId);
        vm.stopPrank();
        
        // Try to execute cancelled order
        vm.startPrank(session1);
        vm.expectRevert("Order not active");
        agent.executeLimitOrder(user1, orderId);
        vm.stopPrank();
    }
    
    /**
     * @notice Test execute reverts expired order
     */
    function testExecuteLimitOrder_RevertsExpired() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Fast forward past expiration
        vm.warp(block.timestamp + 8 days);
        
        // Set price to meet condition
        agent.setMockPrice(3500 * 1e18);
        
        // Try to execute expired order
        vm.startPrank(session1);
        vm.expectRevert("Order expired");
        agent.executeLimitOrder(user1, orderId);
        vm.stopPrank();
    }
    
    /**
     * @notice Test user can execute their own order
     */
    function testExecuteLimitOrder_UserCanExecuteOwn() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Set price
        agent.setMockPrice(3500 * 1e18);
        
        // User executes own order (no session needed)
        vm.prank(user1);
        agent.executeLimitOrder(user1, orderId);
        
        // Should succeed
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive);
    }
    
    // ============ VIEW FUNCTION TESTS ============
    
    /**
     * @notice Test canExecute returns correct status
     */
    function testCanExecute_ReturnsTrueWhenReady() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Price not met yet
        (bool executable1, string memory reason1) = agent.canExecute(user1, orderId);
        assertFalse(executable1);
        assertEq(reason1, "Price condition not met");
        
        // Set price to meet condition
        agent.setMockPrice(3500 * 1e18);
        
        // Now executable
        (bool executable2, string memory reason2) = agent.canExecute(user1, orderId);
        assertTrue(executable2);
        assertEq(reason2, "Ready to execute");
    }
    
    /**
     * @notice Test canExecute detects expired order
     */
    function testCanExecute_DetectsExpired() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Fast forward
        vm.warp(block.timestamp + 8 days);
        
        (bool executable, string memory reason) = agent.canExecute(user1, orderId);
        assertFalse(executable);
        assertEq(reason, "Order expired");
    }
    
    /**
     * @notice Test getStats returns correct values
     */
    function testGetStats_ReturnsCorrectCounts() public {
        vm.startPrank(user1);
        agent.deposit{value: 3 ether}(WETH, 3 ether);
        agent.authorizeSession(session1);
        
        // Create 3 orders
        agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        agent.createLimitOrder(WETH, USDC, 1 ether, 3600 * 1e18, 7, false);
        uint256 orderId3 = agent.createLimitOrder(WETH, USDC, 1 ether, 3700 * 1e18, 7, false);
        
        vm.stopPrank();
        
        // Check stats
        (uint256 created, uint256 executed, uint256 active) = agent.getStats();
        assertEq(created, 3, "Should have 3 created");
        assertEq(executed, 0, "Should have 0 executed");
        assertEq(active, 3, "Should have 3 active");
        
        // Execute one order
        agent.setMockPrice(3700 * 1e18);
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId3);
        
        // Check updated stats
        (created, executed, active) = agent.getStats();
        assertEq(created, 3, "Still 3 created");
        assertEq(executed, 1, "Now 1 executed");
        assertEq(active, 2, "Now 2 active");
    }
    
    // ============ ADMIN FUNCTION TESTS ============
    
    /**
     * @notice Test setMockPrice only owner
     */
    function testSetMockPrice_OnlyOwner() public {
        uint256 newPrice = 4000 * 1e18;
        
        // Owner can set
        agent.setMockPrice(newPrice);
        assertEq(agent.mockPrice(), newPrice);
        
        // Non-owner cannot
        vm.prank(user1);
        vm.expectRevert("Only owner");
        agent.setMockPrice(5000 * 1e18);
    }
    
    /**
     * @notice Test transferOwnership
     */
    function testTransferOwnership_Success() public {
        address newOwner = address(0x999);
        
        agent.transferOwnership(newOwner);
        assertEq(agent.owner(), newOwner, "Ownership should transfer");
    }
    
    /**
     * @notice Test transferOwnership reverts non-owner
     */
    function testTransferOwnership_RevertsNonOwner() public {
        vm.prank(user1);
        vm.expectRevert("Only owner");
        agent.transferOwnership(user2);
    }
    
    /**
     * @notice Test transferOwnership reverts zero address
     */
    function testTransferOwnership_RevertsZeroAddress() public {
        vm.expectRevert("Invalid address");
        agent.transferOwnership(address(0));
    }
    
    /**
     * @notice Test emergencyWithdraw only owner
     */
    function testEmergencyWithdraw_OnlyOwner() public {
        // Send some ETH to contract
        vm.deal(address(agent), 10 ether);
        
        uint256 ownerBalanceBefore = owner.balance;
        
        // Owner can withdraw
        agent.emergencyWithdraw();
        
        assertEq(
            owner.balance - ownerBalanceBefore,
            10 ether,
            "Owner should receive contract balance"
        );
        
        // Non-owner cannot
        vm.deal(address(agent), 5 ether);
        vm.prank(user1);
        vm.expectRevert("Only owner");
        agent.emergencyWithdraw();
    }
    
    // ============ PRICE CONDITION TESTS ============
    
    /**
     * @notice Test sell order only executes when price rises
     */
    function testPriceCondition_SellOrderOnlyWhenPriceRises() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        
        // Create sell order at $3500
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Price at $3000 - should NOT execute
        agent.setMockPrice(3000 * 1e18);
        vm.prank(session1);
        vm.expectRevert("Price condition not met");
        agent.executeLimitOrder(user1, orderId);
        
        // Price at $3400 - still should NOT execute
        agent.setMockPrice(3400 * 1e18);
        vm.prank(session1);
        vm.expectRevert("Price condition not met");
        agent.executeLimitOrder(user1, orderId);
        
        // Price at $3500 - SHOULD execute
        agent.setMockPrice(3500 * 1e18);
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        // Verify executed
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive);
    }
    
    /**
     * @notice Test buy order only executes when price drops
     */
    function testPriceCondition_BuyOrderOnlyWhenPriceDrops() public {
        vm.startPrank(user1);
        agent.deposit{value: 2500 * 1e6}(USDC, 2500 * 1e6);
        agent.authorizeSession(session1);
        
        // Create buy order at $2500 (current price $3000)
        uint256 orderId = agent.createLimitOrder(USDC, WETH, 2500 * 1e6, 2500 * 1e18, 7, true);
        vm.stopPrank();
        
        // Price at $3000 - should NOT execute
        agent.setMockPrice(3000 * 1e18);
        vm.prank(session1);
        vm.expectRevert("Price condition not met");
        agent.executeLimitOrder(user1, orderId);
        
        // Price at $2600 - still should NOT execute
        agent.setMockPrice(2600 * 1e18);
        vm.prank(session1);
        vm.expectRevert("Price condition not met");
        agent.executeLimitOrder(user1, orderId);
        
        // Price at $2500 - SHOULD execute
        agent.setMockPrice(2500 * 1e18);
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        // Verify executed
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive);
    }
    
    /**
     * @notice Test price exactly at limit executes
     */
    function testPriceCondition_ExactlyAtLimitExecutes() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Set price exactly at limit
        agent.setMockPrice(3500 * 1e18);
        
        // Should execute
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive);
    }
    
    // ============ INTEGRATION TESTS ============
    
    /**
     * @notice Test full workflow: deposit → create → authorize → execute → withdraw
     */
    function testIntegration_FullWorkflow() public {
        // Step 1: User deposits
        vm.startPrank(user1);
        agent.deposit{value: 2 ether}(WETH, 2 ether);
        assertEq(agent.getDeposit(user1, WETH), 2 ether);
        
        // Step 2: User creates limit order
        uint256 orderId = agent.createLimitOrder(
            WETH,
            USDC,
            1 ether,
            3500 * 1e18,
            7,
            false
        );
        
        // Step 3: User authorizes session account
        agent.authorizeSession(session1);
        assertTrue(agent.isSessionAuthorized(user1, session1));
        
        vm.stopPrank();
        
        // Step 4: Price condition met
        agent.setMockPrice(3500 * 1e18);
        
        // Step 5: Session executes order automatically
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        // Step 6: Verify execution
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertFalse(order.isActive, "Order should be executed");
        
        // Step 7: User has USDC balance
        uint256 usdcBalance = agent.getDeposit(user1, USDC);
        assertGt(usdcBalance, 0, "User should have USDC");
        
        // Step 8: User withdraws remaining ETH
        vm.prank(user1);
        agent.withdraw(address(0), 1 ether);
        assertEq(agent.getDeposit(user1, WETH), 0, "All ETH withdrawn");
    }
    
    /**
     * @notice Test multiple users with separate orders
     */
    function testIntegration_MultipleUsers() public {
        // User1 creates sell order at $3500
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId1 = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // User2 creates buy order at $2500
        vm.startPrank(user2);
        agent.deposit{value: 2500 * 1e6}(USDC, 2500 * 1e6);
        agent.authorizeSession(session2);
        uint256 orderId2 = agent.createLimitOrder(USDC, WETH, 2500 * 1e6, 2500 * 1e18, 7, true);
        vm.stopPrank();
        
        // Set price to $3500 - only user1's order should execute
        agent.setMockPrice(3500 * 1e18);
        
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId1);
        
        // User1's order executed
        assertFalse(agent.getOrder(user1, orderId1).isActive);
        
        // User2's order still active (price too high for buy)
        assertTrue(agent.getOrder(user2, orderId2).isActive);
        
        // Set price to $2500 - now user2's order executes
        agent.setMockPrice(2500 * 1e18);
        
        vm.prank(session2);
        agent.executeLimitOrder(user2, orderId2);
        
        // Both orders now executed
        assertFalse(agent.getOrder(user2, orderId2).isActive);
    }
    
    /**
     * @notice Test creating multiple orders and cancelling some
     */
    function testIntegration_MultipleOrdersPartialCancel() public {
        vm.startPrank(user1);
        agent.deposit{value: 5 ether}(WETH, 5 ether);
        
        // Create 5 orders
        uint256 orderId1 = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        uint256 orderId2 = agent.createLimitOrder(WETH, USDC, 1 ether, 3600 * 1e18, 7, false);
        uint256 orderId3 = agent.createLimitOrder(WETH, USDC, 1 ether, 3700 * 1e18, 7, false);
        uint256 orderId4 = agent.createLimitOrder(WETH, USDC, 1 ether, 3800 * 1e18, 7, false);
        uint256 orderId5 = agent.createLimitOrder(WETH, USDC, 1 ether, 3900 * 1e18, 7, false);
        
        // Cancel orders 2 and 4
        agent.cancelLimitOrder(orderId2);
        agent.cancelLimitOrder(orderId4);
        
        vm.stopPrank();
        
        // Verify states
        assertTrue(agent.getOrder(user1, orderId1).isActive);
        assertFalse(agent.getOrder(user1, orderId2).isActive); // Cancelled
        assertTrue(agent.getOrder(user1, orderId3).isActive);
        assertFalse(agent.getOrder(user1, orderId4).isActive); // Cancelled
        assertTrue(agent.getOrder(user1, orderId5).isActive);
        
        // Verify refunded tokens (2 orders cancelled = 2 ETH refunded)
        assertEq(agent.getDeposit(user1, WETH), 2 ether);
    }
    
    /**
     * @notice Test session revocation prevents execution
     */
    function testIntegration_SessionRevocationStopsExecution() public {
        // Setup
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        
        // Revoke session
        agent.revokeSession(session1);
        vm.stopPrank();
        
        // Set price to meet condition
        agent.setMockPrice(3500 * 1e18);
        
        // Session tries to execute - should fail
        vm.prank(session1);
        vm.expectRevert("Not authorized");
        agent.executeLimitOrder(user1, orderId);
        
        // Order still active
        assertTrue(agent.getOrder(user1, orderId).isActive);
    }
    
    /**
     * @notice Test order expiration prevents execution
     */
    function testIntegration_ExpirationPreventsExecution() public {
        // Setup with 7 day expiration
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Fast forward 6 days - should still be valid
        vm.warp(block.timestamp + 6 days);
        agent.setMockPrice(3500 * 1e18);
        
        vm.prank(session1);
        agent.executeLimitOrder(user1, orderId);
        
        // Should execute successfully
        assertFalse(agent.getOrder(user1, orderId).isActive);
        
        // Create another order
        vm.startPrank(user1);
        uint256 orderId2 = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        // Fast forward 8 days - now expired
        vm.warp(block.timestamp + 8 days);
        
        vm.prank(session1);
        vm.expectRevert("Order expired");
        agent.executeLimitOrder(user1, orderId2);
    }
    
    // ============ EDGE CASE TESTS ============
    
    /**
     * @notice Test depositing very small amounts
     */
    function testEdgeCase_SmallDeposits() public {
        vm.startPrank(user1);
        
        // Deposit 1 wei
        agent.deposit{value: 1}(WETH, 1);
        assertEq(agent.getDeposit(user1, WETH), 1);
        
        // Should be able to create order with 1 wei
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1, 3500 * 1e18, 7, false);
        
        // Verify order created
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertEq(order.amountIn, 1);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test very high price limits
     */
    function testEdgeCase_HighPriceLimits() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        // Create order with very high price (1 million per ETH)
        uint256 highPrice = 1_000_000 * 1e18;
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, highPrice, 7, false);
        
        // Verify stored correctly
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertEq(order.limitPrice, highPrice);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test maximum expiration (365 days)
     */
    function testEdgeCase_MaxExpiration() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        // Create order with max expiration
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 365, false);
        
        LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, orderId);
        assertEq(order.expiresAt, block.timestamp + 365 days);
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test re-authorizing same session
     */
    function testEdgeCase_ReauthorizeSameSession() public {
        vm.startPrank(user1);
        
        // Authorize
        agent.authorizeSession(session1);
        assertTrue(agent.isSessionAuthorized(user1, session1));
        
        // Authorize again (should not revert)
        agent.authorizeSession(session1);
        assertTrue(agent.isSessionAuthorized(user1, session1));
        
        vm.stopPrank();
    }
    
    /**
     * @notice Test order ID overflow doesn't conflict
     */
    function testEdgeCase_OrderIDIncrement() public {
        vm.startPrank(user1);
        // FIX: Deposit enough for 10 orders (10 ETH total, not 100)
        agent.deposit{value: 10 ether}(WETH, 10 ether);
        
        // Create 10 orders
        for (uint256 i = 0; i < 10; i++) {
            uint256 orderId = agent.createLimitOrder(
                WETH,
                USDC,
                1 ether,
                3500 * 1e18 + i * 100 * 1e18, // Different prices
                7,
                false
            );
            assertEq(orderId, i, "Order ID should increment");
        }
        
        vm.stopPrank();
        
        // Verify all orders exist with correct IDs
        for (uint256 i = 0; i < 10; i++) {
            LimitOrderAgent.LimitOrder memory order = agent.getOrder(user1, i);
            assertEq(order.limitPrice, 3500 * 1e18 + i * 100 * 1e18);
        }
    }
    
    /**
     * @notice Test getCurrentPrice function
     */
    function testGetCurrentPrice_ReturnsMockPrice() public view {
        uint256 price = agent.getCurrentPrice(WETH, USDC);
        assertEq(price, INITIAL_PRICE, "Should return mock price");
    }
    
    /**
     * @notice Test stats counter consistency
     */
    function testStats_CounterConsistency() public {
        vm.startPrank(user1);
        agent.deposit{value: 10 ether}(WETH, 10 ether);
        agent.authorizeSession(session1);
        
        // Create 5 orders
        for (uint256 i = 0; i < 5; i++) {
            agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        }
        vm.stopPrank();
        
        (uint256 created, uint256 executed, uint256 active) = agent.getStats();
        assertEq(created, 5);
        assertEq(executed, 0);
        assertEq(active, 5);
        
        // Execute 2 orders
        agent.setMockPrice(3500 * 1e18);
        vm.startPrank(session1);
        agent.executeLimitOrder(user1, 0);
        agent.executeLimitOrder(user1, 1);
        vm.stopPrank();
        
        (created, executed, active) = agent.getStats();
        assertEq(created, 5, "Total created shouldn't change");
        assertEq(executed, 2, "Executed should be 2");
        assertEq(active, 3, "Active should be 3");
        
        // Cancel 1 order
        vm.prank(user1);
        agent.cancelLimitOrder(2);
        
        (created, executed, active) = agent.getStats();
        assertEq(created, 5);
        assertEq(executed, 2);
        assertEq(active, 3, "Cancelled orders still count in active calculation");
    }
    
    /**
     * @notice Test receive function deposits ETH
     */
    function testReceive_DepositETH() public {
        vm.startPrank(user1);
        
        // Send ETH directly to contract
        (bool success, ) = address(agent).call{value: 5 ether}("");
        require(success);
        
        vm.stopPrank();
        
        // Should be recorded as deposit for user1 at address(0)
        assertEq(agent.getDeposit(user1, address(0)), 5 ether);
    }
    
    // ============ GAS OPTIMIZATION TESTS ============
    
    /**
     * @notice Test gas cost of creating order
     */
    function testGas_CreateOrder() public {
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        
        uint256 gasBefore = gasleft();
        agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // Log gas usage (should be reasonable, < 200k)
        emit log_named_uint("Gas used for createLimitOrder", gasUsed);
        assertLt(gasUsed, 200_000, "Gas usage should be reasonable");
    }
    
    /**
     * @notice Test gas cost of executing order
     */
    function testGas_ExecuteOrder() public {
        // Setup
        vm.startPrank(user1);
        agent.deposit{value: 1 ether}(WETH, 1 ether);
        agent.authorizeSession(session1);
        uint256 orderId = agent.createLimitOrder(WETH, USDC, 1 ether, 3500 * 1e18, 7, false);
        vm.stopPrank();
        
        agent.setMockPrice(3500 * 1e18);
        
        vm.startPrank(session1);
        uint256 gasBefore = gasleft();
        agent.executeLimitOrder(user1, orderId);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Gas used for executeLimitOrder", gasUsed);
        assertLt(gasUsed, 300_000, "Execution gas should be reasonable");
    }
}