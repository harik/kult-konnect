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

export interface ScaleMeasurement {
  id: string;
  profileId: string;
  timestamp: number; // Unix ms
  weightKg: number;
  impedanceOhm?: number;
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
  | 'completed'
  | 'error';

export interface ScaleLiveStatus {
  state: ScaleConnectionState;
  weightKg: number;
  isStable: boolean;
  hasHandles: boolean;
  impedanceReceived: boolean;
  progressPercent: number;
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
