// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEndpointV2} from "./interfaces/IEndpointV2.sol";
import {IUniswapV2Router} from "./interfaces/IUniswapV2Router.sol";

/**
 * @title MonadReceiver - Automated Swap Executor on Monad
 * @notice Receives bridged funds and executes Uniswap swaps automatically
 * @dev Deploy this contract ON MONAD TESTNET
 * 
 * FLOW:
 * 1. Agent.sol (Base Sepolia) sends LayerZero message
 * 2. LayerZero delivers to this contract on Monad
 * 3. lzReceive() decodes message
 * 4. Executes Uniswap swap (ETH → USDC)
 * 5. Credits user's balance
 * 
 * WHY THIS IS GENIUS:
 * - Bridge when Base gas is cheap
 * - Swap on Monad (ultra-low fees, 10k TPS)
 * - User saves money on BOTH bridge AND swap!
 * - Fully automated via MetaMask Smart Accounts
 */
contract MonadReceiver {
    // ============ STATE VARIABLES ============
    
    address public owner;
    IEndpointV2 public immutable ENDPOINT;
    IUniswapV2Router public immutable UNISWAP_ROUTER;
    
    // Token addresses on Monad (from Uniswap deployment)
    address public constant WETH = 0x...; // TODO: Get from Monad Uniswap
    address public constant USDC = 0x...; // TODO: Get from Monad Uniswap
    
    // User balances after swap
    mapping(address => uint256) public usdcBalances;
    
    // Authorized source chains (Base Sepolia EID)
    mapping(uint32 => bool) public trustedSources;
    
    // ============ EVENTS ============
    
    event BridgeReceived(
        address indexed user,
        uint256 amount,
        uint32 srcEid
    );
    
    event SwapExecuted(
        address indexed user,
        uint256 ethIn,
        uint256 usdcOut
    );
    
    event BalanceWithdrawn(
        address indexed user,
        uint256 amount
    );
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy on Monad Testnet
     * @param _endpoint LayerZero Endpoint on Monad: 0xFdB631F5EE196F0a101F2B928F4A3Cfc1f57A8a4
     * @param _uniswapRouter Uniswap V2 Router on Monad (get from testnet.monad.xyz)
     */
    constructor(address _endpoint, address _uniswapRouter) {
        owner = msg.sender;
        ENDPOINT = IEndpointV2(_endpoint);
        UNISWAP_ROUTER = IUniswapV2Router(_uniswapRouter);
        
        // Trust Base Sepolia (EID 40245)
        trustedSources[40245] = true;
    }
    
    // ============ RECEIVE BRIDGE & SWAP ============
    
    /**
     * @notice Called by LayerZero when message arrives from Base
     * @param _origin Source chain info
     * @param _guid Unique message ID
     * @param _message Encoded: (user, amount, action)
     * @param _executor Executor address (unused)
     * @param _extraData Extra data (unused)
     * 
     * SECURITY:
     * - Only LayerZero Endpoint can call
     * - Only trusted source chains accepted
     * - Validates message structure
     * 
     * AUTO-EXECUTION:
     * 1. Decode message → get user + amount
     * 2. Execute Uniswap swap: ETH → USDC
     * 3. Credit user's USDC balance
     * 4. Emit events for frontend tracking
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
        
        // Decode message
        (
            address user,
            uint256 amount,
            uint256 timestamp,
            string memory action
        ) = abi.decode(_message, (address, uint256, uint256, string));
        
        emit BridgeReceived(user, amount, _origin.srcEid);
        
        // Validate action
        require(
            keccak256(bytes(action)) == keccak256("BRIDGE_TO_MONAD"),
            "Invalid action"
        );
        
        // Execute swap on Uniswap
        _executeSwap(user, amount);
    }
    
    /**
     * @notice Internal swap execution on Uniswap V2
     * @param _user User who will receive USDC
     * @param _ethAmount ETH amount to swap
     * 
     * SWAP PATH: WETH → USDC
     * SLIPPAGE: 5% (adjust based on liquidity)
     * DEADLINE: 5 minutes from now
     * 
     * NOTE: Contract must have ETH balance to swap!
     * ETH comes from LayerZero bridge delivery
     */
    function _executeSwap(address _user, uint256 _ethAmount) internal {
        // Build swap path: ETH → USDC
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = USDC;
        
        // Calculate minimum output (5% slippage)
        // In production, get live price from oracle
        uint256[] memory expectedAmounts = UNISWAP_ROUTER.getAmountsOut(
            _ethAmount,
            path
        );
        uint256 minUsdcOut = (expectedAmounts[1] * 95) / 100; // 5% slippage
        
        // Execute swap
        uint256[] memory amounts = UNISWAP_ROUTER.swapExactETHForTokens{
            value: _ethAmount
        }(
            minUsdcOut,
            path,
            address(this), // Receive USDC to contract
            block.timestamp + 300 // 5 min deadline
        );
        
        // Credit user's USDC balance
        usdcBalances[_user] += amounts[1];
        
        emit SwapExecuted(_user, _ethAmount, amounts[1]);
    }
    
    // ============ USER FUNCTIONS ============
    
    /**
     * @notice Withdraw your USDC balance
     * @param _amount USDC amount to withdraw
     * 
     * USE CASE:
     * After auto-swap completes, user calls this to get their USDC
     * Can then use USDC in other Monad DeFi protocols
     */
    function withdrawUSDC(uint256 _amount) external {
        require(usdcBalances[msg.sender] >= _amount, "Insufficient balance");
        
        usdcBalances[msg.sender] -= _amount;
        
        // Transfer USDC to user
        // NOTE: Need to approve/transfer ERC20 here
        // Simplified for MVP - in production add IERC20 interface
        (bool success, ) = USDC.call(
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                msg.sender,
                _amount
            )
        );
        require(success, "USDC transfer failed");
        
        emit BalanceWithdrawn(msg.sender, _amount);
    }
    
    /**
     * @notice Check your USDC balance
     * @param _user User address
     * @return USDC balance in contract
     */
    function getUSDCBalance(address _user) external view returns (uint256) {
        return usdcBalances[_user];
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
     * @notice Emergency withdraw (owner only)
     * @dev In case funds get stuck
     */
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Receive ETH from LayerZero/Uniswap
    receive() external payable {}
}

/**
 * @dev Origin struct for LayerZero V2
 * Used in lzReceive function
 */
struct Origin {
    uint32 srcEid;
    bytes32 sender;
    uint64 nonce;
}