import React from 'react';
import { ScaleMeasurement } from '@/types';
import { db } from '@/core/storage/db';
import { syncMeasurementToHealthConnect } from '@/core/health/healthConnectSync';
import { Trash2, CloudOff, CheckCircle } from 'lucide-react';

interface HistoryListProps {
  measurements: ScaleMeasurement[];
  onRefresh: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ measurements, onRefresh }) => {
  const handleDelete = async (id: string) => {
    if (confirm('Delete this measurement entry?')) {
      await db.measurements.delete(id);
      onRefresh();
    }
  };

  const handleSyncSingle = async (m: ScaleMeasurement) => {
    const ok = await syncMeasurementToHealthConnect(m);
    if (ok) onRefresh();
  };

  if (!measurements || measurements.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        No past records found. Completed weigh-ins will appear here.
      </div>
    );
  }

  // Sort descending
  const sorted = [...measurements].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-3 p-4 max-w-md mx-auto pb-24">
      <h3 className="text-xs uppercase font-semibold tracking-wider text-slate-400 px-1">
        Measurement History ({sorted.length} entries)
      </h3>

      <div className="flex flex-col gap-2.5">
        {sorted.map((m) => (
          <div
            key={m.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white font-mono">{m.weightKg.toFixed(1)}</span>
                <span className="text-xs font-semibold text-slate-400">kg</span>

                {m.bodyFatPercent !== undefined && (
                  <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md ml-1">
                    {m.bodyFatPercent.toFixed(1)}% Fat
                  </span>
                )}

                {m.heartRateBpm !== undefined && (
                  <span className="text-xs font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md ml-1">
                    ♥ {m.heartRateBpm} BPM
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                <span>
                  {new Date(m.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span>• BMI {m.bmi.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Health Connect Sync Status */}
              {m.syncedToHealthConnect ? (
                <span className="p-1.5 text-emerald-400 bg-emerald-400/10 rounded-lg" title="Synced to Health Connect">
                  <CheckCircle className="w-4 h-4" />
                </span>
              ) : (
                <button
                  onClick={() => handleSyncSingle(m)}
                  className="p-1.5 text-slate-400 hover:text-brand-400 bg-slate-800 rounded-lg transition"
                  title="Not synced. Tap to sync to Health Connect"
                >
                  <CloudOff className="w-4 h-4" />
                </button>
              )}

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(m.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-800/60 rounded-lg transition"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
