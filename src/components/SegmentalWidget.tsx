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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl my-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Segmental Analysis (5 Zones)
          </h3>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
          isBalanced ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400'
        }`}>
          {isBalanced ? 'Balanced Symmetry' : 'Asymmetric'}
        </span>
      </div>

      {/* Visual Limb Map Cards */}
      <div className="flex flex-col gap-2.5">
        {/* Upper Body (Arms & Torso) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Right Arm */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
              Right Arm
            </span>
            <div className="text-lg font-bold text-amber-400 font-mono">
              {rightArm.fatPercent}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              {rightArm.muscleKg} kg muscle
            </span>
          </div>

          {/* Torso / Trunk */}
          <div className="bg-slate-950/90 border border-brand-500/30 p-3 rounded-2xl text-center shadow-inner">
            <span className="text-[10px] uppercase font-semibold text-brand-400 block mb-1">
              Torso
            </span>
            <div className="text-xl font-extrabold text-white font-mono">
              {torso.fatPercent}%
            </div>
            <span className="text-[10px] text-slate-300 block font-medium">
              {torso.muscleKg} kg muscle
            </span>
          </div>

          {/* Left Arm */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
              Left Arm
            </span>
            <div className="text-lg font-bold text-amber-400 font-mono">
              {leftArm.fatPercent}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              {leftArm.muscleKg} kg muscle
            </span>
          </div>
        </div>

        {/* Lower Body (Legs) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Right Leg */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
              Right Leg
            </span>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {rightLeg.fatPercent}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              {rightLeg.muscleKg} kg muscle
            </span>
          </div>

          {/* Left Leg */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
              Left Leg
            </span>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {leftLeg.fatPercent}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              {leftLeg.muscleKg} kg muscle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
