// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LimitOrderAgent - Automated Limit Order Execution
 * @notice Executes swaps on behalf of users when price conditions are met
 * @dev Mock DEX integration for testnet demo (production-ready architecture)
 * 
 * - DEX integration is MOCKED for demo (Ambient not on Monad testnet yet)
 * - ALL automation logic is REAL and production-ready
 * - Architecture demonstrates limit order automation concept
 * - Can easily swap in real DEX integration for mainnet
 */
contract LimitOrderAgent {
    // ============ STRUCTS ============
    
    struct LimitOrder {
        address user;           // Order owner
        address tokenIn;        // Token to sell
        address tokenOut;       // Token to buy
        uint256 amountIn;       // Amount to sell
        uint256 limitPrice;     // Target price (tokenOut per tokenIn, 1e18 scaled)
        uint256 expiresAt;      // Expiration timestamp
        bool isActive;          // Order status
        bool isBuy;             // Buy (true) or sell (false)
    }
    
    // ============ STATE VARIABLES ============
    
    address public owner;
    
    // Mock price for demo (in production: Chainlink oracle or DEX reserves)
    uint256 public mockPrice = 3000 * 1e18; // $3000 per ETH
    
    // User orders
    mapping(address => mapping(uint256 => LimitOrder)) public orders;
    mapping(address => uint256) public orderCount;
    
    // Session authorization (MetaMask Smart Accounts)
    mapping(address => mapping(address => bool)) public authorizedSessions;
    
    // Token deposits
    mapping(address => mapping(address => uint256)) public deposits;
    
    // Execution tracking
    uint256 public totalOrdersCreated;
    uint256 public totalOrdersExecuted;
    
    // ============ EVENTS ============
    
    event LimitOrderCreated(
        address indexed user,
        uint256 indexed orderId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 limitPrice,
        uint256 expiresAt
    );
    
    event LimitOrderExecuted(
        address indexed user,
        uint256 indexed orderId,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionPrice
    );
    
    event LimitOrderCancelled(
        address indexed user,
        uint256 indexed orderId
    );
    
    event SessionAuthorized(
        address indexed user,
        address indexed sessionAccount,
        uint256 timestamp
    );
    
    event SessionRevoked(
        address indexed user,
        address indexed sessionAccount
    );
    
    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event MockPriceUpdated(uint256 newPrice);
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy LimitOrderAgent on Monad
     * 
     * DEPLOYMENT:
     * forge create src/LimitOrderAgent.sol:LimitOrderAgent \
     *   --rpc-url https://testnet-rpc.monad.xyz \
     *   --private-key $PRIVATE_KEY \
     *   --legacy
     */
    constructor() {
        owner = msg.sender;
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @notice Deposit tokens for limit orders
     * @param _token Token address (WETH, USDC, etc.)
     * @param _amount Amount to deposit
     * 
     * NOTE: For demo, we accept ETH directly via receive()
     * In production, would require ERC20 approval + transferFrom
     */
    function deposit(address _token, uint256 _amount) external payable {
        require(_amount > 0, "Amount must be > 0");
        
        // For ETH deposits via msg.value
        if (msg.value > 0) {
            deposits[msg.sender][_token] += msg.value;
            emit Deposited(msg.sender, _token, msg.value);
            return;
        }
        
        // For ERC20 tokens (production)
        (bool success, ) = _token.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                address(this),
                _amount
            )
        );
        require(success, "Transfer failed");
        
        deposits[msg.sender][_token] += _amount;
        emit Deposited(msg.sender, _token, _amount);
    }
    
    /**
     * @notice Withdraw deposited tokens
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function withdraw(address _token, uint256 _amount) external {
        require(deposits[msg.sender][_token] >= _amount, "Insufficient balance");
        require(_amount > 0, "Amount must be > 0");
        
        deposits[msg.sender][_token] -= _amount;
        
        // For ETH
        if (_token == address(0) || _token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)) {
            payable(msg.sender).transfer(_amount);
        } else {
            // For ERC20
            (bool success, ) = _token.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    msg.sender,
                    _amount
                )
            );
            require(success, "Transfer failed");
        }
        
        emit Withdrawn(msg.sender, _token, _amount);
    }
    
    /**
     * @notice Create a limit order
     * @param _tokenIn Token to sell
     * @param _tokenOut Token to buy
     * @param _amountIn Amount to sell
     * @param _limitPrice Target price (1e18 scaled)
     * @param _daysValid Days until expiration
     * @param _isBuy Buy order (true) or sell order (false)
     * 
     * EXAMPLE - SELL ORDER:
     * createLimitOrder(
     *   WETH,              // Selling ETH
     *   USDC,              // Buying USDC
     *   1 ether,           // 1 ETH
     *   3500 * 1e18,       // At $3500 per ETH
     *   7,                 // Expires in 7 days
     *   false              // Sell order
     * )
     * 
     * EXAMPLE - BUY ORDER:
     * createLimitOrder(
     *   USDC,              // Selling USDC
     *   WETH,              // Buying ETH
     *   2500 * 1e6,        // 2500 USDC (6 decimals)
     *   2500 * 1e18,       // At $2500 per ETH
     *   7,                 // Expires in 7 days
     *   true               // Buy order
     * )
     */
    function createLimitOrder(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _limitPrice,
        uint256 _daysValid,
        bool _isBuy
    ) external returns (uint256 orderId) {
        require(_amountIn > 0, "Amount must be > 0");
        require(_limitPrice > 0, "Price must be > 0");
        require(_daysValid > 0 && _daysValid <= 365, "Invalid expiration");
        require(deposits[msg.sender][_tokenIn] >= _amountIn, "Insufficient deposit");
        
        // Generate order ID
        orderId = orderCount[msg.sender]++;
        
        // Calculate expiration
        uint256 expiresAt = block.timestamp + (_daysValid * 1 days);
        
        // Create order
        orders[msg.sender][orderId] = LimitOrder({
            user: msg.sender,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            amountIn: _amountIn,
            limitPrice: _limitPrice,
            expiresAt: expiresAt,
            isActive: true,
            isBuy: _isBuy
        });
        
        // Lock user's deposit
        deposits[msg.sender][_tokenIn] -= _amountIn;
        
        totalOrdersCreated++;
        
        emit LimitOrderCreated(
            msg.sender,
            orderId,
            _tokenIn,
            _tokenOut,
            _amountIn,
            _limitPrice,
            expiresAt
        );
    }
    
    /**
     * @notice Cancel an active limit order
     * @param _orderId Order ID to cancel
     */
    function cancelLimitOrder(uint256 _orderId) external {
        LimitOrder storage order = orders[msg.sender][_orderId];
        require(order.isActive, "Order not active");
        require(order.user == msg.sender, "Not your order");
        
        // Mark as inactive
        order.isActive = false;
        
        // Refund locked tokens
        deposits[msg.sender][order.tokenIn] += order.amountIn;
        
        emit LimitOrderCancelled(msg.sender, _orderId);
    }
    
    // ============ SESSION AUTHORIZATION ============
    
    /**
     * @notice Authorize a MetaMask Smart Account session
     * @param _sessionAccount Session account address
     */
    function authorizeSession(address _sessionAccount) external {
        require(_sessionAccount != address(0), "Invalid address");
        require(_sessionAccount != msg.sender, "Cannot authorize self");
        
        authorizedSessions[msg.sender][_sessionAccount] = true;
        emit SessionAuthorized(msg.sender, _sessionAccount, block.timestamp);
    }
    
    /**
     * @notice Revoke session authorization
     * @param _sessionAccount Session to revoke
     */
    function revokeSession(address _sessionAccount) external {
        require(authorizedSessions[msg.sender][_sessionAccount], "Session not authorized");
        authorizedSessions[msg.sender][_sessionAccount] = false;
        emit SessionRevoked(msg.sender, _sessionAccount);
    }
    
    /**
     * @notice Check if session is authorized
     */
    function isSessionAuthorized(address _user, address _session) external view returns (bool) {
        return authorizedSessions[_user][_session];
    }
    
    // ============ AUTOMATED EXECUTION ============
    
    /**
     * @notice Execute limit order when price condition is met
     * @param _user Order owner
     * @param _orderId Order ID to execute
     * 
     * CALLED BY: Authorized session account (automated)
     * 
     * CHECKS:
     * 1. Caller is authorized session OR user themselves
     * 2. Order is active
     * 3. Order hasn't expired
     * 4. Current price meets limit condition
     * 5. Execute swap (mocked for demo, real DEX in production)
     */
    function executeLimitOrder(address _user, uint256 _orderId) external {
        // 1. Verify authorization
        require(
            authorizedSessions[_user][msg.sender] || msg.sender == _user,
            "Not authorized"
        );
        
        LimitOrder storage order = orders[_user][_orderId];
        
        // 2. Verify order is active
        require(order.isActive, "Order not active");
        
        // 3. Check not expired
        require(block.timestamp < order.expiresAt, "Order expired");
        
        // 4. Check price condition
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        bool shouldExecute = order.isBuy 
            ? currentPrice <= order.limitPrice  // Buy when price drops
            : currentPrice >= order.limitPrice; // Sell when price rises
        
        require(shouldExecute, "Price condition not met");
        
        // Mark order as executed
        order.isActive = false;
        
        // 5. Execute swap (mocked for demo)
        uint256 amountOut = _mockSwap(
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            currentPrice
        );
        
        // Credit user with output tokens
        deposits[_user][order.tokenOut] += amountOut;
        
        totalOrdersExecuted++;
        
        emit LimitOrderExecuted(
            _user,
            _orderId,
            order.amountIn,
            amountOut,
            currentPrice
        );
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Mock swap function for demo
     * @dev In production: Call Ambient, Uniswap, or aggregator
     * 
     * PRODUCTION INTEGRATION:
     * - Ambient Finance: Use CrocSwapRouter.userCmd()
     * - Uniswap V2/V3: Use Router.swap()
     * - 1inch/Paraswap: Use aggregator for best price
     */
    function _mockSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 price
    ) internal pure returns (uint256 amountOut) {
        // Simple calculation for demo
        // amountOut = amountIn * price / 1e18
        // With 2% slippage simulation
        amountOut = (amountIn * price * 98) / (100 * 1e18);
        
        // In production, this would be:
        // return IAmbient(AMBIENT_DEX).swap(...);
        // or
        // return IUniswap(UNISWAP_ROUTER).swap(...);
    }
    
    /**
     * @notice Get current price
     * @dev Mock for demo. Production: Chainlink oracle or DEX reserves
     */
    function getCurrentPrice(address tokenIn, address tokenOut) public view returns (uint256) {
        // Return mock price
        // In production: Query Chainlink or calculate from pool reserves
        return mockPrice;
    }
    
    // ============ DEMO FUNCTIONS ============
    
    /**
     * @notice Set mock price for demo
     * @dev Only for testing! Remove in production
     */
    function setMockPrice(uint256 _newPrice) external {
        require(msg.sender == owner, "Only owner");
        mockPrice = _newPrice;
        emit MockPriceUpdated(_newPrice);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get user's limit order
     */
    function getOrder(address _user, uint256 _orderId) external view returns (LimitOrder memory) {
        return orders[_user][_orderId];
    }
    
    /**
     * @notice Get user's deposit balance
     */
    function getDeposit(address _user, address _token) external view returns (uint256) {
        return deposits[_user][_token];
    }
    
    /**
     * @notice Check if order can be executed now
     */
    function canExecute(address _user, uint256 _orderId) external view returns (
        bool executable,
        string memory reason
    ) {
        LimitOrder memory order = orders[_user][_orderId];
        
        if (!order.isActive) {
            return (false, "Order not active");
        }
        
        if (block.timestamp >= order.expiresAt) {
            return (false, "Order expired");
        }
        
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        bool priceConditionMet = order.isBuy 
            ? currentPrice <= order.limitPrice
            : currentPrice >= order.limitPrice;
        
        if (!priceConditionMet) {
            return (false, "Price condition not met");
        }
        
        return (true, "Ready to execute");
    }
    
    /**
     * @notice Get contract stats
     */
    function getStats() external view returns (
        uint256 _totalOrdersCreated,
        uint256 _totalOrdersExecuted,
        uint256 _activeOrders
    ) {
        return (
            totalOrdersCreated,
            totalOrdersExecuted,
            totalOrdersCreated - totalOrdersExecuted
        );
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "Only owner");
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive ETH
    receive() external payable {
        // Accept ETH deposits
        deposits[msg.sender][address(0)] += msg.value;
        emit Deposited(msg.sender, address(0), msg.value);
    }
}