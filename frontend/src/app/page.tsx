'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { toHex } from 'viem';

import { bundlerConfig, isBundlerConfigured } from './config/bundler';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [threshold, setThreshold] = useState('');
  const [status, setStatus] = useState('');

  const agentAddress = '0xA2EA4B31f0E36f18DBd5C21De4f82083d6d64E2d';

  useEffect(() => {
    if (isBundlerConfigured()) {
      console.log('✅ Bundler configured:', {
        chainId: bundlerConfig.chainId,
        url: bundlerConfig.url.substring(0, 50) + '...', // Hide full API key
      });
    } else {
      console.warn('⚠️ Bundler not configured - check .env.local');
    }
  }, []);

  // Extended ABI with checkGas function
  const agentAbi = [
    {
      name: 'setGasThreshold',
      type: 'function',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      name: 'redeemDelegationSimple',
      type: 'function',
      inputs: [
        {
          name: '_del',
          type: 'tuple',
          components: [
            { name: 'delegator', type: 'address' },
            { name: 'delegatee', type: 'address' },
            { name: 'authority', type: 'bytes32' },
            {
              name: 'caveats',
              type: 'tuple[]',
              components: [
                { name: 'enforcer', type: 'address' },
                { name: 'data', type: 'bytes' }
              ]
            },
            { name: 'salt', type: 'uint256' },
            { name: 'expiration', type: 'uint256' }
          ]
        }
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    // checkGas function for real-time monitoring
    {
      name: 'checkGas',
      type: 'function',
      inputs: [{ name: '_user', type: 'address' }],
      outputs: [
        { name: 'currentGasGwei', type: 'uint256' },
        { name: 'shouldTrigger', type: 'bool' }
      ],
      stateMutability: 'view',
    },
    {
      name: 'checkGasAndBridge',
      type: 'function',
      inputs: [{name: '_user', type: 'address' }],
      outputs: [],
      stateMutability: 'payable', // Payable for LZ fees (msg.value).
    }
  ] as const;

  // Wagmi hook to read live gas data
  const { data: gasData, refetch: refetchGas, error: gasError, isLoading: gasLoading } = useReadContract({
    address: agentAddress,
    abi: agentAbi,
    functionName: 'checkGas',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
      refetchInterval: 30000,
    },
  });

  // Hook for bridge tx: value for LZ fees (call if shouldTrigger).
  const { writeContract, isPending, error: writeError} = useWriteContract ({
    address: agentAddress,
    abi: agentAbi,
    functionName: 'checkGasAndBridge',
    args: [address as `0x${string}`],
    value: BigInt(10 ** 16), // 0.01 MON in wei (0.01 * 10^18 = 10^16)
  } as const);

  // Auto-refresh gas data when threshold changes
  useEffect(() => {
    console.log('Gas Data Debug:', {
      gasData,
      gasError,
      gasLoading,
      address,
      agentAddress
    });
  }, [gasData, gasError, gasLoading, address]);

  const estimateLayerZeroFee = async (): Promise<bigint> => {
    return BigInt(10 ** 16); // 0.01 MON in wei
  };

  const handleSetThreshold = async () => {
    if (!walletClient || !threshold) return setStatus('Enter threshold and connect');
    setStatus('Setting threshold...');
    try {
      const hash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'setGasThreshold',
        args: [BigInt(threshold)],
      });
      setStatus(`Threshold set! Tx: ${hash}`);
      // Refresh gas data after setting threshold
      setTimeout(() => refetchGas(), 2000);
    } catch (error: unknown) { // Fix: Use unknown instead of any
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBridgeWithFee = async () => {
    if (!address || !shouldTrigger) return;
    
    try {
      setStatus('Estimating bridge fee...');
      const estimatedFee = await estimateLayerZeroFee();
      
      setStatus('Bridging...');
      
      // Use the writeContract hook with proper value
      writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'checkGasAndBridge',
        args: [address],
        value: estimatedFee,
      });
      
    } catch (error) {
      setStatus(`Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSignRedeem = async () => {
    if (!walletClient || !address) {
      setStatus('Wallet not ready - connect wallet first');
      return;
    }

    setStatus('Starting simple delegation...');

    try {
      // Ensure on Monad testnet chain
      const monadId = 10143; 
      const currentChainId = await walletClient.getChainId();
      
      if (currentChainId !== monadId) {
        setStatus('Switching to Monad testnet...');
        await walletClient.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: toHex(monadId) }],
        });
        setStatus('Chain switched, preparing delegation...');
      }

      setStatus('Building delegation payload...');

      const delegationPayload = {
        delegator: address,
        delegatee: agentAddress as `0x${string}`, // Cast to correct type
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        caveats: [] as readonly { enforcer: `0x${string}`; data: `0x${string}` }[],
        salt: BigInt(Math.floor(Math.random() * 1000000)),
        expiration: BigInt(Math.floor(Date.now() / 1000) + 86400)
      };

      console.log('Delegation payload:', delegationPayload);

      setStatus('Redeeming delegation (no signature needed)...');

      const txHash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'redeemDelegationSimple',
        args: [delegationPayload],
      });

      setStatus(`Delegation redeemed successfully! Tx: ${txHash}`);
      
    } catch (error: unknown) { 
      console.error('Delegation error:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Extract gas data for display
  const [currentGas, shouldTrigger] = gasData || [0, false];

  return (
    <>
      {/* Header section (new file)
      <Header /> */}

      {/* Main content section (your existing code) */}
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">FeeDelegate Bridge</h1>
        
        <ConnectButton />

        {isConnected && (
          <div className="space-y-4">
            {/* Gas Status Display - UPDATED */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold mb-2">Live Gas Monitor</h3>
              {gasLoading ? (
                <p>Loading gas data...</p>
              ) : gasError ? (
                <p>
                  Error loading gas data: {gasError instanceof Error ? gasError.message : 'Unknown error'}
                </p>
              ) : gasData ? (
                <div className="space-y-2">
                  <p>
                    Current Gas: <strong>{currentGas.toString()} gwei</strong>
                  </p>
                  <p>
                    Trigger Status:{' '}
                    <span
                      className={`font-bold ${shouldTrigger ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {shouldTrigger ? 'YES - Bridge Ready!' : 'NO - Below Threshold'}
                    </span>
                  </p>
                  {threshold && (
                    <p className="text-sm text-gray-600">
                      Your threshold: {threshold} gwei |{' '}
                      {shouldTrigger ? '✅ Ready to bridge!' : '⏳ Waiting for gas spike...'}
                    </p>
                  )}
                </div>
              ) : (
                <p>Connect wallet to see gas data</p>
              )}
            </div>

            {/* Threshold Controls */}
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="Gas threshold (gwei)"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="px-3 py-2 border rounded"
              />
              <button
                onClick={handleSetThreshold}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Set Threshold
              </button>
              <button
                onClick={handleSignRedeem}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Sign & Redeem Delegation
              </button>
              <button
                onClick={() => refetchGas()}
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Refresh ↻
              </button>
            </div>

            <button
              onClick={handleBridgeWithFee}
              disabled={!shouldTrigger || isPending}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              {isPending ? 'Bridging...' : 'Bridge Now (0.01 MON fee)'}
            </button>
          </div>
        )}

        <p className="mt-4 text-gray-600">{status}</p>

        {!isConnected && <p className="mt-4">Connect your wallet to see live gas monitoring!</p>}
      </main>
    </>
  );
}