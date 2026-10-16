import React, { useEffect, useState, useRef } from 'react';
import { X, Bluetooth, CheckCircle2, AlertCircle, RefreshCw, HandMetal, Sparkles, HeartPulse, Download, HelpCircle, ShieldAlert } from 'lucide-react';
import { IScaleBleDriver, MeasurementResult } from '@/core/ble/ScaleBleDriver';
import { ScaleLiveStatus, UserProfile, ScaleMeasurement } from '@/types';
import { calculateBIA, calculateAge } from '@/core/bia/biaEngine';
import { saveScaleMeasurement } from '@/core/storage/db';
import { syncMeasurementToHealthConnect } from '@/core/health/healthConnectSync';
import { PostureSchematic } from './PostureSchematic';
import { SegmentalWidget } from './SegmentalWidget';

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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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

        // Prioritize currently active profile; only fall back if none
        const activeProfileId = currentProfile?.id || (profiles.length > 0 ? profiles[0].id : '');
        setSelectedProfileId(activeProfileId);

        // Calculate BIA using target profile
        const activeUser = profiles.find((p) => p.id === activeProfileId) || currentProfile;
        if (result.hasBodyComp && result.impedanceOhm && activeUser) {
          const bia = calculateBIA({
            weightKg: result.weightKg,
            heightCm: activeUser.heightCm || 170,
            ageYears: calculateAge(activeUser.birthDate || '1995-01-01'),
            gender: activeUser.gender || 'male',
            impedanceOhm: result.impedanceOhm,
            rawImpedances: result.rawImpedances,
          });
          setCalculatedBia(bia);
        }
      }
    );
  };

  const handleRetry = async () => {
    try {
      await driver.stopWeighIn();
    } catch {}
    setStatus({
      state: 'disconnected',
      weightKg: 0,
      isStable: false,
      hasHandles: false,
      impedanceReceived: false,
      progressPercent: 0,
    });
    setTimeout(() => {
      startSession();
    }, 400);
  };

  const handleProfileChange = (newProfileId: string) => {
    setSelectedProfileId(newProfileId);
    if (finalResult && finalResult.hasBodyComp && finalResult.impedanceOhm) {
      const activeUser = profiles.find((p) => p.id === newProfileId) || currentProfile;
      const bia = calculateBIA({
        weightKg: finalResult.weightKg,
        heightCm: activeUser?.heightCm || 170,
        ageYears: calculateAge(activeUser?.birthDate || '1995-01-01'),
        gender: activeUser?.gender || 'male',
        impedanceOhm: finalResult.impedanceOhm,
        rawImpedances: finalResult.rawImpedances,
      });
      setCalculatedBia(bia);
    }
  };

  const handleSave = async (syncToHealth: boolean) => {
    if (!finalResult) return;
    setIsSaving(true);
    setSaveMessage(syncToHealth ? 'Saving & connecting to Health Connect...' : 'Saving locally...');

    try {
      const activeUser = profiles.find((p) => p.id === selectedProfileId) || currentProfile;
      const measurementId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const userHeight = activeUser?.heightCm && activeUser.heightCm > 50 ? activeUser.heightCm : 170;

      const measurement: ScaleMeasurement = {
        id: measurementId,
        profileId: activeUser.id,
        timestamp: Date.now(),
        weightKg: Number(finalResult.weightKg.toFixed(2)),
        impedanceOhm: finalResult.impedanceOhm,
        rawImpedances: finalResult.rawImpedances,
        heartRateBpm: finalResult.heartRateBpm,
        segmental: calculatedBia?.segmental,
        bmi: calculatedBia?.bmi || Number((finalResult.weightKg / Math.pow(userHeight / 100, 2)).toFixed(1)),
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
      console.log('[WeighInModal] Measurement saved to Dexie DB:', measurement.id);

      // 2. Sync to Health Connect if requested
      if (syncToHealth) {
        setSaveMessage('Syncing to Google Health Connect...');
        const synced = await syncMeasurementToHealthConnect(measurement);
        if (synced) {
          measurement.syncedToHealthConnect = true;
          setSaveMessage('Synced to Google Health Connect!');
        } else {
          setSaveMessage('Saved locally! Health Connect permission or sync failed.');
        }
      } else {
        setSaveMessage('Saved locally!');
      }

      onMeasurementSaved(measurement);
      // Wait 1.2s so user sees clear confirmation
      await new Promise((r) => setTimeout(r, 1200));
      onClose();
    } catch (err: any) {
      console.error('Error saving measurement:', err);
      setSaveMessage(`Save error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bluetooth className={`w-5 h-5 transition-colors ${
              status.state === 'scanning' || status.state === 'connecting'
                ? 'text-brand-400 animate-pulse'
                : status.state === 'completed'
                ? 'text-emerald-400'
                : status.state === 'error' || status.state === 'disconnected'
                ? 'text-slate-500'
                : 'text-brand-400'
            }`} />
            <span className="font-semibold text-slate-200 text-sm sm:text-base">Cult Smart Scale Pro</span>
          </div>
          <button
            onClick={() => {
              driver.stopWeighIn();
              onClose();
            }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Weight Display Circle */}
        <div className={`relative my-2 sm:my-3 flex flex-col items-center justify-center rounded-full border-4 border-slate-800 bg-slate-950/70 shadow-inner ${
          finalResult ? 'w-36 h-36 sm:w-44 sm:h-44' : 'w-44 h-44 sm:w-52 sm:h-52'
        }`}>
          {/* Progress Ring Indicator */}
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500 transition-transform duration-150 ease-out"
            style={{ transform: `rotate(${(status.progressPercent / 100) * 360}deg)` }}
          />

          <span className={`${finalResult ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'} font-extrabold tracking-tight text-white font-mono`}>
            {finalResult ? finalResult.weightKg.toFixed(1) : status.weightKg > 0 ? status.weightKg.toFixed(1) : '--.-'}
          </span>
          <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-slate-400 mt-0.5">kg</span>

          {/* Handle Grip Status Indicator */}
          <div className={`mt-1.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all ${
            status.hasHandles ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800/80 text-slate-400'
          }`}>
            <HandMetal className="w-3.5 h-3.5" />
            <span>{status.hasHandles ? 'Handles Detected' : 'Feet Only'}</span>
          </div>
        </div>

        {/* Posture Schematic (Guidance during measurement) */}
        {!finalResult && (
          <PostureSchematic
            state={status.state}
            hasHandles={status.hasHandles}
            heartRateBpm={status.heartRateBpm}
          />
        )}

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
          {status.state === 'measuring_heart_rate' && (
            <p className="text-rose-400 text-sm font-medium animate-pulse flex items-center justify-center gap-1.5">
              <HeartPulse className="w-4 h-4 animate-bounce" /> Measuring resting pulse... Scale spinning!
            </p>
          )}
          {status.state === 'completed' && (
            <p className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Weigh-in complete!
            </p>
          )}
          {status.state === 'disconnected' && !finalResult && (
            <p className="text-slate-400 text-sm flex items-center justify-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Scale disconnected. Step on it to wake up.
            </p>
          )}
          {status.state === 'error' && (
            <div className="space-y-3">
              <p className="text-red-400 text-xs flex items-center justify-center gap-1.5 px-2 text-center">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{status.errorMessage || 'Bluetooth connection failed'}</span>
              </p>

              {/* Try Again Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-md transition active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Wake Scale & Try Again
                </button>
              </div>

              {/* Missing Permission Action Card */}
              {(status.errorMessage?.toLowerCase().includes('permission') || status.errorMessage?.toLowerCase().includes('location')) && (
                <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-3 text-xs text-slate-300 space-y-2 text-left">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Permission Required for Scale Discovery</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Android requires both Nearby Devices and Location permissions to discover and connect to Bluetooth LE hardware.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (driver.requestPermissions) {
                        await driver.requestPermissions();
                      }
                      handleRetry();
                    }}
                    className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition active:scale-95"
                  >
                    <ShieldAlert className="w-4 h-4" /> Grant Missing Permissions & Try Again
                  </button>
                </div>
              )}

              {/* Web Bluetooth fallback banner */}
              {status.errorMessage?.includes('not available in this browser') && (
                <div className="bg-slate-950/90 border border-brand-500/30 rounded-2xl p-3 text-xs text-slate-300 space-y-2">
                  <p className="font-semibold text-brand-300">
                    Web Bluetooth is not supported in this browser.
                  </p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Install the native Android APK for direct Bluetooth LE hardware streaming & Google Health Connect sync.
                  </p>
                  <a
                    href="/kult-konnect.apk"
                    download="kult-konnect.apk"
                    className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-md transition"
                  >
                    <Download className="w-4 h-4" /> Download Native Android APK
                  </a>
                </div>
              )}

              {/* Status 147 / Connection Error Checklist */}
              {(status.errorMessage?.includes('147') || status.errorMessage?.includes('timed out') || status.errorMessage?.includes('failed')) && (
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3 text-[11px] text-slate-300 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs mb-1">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>How to fix Connection Status 147:</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 leading-normal">
                    <li>
                      <strong className="text-white">Wake the scale:</strong> Step firmly on the scale until the LCD displays <code className="text-brand-300 bg-slate-900 px-1 rounded">0.0 kg</code> right before tapping Try Again.
                    </li>
                    <li>
                      <strong className="text-white">Disconnect other apps:</strong> Force-close the official Cult.fit app on all phones (the scale accepts only 1 BLE connection).
                    </li>
                    <li>
                      <strong className="text-white">Unpair from phone settings:</strong> If the scale is paired under Android Settings &gt; Bluetooth, tap <em>Forget / Unpair</em>. BLE scales connect directly in the app.
                    </li>
                    <li>
                      <strong className="text-white">Quick reset:</strong> Toggle Bluetooth off and on in Android Quick Settings.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resting Heart Rate Card */}
        {finalResult && (
          <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 my-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${finalResult.heartRateBpm ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Resting Heart Rate</span>
                <span className="text-lg font-bold text-white font-mono">
                  {finalResult.heartRateBpm ? `${finalResult.heartRateBpm} BPM` : '-- BPM'}
                </span>
              </div>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${
              finalResult.heartRateBpm
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-slate-400 bg-slate-800 border-slate-700'
            }`}>
              {finalResult.heartRateBpm ? 'BCG Pulse' : 'Not Captured'}
            </span>
          </div>
        )}

        {/* Body Comp Metrics Preview after completion */}
        {calculatedBia && (
          <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 my-2 grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">Body Fat</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.bodyFatPercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">Muscle</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.musclePercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">Water</span>
              <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.waterPercent}%</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">Bone Mass</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.boneMassKg} kg</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">BMR</span>
              <span className="text-xs sm:text-sm font-bold text-violet-400 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.bmrKcal} kcal</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 sm:p-2 rounded-xl min-w-0 overflow-hidden">
              <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">Visceral Fat</span>
              <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono tracking-tight tabular-nums block truncate">{calculatedBia.visceralFat}</span>
            </div>
          </div>
        )}

        {/* Segmental Breakdown Preview */}
        {calculatedBia?.segmental && (
          <div className="w-full">
            <SegmentalWidget segmental={calculatedBia.segmental} />
          </div>
        )}

        {/* Profile Assignment Dropdown */}
        {finalResult && (
          <div className="w-full mt-2 mb-3">
            <label className="block text-xs font-medium text-slate-400 mb-1">Assign Measurement To:</label>
            <select
              value={selectedProfileId}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          {saveMessage && (
            <div className="p-2.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-center text-xs font-medium text-brand-300 animate-in fade-in">
              {saveMessage}
            </div>
          )}

          {finalResult ? (
            <>
              <button
                disabled={isSaving}
                onClick={() => handleSave(true)}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-brand-500/20 transition flex items-center justify-center gap-2 text-xs sm:text-sm leading-snug"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-center">{isSaving ? 'Saving...' : 'Save & Sync to Health Connect'}</span>
              </button>
              <button
                disabled={isSaving}
                onClick={() => handleSave(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl transition text-xs sm:text-sm text-center"
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
