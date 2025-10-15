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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 h-full">
      {/* Header - Clean, no emoji */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
        <div className="p-3 bg-blue-500 rounded-xl">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gas Monitor</h2>
          <p className="text-sm text-gray-500">Real-time price tracking</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="relative">
            <div className="animate-spin h-16 w-16 border-4 border-blue-200 rounded-full border-t-blue-500"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Fetching gas prices...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-900 mb-1">Error Loading Data</p>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Gas - Large Display */}
          <div className="relative">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">
                Current Gas Price
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-7xl font-black text-blue-600">
                  {currentGas}
                </p>
                <span className="text-3xl font-bold text-blue-400">Gwei</span>
              </div>
            </div>
          </div>

          {/* Threshold Display */}
          {threshold && (
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
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
          )}

          {/* Status Card */}
          <div className={`p-6 rounded-xl border-2 transition-all duration-300 ${
            shouldTrigger 
              ? 'bg-orange-50 border-orange-300' 
              : 'bg-green-50 border-green-300'
          }`}>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
              Bridge Status
            </p>
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                shouldTrigger 
                  ? 'bg-orange-500' 
                  : 'bg-green-500'
              }`}>
                {shouldTrigger ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              
              <div className="flex-1">
                <p className={`text-2xl font-bold mb-1 ${
                  shouldTrigger ? 'text-orange-700' : 'text-green-700'
                }`}>
                  {shouldTrigger ? 'Ready to Bridge' : 'Monitoring'}
                </p>
                <p className="text-sm text-gray-600">
                  {shouldTrigger 
                    ? 'Gas price above threshold' 
                    : 'Gas price below threshold'}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison */}
          {threshold && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-sm font-medium text-gray-700">Difference:</span>
              <span className={`text-lg font-bold ${
                shouldTrigger ? 'text-orange-600' : 'text-green-600'
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