// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {MonadReceiver} from "../src/MonadReceiver.sol";

contract DeployMonadReceiver is Script {
    function run() external returns (MonadReceiver) {
        vm.startBroadcast();
        
        MonadReceiver receiver = new MonadReceiver(
            0xfdB631f5ee196F0A101F2B928f4A3CFc1f57A8A4 // LayerZero endpoint on Monad
        );
        
        vm.stopBroadcast();
        return receiver;
    }
}