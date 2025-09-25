'use client';

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { toHex } from 'viem';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [threshold, setThreshold] = useState('');
  const [status, setStatus] = useState('');

  const agentAddress = '0x85fbD8781411b607e07D9c28a9459D49DE1dcfA0';

  // Updated ABI with the simple function
  const agentAbi = [
    {
      name: 'setGasThreshold',
      type: 'function',
      inputs: [{ name: '_threshold', type: 'uint256' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
    {
      name: 'redeemDelegationSimple', // Use the simple version
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
    }
  ] as const;

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
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
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
      const monadId = 10143n;
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

      // Simple delegation payload - no signature needed
      const delegationPayload = {
        delegator: address, // Current user's address
        delegatee: agentAddress, // Your contract address
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        caveats: [],
        salt: BigInt(Math.floor(Math.random() * 1000000)),
        expiration: BigInt(Math.floor(Date.now() / 1000) + 86400) // 24 hours
      };

      console.log('Delegation payload:', delegationPayload);

      setStatus('Redeeming delegation (no signature needed)...');

      // Call the SIMPLE version that doesn't require signature verification
      const txHash = await walletClient.writeContract({
        address: agentAddress,
        abi: agentAbi,
        functionName: 'redeemDelegationSimple', // Use the simple function
        args: [delegationPayload],
      });

      setStatus(`Delegation redeemed successfully! Tx: ${txHash}`);
      
    } catch (error: any) {
      console.error('Delegation error:', error);
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">FeeDelegate Bridge</h1>
      
      <ConnectButton />

      {isConnected && (
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="number" 
            placeholder="Gas threshold (gwei)" 
            value={threshold} 
            onChange={(e) => setThreshold(e.target.value)} 
            style={{ padding: '5px', marginRight: '10px' }} 
          />
          <button onClick={handleSetThreshold} style={{ padding: '10px', marginRight: '10px' }}>
            Set Threshold
          </button>
          <button onClick={handleSignRedeem} style={{ padding: '10px' }}>
            Sign & Redeem Delegation
          </button>
        </div>
      )}
      <p style={{ marginTop: '10px' }}>{status}</p>
      
      <p className="mt-4">Connect your wallet to get started!</p>
    </main>
  );
}



// 'use client';

// import { useState } from 'react';
// import { useAccount, useWalletClient } from 'wagmi';
// import { ConnectButton } from '@rainbow-me/rainbowkit';
// import { toHex, keccak256, encodeAbiParameters, parseAbiParameters, hashMessage } from 'viem';

// export default function Home() {
//   const { address, isConnected } = useAccount();
//   const { data: walletClient } = useWalletClient();
//   const [threshold, setThreshold] = useState('');
//   const [status, setStatus] = useState('');

//   const agentAddress = '0xa5262b3CF38fA74010A3873974b17EF53b81deE3';

//   const agentAbi = [
//     {
//       name: 'setGasThreshold',
//       type: 'function',
//       inputs: [{ name: '_threshold', type: 'uint256' }],
//       outputs: [],
//       stateMutability: 'nonpayable',
//     },
//     {
//       name: 'redeemDelegation',
//       type: 'function',
//       inputs: [
//         {
//           name: '_del',
//           type: 'tuple',
//           components: [
//             { name: 'delegator', type: 'address' },
//             { name: 'delegatee', type: 'address' },
//             { name: 'authority', type: 'bytes32' },
//             {
//               name: 'caveats',
//               type: 'tuple[]',
//               components: [
//                 { name: 'enforcer', type: 'address' },
//                 { name: 'data', type: 'bytes' }
//               ]
//             },
//             { name: 'salt', type: 'uint256' },
//             { name: 'expiration', type: 'uint256' }
//           ]
//         },
//         { name: '_signature', type: 'bytes' }
//       ],
//       outputs: [],
//       stateMutability: 'nonpayable',
//     }
//   ] as const;

//   const handleSetThreshold = async () => {
//     if (!walletClient || !threshold) return setStatus('Enter threshold and connect');
//     setStatus('Setting threshold...');
//     try {
//       const hash = await walletClient.writeContract({
//         address: agentAddress,
//         abi: agentAbi,
//         functionName: 'setGasThreshold',
//         args: [BigInt(threshold)],
//       });
//       setStatus(`Threshold set! Tx: ${hash}`);
//     } catch (error: any) {
//       setStatus(`Error: ${error.message}`);
//     }
//   };

//   const handleSignRedeem = async () => {
//     console.log('=== DEBUG START ===');
    
//     if (!walletClient || !address) {
//       setStatus('Wallet not ready');
//       return;
//     }

//     try {
//       setStatus('Starting ERC-7710 compliant delegation...');

//       // Build delegation exactly as contract expects
//       const delegation = {
//         delegator: address,
//         delegatee: agentAddress,
//         authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
//         caveats: [],
//         salt: BigInt(Math.floor(Math.random() * 1000000)),
//         expiration: BigInt(Math.floor(Date.now() / 1000) + 86400) // 24 hours
//       };

//       console.log('Delegation object:', delegation);

//       // Encode exactly as Solidity's abi.encode() would
//       // This matches: keccak256(abi.encode(delegation)) in the contract
//       const encodedDelegation = encodeAbiParameters(
//         [
//           {
//             type: 'tuple',
//             components: [
//               { name: 'delegator', type: 'address' },
//               { name: 'delegatee', type: 'address' },
//               { name: 'authority', type: 'bytes32' },
//               { 
//                 name: 'caveats', 
//                 type: 'tuple[]',
//                 components: [
//                   { name: 'enforcer', type: 'address' },
//                   { name: 'data', type: 'bytes' }
//                 ]
//               },
//               { name: 'salt', type: 'uint256' },
//               { name: 'expiration', type: 'uint256' }
//             ]
//           }
//         ],
//         [delegation]
//       );

//       console.log('Encoded delegation:', encodedDelegation);

//       // Hash it exactly as the contract does
//       const payloadHash = keccak256(encodedDelegation);
//       console.log('Payload hash (keccak256 of encoded):', payloadHash);

//       // Add Ethereum signed message prefix (EXACTLY as contract does)
//       const ethSignedMessageHash = hashMessage({ raw: payloadHash });
//       console.log('Ethereum signed message hash:', ethSignedMessageHash);

//       setStatus('Signing delegation hash...');

//       // Sign the exact hash that contract will verify
//       const signature = await walletClient.signMessage({
//         message: { raw: ethSignedMessageHash }
//       });

//       console.log('Signature obtained:', signature);

//       setStatus('Redeeming on-chain...');

//       const txHash = await walletClient.writeContract({
//         address: agentAddress,
//         abi: agentAbi,
//         functionName: 'redeemDelegation',
//         args: [delegation, signature],
//       });

//       console.log('Transaction hash:', txHash);
//       setStatus(`Delegation redeemed! Tx: ${txHash}`);

//     } catch (error: any) {
//       console.error('Error details:', error);
//       setStatus(`Error: ${error.message}`);
//     }
//   };

//   return (
//     <main className="p-8">
//       <h1 className="text-2xl font-bold mb-4">FeeDelegate Bridge</h1>
      
//       <ConnectButton />

//       {isConnected && (
//         <div style={{ marginBottom: '20px' }}>
//           <input 
//             type="number" 
//             placeholder="Gas threshold (gwei)" 
//             value={threshold} 
//             onChange={(e) => setThreshold(e.target.value)} 
//             style={{ padding: '5px', marginRight: '10px' }} 
//           />
//           <button onClick={handleSetThreshold} style={{ padding: '10px', marginRight: '10px' }}>
//             Set Threshold
//           </button>
//           <button onClick={handleSignRedeem} style={{ padding: '10px' }}>
//             Sign & Redeem Delegation
//           </button>
//         </div>
//       )}
//       <p style={{ marginTop: '10px' }}>{status}</p>
      
//       <p className="mt-4">Connect your wallet to get started!</p>
//     </main>
//   );
// }