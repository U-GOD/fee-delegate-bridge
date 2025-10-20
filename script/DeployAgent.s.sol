// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Agent} from "../src/Agent.sol";

contract DeployAgent is Script {
    function run() external returns (Agent) {
        vm.startBroadcast();
        
        // Deploy Agent with constructor args
        Agent agent = new Agent(
            address(0), // Gas oracle (mock - using block.basefee)
            0x6EDCE65403992e310A62460808c4b910D972f10f // LayerZero V2 Endpoint on Base Sepolia
        );
        
        console2.log("Agent deployed at:", address(agent));
        console2.log("Owner:", agent.owner());
        console2.log("");
        console2.log("NEXT STEPS:");
        console2.log("1. Deploy MonadReceiver on Monad Testnet");
        console2.log("2. Call setPeer on Agent:");
        console2.log("   agent.setPeer(40204, bytes32(uint256(uint160(MONAD_RECEIVER_ADDRESS))))");
        console2.log("3. Call setPeer on MonadReceiver:");
        console2.log("   receiver.setPeer(40245, bytes32(uint256(uint160(AGENT_ADDRESS))))");
        
        vm.stopBroadcast();
        return agent;
    }
}