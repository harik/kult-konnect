import { BleClient } from '@capacitor-community/bluetooth-le';
import { parseScalePacket } from './packetParser';
import { ScaleLiveStatus, ScaleConnectionState } from '@/types';

export const CULT_SCALE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const CULT_SCALE_NOTIFY_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';
export const CULT_SCALE_WRITE_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';

export interface MeasurementResult {
  weightKg: number;
  impedanceOhm?: number;
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
  private bodyCompPacketCount = 0;

  async startWeighIn(onStatus: StatusCallback, onResult: ResultCallback): Promise<void> {
    this.onStatus = onStatus;
    this.onResult = onResult;
    this.isRunning = true;
    this.pendingWeight = 0;
    this.pendingImpedance = undefined;
    this.bodyCompPacketCount = 0;

    try {
      this.notifyState('scanning', { weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 10 });
      
      await BleClient.initialize();

      // Ensure Bluetooth is turned on
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

      // 2. If auto-scan did not lock onto the scale, trigger native device picker dialog
      if (!deviceId) {
        const device = await BleClient.requestDevice({
          services: [CULT_SCALE_SERVICE_UUID],
          optionalServices: [],
        });
        deviceId = device.deviceId;
      }

      this.activeDeviceId = deviceId;
      this.notifyState('connecting', { weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 30 });

      await BleClient.connect(deviceId, (disconnectedDeviceId) => {
        console.log(`[BLE Driver] Device ${disconnectedDeviceId} disconnected`);
        this.handleDisconnectFallback();
      });

      this.notifyState('connected', { weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 40 });

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

      this.notifyState('measuring_weight', { weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 50 });
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
    const packet = parseScalePacket(bytes);
    if (!packet) return;

    if (packet.type === 'live_weight') {
      this.pendingWeight = packet.weightKg;

      if (packet.status === 'unstable') {
        this.notifyState('measuring_weight', {
          weightKg: packet.weightKg,
          isStable: false,
          hasHandles: packet.hasHandles,
          impedanceReceived: false,
          progressPercent: 50,
        });
      } else if (packet.status === 'stable_weight_only') {
        // User stepped on without gripping handles
        this.notifyState('completed', {
          weightKg: packet.weightKg,
          isStable: true,
          hasHandles: false,
          impedanceReceived: false,
          progressPercent: 100,
        });
        if (this.onResult && this.pendingWeight > 0) {
          this.onResult({ weightKg: this.pendingWeight, hasBodyComp: false });
        }
      } else if (packet.status === 'measuring_impedance') {
        this.notifyState('measuring_impedance', {
          weightKg: packet.weightKg,
          isStable: true,
          hasHandles: true,
          impedanceReceived: false,
          progressPercent: 70,
        });
      } else if (packet.status === 'stable_complete') {
        this.notifyState('measuring_impedance', {
          weightKg: packet.weightKg,
          isStable: true,
          hasHandles: true,
          impedanceReceived: false,
          progressPercent: 85,
        });
      }
    } else if (packet.type === 'impedance') {
      if (packet.packetIndex === 0 && packet.wholeBodyImpedance) {
        this.pendingImpedance = packet.wholeBodyImpedance;
        console.log(`[BLE Driver] Whole body impedance locked: ${this.pendingImpedance}Ω`);
      }
    } else if (packet.type === 'completion') {
      this.bodyCompPacketCount++;
      if (this.bodyCompPacketCount >= 4 && this.pendingWeight > 0) {
        this.notifyState('completed', {
          weightKg: this.pendingWeight,
          isStable: true,
          hasHandles: true,
          impedanceReceived: !!this.pendingImpedance,
          progressPercent: 100,
        });
        if (this.onResult) {
          this.onResult({
            weightKg: this.pendingWeight,
            impedanceOhm: this.pendingImpedance,
            hasBodyComp: !!this.pendingImpedance && this.pendingImpedance > 0,
          });
        }
        this.stopWeighIn();
      }
    }
  }

  private handleDisconnectFallback() {
    if (this.pendingWeight > 0 && this.bodyCompPacketCount < 4) {
      console.warn('[BLE Driver] Disconnected mid-measurement, publishing fallback weight-only');
      if (this.onResult) {
        this.onResult({ weightKg: this.pendingWeight, hasBodyComp: false });
      }
    }
    this.notifyState('disconnected', {
      weightKg: this.pendingWeight,
      isStable: false,
      hasHandles: false,
      impedanceReceived: false,
      progressPercent: 0,
    });
  }

  private notifyState(state: ScaleConnectionState, status: Omit<ScaleLiveStatus, 'state'>) {
    if (this.onStatus) {
      this.onStatus({ state, ...status });
    }
  }

  async stopWeighIn(): Promise<void> {
    this.isRunning = false;
    if (this.activeDeviceId) {
      try {
        await BleClient.stopNotifications(this.activeDeviceId, CULT_SCALE_SERVICE_UUID, CULT_SCALE_NOTIFY_UUID);
        await BleClient.disconnect(this.activeDeviceId);
      } catch (e) {
        // ignore cleanup errors
      }
      this.activeDeviceId = null;
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
    onStatus({ state: 'scanning', weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 15 });

    await this.delay(1000);
    if (!this.isRunning) return;

    // 2. Connected
    onStatus({ state: 'connected', weightKg: 0, isStable: false, hasHandles: false, impedanceReceived: false, progressPercent: 35 });

    await this.delay(800);
    if (!this.isRunning) return;

    // 3. Live Weight Streaming Simulation (Fluctuating)
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
        progressPercent: 40 + i * 5,
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
      progressPercent: 75,
    });

    await this.delay(1200);
    if (!this.isRunning) return;

    onStatus({
      state: 'measuring_impedance',
      weightKg: simulatedTarget,
      isStable: true,
      hasHandles: true,
      impedanceReceived: true,
      progressPercent: 90,
    });

    await this.delay(800);
    if (!this.isRunning) return;

    // 5. Complete
    onStatus({
      state: 'completed',
      weightKg: simulatedTarget,
      isStable: true,
      hasHandles: true,
      impedanceReceived: true,
      progressPercent: 100,
    });

    onResult({
      weightKg: simulatedTarget,
      impedanceOhm: 248.5,
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
