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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-full flex flex-col">
      {/* Header - Clean */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="p-2 bg-blue-500 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <p className="text-xs text-gray-500">Manage settings</p>
        </div>
      </div>
      
      <div className="space-y-5 flex-1">
        {/* Deposit Balance Card */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900 text-sm">Balance</span>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {depositBalance !== undefined 
                  ? `${(Number(depositBalance) / 1e18).toFixed(4)}` 
                  : '0.0000'}
              </p>
              <p className="text-xs text-gray-500">MON</p>
            </div>
          </div>

          {/* Deposit Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                step="0.01"
              />
              <button
                onClick={onDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                Add
              </button>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-1.5">
              {['0.1', '0.5', '1'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(amount)}
                  className="px-2 py-1.5 bg-white border border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 text-xs font-medium transition-colors"
                >
                  {amount}
                </button>
              ))}
            </div>

            {/* Withdraw */}
            {depositBalance !== undefined && Number(depositBalance) > 0 && (
              <button
                onClick={onWithdraw}
                className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-xs transition-colors"
              >
                Withdraw All
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            0.1 MON per bridge
          </p>
        </div>

        {/* Threshold Setting */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Gas Threshold (Gwei)
          </label>
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold text-sm transition-colors whitespace-nowrap"
            >
              Set
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Authorize Button */}
          <button
            onClick={onDelegate}
            className="w-full px-5 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200"
          >
            Authorize Session
          </button>

          {/* Bridge Button */}
          <button
            onClick={onBridge}
            disabled={!shouldTrigger || isPending}
            className="w-full px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-sm shadow-md hover:shadow-lg disabled:shadow-none transition-all duration-200"
          >
            {isPending ? 'Bridging...' : shouldTrigger ? 'Bridge Now' : 'Bridge (Awaiting trigger)'}
          </button>
        </div>
      </div>
    </div>
  );
}