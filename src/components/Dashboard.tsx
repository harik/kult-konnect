import React from 'react';
import { ScaleMeasurement, UserProfile } from '@/types';
import { getBMICategory } from '@/core/bia/biaEngine';
import { Flame, Droplets, Dumbbell, Activity, ShieldCheck, HeartPulse, Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SegmentalWidget } from './SegmentalWidget';

interface DashboardProps {
  latestMeasurement: ScaleMeasurement | null;
  previousMeasurement: ScaleMeasurement | null;
  currentProfile: UserProfile;
  onStartWeighIn: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  latestMeasurement,
  previousMeasurement,
  currentProfile,
  onStartWeighIn,
}) => {
  if (!latestMeasurement) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-20 h-20 bg-brand-500/10 text-brand-400 rounded-3xl flex items-center justify-center mb-4 border border-brand-500/20 shadow-inner">
          <Scale className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Weigh-ins Yet</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-6">
          Step on your Cult Smart Scale Pro to record your weight and clinical 8-electrode body composition.
        </p>
        <button
          onClick={onStartWeighIn}
          className="bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 px-8 rounded-2xl shadow-xl shadow-brand-500/25 transition active:scale-95"
        >
          Start First Weigh-in
        </button>
      </div>
    );
  }

  // Weight Delta
  const delta = previousMeasurement ? Number((latestMeasurement.weightKg - previousMeasurement.weightKg).toFixed(1)) : 0;
  const bmiInfo = getBMICategory(latestMeasurement.bmi);

  // Target Progress
  const target = currentProfile.targetWeightKg;
  let targetProgressPercent = 0;
  if (target) {
    const diff = Math.abs(latestMeasurement.weightKg - target);
    targetProgressPercent = Math.max(5, Math.min(100, Math.round(100 - (diff / target) * 100)));
  }

  return (
    <div className="flex flex-col gap-5 p-4 max-w-md mx-auto pb-24">
      {/* Hero Weight Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Current Weight</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-extrabold text-white tracking-tight font-mono">
                {latestMeasurement.weightKg.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-slate-400">kg</span>
            </div>
          </div>

          {/* Delta Pill */}
          {previousMeasurement && (
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
              delta < 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 
              delta > 0 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 
              'bg-slate-800 text-slate-400'
            }`}>
              {delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              <span>{Math.abs(delta).toFixed(1)} kg</span>
            </div>
          )}
        </div>

        {/* BMI and Target Weight Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">BMI:</span>
            <span className="text-sm font-bold text-white font-mono">{latestMeasurement.bmi.toFixed(1)}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${bmiInfo.color}`}>
              {bmiInfo.label}
            </span>
          </div>

          <span className="text-[11px] text-slate-500">
            {new Date(latestMeasurement.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {target && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Target: {target} kg</span>
              <span>{targetProgressPercent}% of goal</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${targetProgressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Resting Heart Rate Card (from scale BCG measurement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl border ${
            latestMeasurement.heartRateBpm 
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' 
              : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}>
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Resting Heart Rate
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-extrabold text-white font-mono">
                {latestMeasurement.heartRateBpm || '--'}
              </span>
              <span className="text-xs font-semibold text-slate-400">BPM</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
            latestMeasurement.heartRateBpm 
              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
              : 'text-slate-400 bg-slate-800 border-slate-700'
          }`}>
            {latestMeasurement.heartRateBpm ? 'Scale BCG Pulse' : 'Not Captured'}
          </span>
          <span className="block text-[10px] text-slate-500 mt-1">
            {latestMeasurement.heartRateBpm ? 'Resting Vital' : 'Hold stance during spin'}
          </span>
        </div>
      </div>

      {/* Segmental Analysis (5 Zones: Arms, Torso, Legs) */}
      {latestMeasurement.segmental && (
        <SegmentalWidget segmental={latestMeasurement.segmental} />
      )}

      {/* Clinical Body Composition Metrics Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 px-1">
          Body Composition
        </h3>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Body Fat */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Body Fat</span>
              <Activity className="w-4 h-4 text-amber-400 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.bodyFatPercent !== undefined ? `${latestMeasurement.bodyFatPercent.toFixed(1)}%` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Total body fat ratio</span>
            </div>
          </div>

          {/* Muscle Mass */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Skeletal Muscle</span>
              <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.musclePercent !== undefined ? `${latestMeasurement.musclePercent.toFixed(1)}%` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Muscle mass ratio</span>
            </div>
          </div>

          {/* Body Water */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Total Water</span>
              <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.waterPercent !== undefined ? `${latestMeasurement.waterPercent.toFixed(1)}%` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Hydration status</span>
            </div>
          </div>

          {/* Bone Mass */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Bone Mass</span>
              <ShieldCheck className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.boneMassKg !== undefined ? `${latestMeasurement.boneMassKg.toFixed(1)} kg` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Bone mineral density</span>
            </div>
          </div>

          {/* BMR */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Basal Metabolic</span>
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.bmrKcal !== undefined ? `${latestMeasurement.bmrKcal}` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">kcal / day resting</span>
            </div>
          </div>

          {/* Visceral Fat */}
          <div className="bg-slate-900 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium truncate">Visceral Fat</span>
              <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold text-white font-mono tracking-tight tabular-nums block truncate">
                {latestMeasurement.visceralFat !== undefined ? `${latestMeasurement.visceralFat}` : '--'}
              </span>
              <span className="block text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">Abdominal cavity index</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
