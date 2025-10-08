// frontend/src/app/config/bundler.ts

import { http } from 'viem';
import { monadTestnet } from './wagmi';

/**
 * Pimlico Bundler Configuration for Monad Testnet
 */

// Get API key from environment (set in .env.local)
const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;

if (!PIMLICO_API_KEY) {
  console.warn('⚠️ PIMLICO_API_KEY not found in environment variables');
}

/**
 * Pimlico bundler endpoint URL
 * Format: https://api.pimlico.io/v2/{chainId}/rpc?apikey={key}
 */
export const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/${monadTestnet.id}/rpc?apikey=${PIMLICO_API_KEY}`;

/**
 * Pimlico paymaster URL (for gas sponsorship)
 * Optional to sponsor user gas
 */
export const PIMLICO_PAYMASTER_URL = `https://api.pimlico.io/v2/${monadTestnet.id}/rpc?apikey=${PIMLICO_API_KEY}`;

/**
 * Bundler transport for viem client
 */
export const bundlerTransport = http(PIMLICO_BUNDLER_URL, {
  timeout: 30_000, // 30 second timeout for bundler operations
});

/**
 * Helper to check if bundler is configured
 */
export function isBundlerConfigured(): boolean {
  return !!PIMLICO_API_KEY && PIMLICO_API_KEY !== 'your_api_key_here';
}

/**
 * Bundler configuration object
 */
export const bundlerConfig = {
  url: PIMLICO_BUNDLER_URL,
  paymasterUrl: PIMLICO_PAYMASTER_URL,
  transport: bundlerTransport,
  chainId: monadTestnet.id,
} as const;