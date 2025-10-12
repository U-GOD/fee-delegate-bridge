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
import Header from '@/components/Header';
import GasMonitor from '@/components/GasMonitor';
import ActionPanel from '@/components/ActionPanel';

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
  const [depositAmount, setDepositAmount] = useState('');

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

  const agentAddress = '0x4Ba57f31431CFAe7C6e67eD91116CDAFCD3883Af';

  const agentAbi = [
    {
      name: 'setGasThreshold',
      type: 'function',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      name: 'deposit',
      type: 'function',
      inputs: [],
      outputs: [],
      stateMutability: 'payable',
    },
    {
      name: 'withdraw',
      type: 'function',
      inputs: [{ name: '_amount', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      name: 'getDeposit',
      type: 'function',
      inputs: [{ name: '_user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
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
    {
      name: 'isSessionAuthorized',
      type: 'function',
      inputs: [
        { name: '_user', type: 'address' },
        { name: '_sessionAccount', type: 'address' }
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
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

  const { data: depositBalance, refetch: refetchDeposit } = useReadContract({
    address: agentAddress,
    abi: agentAbi,
    functionName: 'getDeposit',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refresh every 10 seconds
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

  // Handle deposit
  const handleDeposit = async () => {
    if (!walletClient || !address) {
      setStatus('❌ Wallet not connected');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setStatus('❌ Enter a valid deposit amount');
      return;
    }

    try {
      setStatus('💰 Depositing funds...');

      const hash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      });

      setStatus(`✅ Deposited ${depositAmount} MON! Tx: ${hash.substring(0, 10)}...`);
      console.log('✅ Deposit tx:', hash);
      setDepositAmount(''); // Clear input
      
      // Force immediate refresh
      refetchDeposit();
      
      // Also refresh after 2 seconds to ensure confirmation
      setTimeout(() => {
        refetchDeposit();
        console.log('🔄 Deposit balance refreshed');
      }, 2000);

    } catch (error: unknown) {
      console.error('❌ Deposit error:', error);
      setStatus(`❌ Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Debug: Log deposit balance
  useEffect(() => {
    console.log('💰 Deposit Balance Debug:', {
      raw: depositBalance,
      formatted: depositBalance ? (Number(depositBalance) / 1e18).toFixed(4) : '0',
      isGreaterThanZero: depositBalance ? Number(depositBalance) > 0 : false
    });
  }, [depositBalance]);

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!walletClient || !address) {
      setStatus('❌ Wallet not connected');
      return;
    }

    if (!depositBalance || depositBalance === BigInt(0)) {
      setStatus('❌ No funds to withdraw');
      return;
    }

    try {
      setStatus('💸 Withdrawing funds...');

      const hash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'withdraw',
        args: [depositBalance], // Withdraw full balance
      });

      setStatus(`✅ Withdrew ${(Number(depositBalance) / 1e18).toFixed(4)} MON! Tx: ${hash.substring(0, 10)}...`);
      console.log('✅ Withdraw tx:', hash);
      
      // Force immediate refresh
      refetchDeposit();
      
      // Also refresh after 2 seconds
      setTimeout(() => {
        refetchDeposit();
        console.log('🔄 Deposit balance refreshed');
      }, 2000);

    } catch (error: unknown) {
      console.error('❌ Withdraw error:', error);
      setStatus(`❌ Withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Extract gas data for display
  const [currentGas, shouldTrigger] = gasData || [0, false];

  return (
    <>
      {/* Header Component */}
      <Header />

      {/* Main Content with Enhanced Background */}
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
        <div className="container mx-auto max-w-7xl px-4">
          
          {/* Hero Section - Enhanced with better spacing */}
          {isConnected && (
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-200 rounded-full mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700 font-medium">Live Monitoring Active</span>
              </div>
              
              <h2 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gas Fee Monitor & Auto-Bridge
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Automate your cross-chain bridging based on real-time gas prices. 
                Set your threshold and let our smart account handle the rest.
              </p>
            </div>
          )}

          {isConnected && (
            <>
              {/* Main Dashboard Grid - Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Gas Monitor - Takes 2 columns on large screens */}
                <div className="lg:col-span-2">
                  <GasMonitor
                    isLoading={gasLoading}
                    error={gasError}
                    currentGas={Number(currentGas)}
                    threshold={threshold}
                    shouldTrigger={shouldTrigger}
                  />
                </div>

                {/* Action Panel - Takes 1 column */}
                <div className="lg:col-span-1">
                  <ActionPanel
                    threshold={threshold}
                    setThreshold={setThreshold}
                    onSetThreshold={handleSetThreshold}
                    onDelegate={handleAuthorizeSession}
                    onBridge={handleBridgeWithFee}
                    shouldTrigger={shouldTrigger}
                    isPending={isPending}
                    depositAmount={depositAmount}
                    setDepositAmount={setDepositAmount}
                    onDeposit={handleDeposit}
                    depositBalance={depositBalance}
                    onWithdraw={handleWithdraw}
                  />
                </div>
              </div>

              {/* Session Status - Full Width Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MetaMask Smart Account Status</h3>
                    <p className="text-sm text-gray-500">Manage your delegation session</p>
                  </div>
                </div>
                
                {sessionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin h-8 w-8 border-3 border-blue-500 rounded-full border-t-transparent"></div>
                      <p className="text-gray-600">Loading session status...</p>
                    </div>
                  </div>
                ) : hasSession ? (
                  <div className="space-y-4">
                    {/* Session Info Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Session Address Card */}
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">📍</span>
                          <p className="text-sm font-semibold text-gray-700">Session Smart Account</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-white px-3 py-2 rounded-lg flex-1 text-gray-800 border border-blue-200">
                            {sessionAddress}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(sessionAddress || '');
                              setStatus('📋 Address copied to clipboard!');
                            }}
                            className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                            title="Copy address"
                          >
                            📋
                          </button>
                        </div>
                      </div>

                      {/* Authorization Status Card */}
                      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">⚡</span>
                          <p className="text-sm font-semibold text-gray-700">Authorization Status</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {isAuthorized ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                                <span className="text-green-700 font-bold">Active</span>
                              </div>
                              <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full font-medium">
                                ✓ Can auto-bridge
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                <span className="text-orange-700 font-bold">Inactive</span>
                              </div>
                              <span className="text-xs text-orange-600 bg-orange-100 px-3 py-1 rounded-full font-medium">
                                ⚠ Needs authorization
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          window.open(
                            `https://monad-testnet.socialscan.io/tx/${sessionAddress}`,
                            '_blank'
                          );
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        🔍 View on Explorer
                      </button>
                      <button
                        onClick={revokeSession}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                      >
                        🗑️ Revoke Session
                      </button>
                    </div>

                    {/* Info Box */}
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
                      <div className="flex gap-3">
                        <span className="text-xl">ℹ️</span>
                        <div>
                          <p className="font-semibold text-blue-900 mb-1">About Your Smart Account</p>
                          <p className="text-sm text-blue-800">
                            This temporary account bridges assets on your behalf when gas fees exceed your threshold. 
                            It&apos;s secured by MetaMask&apos;s delegation system and stored locally on this device.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* First-Time User Card */}
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-dashed border-purple-200">
                      <div className="text-center">
                        <span className="text-4xl mb-3 block">🚀</span>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">
                          Welcome to Automated Bridging!
                        </h4>
                        <p className="text-gray-600 mb-4">
                          Create a Smart Account session to enable automated bridging when gas fees spike.
                        </p>
                        <ul className="text-sm text-gray-600 space-y-2 text-left max-w-md mx-auto">
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Secured by MetaMask Delegation Toolkit</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Works only on this device</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500 font-bold">✓</span>
                            <span>Can be revoked anytime</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    <button
                      onClick={createSession}
                      disabled={sessionLoading}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-xl hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold text-lg transition-all duration-200"
                    >
                      {sessionLoading ? '⏳ Creating Your Smart Account...' : '✨ Create Session Account'}
                    </button>
                  </div>
                )}
              </div>

              {/* Authorization Alert - Only show if session exists but not authorized */}
              {hasSession && !isAuthorized && (
                <div className="p-5 border-2 border-orange-400 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 mb-6 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2 text-orange-900">
                        Authorization Required
                      </h3>
                      <p className="text-sm text-orange-800 mb-4">
                        Your Smart Account needs on-chain authorization to bridge automatically.
                        This is a one-time transaction that grants permission.
                      </p>
                      <button
                        onClick={handleAuthorizeSession}
                        disabled={isGrantingPermission}
                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors shadow-md hover:shadow-lg"
                      >
                        {isGrantingPermission ? '⏳ Authorizing...' : '🔑 Authorize Smart Account Now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Banner - After authorization */}
              {hasSession && isAuthorized && permissionsGranted && (
                <div className="p-5 border-2 border-green-400 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 mb-6 shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-2 text-green-900">
                        All Set! Automation Ready
                      </h3>
                      <p className="text-sm text-green-800">
                        Your MetaMask Smart Account is authorized and ready to bridge automatically
                        when gas exceeds your threshold. You can now sit back and relax!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Status Message */}
          {status && (
            <div className="fixed bottom-4 right-4 px-6 py-3 bg-gray-900 text-white rounded-lg shadow-2xl animate-slide-up">
              {status}
            </div>
          )}

          {/* Connect Wallet Prompt */}
          {!isConnected && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md">
                <span className="text-6xl mb-4 block">🔌</span>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-600 mb-6">
                  Connect your wallet to start monitoring gas fees and enable automated bridging.
                </p>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    👆 Click the &quot;Connect Wallet&quot; button in the header to get started
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}