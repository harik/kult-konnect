import { UserProfile } from '@/types';
import { db } from './db';

/**
 * Finds the most likely UserProfile for a measured weight based on recent history.
 * If multiple profiles match within tolerance, flags as ambiguous.
 */
export async function matchProfileForWeight(
  weightKg: number,
  toleranceKg = 3.5
): Promise<{ matchedProfile: UserProfile | null; isAmbiguous: boolean }> {
  const profiles = await db.profiles.toArray();
  if (profiles.length === 0) return { matchedProfile: null, isAmbiguous: false };
  if (profiles.length === 1) return { matchedProfile: profiles[0], isAmbiguous: false };

  // For each profile, look up their latest measurement
  const candidates: { profile: UserProfile; delta: number }[] = [];

  for (const profile of profiles) {
    const latest = await db.measurements
      .where('profileId')
      .equals(profile.id)
      .reverse()
      .sortBy('timestamp');

    const lastWeight = latest.length > 0 ? latest[0].weightKg : profile.targetWeightKg || 70;
    const delta = Math.abs(lastWeight - weightKg);

    if (delta <= toleranceKg) {
      candidates.push({ profile, delta });
    }
  }

  // Sort by smallest delta
  candidates.sort((a, b) => a.delta - b.delta);

  if (candidates.length === 0) {
    // Fall back to default profile if no candidate is within tolerance
    const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];
    return { matchedProfile: defaultProfile, isAmbiguous: false };
  }

  if (candidates.length > 1 && Math.abs(candidates[0].delta - candidates[1].delta) < 1.0) {
    // Both profiles are similarly close
    return { matchedProfile: candidates[0].profile, isAmbiguous: true };
  }

  return { matchedProfile: candidates[0].profile, isAmbiguous: false };
}
