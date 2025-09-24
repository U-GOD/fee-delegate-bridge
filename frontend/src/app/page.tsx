'use client';  // Client component for hooks (runs on browser)

import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';  // Factory for MetaMask connector

export default function Home() {
  const { address, isConnected } = useAccount();  // Hook for wallet status and address
  const { connect } = useConnect({ connector: injected() });  // Hook to trigger MetaMask connect

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>FeeDelegate Bridge</h1>
      <button onClick={() => connect()} style={{ padding: '10px', marginBottom: '10px' }}>
        {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect MetaMask'}  // Button text changes on connect
      </button>
    </div>
  );
}