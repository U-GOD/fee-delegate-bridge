// src/interfaces/IEndpointV2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface for LayerZero Endpoint V2 (core for cross-chain sends—enables lzSend like any address).
interface IEndpointV2 {
    // Send message to dest chain (payable for fees; _options for gas/refund).
    function lzSend(uint32 _dstEid, bytes calldata _message, bytes calldata _options) external payable;

    // Quote fees for send (view—call before lzSend to check msg.value).
    function quote(uint32 _dstEid, bytes calldata _message, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint256 nativeFee, uint256 zroFee);

    // Receive message (for dest side—emit for verifiers).
    function receiveMessage(bytes32 _guid, uint32 _srcEid, address _srcAddress, bytes calldata _message) external;

    // Other utils (e.g., getEid for chain ID).
    function getEid() external view returns (uint32);
}