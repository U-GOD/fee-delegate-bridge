// frontend/src/app/config/wagmi.ts

import { createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';

// Define Monad testnet chain
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  rpcUrls: { 
    default: { 
      http: ['https://testnet-rpc.monad.xyz'] 
    } 
  },
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://monad-testnet.socialscan.io'
    }
  }
});

// Define Base Sepolia testnet chain
export const baseSepoliaTestnet = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  rpcUrls: { 
    default: { 
      http: ['https://sepolia.base.org'] 
    } 
  },
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org'
    }
  },
  testnet: true
});

// Wagmi config with BOTH chains
export const config = createConfig({
  chains: [monadTestnet, baseSepoliaTestnet],
  connectors: [injected()],
  transports: { 
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz', {
      timeout: 30_000 // 30 second timeout
    }),
    [baseSepoliaTestnet.id]: http('https://sepolia.base.org', {
      timeout: 30_000
    })
  },
  ssr: true,
});