'use client';  // Client component for hooks (runs on browser)

import { useState } from 'react';  // useState for input/status
import { useAccount, useWalletClient } from 'wagmi';  // useAccount for isConnected/address, useWalletClient for txs
import { ConnectButton } from '@rainbow-me/rainbowkit';  // RainbowKit connect UI
import { toMetaMaskSmartAccount } from '@metamask/delegation-toolkit';
import { signDelegation } from '@metamask/delegation-toolkit/actions';  // Signs delegation payload
import { toHex } from 'viem';  // Utility for bigint to hex (for chain ID in switch)
import { useWallet } from '@rainbow-me/rainbowkit';  // RainbowKit hook for reliable wallet client

export default function Home() {
  const { address, isConnected } = useAccount();  // Hook for wallet status and address (from RainbowKit/Wagmi)
  const { data: walletClient } = useWalletClient();  // Hook for viem client (txs)
  const [threshold, setThreshold] = useState('');  // State for input value
  const [status, setStatus] = useState('');  // State for feedback (tx/error)

  const agentAddress = '0xa5262b3CF38fA74010A3873974b17EF53b81deE3';  // Deployed agent on Base Sepolia

  const agentAbi = [  // Minimal ABI for setGasThreshold (match Phase 1)
    {
      name: 'setGasThreshold',
      type: 'function',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ] as const;

  // Minimal ABI for redeemDelegation (match Step 2)
  const redeemAbi = [
    {
      name: 'redeemDelegation',
      type: 'function',
      inputs: [
        { name: '_del', type: 'tuple', components: [
          { name: 'delegator', type: 'address' },
          { name: 'delegatee', type: 'address' },
          { name: 'authority', type: 'bytes32' },
          { name: 'caveats', type: 'tuple[]', components: [
            { name: 'enforcer', type: 'address' },
            { name: 'data', type: 'bytes' },
          ] },
          { name: 'salt', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
        ] },
        { name: '_signature', type: 'bytes' },
      ],
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

  const handleSignRedeem = async () => {
    if (!walletClient) return setStatus('Connect first');
    if (!walletClient) {
      setStatus('Wallet not ready - try reconnecting');
      return;
    }
    console.log('Wallet client ready:', walletClient);  // Log to confirm non-null
    // Ensure on Base Sepolia chain
    const baseSepoliaId = 84532n;
    const currentChainId = await walletClient.getChainId();  // Get current chain ID
    if (currentChainId !== baseSepoliaId) {
      setStatus('Switching to Base Sepolia...');
      try {
        await walletClient.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: toHex(baseSepoliaId) }],  // Use toHex for bigint to hex chain ID
        });
        setStatus('Chain switched, creating smart account...');
      } catch (switchError) {
        setStatus(`Chain switch error: ${switchError.message}`);
        return;
      }
    }

    // Debug log
    console.log('Wallet client ready for smart account:', walletClient);
    console.log('Current chain ID:', currentChainId);

    setStatus('Creating smart account...');
    try {
      // Create smart account for AA signing (bundles ops)
      const smartAccount = await toMetaMaskSmartAccount(walletClient);

      // Build delegation payload (match Solidity struct from Step 1; empty caveats for MVP)
      const del = {
        delegator: address as `0x${string}`,
        delegatee: agentAddress as `0x${string}`,
        authority: '0xd6c66cad06fe14fdb6ce9297d80d32f24d7428996d0045cbf90cc345c677ba16' as `0x${string}`,  // Fixed keccak256("root")
        caveats: [] as any[],  // Empty; add encoded threshold later
        salt: 1n,
        expiration: BigInt(Math.floor(Date.now() / 1000) + 86400),  // 1 day from now
      };

      setStatus('Signing delegation...');
      // Sign payload (toolkit hashes abi.encode(del) + eth prefix, matches contract)
      const signature = await signDelegation(smartAccount, del as any);

      setStatus('Redeeming on-chain...');
      // Call redeemDelegation (viem encodes tuple ABI)
      const hash = await walletClient.writeContract({
        address: agentAddress,
        abi: redeemAbi,  // Use redeem ABI
        functionName: 'redeemDelegation',
        args: [del, signature],
      });
      setStatus(`Redeemed! Tx: ${hash}`);
      console.log('Delegation:', del, 'Sig:', signature, 'Tx:', hash);  // Debug in console
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error(error);  // Debug errors
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
      {isConnected && (
        <button onClick={handleSignRedeem} style={{ padding: '10px' }}>
          Sign & Redeem Delegation
        </button>
      )}
      <p style={{ marginTop: '10px' }}>{status}</p>
      
      <p className="mt-4">Connect your wallet to get started!</p>
    </main>
  );
}