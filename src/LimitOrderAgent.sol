// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LimitOrderAgent - Automated Limit Order Execution on Monad
 * @notice Executes swaps on behalf of users when price conditions are met
 * @dev Integrates with Ambient Finance DEX on Monad testnet
 * 
 * INPUTS REQUIRED:
 * 1. tokenIn: Token to sell (e.g., WETH)
 * 2. tokenOut: Token to buy (e.g., USDC)
 * 3. amountIn: Amount to swap
 * 4. limitPrice: Target price (e.g., 3000 USDC per ETH)
 * 5. expiresAt: Order expiration timestamp
 */
contract LimitOrderAgent {
    // ============ STRUCTS ============
    
    /**
     * @dev Limit order struct
     * Stores all parameters needed to execute a swap
     */
    struct LimitOrder {
        address user;           // Order owner
        address tokenIn;        // Token to sell
        address tokenOut;       // Token to buy
        uint256 amountIn;       // Amount to sell
        uint256 limitPrice;     // Target price (in tokenOut per tokenIn, scaled by 1e18)
        uint256 expiresAt;      // Expiration timestamp
        bool isActive;          // Order status
        bool isBuy;             // True = buy tokenOut, False = sell tokenIn
    }
    
    // ============ STATE VARIABLES ============
    
    address public owner;
    
    // Ambient Finance CrocSwapRouter on Monad
    // Try standard address first: 0x533E164ded63f4c55E83E1f409BDf2BaC5278035 (Ethereum)
    // Or check monad.ambient.finance for Monad-specific deployment
    address public immutable AMBIENT_ROUTER;
    
    // Price oracle (for checking if limit is hit)
    // In production: Chainlink or Ambient's own price feeds
    address public priceOracle;
    
    // User limit orders (user => orderId => order)
    mapping(address => mapping(uint256 => LimitOrder)) public orders;
    mapping(address => uint256) public orderCount;
    
    // Session authorization (same as Agent.sol pattern)
    mapping(address => mapping(address => bool)) public authorizedSessions;
    
    // Token deposits (user => token => amount)
    mapping(address => mapping(address => uint256)) public deposits;
    
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
        address indexed sessionAccount
    );
    
    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @param _ambientRouter Ambient Finance CrocSwapRouter address
     * @param _priceOracle Price oracle address (or 0x0 for mock)
     * 
     * DEPLOYMENT COMMAND:
     * forge create src/LimitOrderAgent.sol:LimitOrderAgent \
     *   --rpc-url https://testnet-rpc.monad.xyz \
     *   --private-key $PRIVATE_KEY \
     *   --constructor-args \
     *     0x533E164ded63f4c55E83E1f409BDf2BaC5278035 \
     *     0x0000000000000000000000000000000000000000
     */
    constructor(address _ambientRouter, address _priceOracle) {
        owner = msg.sender;
        AMBIENT_ROUTER = _ambientRouter;
        priceOracle = _priceOracle;
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @notice Deposit tokens for limit orders
     * @param _token Token address (use WETH for ETH)
     * @param _amount Amount to deposit
     * 
     * USER FLOW:
     * 1. Approve this contract to spend tokens
     * 2. Call deposit() with amount
     * 3. Create limit orders using deposited funds
     */
    function deposit(address _token, uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        
        // Transfer tokens from user to contract
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
     * @notice Create a new limit order
     * @param _tokenIn Token to sell
     * @param _tokenOut Token to buy
     * @param _amountIn Amount to sell
     * @param _limitPrice Target price (1e18 scaled)
     * @param _daysValid Days until expiration
     * @param _isBuy True for buy order, false for sell order
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
     * 
     * - User authorizes session ONCE
     * - Session monitors prices 24/7
     * - Auto-executes when limit is hit
     * - User doesn't need to watch prices manually!
     */
    function authorizeSession(address _sessionAccount) external {
        require(_sessionAccount != address(0), "Invalid address");
        require(_sessionAccount != msg.sender, "Cannot authorize self");
        
        authorizedSessions[msg.sender][_sessionAccount] = true;
        emit SessionAuthorized(msg.sender, _sessionAccount);
    }
    
    /**
     * @notice Revoke session authorization
     */
    function revokeSession(address _sessionAccount) external {
        authorizedSessions[msg.sender][_sessionAccount] = false;
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
     * 1. Caller is authorized session
     * 2. Order is active
     * 3. Order hasn't expired
     * 4. Current price meets limit
     * 5. Execute swap on Ambient Finance
     */
    function executeLimitOrder(address _user, uint256 _orderId) external {
        // Verify authorization
        require(
            authorizedSessions[_user][msg.sender] || msg.sender == _user,
            "Not authorized"
        );
        
        LimitOrder storage order = orders[_user][_orderId];
        require(order.isActive, "Order not active");
        require(block.timestamp < order.expiresAt, "Order expired");
        
        // Check if price condition is met
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        bool shouldExecute = order.isBuy 
            ? currentPrice <= order.limitPrice  // Buy when price drops
            : currentPrice >= order.limitPrice; // Sell when price rises
        
        require(shouldExecute, "Price condition not met");
        
        // Mark order as executed
        order.isActive = false;
        
        // Execute swap on Ambient Finance
        uint256 amountOut = _swapOnAmbient(
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            order.limitPrice
        );
        
        // Credit user with output tokens
        deposits[_user][order.tokenOut] += amountOut;
        
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
     * @notice Execute swap on Ambient Finance
     * @dev Calls CrocSwapRouter.swap() function
     * 
     * AMBIENT SWAP PARAMETERS:
     * - base: Base token address
     * - quote: Quote token address
     * - poolIdx: Pool index (usually 420 for main pools)
     * - isBuy: Direction of swap
     * - inBaseQty: True if input is base token
     * - qty: Amount to swap
     * - tip: Liquidity provider tip (usually 0)
     * - limitPrice: Max/min price (sqrt price in Q64.64 format)
     * - minOut: Minimum output amount (slippage protection)
     * - reserveFlags: Settlement flags (usually 0)
     */
    function _swapOnAmbient(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 limitPrice
    ) internal returns (uint256 amountOut) {
        // Approve Ambient router to spend tokens
        (bool approveSuccess, ) = tokenIn.call(
            abi.encodeWithSignature(
                "approve(address,uint256)",
                AMBIENT_ROUTER,
                amountIn
            )
        );
        require(approveSuccess, "Approve failed");
        
        // Calculate minimum output (5% slippage)
        uint256 minOut = (amountIn * limitPrice * 95) / (100 * 1e18);
        
        // Call Ambient swap function
        // NOTE: This is simplified - actual Ambient interface is complex
        // Check Ambient docs for exact parameters: docs.ambient.finance
        (bool swapSuccess, bytes memory returnData) = AMBIENT_ROUTER.call(
            abi.encodeWithSignature(
                "swap(address,address,uint256,bool,bool,uint128,uint16,uint128,uint128,uint8)",
                tokenIn,        // base token
                tokenOut,       // quote token
                420,            // poolIdx (standard pool)
                false,          // isBuy
                true,           // inBaseQty
                uint128(amountIn),
                0,              // tip
                uint128(limitPrice),
                uint128(minOut),
                0               // reserveFlags
            )
        );
        require(swapSuccess, "Swap failed");
        
        // Decode output amount from return data
        // Ambient returns (int128 baseFlow, int128 quoteFlow)
        (, int128 quoteFlow) = abi.decode(returnData, (int128, int128));
        amountOut = uint256(int256(quoteFlow));
    }
    
    /**
     * @notice Get current price from oracle
     * @dev For MVP: Mock price. Production: Chainlink or Ambient reserves
     */
    function getCurrentPrice(address tokenIn, address tokenOut) public view returns (uint256) {
        // MOCK IMPLEMENTATION for demo
        // In production: Query Chainlink or Ambient pool reserves
        
        // Example: ETH/USDC price = 3000 USDC per ETH
        if (priceOracle == address(0)) {
            return 3000 * 1e18; // Mock $3000 per ETH
        }
        
        // Production: Query real oracle
        (bool success, bytes memory data) = priceOracle.staticcall(
            abi.encodeWithSignature(
                "getPrice(address,address)",
                tokenIn,
                tokenOut
            )
        );
        require(success, "Oracle query failed");
        return abi.decode(data, (uint256));
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
     * @notice Check if order can be executed
     */
    function canExecute(address _user, uint256 _orderId) external view returns (bool) {
        LimitOrder memory order = orders[_user][_orderId];
        
        if (!order.isActive) return false;
        if (block.timestamp >= order.expiresAt) return false;
        
        uint256 currentPrice = getCurrentPrice(order.tokenIn, order.tokenOut);
        return order.isBuy 
            ? currentPrice <= order.limitPrice
            : currentPrice >= order.limitPrice;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Update price oracle
     */
    function setPriceOracle(address _newOracle) external {
        require(msg.sender == owner, "Only owner");
        priceOracle = _newOracle;
    }
    
    receive() external payable {}
}