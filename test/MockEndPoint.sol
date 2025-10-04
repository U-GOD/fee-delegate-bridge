// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEndpointV2} from "../src/interfaces/IEndpointV2.sol";  // Import from your interfaces.

contract MockEndpoint is IEndpointV2 {
    event MockLzSend(uint32 dstEid, bytes message, bytes options);  // Event to sim send for tests.

    function lzSend(uint32 dstEid, bytes calldata message, bytes calldata options) external payable override {
        emit MockLzSend(dstEid, message, options);  // Sim send—emit for vm.expectEmit in tests (no real call).
    }

    function quote(uint32 dstEid, bytes calldata message, bool payInZRO, bytes calldata adapterParams) external view override returns (uint256 nativeFee, uint256 zroFee) {
        return (0.01 ether, 0);  // Mock fee—0.01 MON native, 0 ZRO.
    }

    // Unused for MVP—revert or empty.
    function receiveMessage(bytes32 guid, uint32 srcEid, address srcAddress, bytes calldata message) external override {}
    function getEid() external view override returns (uint32) { return 40204; }  // Mock Monad ID.
}