import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultProfile } from './core/storage/db';
import { UserProfile } from './types';
import { CapacitorScaleBleDriver, MockScaleBleDriver, WebScaleBleDriver, IScaleBleDriver } from './core/ble/ScaleBleDriver';
import { Dashboard } from './components/Dashboard';
import { TrendCharts } from './components/TrendCharts';
import { HistoryList } from './components/HistoryList';
import { WeighInModal } from './components/WeighInModal';
import { ProfileModal } from './components/ProfileModal';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { SettingsModal } from './components/SettingsModal';
import { Scale, LineChart, History, Settings, ChevronDown, Sparkles, Download, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { usePwaInstall } from './hooks/usePwaInstall';
import { initOtaUpdater, autoCheckAndStageUpdate } from './core/updater/otaUpdater';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'history'>('dashboard');
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);

  // PWA Install Prompt State
  const { isInstallable, isStandalone, promptInstall } = usePwaInstall();

  // Modals
  const [isWeighInOpen, setIsWeighInOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Scale Driver Mode
  const [isMockMode, setIsMockMode] = useState(false);
  const [mockModeType, setMockModeType] = useState<'full_body' | 'weight_only'>('full_body');

  // Drivers: Auto-selects Native BLE on Android, Web Bluetooth in browser/PWA, or Mock
  const realDriver = useMemo(() => {
    if (Capacitor.isNativePlatform()) {
      return new CapacitorScaleBleDriver();
    }
    return new WebScaleBleDriver();
  }, []);
  const mockDriver = useMemo(() => new MockScaleBleDriver(mockModeType), [mockModeType]);
  const activeDriver: IScaleBleDriver = isMockMode ? mockDriver : realDriver;

  // Database Queries
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) || [];
  const measurements = useLiveQuery(() => {
    if (!activeProfile) return [];
    return db.measurements
      .where('profileId')
      .equals(activeProfile.id)
      .reverse()
      .sortBy('timestamp');
  }, [activeProfile?.id]) || [];

  // Check if user has completed profile setup and initialize OTA updater
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initOtaUpdater();
      autoCheckAndStageUpdate();
    }

    const hasSetup = localStorage.getItem('kult_has_configured_profile');
    if (!hasSetup) {
      setIsSetupModalOpen(true);
    }
    ensureDefaultProfile().then((p) => {
      if (!activeProfile) setActiveProfile(p);
    });
  }, []);

  const handleTriggerWeighIn = () => {
    const hasSetup = localStorage.getItem('kult_has_configured_profile');
    if (!hasSetup) {
      setIsSetupModalOpen(true);
      return;
    }
    setIsWeighInOpen(true);
  };

  const latestMeasurement = measurements.length > 0 ? measurements[0] : null;
  const previousMeasurement = measurements.length > 1 ? measurements[1] : null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans safe-top">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        {/* Profile Selector Button */}
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
            {activeProfile?.name.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-semibold text-white max-w-[120px] truncate">
            {activeProfile?.name || 'Loading...'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {/* Right Action Icons & Mode Indicator */}
        <div className="flex items-center gap-2">
          {isMockMode && (
            <span className="text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Mock Scale
            </span>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Progressive Multi-Tier Banner */}
      {!Capacitor.isNativePlatform() && (
        <aside aria-label="App Status Notice" className="bg-gradient-to-r from-brand-950/80 via-slate-900 to-brand-950/80 border-b border-brand-500/25 px-4 py-2.5 text-xs flex items-center justify-between gap-3 text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-brand-400 shrink-0" />
            <div className="truncate">
              {isInstallable ? (
                <>
                  <span className="font-semibold text-white">Install App:</span>{' '}
                  <span className="text-slate-400">Add to home screen for clean offline access.</span>
                </>
              ) : isStandalone ? (
                <>
                  <span className="font-semibold text-emerald-400">PWA Active:</span>{' '}
                  <span className="text-slate-400">Web Bluetooth enabled. Health Connect requires APK.</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">Web Mode:</span>{' '}
                  <span className="text-slate-400">Web Bluetooth enabled on Chrome.</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <button
                onClick={promptInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install PWA</span>
              </button>
            )}

            {!isInstallable && (
              <a
                href="/kult-konnect.apk"
                download="kult-konnect.apk"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition"
                title="Download full Android package for Google Health Connect"
              >
                <Download className="w-3.5 h-3.5" />
                <span>APK</span>
              </a>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {activeTab === 'dashboard' && (
          <Dashboard
            latestMeasurement={latestMeasurement}
            previousMeasurement={previousMeasurement}
            currentProfile={activeProfile || ({} as UserProfile)}
            onStartWeighIn={handleTriggerWeighIn}
          />
        )}

        {activeTab === 'trends' && (
          <TrendCharts measurements={measurements} />
        )}

        {activeTab === 'history' && (
          <HistoryList
            measurements={measurements}
            onRefresh={() => {}}
          />
        )}
      </main>

      {/* Floating Start Weigh-in Action Bar */}
      <div className="fixed bottom-16 inset-x-0 z-30 flex justify-center p-4 pointer-events-none">
        <button
          onClick={handleTriggerWeighIn}
          className="pointer-events-auto bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold py-3.5 px-8 rounded-full shadow-2xl shadow-brand-500/40 flex items-center gap-2.5 transition active:scale-95 border border-brand-400/30"
        >
          <Scale className="w-5 h-5" />
          <span>Weigh In</span>
        </button>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 safe-bottom">
        <div className="flex justify-around items-center max-w-md mx-auto h-14">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'dashboard' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Scale className="w-5 h-5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'trends' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <LineChart className="w-5 h-5" />
            <span>Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'history' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <History className="w-5 h-5" />
            <span>History</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {activeProfile && (
        <WeighInModal
          isOpen={isWeighInOpen}
          onClose={() => setIsWeighInOpen(false)}
          driver={activeDriver}
          currentProfile={activeProfile}
          profiles={profiles}
          onMeasurementSaved={() => {}}
        />
      )}

      {activeProfile && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profiles={profiles}
          currentProfile={activeProfile}
          onProfileSelect={(p) => setActiveProfile(p)}
          onProfilesChanged={() => {}}
        />
      )}

      {activeProfile && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          activeProfileId={activeProfile.id}
          isMockMode={isMockMode}
          setIsMockMode={setIsMockMode}
          mockModeType={mockModeType}
          setMockModeType={setMockModeType}
          onDataImported={() => {}}
        />
      )}

      <ProfileSetupModal
        isOpen={isSetupModalOpen}
        onProfileCreated={(p) => {
          setActiveProfile(p);
          setIsSetupModalOpen(false);
        }}
      />
    </div>
  );
}
export default App;
