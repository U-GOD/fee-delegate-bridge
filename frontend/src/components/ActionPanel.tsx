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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Actions</h2>
      
      <div className="space-y-6">
        {/* Deposit Management */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            💰 Deposit Balance
          </h3>
          
          <div className="bg-white rounded-lg p-3 mb-3 border border-green-100">
            <p className="text-3xl font-bold text-green-600">
              {depositBalance !== undefined 
                ? `${(Number(depositBalance) / 1e18).toFixed(4)} MON` 
                : '0.0000 MON'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Available for bridging (0.1 MON per bridge)
            </p>
          </div>

          {/* Deposit Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount (MON)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                step="0.01"
              />
              <button
                onClick={onDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-semibold"
              >
                Deposit
              </button>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDepositAmount('0.1')}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                0.1
              </button>
              <button
                onClick={() => setDepositAmount('0.5')}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                0.5
              </button>
              <button
                onClick={() => setDepositAmount('1')}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                1.0
              </button>
            </div>

            {/* Withdraw */}
            {depositBalance !== undefined && Number(depositBalance) > 0 && (
              <button
                onClick={onWithdraw}
                className="w-full mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm"
              >
                Withdraw All
              </button>
            )}
          </div>
        </div>

        {/* Set Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Set Threshold
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Gas threshold (gwei)"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onSetThreshold}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold whitespace-nowrap"
            >
              Set
            </button>
          </div>
        </div>

        {/* Delegate Button */}
        <button
          onClick={onDelegate}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 font-bold text-lg shadow-md"
        >
          Delegate
        </button>

        {/* Bridge Button */}
        <button
          onClick={onBridge}
          disabled={!shouldTrigger || isPending}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md"
        >
          {isPending ? 'Bridging...' : 'Bridge'}
        </button>
      </div>
    </div>
  );
}