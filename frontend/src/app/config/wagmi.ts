import { createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';

// Define Monad testnet chain (custom, as not built-in)
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  rpcUrls: { default: { http: ['https://testnet.monad.xyz/rpc'] } },
  nativeCurrency: { name: 'Monad', symbol: 'MONAD', decimals: 18 },
});

// Wagmi config (Monad chain, MetaMask connector, RPC transport)
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],  // Connector for MetaMask
  transports: { [monadTestnet.id]: http() },
});