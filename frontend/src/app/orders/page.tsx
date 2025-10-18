// frontend/src/app/orders/page.tsx
'use client';

import { useState } from 'react';
import { useAccount, useWalletClient, useReadContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useSessionAccount } from '@/hooks/useSessionAccount';
import Header from '@/components/Header';

export default function OrdersPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState('');

  const {
    sessionAddress,
    createSession,
    revokeSession,
    hasSession,
    isLoading: sessionLoading
  } = useSessionAccount();

  // LimitOrderAgent deployed address on Monad
  const limitOrderAgentAddress = '0x7FbaAA1E70a7D4Efcc0554BDa5416FEAAcacD4A1' as `0x${string}`;

  // ABI for LimitOrderAgent
  const agentAbi = [
    {
      name: 'deposit',
      type: 'function',
      inputs: [{ name: '_token', type: 'address' }, { name: '_amount', type: 'uint256' }],
      outputs: [],
      stateMutability: 'payable',
    },
    {
      name: 'createLimitOrder',
      type: 'function',
      inputs: [
        { name: '_tokenIn', type: 'address' },
        { name: '_tokenOut', type: 'address' },
        { name: '_amountIn', type: 'uint256' },
        { name: '_limitPrice', type: 'uint256' },
        { name: '_daysValid', type: 'uint256' },
        { name: '_isBuy', type: 'bool' }
      ],
      outputs: [{ name: 'orderId', type: 'uint256' }],
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
      inputs: [{ name: '_user', type: 'address' }, { name: '_session', type: 'address' }],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
    },
    {
      name: 'getDeposit',
      type: 'function',
      inputs: [{ name: '_user', type: 'address' }, { name: '_token', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    },
    {
      name: 'getCurrentPrice',
      type: 'function',
      inputs: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    },
    {
      name: 'mockPrice',
      type: 'function',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
    },
  ] as const;

  // Mock token addresses (ETH = address(0) for native)
  const ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const USDC_ADDRESS = '0x0000000000000000000000000000000000000002' as `0x${string}`;

  // State
  const [depositAmount, setDepositAmount] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [orderType, setOrderType] = useState<'sell' | 'buy'>('sell');

  // Read contract data
  const { data: depositBalance, refetch: refetchDeposit } = useReadContract({
    address: limitOrderAgentAddress,
    abi: agentAbi,
    functionName: 'getDeposit',
    args: [address!, ETH_ADDRESS],
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  const { data: isAuthorized } = useReadContract({
    address: limitOrderAgentAddress,
    abi: agentAbi,
    functionName: 'isSessionAuthorized',
    args: [address!, sessionAddress!],
    query: { enabled: !!address && !!sessionAddress, refetchInterval: 10000 },
  });

  const { data: currentPrice } = useReadContract({
    address: limitOrderAgentAddress,
    abi: agentAbi,
    functionName: 'mockPrice',
    query: { enabled: true, refetchInterval: 30000 },
  });

  // Handlers
  const handleDeposit = async () => {
    if (!walletClient || !depositAmount) return setStatus('❌ Enter amount');
    try {
      setStatus('💰 Depositing...');
      const hash = await walletClient.writeContract({
        address: limitOrderAgentAddress,
        abi: agentAbi,
        functionName: 'deposit',
        args: [ETH_ADDRESS, parseEther(depositAmount)],
        value: parseEther(depositAmount),
      });
      setStatus(`✅ Deposited! ${hash.slice(0, 10)}...`);
      setDepositAmount('');
      setTimeout(() => refetchDeposit(), 2000);
    } catch (error: unknown) {
      setStatus(`❌ ${error instanceof Error ? error.message : 'Error'}`);
    }
  };

  const handleCreateOrder = async () => {
    if (!walletClient || !orderAmount || !limitPrice) return setStatus('❌ Fill all fields');
    try {
      setStatus('📝 Creating order...');
      const hash = await walletClient.writeContract({
        address: limitOrderAgentAddress,
        abi: agentAbi,
        functionName: 'createLimitOrder',
        args: [
          ETH_ADDRESS,
          USDC_ADDRESS,
          parseEther(orderAmount),
          parseEther(limitPrice),
          BigInt(7), // 7 days expiration
          orderType === 'buy',
        ],
      });
      setStatus(`✅ Order created! ${hash.slice(0, 10)}...`);
      setOrderAmount('');
      setLimitPrice('');
    } catch (error: unknown) {
      setStatus(`❌ ${error instanceof Error ? error.message : 'Error'}`);
    }
  };

  const handleAuthorize = async () => {
    if (!walletClient || !sessionAddress) return setStatus('❌ No session');
    try {
      setStatus('🔐 Authorizing...');
      const hash = await walletClient.writeContract({
        address: limitOrderAgentAddress,
        abi: agentAbi,
        functionName: 'authorizeSession',
        args: [sessionAddress],
      });
      setStatus(`✅ Authorized! ${hash.slice(0, 10)}...`);
    } catch (error: unknown) {
      setStatus(`❌ ${error instanceof Error ? error.message : 'Error'}`);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 py-8">
        <div className="container mx-auto max-w-4xl px-4">
          
          {isConnected ? (
            <>
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  🎯 Automated Limit Orders
                </h1>
                <p className="text-gray-600 text-lg">
                  Set your target price, let automation execute for you
                </p>
                {currentPrice && (
                  <div className="mt-4 inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                    <p className="text-white text-2xl font-bold">
                      Current Price: ${(Number(currentPrice) / 1e18).toFixed(0)} / ETH
                    </p>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Deposit & Order */}
                <div className="space-y-6">
                  {/* Deposit */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200">
                    <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                      Deposit Funds
                    </h3>
                    <div className="p-3 bg-purple-50 rounded-lg mb-3">
                      <p className="text-sm text-gray-600">Your Balance</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {depositBalance ? formatEther(depositBalance) : '0'} MON
                      </p>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="number"
                        placeholder="Amount to deposit"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        step="0.1"
                      />
                      <button
                        onClick={handleDeposit}
                        disabled={!depositAmount}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 font-semibold transition-colors"
                      >
                        Deposit
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {['0.1', '0.5', '1'].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setDepositAmount(amt)}
                          className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-purple-100 transition-colors"
                        >
                          {amt} MON
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Create Order */}
                  <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-pink-200">
                    <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
                      Create Limit Order
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        onClick={() => setOrderType('sell')}
                        className={`py-2 rounded-lg font-semibold transition-colors ${
                          orderType === 'sell' ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        🔴 Sell Order
                      </button>
                      <button
                        onClick={() => setOrderType('buy')}
                        className={`py-2 rounded-lg font-semibold transition-colors ${
                          orderType === 'buy' ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        🟢 Buy Order
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="number"
                        placeholder="Amount (MON)"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:outline-none"
                        step="0.1"
                      />

                      <input
                        type="number"
                        placeholder="Target Price ($)"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:outline-none"
                        step="100"
                      />

                      <button
                        onClick={handleCreateOrder}
                        disabled={!orderAmount || !limitPrice}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 font-bold transition-colors"
                      >
                        Create {orderType === 'sell' ? 'Sell' : 'Buy'} Order
                      </button>
                    </div>

                    <div className="mt-3 p-3 bg-pink-50 rounded-lg">
                      <p className="text-xs text-pink-800">
                        <strong>Example:</strong> {orderType === 'sell' ? 'Sell 1 MON at $3500' : 'Buy 1 MON at $2500'}. 
                        Order expires in 7 days.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Session Management */}
                <div className="space-y-6">
                  {!hasSession ? (
                    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
                      <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
                        Enable Automation
                      </h3>
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Create a MetaMask Smart Account session to monitor prices and execute orders automatically 24/7.
                        </p>
                        <button
                          onClick={createSession}
                          disabled={sessionLoading}
                          className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-bold transition-colors"
                        >
                          {sessionLoading ? 'Creating Session...' : 'Create Session Account'}
                        </button>
                      </div>
                    </div>
                  ) : !isAuthorized ? (
                    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
                      <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
                        Authorize Session
                      </h3>
                      <div className="p-3 bg-orange-50 rounded-lg mb-4">
                        <p className="text-sm text-orange-800 mb-2">
                          <strong>Almost there!</strong> Grant on-chain permission for your session to execute orders automatically.
                        </p>
                      </div>
                      <button
                        onClick={handleAuthorize}
                        className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold transition-colors"
                      >
                        Authorize Session Account
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
                      <h3 className="font-bold text-xl mb-4 text-green-900 flex items-center gap-2">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ✅ Automation Active!
                      </h3>
                      <div className="space-y-3">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800 mb-2">
                            <strong>Your session is monitoring prices 24/7!</strong>
                          </p>
                          <p className="text-xs text-green-700">
                            When your limit order price is reached, the session will automatically execute the swap on your behalf.
                          </p>
                        </div>
                        
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-600 mb-1">Session Address</p>
                          <code className="text-xs break-all bg-white p-2 rounded block">{sessionAddress}</code>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-purple-50 rounded-lg text-center">
                            <p className="text-xs text-gray-600">Balance</p>
                            <p className="text-lg font-bold text-purple-600">
                              {depositBalance ? formatEther(depositBalance) : '0'}
                            </p>
                          </div>
                          <div className="p-3 bg-pink-50 rounded-lg text-center">
                            <p className="text-xs text-gray-600">Status</p>
                            <p className="text-lg font-bold text-green-600">Active</p>
                          </div>
                        </div>

                        <button
                          onClick={revokeSession}
                          className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-colors"
                        >
                          Revoke Session
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Info Card */}
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white">
                    <h3 className="font-bold text-lg mb-3">💡 How It Works</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-300">•</span>
                        <span>Set your target price (e.g., "Sell at $3500")</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-300">•</span>
                        <span>Session monitors price every 30 seconds</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-300">•</span>
                        <span>When price hits → automatic execution!</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-300">•</span>
                        <span>No more watching charts 24/7 📈</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-4 bg-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-gray-600 mb-6">
                Connect to Monad testnet to start creating automated limit orders
              </p>
              <div className="p-4 bg-purple-50 rounded-lg inline-block">
                <p className="text-sm text-purple-800">
                  Click "Connect Wallet" in the header and switch to Monad Testnet
                </p>
              </div>
            </div>
          )}

          {/* Status Toast */}
          {status && (
            <div className="fixed bottom-4 right-4 px-6 py-3 bg-gray-900 text-white rounded-lg shadow-2xl z-50 animate-slide-up">
              {status}
            </div>
          )}
        </div>
      </main>
    </>
  );
}