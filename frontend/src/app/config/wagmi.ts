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
      // http: ['https://testnet-rpc.monad.xyz'] Alternative RPC
      http: ['https://testnet.monad.xyz/rpc']
    } 
  },
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
});

// Wagmi config
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: { [monadTestnet.id]: http() },
  // autoConnect: false,
  ssr: true,
});