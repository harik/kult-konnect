import { Health } from '@capgo/capacitor-health';
import { ScaleMeasurement } from '@/types';
import { db } from '../storage/db';

export interface HealthSyncStatus {
  isAvailable: boolean;
  isAuthorized: boolean;
  platform?: string;
  error?: string;
}

/**
 * Checks if Health Connect (Android) or HealthKit (iOS) is available on the device
 */
export async function checkHealthConnectAvailability(): Promise<HealthSyncStatus> {
  try {
    const res = await Health.isAvailable();
    if (!res.available) {
      return {
        isAvailable: false,
        isAuthorized: false,
        platform: res.platform,
        error: res.reason || 'Health Connect is not available on this device',
      };
    }

    const auth = await Health.checkAuthorization({
      write: ['weight', 'bodyFat', 'basalCalories', 'heartRate'],
    });

    const isAuthorized = auth.writeAuthorized.includes('weight');

    return {
      isAvailable: true,
      isAuthorized,
      platform: res.platform,
    };
  } catch (err: any) {
    return {
      isAvailable: false,
      isAuthorized: false,
      error: err?.message || 'Error checking Health Connect status',
    };
  }
}

/**
 * Requests write permissions for weight, body fat, basal calories, and heart rate
 */
export async function requestHealthPermissions(): Promise<boolean> {
  try {
    const status = await Health.requestAuthorization({
      write: ['weight', 'bodyFat', 'basalCalories', 'heartRate'],
    });
    return status.writeAuthorized.includes('weight');
  } catch (err) {
    console.error('[Health Sync] Permission request failed:', err);
    return false;
  }
}

/**
 * Syncs a single ScaleMeasurement record to Google Health Connect
 */
export async function syncMeasurementToHealthConnect(measurement: ScaleMeasurement): Promise<boolean> {
  try {
    const avail = await Health.isAvailable();
    if (!avail.available) {
      console.warn('[Health Sync] Health Connect is not available on this platform');
      return false;
    }

    const dateIso = new Date(measurement.timestamp).toISOString();

    // 1. Sync Weight (kg)
    if (measurement.weightKg > 0) {
      await Health.saveSample({
        dataType: 'weight',
        value: measurement.weightKg,
        unit: 'kilogram',
        startDate: dateIso,
        endDate: dateIso,
        metadata: {
          kultKonnectId: measurement.id,
          source: 'Kult Smart Scale Pro',
        },
      });
    }

    // 2. Sync Body Fat (%)
    if (measurement.bodyFatPercent !== undefined && measurement.bodyFatPercent > 0) {
      await Health.saveSample({
        dataType: 'bodyFat',
        value: measurement.bodyFatPercent / 100, // standard decimal ratio or percentage
        unit: 'percent',
        startDate: dateIso,
        endDate: dateIso,
        metadata: {
          kultKonnectId: measurement.id,
        },
      });
    }

    // 3. Sync Basal Calories (kcal)
    if (measurement.bmrKcal !== undefined && measurement.bmrKcal > 0) {
      await Health.saveSample({
        dataType: 'basalCalories',
        value: measurement.bmrKcal,
        unit: 'kilocalorie',
        startDate: dateIso,
        endDate: dateIso,
      });
    }

    // 4. Sync Resting Heart Rate (BPM)
    if (measurement.heartRateBpm !== undefined && measurement.heartRateBpm > 0) {
      await Health.saveSample({
        dataType: 'heartRate',
        value: measurement.heartRateBpm,
        unit: 'bpm',
        startDate: dateIso,
        endDate: dateIso,
        metadata: {
          kultKonnectId: measurement.id,
          source: 'Cult Smart Scale Pro BCG',
        },
      });
    }

    // Update local database record
    await db.measurements.update(measurement.id, {
      syncedToHealthConnect: true,
    });

    console.log(`[Health Sync] Successfully synced measurement ${measurement.id}`);
    return true;
  } catch (err) {
    console.error(`[Health Sync] Failed to sync measurement ${measurement.id}:`, err);
    return false;
  }
}

/**
 * Batch syncs all pending unsynced measurements to Google Health Connect
 */
export async function syncPendingMeasurements(): Promise<{ syncedCount: number; failedCount: number }> {
  const pending = await db.measurements
    .where('syncedToHealthConnect')
    .equals(0) // boolean stored as 0/false in indexeddb queries
    .or('syncedToHealthConnect')
    .equals(false as any)
    .toArray();

  let syncedCount = 0;
  let failedCount = 0;

  for (const m of pending) {
    const ok = await syncMeasurementToHealthConnect(m);
    if (ok) syncedCount++;
    else failedCount++;
  }

  return { syncedCount, failedCount };
}
