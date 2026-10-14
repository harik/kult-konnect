import { BleClient } from '@capacitor-community/bluetooth-le';
import { parseScalePacket } from './packetParser';
import { ScaleLiveStatus, ScaleConnectionState } from '@/types';

export const CULT_SCALE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const CULT_SCALE_NOTIFY_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';
export const CULT_SCALE_WRITE_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';

export interface MeasurementResult {
  weightKg: number;
  impedanceOhm?: number;
  rawImpedances?: number[];
  heartRateBpm?: number;
  hasBodyComp: boolean;
}

export type StatusCallback = (status: ScaleLiveStatus) => void;
export type ResultCallback = (result: MeasurementResult) => void;

export interface IScaleBleDriver {
  startWeighIn(onStatus: StatusCallback, onResult: ResultCallback): Promise<void>;
  stopWeighIn(): Promise<void>;
  isScanningOrConnected(): boolean;
}

/**
 * Real Hardware BLE Driver for Cult Smart Scale Pro
 */
export class CapacitorScaleBleDriver implements IScaleBleDriver {
  private activeDeviceId: string | null = null;
  private isRunning = false;
  private onStatus: StatusCallback | null = null;
  private onResult: ResultCallback | null = null;

  private pendingWeight = 0;
  private pendingImpedance: number | undefined = undefined;
  private pendingRawImpedances: number[] = [];
  private pendingHeartRate: number | undefined = undefined;
  private bodyCompPacketCount = 0;
  private heartRateTimeout: any = null;

