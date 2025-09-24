'use client';  // Client component for hooks (runs on browser)

import { useState } from 'react';  // useState for input/status
import { useAccount, useWalletClient } from 'wagmi';  // useAccount for isConnected/address, useWalletClient for txs
import { ConnectButton } from '@rainbow-me/rainbowkit';  // RainbowKit connect UI

export default function Home() {
  const { address, isConnected } = useAccount();  // Hook for wallet status and address (from RainbowKit/Wagmi)
  const { data: walletClient } = useWalletClient();  // Hook for viem client (txs)
  const [threshold, setThreshold] = useState('');  // State for input value
  const [status, setStatus] = useState('');  // State for feedback (tx/error)

  const agentAddress = '0x9b52dF03bbB3B20dDcb793100984425eD80ac5fD';  // Deployed agent on Base Sepolia
  const agentAbi = [  // Minimal ABI for setGasThreshold (match contract from Phase 1)
    {
      name: 'setGasThreshold',
      type: 'function',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const;

  const handleSetThreshold = async () => {
    if (!walletClient || !threshold) return setStatus('Enter threshold and connect');
    setStatus('Setting threshold...');
    try {
      const hash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'setGasThreshold',
        args: [BigInt(threshold)],  // Convert string input to BigInt for Solidity uint256
      });
      setStatus(`Threshold set! Tx: ${hash}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">FeeDelegate Bridge</h1>
      
      {/* Simple Connect Button */}
      <ConnectButton />

      {isConnected && (
        <div style={{ marginBottom: '20px' }}>
          <input type="number" placeholder="Gas threshold (gwei)" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ padding: '5px', marginRight: '10px' }} />
          <button onClick={handleSetThreshold} style={{ padding: '10px' }}>
            Set Threshold
          </button>
        </div>
      )}
      <p style={{ marginTop: '10px' }}>{status}</p>
      
      <p className="mt-4">Connect your wallet to get started!</p>
    </main>
  );
}