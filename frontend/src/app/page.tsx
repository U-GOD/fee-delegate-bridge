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

      {/* Main Content */}
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
        <div className="container mx-auto max-w-4xl px-4">
          
          {/* Hero Section */}
          {isConnected && (
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-200 rounded-full mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700 font-medium">Live Monitoring Active</span>
              </div>
              
              <h2 className="text-4xl font-bold text-gray-900 mb-3">
                Gas Fee Monitor & Auto-Bridge
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-6">
                Save on gas fees! Deposit on Base Sepolia, set your threshold, and automatically bridge to Monad when Base gas is cheap. Your funds will be swapped to USDC on Monad.
              </p>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  depositBalance && Number(depositBalance) > 0 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    depositBalance && Number(depositBalance) > 0 ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">Funded</span>
                </div>
                <div className="w-8 h-0.5 bg-gray-300"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  threshold 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    threshold ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">Threshold Set</span>
                </div>
                <div className="w-8 h-0.5 bg-gray-300"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  hasSession 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    hasSession ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">Session Created</span>
                </div>
                <div className="w-8 h-0.5 bg-gray-300"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                  isAuthorized 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isAuthorized ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="font-medium">Authorized</span>
                </div>
              </div>
            </div>
          )}

          {/* Chain Flow Explanation */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-xl p-6 mb-6 text-white">
            <h3 className="text-2xl font-bold mb-4">How It Works: Cross-Chain Gas Optimization</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h4 className="font-bold mb-2">1. Deposit on Base Sepolia</h4>
                <p className="text-sm text-blue-100">High gas fees, but you deposit when YOU choose</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-bold mb-2">2. Auto-Bridge When Cheap</h4>
                <p className="text-sm text-blue-100">Agent monitors gas, bridges when Base fees drop below your threshold</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-bold mb-2">3. Receive USDC on Monad</h4>
                <p className="text-sm text-blue-100">Low gas, auto-swapped to USDC at $2000/ETH</p>
              </div>
            </div>
          </div>

          {isConnected && (
            <div className="space-y-6">
              
              {/* STEP 1: Deposit Funds */}
              <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Deposit Funds on Base Sepolia</h3>
                    <p className="text-sm text-gray-500">Deposit ETH that will be bridged to Monad when gas is cheap</p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-900">Your Balance</span>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">
                        {depositBalance !== undefined 
                          ? `${(Number(depositBalance) / 1e18).toFixed(4)}` 
                          : '0.0000'}
                      </p>
                      <p className="text-xs text-gray-500">ETH (Base Sepolia)</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount to deposit"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                      />
                      <button
                        onClick={handleDeposit}
                        disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
                      >
                        Deposit
                      </button>
                    </div>

                    {/* Quick amounts */}
                    <div className="grid grid-cols-3 gap-2">
                      {['0.1', '0.5', '1'].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setDepositAmount(amount)}
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-sm font-medium transition-colors"
                        >
                          {amount} ETH
                        </button>
                      ))}
                    </div>

                    {/* Withdraw */}
                    {depositBalance !== undefined && Number(depositBalance) > 0 && (
                      <button
                        onClick={handleWithdraw}
                        className="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm transition-colors"
                      >
                        Withdraw All
                      </button>
                    )}
                  </div>

                  <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> Each bridge transfers 0.1 ETH from Base to Monad. Deposit enough for multiple automated bridges. Plus gas fees for LayerZero (~0.01 ETH per bridge).
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 2: Set Gas Threshold */}
              <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Set Gas Threshold</h3>
                    <p className="text-sm text-gray-500">Define when to trigger auto-bridge</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Threshold (Gwei)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="e.g., 50"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                    />
                    <button
                      onClick={handleSetThreshold}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold transition-colors whitespace-nowrap"
                    >
                      Set Threshold
                    </button>
                  </div>
                  
                  {threshold && (
                    <div className="mt-3 p-3 bg-green-100 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>Active threshold:</strong> Bridge will trigger when Base Sepolia gas drops below {threshold} Gwei (cheaper gas = bridge now!)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3: Create Session Account (Show if NO session) */}
              {!hasSession && (
                <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      3
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Create Session Account</h3>
                      <p className="text-sm text-gray-500">Set up automated bridging</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-2">
                        Ready for Automation
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Create a temporary smart account that will execute bridges on your behalf when gas prices spike.
                      </p>
                      <ul className="text-sm text-gray-600 space-y-2 text-left max-w-md mx-auto mb-6">
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Secured by MetaMask Delegation Toolkit</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Stored locally on this device only</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Can be revoked anytime</span>
                        </li>
                      </ul>
                      
                      <button
                        onClick={createSession}
                        disabled={sessionLoading}
                        className="w-full px-6 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        {sessionLoading ? 'Creating Smart Account...' : 'Create Session Account'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Authorize Session (Show if session exists but NOT authorized) */}
              {hasSession && !isAuthorized && (
                <div className="bg-white rounded-2xl shadow-lg border-2 border-orange-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      4
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Authorize Session</h3>
                      <p className="text-sm text-gray-500">Grant on-chain permission</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-xl border border-orange-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-orange-500 rounded-lg flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-2 text-orange-900">
                          One More Step!
                        </h4>
                        <p className="text-sm text-orange-800 mb-4">
                          Your smart account is created but needs on-chain authorization to bridge automatically.
                          This is a one-time transaction that grants permission to the contract.
                        </p>
                        <button
                          onClick={handleAuthorizeSession}
                          disabled={isGrantingPermission}
                          className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
                        >
                          {isGrantingPermission ? 'Authorizing...' : 'Authorize Smart Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Success Banner (Show when fully authorized) */}
              {hasSession && isAuthorized && (
                <div className="bg-white rounded-2xl shadow-lg border-2 border-green-300 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-500 rounded-lg flex-shrink-0">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-2xl mb-2 text-green-900">
                        All Set! Automation Active
                      </h3>
                      <p className="text-green-800 mb-4">
                        Your MetaMask Smart Account is fully configured and monitoring gas prices. 
                        When gas exceeds your threshold, the bridge will execute automatically.
                      </p>
                      <div className="flex gap-3">
                        <div className="flex-1 p-3 bg-green-100 rounded-lg text-center">
                          <p className="text-sm text-green-700 font-medium">Balance</p>
                          <p className="text-lg font-bold text-green-900">
                            {depositBalance ? `${(Number(depositBalance) / 1e18).toFixed(4)} ETH` : '0 ETH'}
                          </p>
                        </div>
                        <div className="flex-1 p-3 bg-green-100 rounded-lg text-center">
                          <p className="text-sm text-green-700 font-medium">Threshold</p>
                          <p className="text-lg font-bold text-green-900">{threshold || '--'} Gwei</p>
                        </div>
                        <div className="flex-1 p-3 bg-green-100 rounded-lg text-center">
                          <p className="text-sm text-green-700 font-medium">Status</p>
                          <p className="text-lg font-bold text-green-900">Active</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gas Monitor (Show when authorized) */}
              {hasSession && isAuthorized && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <GasMonitor
                      isLoading={gasLoading}
                      error={gasError}
                      currentGas={Number(currentGas)}
                      threshold={threshold}
                      shouldTrigger={shouldTrigger}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Bridge Control</h3>
                      <button
                        onClick={handleBridgeWithFee}
                        disabled={!shouldTrigger || isPending}
                        className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg disabled:shadow-none transition-all duration-200"
                      >
                        {isPending ? 'Bridging...' : shouldTrigger ? 'Bridge Now' : 'Waiting for Trigger'}
                      </button>
                      <p className="text-sm text-gray-500 mt-3 text-center">
                        {shouldTrigger 
                          ? 'Base gas is below your threshold - cheap to bridge now!' 
                          : `Waiting for Base gas to drop below ${threshold} Gwei`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Details (Show when session exists) */}
              {hasSession && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Session Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Session Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-white px-3 py-2 rounded-lg flex-1 text-gray-800 border border-blue-200">
                          {sessionAddress}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sessionAddress || '');
                            setStatus('Address copied!');
                          }}
                          className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Authorization Status</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isAuthorized ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                        <span className={`font-bold ${isAuthorized ? 'text-green-700' : 'text-orange-700'}`}>
                          {isAuthorized ? 'Active' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => window.open(`https://monad-testnet.socialscan.io/address/${sessionAddress}`, '_blank')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      View on Explorer
                    </button>
                    <button
                      onClick={revokeSession}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Revoke Session
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Status Message Toast */}
          {status && (
            <div className="fixed bottom-4 right-4 px-6 py-3 bg-gray-900 text-white rounded-lg shadow-2xl animate-slide-up z-50">
              {status}
            </div>
          )}

          {/* Connect Wallet Prompt */}
          {!isConnected && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-600 mb-6">
                  Connect your wallet to start monitoring gas fees and enable automated bridging.
                </p>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    Click the "Connect Wallet" button in the header to get started
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