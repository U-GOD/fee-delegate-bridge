// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEndpointV2} from "./interfaces/IEndpointV2.sol";

/**
 * @title MonadReceiver - MOCK VERSION for Hackathon
 * @notice Receives bridged funds and SIMULATES Uniswap swap
 * @dev Deploy this if you can't find Uniswap addresses on Monad
 */
contract MonadReceiver {
    // ============ STATE VARIABLES ============
    
    address public owner;
    IEndpointV2 public immutable ENDPOINT;
    
    // Mock price: 1 ETH = 2000 USDC (6 decimals)
    uint256 public constant MOCK_ETH_PRICE = 2000;
    uint256 public constant USDC_DECIMALS = 6;
    
    // User balances in mock USDC (6 decimals)
    mapping(address => uint256) public usdcBalances;
    
    // Track ETH held for users (for withdrawal)
    mapping(address => uint256) public ethBalances;
    
    // Authorized source chains (Base Sepolia EID)
    mapping(uint32 => bool) public trustedSources;
    
    // Total mock USDC supply (for accounting)
    uint256 public totalMockUSDC;
    
    // ============ EVENTS ============
    
    event BridgeReceived(
        address indexed user,
        uint256 ethAmount,
        uint32 srcEid,
        uint256 timestamp
    );
    
    event MockSwapExecuted(
        address indexed user,
        uint256 ethIn,
        uint256 usdcOut,
        uint256 mockPrice
    );
    
    event BalanceWithdrawn(
        address indexed user,
        uint256 usdcAmount,
        uint256 ethAmount
    );
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy on Monad Testnet
     * @param _endpoint LayerZero Endpoint on Monad
     * 
     * Monad LayerZero Endpoint: 0xFdB631F5EE196F0a101F2B928F4A3Cfc1f57A8a4
     */
    constructor(address _endpoint) {
        owner = msg.sender;
        ENDPOINT = IEndpointV2(_endpoint);
        
        // Trust Base Sepolia (EID 40245)
        trustedSources[40245] = true;
    }
    
    // ============ RECEIVE BRIDGE & MOCK SWAP ============
    
    /**
     * @notice Called by LayerZero when message arrives from Base
     * @param _origin Source chain info
     * @param _guid Unique message ID
     * @param _message Encoded: (user, amount, timestamp, action)
     * @param _executor Executor address (unused)
     * @param _extraData Extra data (unused)
     * 
     * FLOW:
     * 1. Validate sender is LayerZero Endpoint
     * 2. Validate source is trusted (Base Sepolia)
     * 3. Decode message to get user + ETH amount
     * 4. Execute MOCK swap (ETH → USDC)
     * 5. Credit user's USDC balance
     * 6. Hold ETH for potential withdrawal
     * 
     * MOCK SWAP LOGIC:
     * - Use fixed price: 1 ETH = $2000
     * - Convert ETH (18 decimals) to USDC (6 decimals)
     * - Example: 0.1 ETH → 200 USDC
     */
    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable {
        // Only LayerZero can call this
        require(msg.sender == address(ENDPOINT), "Only endpoint");
        
        // Only accept from trusted chains (Base Sepolia)
        require(trustedSources[_origin.srcEid], "Untrusted source");
        
        // Decode message from Agent.sol
        (
            address user,
            uint256 ethAmount,
            uint256 timestamp,
            string memory action
        ) = abi.decode(_message, (address, uint256, uint256, string));
        
        emit BridgeReceived(user, ethAmount, _origin.srcEid, timestamp);
        
        // Validate action type
        require(
            keccak256(bytes(action)) == keccak256("BRIDGE_TO_MONAD"),
            "Invalid action"
        );
        
        // Execute MOCK swap
        _executeMockSwap(user, ethAmount);
    }
    
    /**
     * @notice MOCK swap execution (simulates Uniswap)
     * @param _user User who will receive USDC
     * @param _ethAmount ETH amount to "swap"
     * 
     * MATH EXPLANATION:
     * 1. ETH has 18 decimals (1 ETH = 1e18 wei)
     * 2. USDC has 6 decimals (1 USDC = 1e6)
     * 3. Price: 1 ETH = $2000
     * 
     * CONVERSION FORMULA:
     * usdcOut = (ethAmount * PRICE * 10^6) / 10^18
     * usdcOut = (ethAmount * 2000 * 1e6) / 1e18
     * 
     * EXAMPLE:
     * Input: 0.1 ETH = 100000000000000000 wei
     * Calc: (100000000000000000 * 2000 * 1e6) / 1e18
     *     = 200 * 1e6
     *     = 200000000 (200 USDC in 6 decimals)
     */
    function _executeMockSwap(address _user, uint256 _ethAmount) internal {
        // Calculate mock USDC output (6 decimals)
        // Formula: (ethAmount * price * 10^6) / 10^18
        uint256 usdcOut = (_ethAmount * MOCK_ETH_PRICE * (10 ** USDC_DECIMALS)) / (10 ** 18);
        
        // Credit user's mock USDC balance
        usdcBalances[_user] += usdcOut;
        
        // Store ETH for user (they can withdraw later)
        ethBalances[_user] += _ethAmount;
        
        // Track total mock USDC (for accounting)
        totalMockUSDC += usdcOut;
        
        emit MockSwapExecuted(_user, _ethAmount, usdcOut, MOCK_ETH_PRICE);
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @notice Withdraw your mock USDC balance
     * @param _usdcAmount USDC amount to withdraw (6 decimals)
     * 
     * HOW IT WORKS:
     * - User has mock USDC balance from "swap"
     * - We convert USDC back to ETH at same price
     * - Transfer ETH to user
     * 
     * CONVERSION:
     * ethOut = (usdcAmount * 10^18) / (price * 10^6)
     * 
     * EXAMPLE:
     * Input: 200 USDC = 200000000 (6 decimals)
     * Calc: (200000000 * 1e18) / (2000 * 1e6)
     *     = 100000000000000000 wei
     *     = 0.1 ETH
     */
    function withdrawUSDC(uint256 _usdcAmount) external {
        require(_usdcAmount > 0, "Must withdraw something");
        require(usdcBalances[msg.sender] >= _usdcAmount, "Insufficient USDC balance");
        
        // Calculate ETH to return
        uint256 ethToReturn = (_usdcAmount * (10 ** 18)) / (MOCK_ETH_PRICE * (10 ** USDC_DECIMALS));
        require(ethBalances[msg.sender] >= ethToReturn, "Insufficient ETH backing");
        
        // Deduct balances
        usdcBalances[msg.sender] -= _usdcAmount;
        ethBalances[msg.sender] -= ethToReturn;
        totalMockUSDC -= _usdcAmount;
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: ethToReturn}("");
        require(success, "ETH transfer failed");
        
        emit BalanceWithdrawn(msg.sender, _usdcAmount, ethToReturn);
    }
    
    /**
     * @notice Check your mock USDC balance
     * @param _user User address
     * @return USDC balance (6 decimals)
     */
    function getUSDCBalance(address _user) external view returns (uint256) {
        return usdcBalances[_user];
    }
    
    /**
     * @notice Check your ETH backing
     * @param _user User address
     * @return ETH balance held for user
     */
    function getETHBalance(address _user) external view returns (uint256) {
        return ethBalances[_user];
    }
    
    /**
     * @notice Get current mock price
     * @return Price in USD (2 decimals)
     */
    function getMockPrice() external pure returns (uint256) {
        return MOCK_ETH_PRICE;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Add trusted source chain
     * @param _srcEid LayerZero endpoint ID
     */
    function addTrustedSource(uint32 _srcEid) external {
        require(msg.sender == owner, "Only owner");
        trustedSources[_srcEid] = true;
    }
    
    /**
     * @notice Update mock price (in case you want to demo price changes)
     * @dev NOT IMPLEMENTED - price is constant for simplicity
     * In production, you'd fetch from Chainlink oracle
     */
    
    /**
     * @notice Emergency withdraw (owner only)
     * @dev In case funds get stuck
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive ETH from LayerZero/users
    receive() external payable {}
}

/**
 * @dev Origin struct for LayerZero V2
 * Used in lzReceive function
 */
struct Origin {
    uint32 srcEid;      // Source endpoint ID
    bytes32 sender;     // Sender address (bytes32)
    uint64 nonce;       // Message nonce
}

/**
 * ============================================
 * 📝 DEPLOYMENT NOTES
 * ============================================
 * 
 * 1. Deploy with Monad LayerZero Endpoint:
 *    constructor(0xFdB631F5EE196F0a101F2B928F4A3Cfc1f57A8a4)
 * 
 * 2. After deployment, verify on explorer:
 *    https://monad-testnet.socialscan.io
 * 
 * 3. Tell Agent contract about this receiver:
 *    Agent.setPeer(40204, addressToBytes32(receiver))
 * 
 * 4. Test the flow:
 *    - Bridge from Base → Monad
 *    - Check USDC balance: getUSDCBalance(user)
 *    - Should show: ethAmount * 2000 (in 6 decimals)
 * 
 * 5. In demo video, explain:
 *    "This simulates Uniswap using a fixed $2000/ETH price.
 *    The real version would call Uniswap V2 Router for
 *    live market prices and actual token swaps."
 */