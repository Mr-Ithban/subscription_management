import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '../api/health';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Server } from 'lucide-react';

export default function HealthCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: getHealthStatus,
    retry: 1,
  });

  return (
    <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Backend Health Status</h2>
            <p className="text-xs text-slate-400">Endpoint: <code className="text-indigo-300">GET /api/health</code></p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center gap-3 text-slate-300 py-4">
            <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-sm">Connecting to backend server...</span>
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Failed to reach backend server</span>
            </div>
            <p className="mt-1 text-xs text-red-400/80">
              {error?.message || 'Check if the backend is running on port 5000'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-semibold">Backend Connected & Operational</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                HTTP 200 OK
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-500/20">
              <p className="text-xs text-slate-400 mb-1 font-medium">Response Payload:</p>
              <pre className="text-xs font-mono bg-slate-900/80 text-emerald-400 p-2.5 rounded-lg border border-slate-700/50 overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
