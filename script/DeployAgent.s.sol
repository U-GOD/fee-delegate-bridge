// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Agent} from "../src/Agent.sol";

contract DeployAgent is Script {
    function run() external returns (Agent) {
        vm.startBroadcast();
        
        // Deploy Agent with constructor args
        Agent agent = new Agent(
            address(0), // Gas oracle (mock)
            0x6EDCE65403992e310A62460808c4b910D972f10f // LayerZero endpoint
        );
        
        vm.stopBroadcast();
        return agent;
    }
}