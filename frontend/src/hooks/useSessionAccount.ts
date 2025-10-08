// frontend/src/hooks/useSessionAccount.ts

'use client';

import { useState, useEffect, useCallback } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';
import type { Address } from 'viem';

/**
 * Custom React hook for managing ephemeral session accounts
 * 
 * Session account:
 * - A temporary wallet with its own private key
 * - Created in the browser, lives only on this device
 * - User authorizes it to act on their behalf
 * - Can be revoked at any time
 * 
 * Security considerations:
 * - Private key stored in localStorage (acceptable for hackathon/testnet)
 * - In production, consider using browser's IndexedDB with encryption
 * - Session accounts have limited permissions (only what user grants)
 * 
 * Similar to: JWT tokens, API keys, SSH keys
 */

// LocalStorage key for session private key
const SESSION_KEY = 'fee_delegate_session_key';

interface UseSessionAccountReturn {
  // The session account's address (or null if none exists)
  sessionAddress: Address | null;
  
  // The private key (for signing, never expose to UI)
  sessionPrivateKey: `0x${string}` | null;
  
  // Create a new session account (generates new key)
  createSession: () => void;
  
  // Delete the current session
  revokeSession: () => void;
  
  // Check if session exists
  hasSession: boolean;
  
  // Loading state
  isLoading: boolean;
}

export function useSessionAccount(): UseSessionAccountReturn {
  const [sessionPrivateKey, setSessionPrivateKey] = useState<`0x${string}` | null>(null);
  const [sessionAddress, setSessionAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load existing session from localStorage on mount
   * This runs once when the component using this hook first renders
   */
  useEffect(() => {
    try {
      // Check if we're in the browser (not SSR)
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      // Try to load existing session key
      const storedKey = localStorage.getItem(SESSION_KEY);
      
      if (storedKey && storedKey.startsWith('0x')) {
        // Valid key found - derive the address
        const account = privateKeyToAccount(storedKey as `0x${string}`);
        setSessionPrivateKey(storedKey as `0x${string}`);
        setSessionAddress(account.address);
        console.log('✅ Session account loaded:', account.address);
      } else {
        // No valid key found
        console.log('ℹ️ No session account found');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      // Clear corrupted data
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array = run once on mount

  /**
   * Create a new session account
   * Generates a random private key and stores it
   */
  const createSession = useCallback(() => {
    try {
      setIsLoading(true);
      
      // Generate a cryptographically secure random private key
      // This uses window.crypto under the hood (browser's secure random)
      const privateKey = generatePrivateKey();
      
      // Derive the public address from the private key
      const account = privateKeyToAccount(privateKey);
      
      // Store in localStorage (WARNING: not secure for production!)
      // For hackathon/testnet this is acceptable
      localStorage.setItem(SESSION_KEY, privateKey);
      
      // Update React state
      setSessionPrivateKey(privateKey);
      setSessionAddress(account.address);
      
      console.log('✅ New session account created:', account.address);
      console.log('⚠️ Session key stored in localStorage (testnet only!)');
      
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies: function never changes

  /**
   * Delete the current session
   * Removes from localStorage and clears state
   */
  const revokeSession = useCallback(() => {
    try {
      // Remove from storage
      localStorage.removeItem(SESSION_KEY);
      
      // Clear state
      setSessionPrivateKey(null);
      setSessionAddress(null);
      
      console.log('✅ Session account revoked');
      
    } catch (error) {
      console.error('Error revoking session:', error);
    }
  }, []); // No dependencies

  return {
    sessionAddress,
    sessionPrivateKey,
    createSession,
    revokeSession,
    hasSession: !!sessionAddress,
    isLoading,
  };
}