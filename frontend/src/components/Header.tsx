'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left side - App title and tagline */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">FeeDelegate Bridge</h1>
          <p className="text-sm text-gray-500">Automated gas threshold monitor and bridge</p>
        </div>

        {/* Right side - Wallet connect button */}
        <div className="flex items-center space-x-4">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
