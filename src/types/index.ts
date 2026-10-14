export type Gender = 'male' | 'female';

export interface UserProfile {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  targetWeightKg?: number;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SegmentMetrics {
  fatPercent: number;
  fatKg: number;
  muscleKg: number;
}

export interface SegmentalBreakdown {
  rightArm: SegmentMetrics;
  leftArm: SegmentMetrics;
  torso: SegmentMetrics;
  rightLeg: SegmentMetrics;
  leftLeg: SegmentMetrics;
}

export interface ScaleMeasurement {
  id: string;
  profileId: string;
  timestamp: number; // Unix ms
  weightKg: number;
  impedanceOhm?: number;
  rawImpedances?: number[]; // all 10 raw frequencies/segments
  heartRateBpm?: number;
  segmental?: SegmentalBreakdown;
  bmi: number;
  bodyFatPercent?: number;
  musclePercent?: number;
  waterPercent?: number;
  boneMassKg?: number;
  bmrKcal?: number;
  visceralFat?: number;
  syncedToHealthConnect: boolean;
  healthConnectRecordIds?: {
    weight?: string;
    bodyFat?: string;
    boneMass?: string;
    bmr?: string;
    leanBodyMass?: string;
    heartRate?: string;
  };
  createdAt: number;
}

export type ScaleConnectionState = 
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'measuring_weight'
  | 'measuring_impedance'
  | 'measuring_heart_rate'
  | 'completed'
  | 'error';

export interface ScaleLiveStatus {
  state: ScaleConnectionState;
  weightKg: number;
  isStable: boolean;
  hasHandles: boolean;
  impedanceReceived: boolean;
  heartRateBpm?: number;
  progressPercent: number;
  stepMessage?: string;
  errorMessage?: string;
}

export interface DriveBackupPayload {
  version: 1;
  exportedAt: number;
  deviceInfo: string;
  profiles: UserProfile[];
  measurements: ScaleMeasurement[];
  checksum: string;
}
