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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Gas Monitor</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Gas Display */}
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-sm text-gray-500 mb-1">Current Gas (Gwei)</p>
              <p className="text-5xl font-bold text-gray-900">{currentGas}</p>
            </div>
          </div>

          {/* Threshold Display */}
          {threshold && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Threshold</p>
              <p className="text-4xl font-bold text-gray-700">{threshold}</p>
            </div>
          )}

          {/* Status Indicator */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${shouldTrigger ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
              <p className={`font-semibold ${shouldTrigger ? 'text-red-600' : 'text-green-600'}`}>
                {shouldTrigger ? 'Trigger needed' : 'Trigger not needed'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}