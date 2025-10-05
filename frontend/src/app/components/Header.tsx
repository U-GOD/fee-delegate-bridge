'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Header() {
  return (
    <header className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
      {/* Left side - Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">F</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">FeeDelegate Bridge</h1>
      </div>

      {/* Right side - Connect Button */}
      <div className="flex items-center space-x-4">
        {/* Network indicator could go here in the future */}
        <ConnectButton 
          showBalance={false}
          chainStatus="none"
          accountStatus="address"
        />
      </div>
    </header>
  );
}