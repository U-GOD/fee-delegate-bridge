// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Agent} from "../src/Agent.sol";

// Simple mock that properly implements the interface
contract MockOracle {
    uint8 public decimals = 8;
    int256 public currentAnswer;
    uint256 public lastUpdate;
    
    function setMockData(int256 answer, uint256 timestamp) external {
        currentAnswer = answer;
        lastUpdate = timestamp;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, currentAnswer, block.timestamp, lastUpdate, 1);
    }
    
    // Required interface functions
    function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80) {
        revert("Not implemented");
    }
    
    function description() external pure returns (string memory) {
        return "Mock Oracle";
    }
    
    function version() external pure returns (uint256) {
        return 1;
    }
}

contract AgentOracleTest is Test {
    Agent public agent;
    MockOracle public mockOracle;
    
    address user1 = address(0x123);
    address user2 = address(0x456);
    
    function setUp() public {
        mockOracle = new MockOracle();
        agent = new Agent(address(mockOracle));
    }
    
    // Let's start with the simplest test first
    function testCheckGas_BasicFunctionality() public {
        // Set fresh data
        mockOracle.setMockData(35 * 10**8, block.timestamp);
        
        (uint256 currentGas, bool shouldTrigger) = agent.checkGas(user1);
        
        assertEq(currentGas, 35, "Should return 35 gwei");
        assertFalse(shouldTrigger, "Should not trigger without threshold");
    }
    
    // Test with user threshold
    function testCheckGas_WithUserThreshold() public {
        vm.prank(user1);
        agent.setGasThreshold(30);
        
        mockOracle.setMockData(40 * 10**8, block.timestamp);
        
        (, bool shouldTrigger) = agent.checkGas(user1);
        assertTrue(shouldTrigger, "Should trigger when gas > threshold");
    }
    
    // Test stale data revert - better version using vm.warp
    function testCheckGas_StaleDataRevert() public {
        // Set current block timestamp to a known value
        uint256 currentTime = 1000000;
        vm.warp(currentTime);
        
        // Set data that's 10 minutes old
        mockOracle.setMockData(35 * 10**8, currentTime - 10 minutes);
        
        vm.expectRevert("Stale oracle data");
        agent.checkGas(user1);
    }
}