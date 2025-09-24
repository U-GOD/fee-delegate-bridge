import { createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';

// // Define Monad testnet chain (custom, as not built-in)
// export const monadTestnet = defineChain({
//   id: 10143,
//   name: 'Monad Testnet',
//   rpcUrls: { default: { http: ['https://testnet.monad.xyz/rpc'] } },
//   nativeCurrency: { name: 'Monad', symbol: 'MONAD', decimals: 18 },
// });

// // Wagmi config (Monad chain, MetaMask connector, RPC transport, disable auto-connect)
// export const config = createConfig({
//   chains: [monadTestnet],
//   connectors: [injected()],
//   transports: { [monadTestnet.id]: http() },
//   autoConnect: false,  // Disable auto-connect—require button click
//   ssr: true,  // Enable SSR support for initial state matching
// });

// Define Base Sepolia testnet chain (EVM-compatible alternative to Monad for easy tokens)
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
});

// Wagmi config (Base Sepolia chain, MetaMask connector, RPC transport, disable auto-connect)
export const config = createConfig({
  chains: [baseSepolia],  // Use baseSepolia instead of monadTestnet
  connectors: [injected()],
  transports: { [baseSepolia.id]: http() },  // Use baseSepolia.id
  autoConnect: false,  // Disable auto-connect—require button click
  ssr: true,  // Enable SSR support for initial state matching
});