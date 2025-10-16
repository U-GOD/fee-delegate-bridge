// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Agent.sol";

contract DeployAgent is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Base Sepolia LayerZero Endpoint
        address lzEndpoint = 0x6EDCE65403992e310A62460808c4b910D972f10f;
        
        // Deploy with mock oracle (0x0)
        Agent agent = new Agent(address(0), lzEndpoint);
        
        console.log("Agent deployed at:", address(agent));
        console.log("Remember to:");
        console.log("1. Update frontend agentAddress");
        console.log("2. Fund with test ETH for LayerZero fees");
        
        vm.stopBroadcast();
    }
}