import Dexie, { type Table } from 'dexie';
import { UserProfile, ScaleMeasurement, DriveBackupPayload } from '@/types';

export class KultKonnectDB extends Dexie {
  profiles!: Table<UserProfile, string>;
  measurements!: Table<ScaleMeasurement, string>;

  constructor() {
    super('KultKonnectDB');

    this.version(1).stores({
      profiles: 'id, name, isDefault',
      measurements: 'id, profileId, timestamp, syncedToHealthConnect',
    });
  }
}

export const db = new KultKonnectDB();

/**
 * Initializes a default profile if the database has zero profiles
 */
export async function ensureDefaultProfile(): Promise<UserProfile> {
  const count = await db.profiles.count();
  if (count === 0) {
    const defaultProfile: UserProfile = {
      id: 'default-profile',
      name: 'Primary User',
      gender: 'male',
      birthDate: '1995-01-01',
      heightCm: 175,
      targetWeightKg: 70,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.profiles.add(defaultProfile);
    return defaultProfile;
  }
  const defaultUser = await db.profiles.filter(p => p.isDefault).first();
  if (defaultUser) return defaultUser;
  const firstUser = await db.profiles.toCollection().first();
  return firstUser!;
}

/**
 * Saves a scale measurement record
 */
export async function saveScaleMeasurement(measurement: ScaleMeasurement): Promise<void> {
  await db.measurements.put(measurement);
}

/**
 * Exports all database records into standard JSON
 */
export async function exportAllData(): Promise<DriveBackupPayload> {
  const profiles = await db.profiles.toArray();
  const measurements = await db.measurements.toArray();

  return {
    version: 1,
    exportedAt: Date.now(),
    deviceInfo: navigator.userAgent,
    profiles,
    measurements,
    checksum: `chk_${Date.now()}_${measurements.length}`,
  };
}

/**
 * Merges / Imports data from a backup payload with conflict resolution
 */
export async function importBackupData(payload: DriveBackupPayload): Promise<{ profilesAdded: number; measurementsAdded: number }> {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.profiles) || !Array.isArray(payload.measurements)) {
    throw new Error('Invalid backup data format');
  }

  let profilesAdded = 0;
  let measurementsAdded = 0;

  await db.transaction('rw', db.profiles, db.measurements, async () => {
    for (const p of payload.profiles) {
      await db.profiles.put(p);
      profilesAdded++;
    }
    for (const m of payload.measurements) {
      await db.measurements.put(m);
      measurementsAdded++;
    }
  });

  return { profilesAdded, measurementsAdded };
}

/**
 * Exports measurements for a profile as standard CSV
 */
export async function exportToCsv(profileId: string): Promise<string> {
  const records = await db.measurements
    .where('profileId')
    .equals(profileId)
    .reverse()
    .sortBy('timestamp');

  const headers = [
    'Date & Time',
    'Weight (kg)',
    'BMI',
    'Body Fat (%)',
    'Muscle (%)',
    'Water (%)',
    'Bone Mass (kg)',
    'BMR (kcal)',
    'Visceral Fat',
    'Impedance (Ohm)',
  ];

  const rows = records.map(r => [
    new Date(r.timestamp).toISOString(),
    r.weightKg.toFixed(2),
    r.bmi.toFixed(1),
    r.bodyFatPercent !== undefined ? r.bodyFatPercent.toFixed(1) : '',
    r.musclePercent !== undefined ? r.musclePercent.toFixed(1) : '',
    r.waterPercent !== undefined ? r.waterPercent.toFixed(1) : '',
    r.boneMassKg !== undefined ? r.boneMassKg.toFixed(1) : '',
    r.bmrKcal !== undefined ? r.bmrKcal.toString() : '',
    r.visceralFat !== undefined ? r.visceralFat.toString() : '',
    r.impedanceOhm !== undefined ? r.impedanceOhm.toFixed(1) : '',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
