'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { createWalletClient, toHex, custom, createPublicClient, http, encodeFunctionData, parseEther } from 'viem';
import { bundlerConfig, isBundlerConfigured } from './config/bundler';
import { useSessionAccount } from '@/hooks/useSessionAccount';
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental';
import { monadTestnet } from './config/wagmi';
import { createBundlerClient } from 'viem/account-abstraction';

// Type declaration for MetaMask's experimental wallet_grantPermissions
// declare global {
//   interface Window {
//     ethereum?: {
//       request: (args: { method: string; params?: any[] }) => Promise<any>;
//       isMetaMask?: boolean;
//     };
//   }
// }

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [threshold, setThreshold] = useState('');
  const [status, setStatus] = useState('');

  const {
    sessionAddress,
    smartAccount,
    createSession,
    revokeSession,
    hasSession,
    isLoading: sessionLoading
  } = useSessionAccount();

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionsContext, setPermissionsContext] = useState<string | null>(null);
  const [delegationManager, setDelegationManager] = useState<`0x${string}` | null>(null);
  const [isGrantingPermission, setIsGrantingPermission] = useState(false);
  
  useEffect(() => {
    if (isBundlerConfigured()) {
      console.log('✅ Bundler configured:', {
        chainId: bundlerConfig.chainId,
        url: bundlerConfig.url.substring(0, 50) + '...', // Hide full API key
      });
    } else {
      console.warn('⚠️ Bundler not configured, check .env.local');
    }
  }, []);

  const agentAddress = '0x7B6831D2d1d65884cB1AFc051A364d8FEc2c444D';

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
    {
      name: 'authorizeSession',
      type: 'function',
      inputs: [{ name: '_sessionAccount', type: 'address' }],
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
  const { writeContract, isPending, error: writeError } = useWriteContract();

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

  // Create bundler client for sending user operations
  const getBundlerClient = useCallback(() => {
    if (!smartAccount) return null;
    
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });

    return createBundlerClient({
      client: publicClient,
      transport: http(bundlerConfig.url),
      paymaster: true, // Enable paymaster for gasless txs
    });
  }, [smartAccount]);

  // Check if session is authorized on-chain
  const { data: isAuthorized } = useReadContract({
    address: agentAddress,
    abi: agentAbi,
    functionName: 'isSessionAuthorized',
    args: [address as `0x${string}`, sessionAddress as `0x${string}`],
    query: {
      enabled: !!address && !!sessionAddress,
      refetchInterval: 10000, // Check every 10 seconds
    },
  });

  const handleBridgeWithFee = async () => {
    if (!address || !shouldTrigger) {
      setStatus('❌ Bridge conditions not met');
      return;
    }

    if (!smartAccount || !sessionAddress) {
      setStatus('❌ No Smart Account - create session first');
      return;
    }

    try {
      setStatus('🚀 Preparing bridge via Smart Account...');
      
      const bundlerClient = getBundlerClient();
      if (!bundlerClient) {
        throw new Error('Bundler client not available');
      }

      // Encode the bridge function call
      const bridgeCallData = encodeFunctionData({
        abi: agentAbi,
        functionName: 'checkGasAndBridge',
        args: [address],
      });

      console.log('📦 Sending user operation via Smart Account...');
      console.log('Smart Account:', sessionAddress);
      console.log('Target Contract:', agentAddress);

      // Send user operation via bundler
      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [{
          to: agentAddress,
          value: parseEther('0.01'), // 0.01 MON for LZ fee
          data: bridgeCallData,
        }],
        maxFeePerGas: BigInt(10 ** 9), // 1 gwei
        maxPriorityFeePerGas: BigInt(10 ** 9), // 1 gwei
      });

      setStatus(`✅ Bridge initiated! UserOp: ${userOpHash.substring(0, 10)}...`);
      console.log('✅ User Operation Hash:', userOpHash);

      // Wait for receipt
      setStatus('⏳ Waiting for confirmation...');
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      setStatus(`✅ Bridge complete! Tx: ${receipt.receipt.transactionHash.substring(0, 10)}...`);
      console.log('✅ Transaction Receipt:', receipt);

    } catch (error: unknown) {
      console.error('❌ Bridge error:', error);
      setStatus(`❌ Bridge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
  * Grant ERC-7715 permissions to session account
  * 
  * 1. Shows MetaMask popup asking user to grant permissions
  * 2. Permission: "Bridge up to 1 ETH over 1 week when gas > threshold"
  * 3. Stores permission context for later use
  * 4. Authorizes session account on-chain (calls Agent.authorizeSession)
  * 
  * two steps
  * - Off-chain permission (MetaMask) = User's consent
  * - On-chain authorization (Agent contract) = Smart contract's record
  */
 const handleAuthorizeSession = async () => {
  if (!walletClient || !address) {
    setStatus('❌ Wallet not connected');
    return;
  }

  if (!hasSession || !sessionAddress) {
    setStatus('❌ Please create a MetaMask Smart Account session first');
    return;
  }

  setIsGrantingPermission(true);
  setStatus('🔄 Authorizing MetaMask Smart Account...');

  try {
    const authHash = await walletClient.writeContract({
      address: agentAddress,
      abi: agentAbi,
      functionName: 'authorizeSession',
      args: [sessionAddress],
    });

    setStatus(`✅ Smart Account authorized! Tx: ${authHash.substring(0, 10)}...`);
    setPermissionsGranted(true);
    console.log('✅ Authorization tx:', authHash);

  } catch (error: unknown) {
    console.error('❌ Authorization error:', error);
    setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsGrantingPermission(false);
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

        {/* MetaMask Smart Account Authorization */}
        {isConnected && hasSession && (
          <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 mt-4">
            <h3 className="font-semibold mb-2">🔐 Authorize MetaMask Smart Account</h3>
            
            {permissionsGranted ? (
              <div className="space-y-2">
                <p className="text-green-600 font-semibold">✅ Smart Account authorized!</p>
                <p className="text-sm text-gray-600">
                  Your MetaMask Smart Account can now bridge when gas exceeds threshold.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-2">
                  Authorize your MetaMask Smart Account for automated bridging.
                </p>
                <button
                  onClick={handleAuthorizeSession}
                  disabled={isGrantingPermission}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded hover:from-purple-600 hover:to-blue-600 disabled:bg-gray-300"
                >
                  {isGrantingPermission ? '⏳ Authorizing...' : '🔑 Authorize Smart Account'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Session Status Panel */}
        {isConnected && (
          <div className="p-6 border-2 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 mt-4 shadow-md">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>🔐</span> MetaMask Smart Account Status
            </h3>
            
            {sessionLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                <p className="text-gray-600">Loading session...</p>
              </div>
            ) : hasSession ? (
              <div className="space-y-4">
                {/* Session Address Display */}
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Session Smart Account</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-gray-100 px-3 py-2 rounded flex-1">
                      {sessionAddress}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sessionAddress || '');
                        setStatus('📋 Address copied!');
                      }}
                      className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Authorization Status */}
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500 mb-2">Authorization Status</p>
                  <div className="flex items-center gap-3">
                    {isAuthorized ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-green-700 font-semibold">Authorized & Active</span>
                        </div>
                        <span className="text-xs text-gray-500 bg-green-50 px-2 py-1 rounded">
                          ✓ Can bridge automatically
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="text-orange-700 font-semibold">Not Authorized</span>
                        </div>
                        <span className="text-xs text-gray-500 bg-orange-50 px-2 py-1 rounded">
                          ⚠ Click "Authorize" below
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.open(
                        `https://monad-testnet.socialscan.io/tx/${sessionAddress}`,
                        '_blank'
                      );
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-2"
                  >
                    🔍 View on Explorer
                  </button>
                  <button
                    onClick={revokeSession}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm flex items-center gap-2"
                  >
                    🗑️ Revoke Session
                  </button>
                </div>

                {/* Info Box */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p className="font-semibold mb-1">ℹ️ What is this?</p>
                  <p>
                    This is a temporary MetaMask Smart Account that can bridge on your behalf
                    when gas fees exceed your threshold. It's stored locally on this device only.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-600 mb-3">
                    💡 <strong>First time here?</strong> Create a Smart Account session to enable
                    automated bridging when gas fees spike.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1 ml-6 list-disc">
                    <li>Secured by MetaMask Delegation Toolkit</li>
                    <li>Works only on this device</li>
                    <li>Can be revoked anytime</li>
                  </ul>
                </div>
                
                <button
                  onClick={createSession}
                  disabled={sessionLoading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg shadow-md"
                >
                  {sessionLoading ? '⏳ Creating Smart Account...' : '🚀 Create Session Account'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Authorization Section - Only show if session exists but not authorized */}
        {isConnected && hasSession && !isAuthorized && (
          <div className="p-4 border-2 border-orange-300 rounded-lg bg-orange-50 mt-4">
            <h3 className="font-semibold mb-2 text-orange-800 flex items-center gap-2">
              ⚠️ Authorization Required
            </h3>
            <p className="text-sm text-orange-700 mb-3">
              Your Smart Account needs on-chain authorization to bridge automatically.
              This is a one-time transaction.
            </p>
            <button
              onClick={handleAuthorizeSession}
              disabled={isGrantingPermission}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 font-semibold"
            >
              {isGrantingPermission ? '⏳ Authorizing...' : '🔑 Authorize Smart Account Now'}
            </button>
          </div>
        )}

        {/* Success message after authorization */}
        {isConnected && hasSession && isAuthorized && permissionsGranted && (
          <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50 mt-4">
            <h3 className="font-semibold mb-2 text-green-800 flex items-center gap-2">
              ✅ All Set! Automation Ready
            </h3>
            <p className="text-sm text-green-700">
              Your MetaMask Smart Account is authorized and ready to bridge automatically
              when gas exceeds your threshold.
            </p>
          </div>
        )}

        <p className="mt-4 text-gray-600">{status}</p>

        {!isConnected && <p className="mt-4">Connect your wallet to see live gas monitoring!</p>}
      </main>
    </>
  );
}