import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { matchProfileForWeight } from './profileMatcher';
import { UserProfile, ScaleMeasurement } from '@/types';

describe('Profile Auto-Matcher', () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.measurements.clear();
  });

  it('returns single profile when only one profile exists', async () => {
    const p1: UserProfile = {
      id: 'p1',
      name: 'Hari',
      gender: 'male',
      birthDate: '1990-01-01',
      heightCm: 175,
      targetWeightKg: 75,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.profiles.add(p1);

    const match = await matchProfileForWeight(74.5);
    expect(match.matchedProfile?.id).toBe('p1');
    expect(match.isAmbiguous).toBe(false);
  });

  it('matches closest profile based on past measurement history', async () => {
    const p1: UserProfile = {
      id: 'p1',
      name: 'Hari',
      gender: 'male',
      birthDate: '1990-01-01',
      heightCm: 175,
      targetWeightKg: 75,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const p2: UserProfile = {
      id: 'p2',
      name: 'Alex',
      gender: 'female',
      birthDate: '1995-01-01',
      heightCm: 160,
      targetWeightKg: 55,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.profiles.bulkAdd([p1, p2]);

    // Add historical measurements
    const m1: ScaleMeasurement = {
      id: 'm1',
      profileId: 'p1',
      timestamp: Date.now() - 86400000,
      weightKg: 75.2,
      bmi: 24.5,
      syncedToHealthConnect: true,
      createdAt: Date.now(),
    };
    const m2: ScaleMeasurement = {
      id: 'm2',
      profileId: 'p2',
      timestamp: Date.now() - 86400000,
      weightKg: 54.8,
      bmi: 21.4,
      syncedToHealthConnect: true,
      createdAt: Date.now(),
    };
    await db.measurements.bulkAdd([m1, m2]);

    // Weigh-in of 55.1 kg should match Alex (p2)
    const matchAlex = await matchProfileForWeight(55.1);
    expect(matchAlex.matchedProfile?.id).toBe('p2');

    // Weigh-in of 74.9 kg should match Hari (p1)
    const matchHari = await matchProfileForWeight(74.9);
    expect(matchHari.matchedProfile?.id).toBe('p1');
  });
});
