// // src/app/config/wagmi.ts
import { createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';

// Define Monad testnet chain (custom, as not built-in)
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
});

// Wagmi config (Monad chain, MetaMask connector, RPC transport, disable auto-connect)
export const config = createConfig({
  chains: [monadTestnet],  // Use monadTestnet
  connectors: [injected()],
  transports: { [monadTestnet.id]: http() },  // Use monadTestnet.id
  autoConnect: false,  // Disable auto-connect—require button click
  ssr: true,  // Enable SSR support for initial state matching
});



// import { getDefaultConfig } from '@rainbow-me/rainbowkit';
// import { baseSepolia } from 'viem/chains';

// export const config = getDefaultConfig({
//   appName: 'FeeDelegate Bridge',
//   projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
//   chains: [baseSepolia],
//   ssr: true, // Required for Next.js App Router
// });