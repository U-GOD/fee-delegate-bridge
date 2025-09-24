'use client';  // Client component for hooks (runs on browser)

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';  // Factory for MetaMask connector

export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();  // Hook for wallet status, address, connecting state
  const { connect } = useConnect({ connector: injected() });  // Hook to trigger MetaMask connect
  const [isMounted, setIsMounted] = useState(false);  // State to delay render until client-mounted (fixes hydration)

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