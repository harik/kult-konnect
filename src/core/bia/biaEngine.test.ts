import { describe, it, expect } from 'vitest';
import { calculateBMI, calculateAge, calculateBIA, getBMICategory } from './biaEngine';

describe('BIA Calculation Engine', () => {
  it('correctly calculates BMI', () => {
    // 75 kg at 175 cm -> 75 / (1.75 * 1.75) = 24.489... -> 24.5
    expect(calculateBMI(75, 175)).toBe(24.5);
    expect(calculateBMI(0, 175)).toBe(0);
    expect(calculateBMI(75, 0)).toBe(0);
  });

  it('correctly calculates age from birthdate', () => {
    const age = calculateAge('1990-05-15');
    expect(age).toBeGreaterThanOrEqual(30);
    expect(age).toBeLessThanOrEqual(50);
  });

  it('calculates bounded BIA metrics for adult male', () => {
    const result = calculateBIA({
      weightKg: 75,
      heightCm: 178,
      ageYears: 32,
      gender: 'male',
      impedanceOhm: 250, // typical whole-body impedance
    });

    expect(result.bmi).toBe(23.7);
    expect(result.bodyFatPercent).toBeGreaterThanOrEqual(8);
    expect(result.bodyFatPercent).toBeLessThanOrEqual(30);
    expect(result.musclePercent).toBeGreaterThan(30);
    expect(result.waterPercent).toBeGreaterThan(45);
    expect(result.boneMassKg).toBeGreaterThan(2);
    expect(result.boneMassKg).toBeLessThan(6);
    expect(result.bmrKcal).toBeGreaterThan(1300);
    expect(result.bmrKcal).toBeLessThan(2200);
    expect(result.visceralFat).toBeGreaterThanOrEqual(1);
  });

  it('calculates bounded BIA metrics for adult female', () => {
    const result = calculateBIA({
      weightKg: 58,
      heightCm: 165,
      ageYears: 28,
      gender: 'female',
      impedanceOhm: 290,
    });

    expect(result.bmi).toBe(21.3);
    expect(result.bodyFatPercent).toBeGreaterThanOrEqual(12);
    expect(result.bodyFatPercent).toBeLessThanOrEqual(35);
    expect(result.musclePercent).toBeGreaterThan(25);
    expect(result.waterPercent).toBeGreaterThan(40);
    expect(result.bmrKcal).toBeGreaterThan(1000);
    expect(result.bmrKcal).toBeLessThan(1800);
  });

  it('handles zero or invalid impedance gracefully without throwing', () => {
    const result = calculateBIA({
      weightKg: 70,
      heightCm: 175,
      ageYears: 30,
      gender: 'male',
      impedanceOhm: 0,
    });

    expect(result.bodyFatPercent).toBe(0);
    expect(result.fatFreeMassKg).toBe(0);
  });

  it('classifies BMI categories correctly', () => {
    expect(getBMICategory(17.5).label).toBe('Underweight');
    expect(getBMICategory(22.0).label).toBe('Normal Weight');
    expect(getBMICategory(26.5).label).toBe('Overweight');
    expect(getBMICategory(32.0).label).toBe('Obese');
  });
});
