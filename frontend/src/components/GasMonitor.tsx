'use client';

interface GasMonitorProps {
  isLoading: boolean;
  error: Error | null;
  currentGas: number;
  threshold: string;
  shouldTrigger: boolean;
}

export default function GasMonitor({
  isLoading,
  error,
  currentGas,
  threshold,
  shouldTrigger
}: GasMonitorProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-8 h-full">
      {/* Header with Icon */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
          <span className="text-2xl">⛽</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gas Monitor</h2>
          <p className="text-sm text-gray-500">Real-time gas price tracking</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="relative">
            <div className="animate-spin h-16 w-16 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">⛽</span>
            </div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Fetching gas prices...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-xl">
          <div className="flex gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="font-semibold text-red-900 mb-1">Error Loading Gas Data</p>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Gas - Hero Display */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20"></div>
            <div className="relative p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Current Gas Price
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-7xl font-black text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                  {currentGas}
                </p>
                <span className="text-3xl font-bold text-gray-500">Gwei</span>
              </div>
            </div>
          </div>

          {/* Threshold Display */}
          {threshold && (
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Your Threshold
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-bold text-gray-800">
                      {threshold}
                    </p>
                    <span className="text-2xl font-semibold text-gray-500">Gwei</span>
                  </div>
                </div>
                <div className="text-4xl">🎯</div>
              </div>
            </div>
          )}

          {/* Status Card - Enhanced */}
          <div className={`p-6 rounded-xl border-2 transition-all duration-300 ${
            shouldTrigger 
              ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300 shadow-lg shadow-red-100' 
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-lg shadow-green-100'
          }`}>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
              Bridge Status
            </p>
            <div className="flex items-center gap-4">
              {/* Animated Status Indicator */}
              <div className="relative">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  shouldTrigger 
                    ? 'bg-red-500 animate-pulse shadow-2xl shadow-red-500/50' 
                    : 'bg-green-500 shadow-2xl shadow-green-500/50'
                }`}>
                  <span className="text-3xl">{shouldTrigger ? '🚨' : '✅'}</span>
                </div>
                {shouldTrigger && (
                  <div className="absolute -inset-1 bg-red-500 rounded-full animate-ping opacity-75"></div>
                )}
              </div>
              
              <div className="flex-1">
                <p className={`text-2xl font-bold mb-1 ${
                  shouldTrigger ? 'text-red-700' : 'text-green-700'
                }`}>
                  {shouldTrigger ? 'Bridge Ready!' : 'Monitoring...'}
                </p>
                <p className="text-sm text-gray-600">
                  {shouldTrigger 
                    ? 'Gas price above threshold - ready to bridge' 
                    : 'Gas price below threshold - no action needed'}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Indicator */}
          {threshold && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="text-sm font-medium text-gray-700">Price vs Threshold:</span>
              </div>
              <span className={`text-lg font-bold ${
                shouldTrigger ? 'text-red-600' : 'text-green-600'
              }`}>
                {currentGas > Number(threshold) ? '+' : ''}
                {(currentGas - Number(threshold)).toFixed(1)} Gwei
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}