  async startWeighIn(onStatus: StatusCallback, onResult: ResultCallback): Promise<void> {
    this.onStatus = onStatus;
    this.onResult = onResult;
    this.isRunning = true;
    this.pendingWeight = 0;
    this.pendingImpedance = undefined;
    this.pendingRawImpedances = [];
    this.pendingHeartRate = undefined;
    this.bodyCompPacketCount = 0;
    this.clearHeartRateTimer();

    try {
      this.notifyState('scanning', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 10,
        stepMessage: 'Searching for scale... Step on it to turn on display',
      });
      
      await BleClient.initialize();

      const isBtEnabled = await BleClient.isEnabled();
      if (!isBtEnabled) {
        try {
          await BleClient.requestEnable();
        } catch (e) {
          console.warn('[BLE Driver] Bluetooth enable request rejected or dismissed');
        }
      }

      let deviceId: string | null = null;

      // 1. Try automatic LE scanning (user steps on scale, wakes up BLE)
      try {
        await new Promise<void>(async (resolve, reject) => {
          const timeout = setTimeout(async () => {
            try { await BleClient.stopLEScan(); } catch {}
            resolve();
          }, 12000);

          try {
            await BleClient.requestLEScan({ allowDuplicates: false }, async (scanResult) => {
              const name = (scanResult.device.name || '').toLowerCase();
              const hasScaleService = scanResult.uuids?.some((u) => u.toLowerCase().includes('fff0'));

              if (hasScaleService || name.includes('cult') || name.includes('scale')) {
                clearTimeout(timeout);
                deviceId = scanResult.device.deviceId;
                try { await BleClient.stopLEScan(); } catch {}
                resolve();
              }
            });
          } catch (scanErr) {
            clearTimeout(timeout);
            reject(scanErr);
          }
        });
      } catch (scanErr) {
        console.warn('[BLE Driver] requestLEScan not supported or failed, using requestDevice fallback:', scanErr);
      }

      if (!deviceId) {
        const device = await BleClient.requestDevice({
          services: [CULT_SCALE_SERVICE_UUID],
          optionalServices: [],
        });
        deviceId = device.deviceId;
      }

      this.activeDeviceId = deviceId;
      this.notifyState('connecting', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 25,
        stepMessage: 'Connecting to scale...',
      });

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        console.log(`[BLE Driver] Device ${disconnectedDeviceId} disconnected`);
        this.handleDisconnectFallback();
      });

      this.notifyState('connected', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 35,
        stepMessage: 'Scale connected. Step on with bare feet and hold the handle',
      });

      // Start notifications on 0xFFF4
      await BleClient.startNotifications(
        deviceId,
        CULT_SCALE_SERVICE_UUID,
        CULT_SCALE_NOTIFY_UUID,
        (value) => {
          const uint8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          this.handlePacket(uint8);
        }
      );

      this.notifyState('measuring_weight', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 40,
        stepMessage: 'Stabilizing weight...',
      });
    } catch (err: any) {
      console.error('[BLE Driver] Error during weigh-in:', err);
      this.notifyState('error', { 
        weightKg: 0, 
        isStable: false, 
        hasHandles: false, 
        impedanceReceived: false, 
        progressPercent: 0,
        errorMessage: err?.message || 'Bluetooth connection failed',
      });
      await this.stopWeighIn();
    }
  }

  private handlePacket(bytes: Uint8Array) {
    const rawHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`[BLE Driver] Packet: ${rawHex}`);

    const packet = parseScalePacket(bytes);
    if (!packet) return;

    if (packet.type === 'live_weight') {
      if (packet.weightKg > 0) {
        this.pendingWeight = packet.weightKg;
      }
      if (packet.heartRateBpm) {
        this.pendingHeartRate = packet.heartRateBpm;
        console.log(`[BLE Driver] Heart rate captured: ${packet.heartRateBpm} BPM`);
      }

      // If we received the post-measurement heart rate packet, finalize immediately!
      if (packet.heartRateBpm && this.pendingWeight > 0) {
        this.finalizeMeasurement();
        return;
      }

      if (packet.status === 'unstable') {
        this.notifyState('measuring_weight', {
          weightKg: packet.weightKg,
          isStable: false,
          hasHandles: packet.hasHandles,
          impedanceReceived: false,
          progressPercent: 45,
          stepMessage: 'Measuring weight... Stand still',
        });
      } else if (packet.status === 'stable_weight_only') {
        this.notifyState('completed', {
          weightKg: this.pendingWeight || packet.weightKg,
          isStable: true,
          hasHandles: false,
          impedanceReceived: false,
          progressPercent: 100,
          stepMessage: 'Weight locked (feet only)',
        });
        if (this.onResult && this.pendingWeight > 0) {
          this.onResult({ weightKg: this.pendingWeight, hasBodyComp: false });
        }
      } else if (packet.status === 'measuring_impedance') {
        this.notifyState('measuring_impedance', {
          weightKg: this.pendingWeight || packet.weightKg,
          isStable: true,
          hasHandles: true,
          impedanceReceived: false,
          progressPercent: 65,
          stepMessage: 'Measuring 8-electrode limb & torso bioimpedance...',
        });
      } else if (packet.status === 'measuring_heart_rate') {
        this.notifyState('measuring_heart_rate', {
          weightKg: this.pendingWeight || packet.weightKg,
          isStable: true,
          hasHandles: true,
          impedanceReceived: true,
          heartRateBpm: this.pendingHeartRate,
          progressPercent: 88,
          stepMessage: 'Measuring resting pulse... Scale is spinning',
        });
      } else if (packet.status === 'stable_complete') {
        this.notifyState('measuring_impedance', {
          weightKg: this.pendingWeight || packet.weightKg,
          isStable: true,
          hasHandles: true,
          impedanceReceived: true,
          progressPercent: 75,
          stepMessage: 'Full body impedance locked',
        });
      }
    } else if (packet.type === 'impedance') {
      this.pendingRawImpedances = [...this.pendingRawImpedances, ...packet.impedances];
      if (packet.packetIndex === 0 && packet.wholeBodyImpedance) {
        this.pendingImpedance = packet.wholeBodyImpedance;
      }
    } else if (packet.type === 'completion') {
      this.bodyCompPacketCount++;
      // When body comp is done, the scale screen begins spinning to measure heart rate!
      // Do NOT disconnect! Give it up to 12 seconds to measure pulse / BCG.
      if (this.bodyCompPacketCount >= 4 && !this.heartRateTimeout) {
        this.notifyState('measuring_heart_rate', {
          weightKg: this.pendingWeight,
          isStable: true,
          hasHandles: true,
          impedanceReceived: true,
          heartRateBpm: this.pendingHeartRate,
          progressPercent: 88,
          stepMessage: 'Measuring resting pulse rate... Hold still while scale spins',
        });

        this.heartRateTimeout = setTimeout(() => {
          console.log('[BLE Driver] Heart rate wait window complete, finalizing measurement');
          this.finalizeMeasurement();
        }, 12000);
      }
    } else if (packet.type === 'heart_rate') {
      console.log(`[BLE Driver] Dedicated pulse captured: ${packet.bpm} BPM`);
      this.pendingHeartRate = packet.bpm;
      this.finalizeMeasurement();
    }
  }

  private finalizeMeasurement() {
    this.clearHeartRateTimer();
    if (!this.isRunning || this.pendingWeight <= 0) return;

    this.notifyState('completed', {
      weightKg: this.pendingWeight,
      isStable: true,
      hasHandles: !!this.pendingImpedance,
      impedanceReceived: !!this.pendingImpedance,
      heartRateBpm: this.pendingHeartRate,
      progressPercent: 100,
      stepMessage: 'Weigh-in complete!',
    });

    if (this.onResult) {
      this.onResult({
        weightKg: this.pendingWeight,
        impedanceOhm: this.pendingImpedance,
        rawImpedances: this.pendingRawImpedances,
        heartRateBpm: this.pendingHeartRate,
        hasBodyComp: !!this.pendingImpedance && this.pendingImpedance > 0,
      });
    }

    this.stopWeighIn();
  }

  private handleDisconnectFallback() {
    this.clearHeartRateTimer();
    console.log(`[BLE Driver] Device disconnected. Weight=${this.pendingWeight}, Imp=${this.pendingImpedance}`);
    if (this.pendingWeight > 0) {
      this.finalizeMeasurement();
    } else {
      this.notifyState('disconnected', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 0,
      });
    }
  }

  private notifyState(state: ScaleConnectionState, status: Omit<ScaleLiveStatus, 'state'>) {
    if (this.onStatus) {
      this.onStatus({ state, ...status });
    }
  }

  private clearHeartRateTimer() {
    if (this.heartRateTimeout) {
      clearTimeout(this.heartRateTimeout);
      this.heartRateTimeout = null;
    }
  }

  async stopWeighIn(): Promise<void> {
    this.isRunning = false;
    this.clearHeartRateTimer();
    if (this.activeDeviceId) {
      const devId = this.activeDeviceId;
      this.activeDeviceId = null;
      try {
        await BleClient.stopNotifications(devId, CULT_SCALE_SERVICE_UUID, CULT_SCALE_NOTIFY_UUID);
        await BleClient.disconnect(devId);
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }

  isScanningOrConnected(): boolean {
    return this.isRunning;
  }
}

/**
 * Mock BLE Driver for Desktop Browser Development & Automated Testing
 */
export class MockScaleBleDriver implements IScaleBleDriver {
  private timer: any = null;
  private isRunning = false;
  private mode: 'full_body' | 'weight_only' = 'full_body';

  constructor(mode: 'full_body' | 'weight_only' = 'full_body') {
    this.mode = mode;
  }

  setMode(mode: 'full_body' | 'weight_only') {
    this.mode = mode;
  }

  async startWeighIn(onStatus: StatusCallback, onResult: ResultCallback): Promise<void> {
    this.isRunning = true;
    this.clearTimer();

    // 1. Scanning
    onStatus({
      state: 'scanning',
      weightKg: 0,
      isStable: false,
      hasHandles: false,
      impedanceReceived: false,
      progressPercent: 15,
      stepMessage: 'Scanning for scale... Step on scale to turn on',
    });

    await this.delay(1000);
    if (!this.isRunning) return;

    // 2. Connected
    onStatus({
      state: 'connected',
      weightKg: 0,
      isStable: false,
      hasHandles: false,
      impedanceReceived: false,
      progressPercent: 30,
      stepMessage: 'Connected! Grip the handlebar and stand upright',
    });

    await this.delay(800);
    if (!this.isRunning) return;

    // 3. Live Weight Streaming Simulation
    const simulatedTarget = 74.5;
    const steps = [42.1, 65.3, 72.8, 74.2, 74.5, 74.5];

    for (let i = 0; i < steps.length; i++) {
      if (!this.isRunning) return;
      onStatus({
        state: 'measuring_weight',
        weightKg: steps[i],
        isStable: i >= 4,
        hasHandles: this.mode === 'full_body',
        impedanceReceived: false,
        progressPercent: 35 + i * 5,
        stepMessage: 'Stabilizing weight on load cells...',
      });
      await this.delay(400);
    }

    if (this.mode === 'weight_only') {
      onStatus({
        state: 'completed',
        weightKg: simulatedTarget,
        isStable: true,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 100,
        stepMessage: 'Weight-only complete',
      });
      onResult({ weightKg: simulatedTarget, hasBodyComp: false });
      this.isRunning = false;
      return;
    }

    // 4. Impedance Measurement Simulation (Holding Handles)
    onStatus({
      state: 'measuring_impedance',
      weightKg: simulatedTarget,
      isStable: true,
      hasHandles: true,
      impedanceReceived: false,
      progressPercent: 70,
      stepMessage: 'Scanning limbs & torso (8 electrodes)... Keep arms forward',
    });

    await this.delay(1400);
    if (!this.isRunning) return;

    // 5. Heart Rate Measurement Simulation (Scale spinning)
    onStatus({
      state: 'measuring_heart_rate',
      weightKg: simulatedTarget,
      isStable: true,
      hasHandles: true,
      impedanceReceived: true,
      heartRateBpm: 72,
      progressPercent: 88,
      stepMessage: 'Measuring resting heart rate... Scale spinning',
    });

    await this.delay(1500);
    if (!this.isRunning) return;

    // 6. Complete
    onStatus({
      state: 'completed',
      weightKg: simulatedTarget,
      isStable: true,
      hasHandles: true,
      impedanceReceived: true,
      heartRateBpm: 72,
      progressPercent: 100,
      stepMessage: 'Full body analysis complete!',
    });

    onResult({
      weightKg: simulatedTarget,
      impedanceOhm: 248.5,
      rawImpedances: [2867, 3013, 248, 2904, 2668, 2750, 2900, 31, 2800, 2550],
      heartRateBpm: 72,
      hasBodyComp: true,
    });

    this.isRunning = false;
  }

  async stopWeighIn(): Promise<void> {
    this.isRunning = false;
    this.clearTimer();
  }

  isScanningOrConnected(): boolean {
    return this.isRunning;
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }
}
