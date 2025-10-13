'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="container flex h-20 items-center justify-between px-6 mx-auto max-w-7xl">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          {/* Animated Logo Icon */}
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <span className="text-white text-2xl font-black">F</span>
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
          </div>
          
          {/* Title Section */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-transparent bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text">
              FeeDelegate Bridge
            </h1>
            <p className="text-xs text-gray-500 font-medium hidden sm:block">
              Powered by MetaMask Smart Accounts
            </p>
          </div>
        </div>

        {/* Right: Network + Connect Button */}
        <div className="flex items-center gap-4">
          {/* Network Status Badge */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full shadow-sm">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <span className="text-sm text-green-700 font-semibold">Monad Testnet</span>
          </div>
          
          {/* Connect Wallet Button with Custom Styling */}
          <div className="connect-button-wrapper">
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
      </div>
    </header>
  );
}