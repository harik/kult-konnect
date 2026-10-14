import React, { useEffect, useState, useRef } from 'react';
import { X, Bluetooth, CheckCircle2, AlertCircle, RefreshCw, HandMetal, Sparkles } from 'lucide-react';
import { IScaleBleDriver, MeasurementResult } from '@/core/ble/ScaleBleDriver';
import { ScaleLiveStatus, UserProfile, ScaleMeasurement } from '@/types';
import { calculateBIA, calculateAge } from '@/core/bia/biaEngine';
import { saveScaleMeasurement } from '@/core/storage/db';
import { syncMeasurementToHealthConnect } from '@/core/health/healthConnectSync';
import { matchProfileForWeight } from '@/core/storage/profileMatcher';

interface WeighInModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: IScaleBleDriver;
  currentProfile: UserProfile;
  profiles: UserProfile[];
  onMeasurementSaved: (m: ScaleMeasurement) => void;
}

export const WeighInModal: React.FC<WeighInModalProps> = ({
  isOpen,
  onClose,
  driver,
  currentProfile,
  profiles,
  onMeasurementSaved,
}) => {
  const [status, setStatus] = useState<ScaleLiveStatus>({
    state: 'disconnected',
    weightKg: 0,
    isStable: false,
    hasHandles: false,
    impedanceReceived: false,
    progressPercent: 0,
  });

  const [finalResult, setFinalResult] = useState<MeasurementResult | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(currentProfile.id);
  const [isSaving, setIsSaving] = useState(false);
  const [calculatedBia, setCalculatedBia] = useState<any>(null);

  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setFinalResult(null);
      setCalculatedBia(null);
      setSelectedProfileId(currentProfile.id);
      startSession();
    }

    return () => {
      if (!isOpen && hasStartedRef.current) {
        hasStartedRef.current = false;
        driver.stopWeighIn();
      }
    };
  }, [isOpen]);

  const startSession = async () => {
    await driver.startWeighIn(
      (newStatus: ScaleLiveStatus) => {
        setStatus(newStatus);
      },
      async (result: MeasurementResult) => {
        setFinalResult(result);

        // Auto-match user profile based on weight history
        const match = await matchProfileForWeight(result.weightKg);
        const matchedId = match.matchedProfile ? match.matchedProfile.id : currentProfile.id;
        setSelectedProfileId(matchedId);

        // Calculate BIA using target profile
        const activeUser = profiles.find((p) => p.id === matchedId) || currentProfile;
        if (result.hasBodyComp && result.impedanceOhm) {
          const bia = calculateBIA({
            weightKg: result.weightKg,
            heightCm: activeUser.heightCm,
            ageYears: calculateAge(activeUser.birthDate),
            gender: activeUser.gender,
            impedanceOhm: result.impedanceOhm,
          });
          setCalculatedBia(bia);
        }
      }
    );
  };

  const handleProfileChange = (newProfileId: string) => {
    setSelectedProfileId(newProfileId);
    if (finalResult && finalResult.hasBodyComp && finalResult.impedanceOhm) {
      const activeUser = profiles.find((p) => p.id === newProfileId) || currentProfile;
      const bia = calculateBIA({
        weightKg: finalResult.weightKg,
        heightCm: activeUser.heightCm,
        ageYears: calculateAge(activeUser.birthDate),
        gender: activeUser.gender,
        impedanceOhm: finalResult.impedanceOhm,
      });
      setCalculatedBia(bia);
    }
  };

  const handleSave = async (syncToHealth: boolean) => {
    if (!finalResult) return;
    setIsSaving(true);

    try {
      const activeUser = profiles.find((p) => p.id === selectedProfileId) || currentProfile;
      const measurementId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const measurement: ScaleMeasurement = {
        id: measurementId,
        profileId: activeUser.id,
        timestamp: Date.now(),
        weightKg: finalResult.weightKg,
        impedanceOhm: finalResult.impedanceOhm,
        bmi: calculatedBia?.bmi || Number((finalResult.weightKg / Math.pow(activeUser.heightCm / 100, 2)).toFixed(1)),
        bodyFatPercent: calculatedBia?.bodyFatPercent,
        musclePercent: calculatedBia?.musclePercent,
        waterPercent: calculatedBia?.waterPercent,
        boneMassKg: calculatedBia?.boneMassKg,
        bmrKcal: calculatedBia?.bmrKcal,
        visceralFat: calculatedBia?.visceralFat,
        syncedToHealthConnect: false,
        createdAt: Date.now(),
      };

      // 1. Save to Dexie.js local database first
      await saveScaleMeasurement(measurement);

      // 2. Sync to Health Connect if requested
      if (syncToHealth) {
        await syncMeasurementToHealthConnect(measurement);
      }

      onMeasurementSaved(measurement);
      onClose();
    } catch (err) {
      console.error('Error saving measurement:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center overflow-hidden">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-brand-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Cult Smart Scale Pro</span>
          </div>
          <button
            onClick={() => {
              driver.stopWeighIn();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Weight Display Circle */}
        <div className="relative my-4 flex flex-col items-center justify-center w-64 h-64 rounded-full border-4 border-slate-800 bg-slate-950/70 shadow-inner">
          {/* Progress Ring Indicator */}
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 transition-all duration-300"
            style={{ transform: `rotate(${(status.progressPercent / 100) * 360}deg)` }}
          />

          <span className="text-6xl font-extrabold tracking-tight text-white font-mono">
            {status.weightKg > 0 ? status.weightKg.toFixed(1) : '--.-'}
          </span>
          <span className="text-sm font-medium uppercase tracking-wider text-slate-400 mt-1">kg</span>

          {/* Handle Grip Status Indicator */}
          <div className={`mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
            status.hasHandles ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800/80 text-slate-400'
          }`}>
            <HandMetal className="w-3.5 h-3.5" />
            <span>{status.hasHandles ? 'Handles Detected' : 'Feet Only'}</span>
          </div>
        </div>

        {/* State Label */}
        <div className="text-center my-2 min-h-[44px]">
          {status.state === 'scanning' && (
            <p className="text-slate-400 text-sm animate-pulse flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Scanning for scale... Step on it to turn on!
            </p>
          )}
          {status.state === 'connecting' && (
            <p className="text-brand-400 text-sm animate-pulse">Connecting to scale GATT service...</p>
          )}
          {status.state === 'measuring_weight' && (
            <p className="text-slate-300 text-sm">Measuring weight... Keep steady on the plates</p>
          )}
          {status.state === 'measuring_impedance' && (
            <p className="text-brand-400 text-sm font-medium animate-pulse flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Measuring full body composition... Hold handles firm!
            </p>
          )}
          {status.state === 'completed' && (
            <p className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Weigh-in complete!
            </p>
          )}
          {status.state === 'error' && (
            <p className="text-red-400 text-sm flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {status.errorMessage || 'Bluetooth connection failed'}
            </p>
          )}
        </div>

        {/* Body Comp Metrics Preview after completion */}
        {calculatedBia && (
          <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-4 my-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">Body Fat</span>
              <span className="text-base font-bold text-amber-400">{calculatedBia.bodyFatPercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">Muscle</span>
              <span className="text-base font-bold text-emerald-400">{calculatedBia.musclePercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">Water</span>
              <span className="text-base font-bold text-cyan-400">{calculatedBia.waterPercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">Bone Mass</span>
              <span className="text-base font-bold text-slate-200">{calculatedBia.boneMassKg} kg</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">BMR</span>
              <span className="text-base font-bold text-violet-400">{calculatedBia.bmrKcal} kcal</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">Visceral Fat</span>
              <span className="text-base font-bold text-rose-400">{calculatedBia.visceralFat}</span>
            </div>
          </div>
        )}

        {/* Profile Assignment Dropdown */}
        {finalResult && (
          <div className="w-full mt-2 mb-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">Assign Measurement To:</label>
            <select
              value={selectedProfileId}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.gender}, {p.heightCm}cm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2 mt-2">
          {finalResult ? (
            <>
              <button
                disabled={isSaving}
                onClick={() => handleSave(true)}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save & Sync to Health Connect'}
              </button>
              <button
                disabled={isSaving}
                onClick={() => handleSave(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl transition text-sm"
              >
                Save Locally Only
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                driver.stopWeighIn();
                startSession();
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Restart Scan
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
