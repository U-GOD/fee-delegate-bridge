'use client';  // Client component for hooks (runs on browser)

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';  // Factory for MetaMask connector
import { useWalletClient } from 'wagmi';  // Hook for viem client (tx sending)

export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();  // Hook for wallet status, address, connecting state
  const { connect } = useConnect({ connector: injected() });  // Hook to trigger MetaMask connect
  const [isMounted, setIsMounted] = useState(false);  // State to delay render until client-mounted (fixes hydration)

  const [threshold, setThreshold] = useState('');  // State for input value
  const { data: walletClient } = useWalletClient();  // Hook for viem client (txs)
  const [status, setStatus] = useState('');  // State for feedback (tx/error)

  const agentAddress = '0x9b52dF03bbB3B20dDcb793100984425eD80ac5fD';  // Replace with deployed agent (from forge create)
  const agentAbi = [  // Minimal ABI for setGasThreshold (match contract)
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
        args: [BigInt(threshold)],  // Convert to BigInt for Solidity uint256
      });
      setStatus(`Threshold set! Tx: ${hash}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    setIsMounted(true);  // Set true after mount—ensures client-only render
  }, []);

  if (!isMounted) {
    return <div>Loading...</div>;  // Server/client placeholder to avoid mismatch
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>FeeDelegate Bridge</h1>
      <button onClick={() => connect()} style={{ padding: '10px', marginBottom: '10px' }}>
        {isConnecting ? 'Connecting...' : isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect MetaMask'}  // Button text changes on connect/loading
      </button>
    </div>
  );
}