'use client';

interface ActionPanelProps {
  threshold: string;
  setThreshold: (value: string) => void;
  onSetThreshold: () => void;
  onDelegate: () => void;
  onBridge: () => void;
  shouldTrigger: boolean;
  isPending: boolean;
  depositAmount: string;
  setDepositAmount: (value: string) => void;
  onDeposit: () => void;
  depositBalance?: bigint; 
  onWithdraw: () => void;
}

export default function ActionPanel({
  threshold,
  setThreshold,
  onSetThreshold,
  onDelegate,
  onBridge,
  shouldTrigger,
  isPending,
  depositAmount,
  setDepositAmount,
  onDeposit,
  depositBalance, 
  onWithdraw
}: ActionPanelProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-md">
          <span className="text-xl">⚡</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <p className="text-xs text-gray-500">Manage your bridge settings</p>
        </div>
      </div>
      
      <div className="space-y-5 flex-1">
        {/* Deposit Balance Card - Compact Version */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <span className="font-semibold text-gray-900 text-sm">Balance</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">
                {depositBalance !== undefined 
                  ? `${(Number(depositBalance) / 1e18).toFixed(4)}` 
                  : '0.0000'}
              </p>
              <p className="text-xs text-gray-500">MON</p>
            </div>
          </div>

          {/* Deposit Controls - Compact */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                step="0.01"
              />
              <button
                onClick={onDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-semibold text-sm transition-colors shadow-sm"
              >
                Add
              </button>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {['0.1', '0.5', '1'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(amount)}
                  className="px-2 py-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-xs font-medium transition-colors"
                >
                  {amount}
                </button>
              ))}
            </div>

            {/* Withdraw Button - Conditional */}
            {depositBalance !== undefined && Number(depositBalance) > 0 && (
              <button
                onClick={onWithdraw}
                className="w-full mt-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-xs transition-colors shadow-sm"
              >
                Withdraw All
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            0.1 MON per bridge operation
          </p>
        </div>

        {/* Threshold Setting - Compact */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <label className="text-sm font-semibold text-gray-900">
              Gas Threshold (Gwei)
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g., 50"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            />
            <button
              onClick={onSetThreshold}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-sm transition-colors shadow-sm whitespace-nowrap"
            >
              Set
            </button>
          </div>
        </div>

        {/* Action Buttons - Stacked */}
        <div className="space-y-3 pt-2">
          {/* Delegate Button */}
          <button
            onClick={onDelegate}
            className="w-full px-5 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200"
          >
            🔑 Authorize Session
          </button>

          {/* Bridge Button */}
          <button
            onClick={onBridge}
            disabled={!shouldTrigger || isPending}
            className="w-full px-5 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-bold text-sm shadow-md hover:shadow-lg disabled:shadow-none transition-all duration-200"
          >
            {isPending ? '⏳ Bridging...' : shouldTrigger ? '🌉 Bridge Now' : '🌉 Bridge (Waiting for trigger)'}
          </button>
        </div>
      </div>
    </div>
  );
}