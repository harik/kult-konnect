import React from 'react';
import { SegmentalBreakdown } from '@/types';
import { Layers } from 'lucide-react';

interface SegmentalWidgetProps {
  segmental?: SegmentalBreakdown;
}

export const SegmentalWidget: React.FC<SegmentalWidgetProps> = ({ segmental }) => {
  if (!segmental) return null;

  const { rightArm, leftArm, torso, rightLeg, leftLeg } = segmental;

  // Symmetry analysis
  const armDiff = Math.abs(rightArm.fatPercent - leftArm.fatPercent);
  const legDiff = Math.abs(rightLeg.fatPercent - leftLeg.fatPercent);
  const isBalanced = armDiff < 2.5 && legDiff < 2.5;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl my-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-4 h-4 text-brand-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
            Segmental Analysis (5 Zones)
          </h3>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          isBalanced ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400'
        }`}>
          {isBalanced ? 'Balanced Symmetry' : 'Asymmetric'}
        </span>
      </div>

      {/* Visual Limb Map Cards */}
      <div className="flex flex-col gap-2">
        {/* Upper Body (Arms & Torso) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Right Arm */}
          <div className="bg-slate-950/70 border border-slate-800 p-2 sm:p-3 rounded-xl sm:rounded-2xl text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 truncate">
              Right Arm
            </span>
            <div className="text-sm sm:text-base font-bold text-amber-400 font-mono tracking-tight tabular-nums truncate block">
              {rightArm.fatPercent}%
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
              {rightArm.muscleKg} kg muscle
            </span>
          </div>

          {/* Torso / Trunk */}
          <div className="bg-slate-950/90 border border-brand-500/40 p-2 sm:p-3 rounded-xl sm:rounded-2xl text-center shadow-inner min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-brand-400 block mb-0.5 truncate">
              Torso
            </span>
            <div className="text-sm sm:text-base font-extrabold text-white font-mono tracking-tight tabular-nums truncate block">
              {torso.fatPercent}%
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-300 block font-medium truncate">
              {torso.muscleKg} kg muscle
            </span>
          </div>

          {/* Left Arm */}
          <div className="bg-slate-950/70 border border-slate-800 p-2 sm:p-3 rounded-xl sm:rounded-2xl text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 truncate">
              Left Arm
            </span>
            <div className="text-sm sm:text-base font-bold text-amber-400 font-mono tracking-tight tabular-nums truncate block">
              {leftArm.fatPercent}%
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
              {leftArm.muscleKg} kg muscle
            </span>
          </div>
        </div>

        {/* Lower Body (Legs) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* Right Leg */}
          <div className="bg-slate-950/70 border border-slate-800 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 truncate">
              Right Leg
            </span>
            <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono tracking-tight tabular-nums truncate block">
              {rightLeg.fatPercent}%
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
              {rightLeg.muscleKg} kg muscle
            </span>
          </div>

          {/* Left Leg */}
          <div className="bg-slate-950/70 border border-slate-800 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 truncate">
              Left Leg
            </span>
            <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono tracking-tight tabular-nums truncate block">
              {leftLeg.fatPercent}%
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
              {leftLeg.muscleKg} kg muscle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
