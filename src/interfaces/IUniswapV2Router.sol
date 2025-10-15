// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUniswapV2Router - Interface for Uniswap V2 Router on Monad
 * @notice Minimal interface for token swaps on Uniswap
 * 
 * Uniswap V2 is LIVE on Monad Testnet!
 * Router Address: 0x... (get from Monad docs or Uniswap frontend)
 * 
 * Key function: swapExactETHForTokens
 * - Swaps exact ETH input for maximum tokens output
 * - Path: [WETH, TokenOut] for ETH → Token swaps
 */
interface IUniswapV2Router {
    /**
     * @notice Swap exact ETH for tokens
     * @param amountOutMin Minimum tokens to receive (slippage protection)
     * @param path Array of token addresses [WETH, TokenOut]
     * @param to Recipient address
     * @param deadline Unix timestamp deadline
     * @return amounts Array of amounts [amountIn, amountOut]
     * 
     * EXAMPLE:
     * swapExactETHForTokens{value: 1 ether}(
     *   950000000000000000,  // Min 0.95 USDC (5% slippage)
     *   [WETH, USDC],
     *   msg.sender,
     *   block.timestamp + 300
     * );
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    /**
     * @notice Swap exact tokens for ETH
     * @param amountIn Exact token amount to swap
     * @param amountOutMin Minimum ETH to receive
     * @param path Array [TokenIn, WETH]
     * @param to Recipient
     * @param deadline Unix timestamp
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @notice Get output amount for given input
     * @param amountIn Input amount
     * @param path Swap path
     * @return amounts Expected output amounts
     * 
     * USE CASE: Check how much USDC you'll get for 1 ETH
     */
    function getAmountsOut(
        uint256 amountIn, 
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
    
    /**
     * @notice WETH address on Monad
     * @return WETH contract address
     */
    function WETH() external pure returns (address);
}