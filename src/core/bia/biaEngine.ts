import { Gender } from '@/types';

export interface BIAInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: Gender;
  impedanceOhm: number;
}

export interface BIAResult {
  bmi: number;
  fatFreeMassKg: number;
  bodyFatPercent: number;
  waterPercent: number;
  musclePercent: number;
  boneMassKg: number;
  bmrKcal: number;
  visceralFat: number;
}

/**
 * Calculates Body Mass Index (BMI)
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

/**
 * Calculates demographic age from birthDate string (YYYY-MM-DD)
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(10, Math.min(120, age));
}

/**
 * Clinical-grade BIA calculation from raw impedance values.
 * Based on Sun SS et al. (2003) & Janssen et al. prediction equations.
 * Accounts for 8-electrode parallel hand-to-foot circuit resistance (~200-350Ω range).
 */
export function calculateBIA(input: BIAInput): BIAResult {
  const { weightKg, heightCm, ageYears, gender, impedanceOhm } = input;
  const bmi = calculateBMI(weightKg, heightCm);

  if (weightKg <= 0 || heightCm <= 0 || impedanceOhm <= 0) {
    return {
      bmi,
      fatFreeMassKg: 0,
      bodyFatPercent: 0,
      waterPercent: 0,
      musclePercent: 0,
      boneMassKg: 0,
      bmrKcal: 0,
      visceralFat: 0,
    };
  }

  const isMale = gender === 'male';
  const genderInt = isMale ? 1 : 0;

  // 8-electrode scales measure both sides in parallel, reporting impedance ~250Ω.
  // Standard equations assume whole-body single-side pathway (~500Ω).
  const effectiveImpedance = impedanceOhm < 380 ? impedanceOhm * 2 : impedanceOhm;

  // Reusable constant: H^2 / R
  const h2rCoeff = (heightCm * heightCm) / effectiveImpedance;

  // Fat-Free Mass (FFM) according to Sun SS et al. (2003)
  let ffm: number;
  if (isMale) {
    ffm = -10.68 + 0.65 * h2rCoeff + 0.26 * weightKg + 0.02 * effectiveImpedance;
  } else {
    ffm = -9.53 + 0.69 * h2rCoeff + 0.17 * weightKg + 0.02 * effectiveImpedance;
  }

  // Clinical safety bounds for FFM
  ffm = Math.max(weightKg * 0.4, Math.min(weightKg * 0.95, ffm));

  // Body Fat % = (1 - FFM / Weight) * 100
  let bodyFatPercent = ((weightKg - ffm) / weightKg) * 100;
  bodyFatPercent = Math.max(3.0, Math.min(65.0, bodyFatPercent));

  // Total Body Water (TBW) in Liters / kg according to Sun SS et al. (2003)
  const liters = isMale
    ? 1.2 + 0.45 * h2rCoeff + 0.18 * weightKg
    : 3.75 + 0.45 * h2rCoeff + 0.11 * weightKg;
  const waterKg = 0.99513 * liters;
  const waterPercent = Math.max(30.0, Math.min(75.0, (waterKg / weightKg) * 100));

  // Skeletal Muscle Mass according to Janssen et al.
  const skeletalMuscleKg = 0.401 * h2rCoeff + 3.825 * genderInt - 0.071 * ageYears + 5.102;
  const musclePercent = Math.max(15.0, Math.min(65.0, (skeletalMuscleKg / weightKg) * 100));

  // Bone Mass (kg)
  const boneFactor = isMale ? 0.057 : 0.05;
  const boneMassKg = Math.max(1.0, Math.min(7.0, boneFactor * ffm));

  // BMR (kcal/day) according to Katch-McArdle formula
  const bmrKcal = Math.round(370 + 21.6 * ffm);

  // Visceral Fat index (Scale 1 to 30)
  let visceralFat = Math.round(bmi * 0.4 + bodyFatPercent * 0.2 + ageYears * 0.05 - (isMale ? 0 : 2));
  visceralFat = Math.max(1, Math.min(30, visceralFat));

  return {
    bmi,
    fatFreeMassKg: Number(ffm.toFixed(1)),
    bodyFatPercent: Number(bodyFatPercent.toFixed(1)),
    waterPercent: Number(waterPercent.toFixed(1)),
    musclePercent: Number(musclePercent.toFixed(1)),
    boneMassKg: Number(boneMassKg.toFixed(1)),
    bmrKcal,
    visceralFat,
  };
}

/**
 * WHO / Asian BMI classifications
 */
export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-amber-400 bg-amber-400/10' };
  if (bmi < 24.9) return { label: 'Normal Weight', color: 'text-emerald-400 bg-emerald-400/10' };
  if (bmi < 29.9) return { label: 'Overweight', color: 'text-orange-400 bg-orange-400/10' };
  return { label: 'Obese', color: 'text-red-400 bg-red-400/10' };
}
