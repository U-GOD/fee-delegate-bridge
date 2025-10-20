// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MonadReceiver} from "../src/MonadReceiver.sol";

contract DeployMonadReceiver is Script {
    function run() external returns (MonadReceiver) {
        vm.startBroadcast();
        
        // Deploy MonadReceiver on Monad Testnet
        MonadReceiver receiver = new MonadReceiver(
            0xfdB631f5ee196F0A101F2B928f4A3CFc1f57A8A4 // LayerZero V2 Endpoint on Monad Testnet
        );
        
        console2.log("MonadReceiver deployed at:", address(receiver));
        console2.log("Owner:", receiver.owner());
        console2.log("");
        console2.log("NEXT STEPS:");
        console2.log("1. Call setPeer on MonadReceiver:");
        console2.log("   receiver.setPeer(40245, bytes32(uint256(uint160(AGENT_ADDRESS))))");
        console2.log("2. Test bridge from Base Sepolia");
        
        vm.stopBroadcast();
        return receiver;
    }
}