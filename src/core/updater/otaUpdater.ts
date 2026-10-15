import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

export interface VersionInfo {
  version: string;
  url: string;
  releaseDate?: string;
  changelog?: string;
}

export interface UpdateStatus {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  isDownloading: boolean;
  error?: string;
}

/**
 * Default update manifest endpoint.
 * In production, this points to your Vercel deployment URL (e.g. https://kult-konnect.vercel.app/updates/version.json).
 */
const DEFAULT_UPDATE_URL =
  import.meta.env.VITE_UPDATE_URL ||
  (import.meta.env.VITE_PUBLIC_URL ? `${import.meta.env.VITE_PUBLIC_URL}/updates/version.json` : '/updates/version.json');

/**
 * Initializes the OTA updater.
 * Must call notifyAppReady() in native apps so Capgo knows the active bundle launched successfully.
 */
export async function initOtaUpdater(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
    console.log('[OTA] notifyAppReady sent successfully');
  } catch (err) {
    console.warn('[OTA] notifyAppReady error:', err);
  }
}

/**
 * Checks Vercel endpoint for new OTA web bundles
 */
export async function checkForOtaUpdate(customUrl?: string): Promise<UpdateStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      hasUpdate: false,
      currentVersion: 'web',
      isDownloading: false,
    };
  }

  const endpoint = customUrl || DEFAULT_UPDATE_URL;

  try {
    const current = await CapacitorUpdater.current();
    const currentVersionId = current?.bundle?.id || 'base';

    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch version info: HTTP ${res.status}`);
    }

    const info: VersionInfo = await res.json();

    if (info.version && info.version !== currentVersionId && info.url) {
      return {
        hasUpdate: true,
        currentVersion: currentVersionId,
        latestVersion: info.version,
        isDownloading: false,
      };
    }

    return {
      hasUpdate: false,
      currentVersion: currentVersionId,
      latestVersion: info.version,
      isDownloading: false,
    };
  } catch (err: any) {
    console.warn('[OTA] Update check failed:', err);
    return {
      hasUpdate: false,
      currentVersion: 'unknown',
      isDownloading: false,
      error: err?.message || 'Check failed',
    };
  }
}

/**
 * Downloads and stages the new bundle for next launch
 */
export async function downloadAndStageOtaUpdate(info: VersionInfo): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const resolvedUrl = info.url.startsWith('http')
      ? info.url
      : new URL(info.url, DEFAULT_UPDATE_URL.startsWith('http') ? DEFAULT_UPDATE_URL : window.location.origin).toString();

    console.log(`[OTA] Downloading update bundle: ${info.version} from ${resolvedUrl}`);
    const bundle = await CapacitorUpdater.download({
      url: resolvedUrl,
      version: info.version,
    });

    // Stage bundle for next app launch
    await CapacitorUpdater.set(bundle);
    console.log(`[OTA] Bundle ${info.version} staged successfully!`);
    return true;
  } catch (err) {
    console.error('[OTA] Download failed:', err);
    return false;
  }
}

/**
 * Auto-checks and silently stages update on app launch
 */
export async function autoCheckAndStageUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const status = await checkForOtaUpdate();
    if (status.hasUpdate && status.latestVersion) {
      const endpoint = DEFAULT_UPDATE_URL;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const info: VersionInfo = await res.json();
      await downloadAndStageOtaUpdate(info);
    }
  } catch (err) {
    console.warn('[OTA] Silent update staging encountered an issue:', err);
  }
}
