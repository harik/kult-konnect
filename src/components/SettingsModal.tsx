import React, { useState, useEffect } from 'react';
import { X, Settings, HeartPulse, HardDrive, Download, Upload, FileSpreadsheet, RefreshCw, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { checkHealthConnectAvailability, requestHealthPermissions, syncPendingMeasurements, HealthSyncStatus } from '@/core/health/healthConnectSync';
import { downloadLocalBackupFile, restoreFromFile } from '@/core/drive/driveBackup';
import { exportToCsv } from '@/core/storage/db';
import { Capacitor } from '@capacitor/core';
import { checkForOtaUpdate, downloadAndStageOtaUpdate } from '@/core/updater/otaUpdater';
import { Sparkles } from 'lucide-react';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
  mockModeType: 'full_body' | 'weight_only';
  setMockModeType: (val: 'full_body' | 'weight_only') => void;
  onDataImported: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeProfileId,
  isMockMode,
  setIsMockMode,
  mockModeType,
  setMockModeType,
  onDataImported,
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // OTA Updates State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHealthStatus();
    }
  }, [isOpen]);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const res = await checkForOtaUpdate();
      if (res.hasUpdate && res.latestVersion) {
        setUpdateMsg(`Found new update (v${res.latestVersion})! Downloading...`);
        const endpoint = import.meta.env.VITE_UPDATE_URL || '/updates/version.json';
        const vRes = await fetch(endpoint, { cache: 'no-store' });
        const info = await vRes.json();
        const ok = await downloadAndStageOtaUpdate(info);
        if (ok) {
          setUpdateMsg(`Update v${res.latestVersion} ready! Restart app to apply.`);
        } else {
          setUpdateMsg('Failed to download update bundle.');
        }
      } else {
        setUpdateMsg('App is up to date with latest live version.');
      }
    } catch (e: any) {
      setUpdateMsg(e.message || 'Check failed');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const loadHealthStatus = async () => {
    const res = await checkHealthConnectAvailability();
    setHealthStatus(res);
  };

  const handleGrantPermissions = async () => {
    const ok = await requestHealthPermissions();
    if (ok) {
      loadHealthStatus();
    }
  };

  const handleSyncPending = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncPendingMeasurements();
      setSyncMessage(`Synced ${res.syncedCount} records (${res.failedCount} failed)`);
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCsv = async () => {
    const csv = await exportToCsv(activeProfileId);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kult-konnect-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await restoreFromFile(file);
      alert(`Restored successfully: ${res.measurementsAdded} measurements, ${res.profilesAdded} profiles.`);
      onDataImported();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error restoring data');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" /> Settings & Integrations
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Bluetooth & Hardware Driver Mode */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-4">
          <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 block mb-2">
            Scale Hardware Driver
          </span>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-white block">Mock Simulation Mode</span>
              <span className="text-xs text-slate-500">Test weigh-ins without scale hardware</span>
            </div>
            <button
              onClick={() => setIsMockMode(!isMockMode)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                isMockMode ? 'bg-brand-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                  isMockMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isMockMode && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2">
              <span className="text-xs text-slate-400">Simulation:</span>
              <button
                onClick={() => setMockModeType('full_body')}
                className={`text-xs px-2.5 py-1 rounded-lg transition ${
                  mockModeType === 'full_body' ? 'bg-brand-500 text-white font-medium' : 'bg-slate-800 text-slate-400'
                }`}
              >
                8-Electrode + Handles
              </button>
              <button
                onClick={() => setMockModeType('weight_only')}
                className={`text-xs px-2.5 py-1 rounded-lg transition ${
                  mockModeType === 'weight_only' ? 'bg-brand-500 text-white font-medium' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Weight Only
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Google Health Connect */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-rose-400" /> Google Health Connect
            </span>
            {healthStatus?.isAuthorized ? (
              <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {healthStatus?.isAvailable ? 'Not Authorized' : 'Unavailable'}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Syncs weight, body fat %, and metabolic calories directly into Google Health Connect.
          </p>

          <div className="flex flex-col gap-2">
            {!healthStatus?.isAvailable ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <span className="text-xs text-amber-300 font-medium block mb-1">
                  Requires Native Android App
                </span>
                <span className="text-[11px] text-slate-400 block mb-2.5">
                  Web browsers & PWAs cannot access Android OS Health Connect due to Android security sandboxing. To enable Health Connect sync, switch to the native Android APK below.
                </span>
                <a
                  href="/kult-konnect.apk"
                  download="kult-konnect.apk"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-brand-400" /> Download Android APK for Health Connect
                </a>
              </div>
            ) : (
              <>
                {!healthStatus?.isAuthorized && (
                  <button
                    onClick={handleGrantPermissions}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4 text-brand-400" /> Request Health Connect Permissions
                  </button>
                )}

                <button
                  disabled={isSyncing}
                  onClick={handleSyncPending}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Pending Measurements'}
                </button>

                {syncMessage && (
                  <span className="text-[11px] text-slate-400 text-center mt-1">{syncMessage}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section 3: Data Management & Backup */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
            <HardDrive className="w-4 h-4 text-cyan-400" /> Data Backup & Export
          </span>
          <p className="text-xs text-slate-400 mb-3">
            All records remain 100% offline on your device. Export or restore your measurements at any time.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={downloadLocalBackupFile}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4 text-brand-400" /> Download Full JSON Backup
              </span>
              <span className="text-[10px] text-slate-500">JSON</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Profile as CSV
              </span>
              <span className="text-[10px] text-slate-500">Spreadsheet</span>
            </button>

            <label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-400" /> Restore from JSON Backup
              </span>
              <span className="text-[10px] text-slate-500">Import</span>
              <input type="file" accept=".json" onChange={handleFileRestore} className="hidden" />
            </label>
          </div>
        </div>

        {/* Section 4: Software Updates (Native) or Android Companion (Web/PWA) */}
        {Capacitor.isNativePlatform() ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-400" /> Over-The-Air Updates
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                Live OTA
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Kult Konnect automatically checks Vercel for live updates on startup. You can also trigger an immediate check.
            </p>
            <button
              disabled={isCheckingUpdate}
              onClick={handleCheckUpdates}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              {isCheckingUpdate ? 'Checking Vercel...' : 'Check for Updates Now'}
            </button>
            {updateMsg && (
              <span className="text-[11px] text-brand-400 text-center block mt-2">{updateMsg}</span>
            )}
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mt-4">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Native Android Companion
            </span>
            <p className="text-xs text-slate-400 mb-3">
              Need direct Google Health Connect synchronization? Install the native Android APK companion app.
            </p>
            <a
              href="/kult-konnect.apk"
              download="kult-konnect.apk"
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-between shadow-md"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" /> Download Native APK
              </span>
              <span className="text-[10px] bg-brand-700/60 px-2 py-0.5 rounded font-mono">Health Connect</span>
            </a>
          </div>
        )}

        <div className="mt-4 text-center">
          <span className="text-[11px] text-slate-600">
            Kult Konnect v0.1.0 • {Capacitor.isNativePlatform() ? 'Android Native (Tier 3)' : 'Web / PWA'}
          </span>
        </div>
      </div>
    </div>
  );
};
