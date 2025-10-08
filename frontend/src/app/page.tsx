'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { createWalletClient, toHex, custom } from 'viem';
import { bundlerConfig, isBundlerConfigured } from './config/bundler';
import { useSessionAccount } from '@/hooks/useSessionAccount';
import { erc7715ProviderActions } from '@metamask/delegation-toolkit/experimental';
import { monadTestnet } from './config/wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [threshold, setThreshold] = useState('');
  const [status, setStatus] = useState('');

  const {
    sessionAddress,
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

  const agentAddress = '0xA2EA4B31f0E36f18DBd5C21De4f82083d6d64E2d';

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
 const handleGrantPermission = async () => {
  if (!walletClient || !address) {
    setStatus('❌ Wallet not connected');
    return;
  }

  if (!hasSession || !sessionAddress) {
    setStatus('❌ Please create a session account first');
    return;
  }

  setIsGrantingPermission(true);
  setStatus('📝 Requesting permission from MetaMask...');

  try {
    // Step 1: Extend wallet client with ERC-7715 actions
    const extendedClient = createWalletClient({
      account: address,
      chain: monadTestnet,
      transport: custom(window.ethereum), // ✅ Now imports correctly
    }).extend(erc7715ProviderActions());

    console.log('🔑 Creating permission request...');

    // Step 2: Define permission parameters
    const currentTime = Math.floor(Date.now() / 1000);
    const oneWeek = 604800; // 7 days in seconds
    const expiry = currentTime + oneWeek;

    // Step 3: Request permission from MetaMask
    // ✅ Type assertion for experimental API
    const grantedPermissions = await (extendedClient as any).grantPermissions([{
      chainId: monadTestnet.id,
      expiry,
      signer: {
        type: 'account',
        data: {
          address: sessionAddress,
        },
      },
      permissions: [{
        type: 'native-token-stream',
        data: {
          initialAmount: BigInt(0),
          amountPerSecond: BigInt(1000000000000),
          maxAmount: BigInt(10 ** 18),
          startTime: currentTime,
          justification: 'Automated bridging when gas fees exceed threshold',
        },
      }],
    }]);

    console.log('✅ Permissions granted:', grantedPermissions);

    // Step 4: Extract important data from response
    const permission = grantedPermissions[0];
    const context = permission.context as string;
    const manager = permission.signerMeta?.delegationManager as `0x${string}`;

    if (!context || !manager) {
      throw new Error('Invalid permission response - missing context or delegation manager');
    }

    // Step 5: Store permission data for later use
    setPermissionsContext(context);
    setDelegationManager(manager);
    setPermissionsGranted(true);

    console.log('📋 Permission Context:', context.substring(0, 50) + '...');
    console.log('🏛️ Delegation Manager:', manager);

    // Step 6: Now authorize session on-chain
    setStatus('🔄 Authorizing session on Agent contract...');

    const authHash = await walletClient.writeContract({
      address: agentAddress,
      abi: agentAbi,
      functionName: 'authorizeSession',
      args: [sessionAddress],
    });

    setStatus(`✅ Permission granted! Session authorized. Tx: ${authHash.substring(0, 10)}...`);
    console.log('✅ On-chain authorization tx:', authHash);

  } catch (error: unknown) {
    console.error('❌ Permission error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        setStatus('❌ Permission denied by user');
      } else {
        setStatus(`❌ Error: ${error.message}`);
      }
    } else {
      setStatus('❌ Unknown error occurred');
    }
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

        {/* Permission Request Section */}
        {isConnected && hasSession && (
          <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 mt-4">
            <h3 className="font-semibold mb-2">🔐 Grant Permission</h3>
            
            {permissionsGranted ? (
              <div className="space-y-2">
                <p className="text-green-600 font-semibold">✅ Permissions granted!</p>
                <p className="text-sm text-gray-600">
                  Your session account can now bridge up to 1 ETH when gas exceeds your threshold.
                </p>
                <button
                  onClick={() => {
                    setPermissionsGranted(false);
                    setPermissionsContext(null);
                    setDelegationManager(null);
                    setStatus('Permissions revoked locally');
                  }}
                  className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                >
                  Clear Permission (Local)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-2">
                  Grant permission for your session account to bridge assets automatically when gas fees spike.
                </p>
                <button
                  onClick={handleGrantPermission}
                  disabled={isGrantingPermission || !hasSession}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded hover:from-purple-600 hover:to-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isGrantingPermission ? '⏳ Requesting Permission...' : '🔑 Grant Permission'}
                </button>
                {!hasSession && (
                  <p className="text-sm text-red-500">
                    Create a session account first
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Session Account Display */}
        {isConnected && (
          <div className="p-4 border rounded-lg bg-blue-50 mt-4">
            <h3 className="font-semibold mb-2">Session Account Status</h3>
            
            {sessionLoading ? (
              <p>Loading session...</p>
            ) : hasSession ? (
              <div className="space-y-2">
                <p>
                  <strong>Session Address:</strong>{' '}
                  <code className="text-sm bg-gray-200 px-2 py-1 rounded">
                    {sessionAddress?.substring(0, 6)}...{sessionAddress?.substring(38)}
                  </code>
                </p>
                <p className="text-sm text-green-600">✅ Session active</p>
                <button
                  onClick={revokeSession}
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                >
                  Revoke Session
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  No session account yet. Create one to enable automated bridging.
                </p>
                <button
                  onClick={createSession}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create Session Account
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-gray-600">{status}</p>

        {!isConnected && <p className="mt-4">Connect your wallet to see live gas monitoring!</p>}
      </main>
    </>
  );
}