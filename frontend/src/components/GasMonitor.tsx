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
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
      <h2 className="text-2xl font-bold mb-8 text-gray-900">Gas Monitor</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Gas - Large Display */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">
              Current Gas (Gwei)
            </p>
            <p className="text-7xl font-bold text-gray-900 tracking-tight">
              {currentGas}
            </p>
          </div>

          {/* Threshold Display */}
          {threshold && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                Threshold
              </p>
              <p className="text-5xl font-bold text-gray-700 tracking-tight">
                {threshold}
              </p>
            </div>
          )}

          {/* Status - Enhanced */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-3">Status</p>
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${
                shouldTrigger 
                  ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' 
                  : 'bg-green-500 shadow-lg shadow-green-500/50'
              }`}></div>
              <p className={`text-lg font-bold ${
                shouldTrigger ? 'text-red-600' : 'text-green-600'
              }`}>
                {shouldTrigger ? 'Trigger needed' : 'Trigger not needed'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}