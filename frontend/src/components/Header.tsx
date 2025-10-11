'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          {/* Logo Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-md">
            <span className="text-white text-xl font-bold">F</span>
          </div>
          
          {/* Title */}
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900">
              FeeDelegate Bridge
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              Automated cross-chain bridging
            </p>
          </div>
        </div>

        {/* Right: Connect Button */}
        <div className="flex items-center gap-4">
          {/* Optional: Network indicator (for future) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700 font-medium">Monad Testnet</span>
          </div>
          
          {/* Connect Wallet Button */}
          <ConnectButton 
            showBalance={false}
            chainStatus="icon"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>
    </header>
  );
}