// frontend/src/hooks/useSessionAccount.ts

'use client';

import { useState, useEffect, useCallback } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { generatePrivateKey } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import type { Address } from 'viem';
import { monadTestnet } from '@/app/config/wagmi';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/delegation-toolkit';

const SESSION_KEY = 'fee_delegate_session_key';

// Define the type using Awaited and ReturnType
type SmartAccountType = Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;

interface UseSessionAccountReturn {
  sessionAddress: Address | null;
  sessionPrivateKey: `0x${string}` | null;
  smartAccount: SmartAccountType | null;
  createSession: () => Promise<void>;
  revokeSession: () => void;
  hasSession: boolean;
  isLoading: boolean;
}

export function useSessionAccount(): UseSessionAccountReturn {
  const [sessionPrivateKey, setSessionPrivateKey] = useState<`0x${string}` | null>(null);
  const [sessionAddress, setSessionAddress] = useState<Address | null>(null);
  const [smartAccount, setSmartAccount] = useState<SmartAccountType | null>(null); 
  const [isLoading, setIsLoading] = useState(true);

  // Load existing session
  useEffect(() => {
    const loadSession = async () => {
      try {
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }

        const storedKey = localStorage.getItem(SESSION_KEY);
        
        if (storedKey && storedKey.startsWith('0x')) {
          const account = privateKeyToAccount(storedKey as `0x${string}`);
          
          // Create public client for Monad
          const publicClient = createPublicClient({
            chain: monadTestnet,
            transport: http(),
          });

          // Create MetaMask Smart Account
          const smart = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [account.address, [], [], []],
            deploySalt: '0x',
            signer: { account },
          });

          setSessionPrivateKey(storedKey as `0x${string}`);
          setSessionAddress(smart.address);
          setSmartAccount(smart);
          console.log('✅ MetaMask Smart Account loaded:', smart.address);
        }
      } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Create new session
  const createSession = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      
      // Create public client
      const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(),
      });

      // Create MetaMask Smart Account
      console.log('Creating MetaMask Smart Account...');
      const smart = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [account.address, [], [], []],
        deploySalt: '0x',
        signer: { account },
      });

      localStorage.setItem(SESSION_KEY, privateKey);
      setSessionPrivateKey(privateKey);
      setSessionAddress(smart.address);
      setSmartAccount(smart);
      
      console.log('✅ MetaMask Smart Account created:', smart.address);
      
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionPrivateKey(null);
    setSessionAddress(null);
    setSmartAccount(null);
    console.log('✅ Session revoked');
  }, []);

  return {
    sessionAddress,
    sessionPrivateKey,
    smartAccount,
    createSession,
    revokeSession,
    hasSession: !!smartAccount,
    isLoading,
  };
}