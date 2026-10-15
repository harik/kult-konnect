import { parseScalePacket } from './packetParser';
import {
  CULT_SCALE_SERVICE_UUID,
  CULT_SCALE_NOTIFY_UUID,
  IScaleBleDriver,
  ResultCallback,
  StatusCallback,
} from './ScaleBleDriver';
import { ScaleLiveStatus, ScaleConnectionState } from '@/types';

/**
 * Web Bluetooth Driver for Cult Smart Scale Pro
 * Runs on standard Web Bluetooth supported browsers (Chrome/Edge on Android, Chrome on Desktop).
 */
export class WebScaleBleDriver implements IScaleBleDriver {
  private device: any = null;
  private server: any = null;
  private notifyChar: any = null;
  private isRunning = false;
  private onStatus: StatusCallback | null = null;
  private onResult: ResultCallback | null = null;

  private pendingWeight = 0;
  private pendingImpedance: number | undefined = undefined;
  private pendingRawImpedances: number[] = [];
  private pendingHeartRate: number | undefined = undefined;
  private bodyCompPacketCount = 0;
  private heartRateTimeout: any = null;

  async requestPermissions(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return false;
    }
    return true;
  }

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

    const nav = navigator as any;
    if (!nav.bluetooth) {
      this.notifyState('error', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 0,
        errorMessage: 'Web Bluetooth is not supported on this browser. Please use Chrome on Android or install the Android App.',
      });
      this.isRunning = false;
      return;
    }

    try {
      this.notifyState('scanning', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 15,
        stepMessage: 'Select your Cult scale from the device list...',
      });

      // Request device picker
      // Cult scale service UUID is 0xFFF0
      this.device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [CULT_SCALE_SERVICE_UUID] },
          { namePrefix: 'Cult' },
          { namePrefix: 'CULT' },
          { namePrefix: 'Scale' },
          { namePrefix: 'scale' },
        ],
        optionalServices: [CULT_SCALE_SERVICE_UUID],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnectFallback();
      });

      this.notifyState('connected', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 30,
        stepMessage: 'Connecting to scale...',
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(CULT_SCALE_SERVICE_UUID);
      this.notifyChar = await service.getCharacteristic(CULT_SCALE_NOTIFY_UUID);

      await this.notifyChar.startNotifications();
      this.notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const dataView: DataView = event.target.value;
        const uint8 = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
        this.handlePacket(uint8);
      });

      this.notifyState('measuring_weight', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 40,
        stepMessage: 'Step on scale with bare feet and hold handle bars...',
      });
    } catch (err: any) {
      console.warn('[Web BLE Driver] Error during weigh in:', err);
      let errorMessage = err?.message || 'Bluetooth connection failed';
      if (err?.name === 'NotFoundError' || errorMessage.includes('User cancelled')) {
        errorMessage = 'Scale selection was cancelled. Tap Weigh In again to retry.';
      } else if (err?.name === 'SecurityError') {
        errorMessage = 'Bluetooth permission blocked. Please ensure this site is served over HTTPS.';
      }

      this.notifyState('error', {
        weightKg: 0,
        isStable: false,
        hasHandles: false,
        impedanceReceived: false,
        progressPercent: 0,
        errorMessage,
      });
      await this.stopWeighIn();
    }
  }

  private handlePacket(bytes: Uint8Array) {
    const rawHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`[Web BLE Driver] Packet: ${rawHex}`);

    const packet = parseScalePacket(bytes);
    if (!packet) return;

    if (packet.type === 'live_weight') {
      if (packet.weightKg > 0) {
        this.pendingWeight = packet.weightKg;
      }
      if (packet.heartRateBpm) {
        this.pendingHeartRate = packet.heartRateBpm;
      }

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
          stepMessage: 'Measuring 8-electrode bioimpedance...',
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
      if (this.bodyCompPacketCount >= 4 && !this.heartRateTimeout) {
        this.notifyState('measuring_heart_rate', {
          weightKg: this.pendingWeight,
          isStable: true,
          hasHandles: true,
          impedanceReceived: true,
          heartRateBpm: this.pendingHeartRate,
          progressPercent: 88,
          stepMessage: 'Measuring pulse... Hold still',
        });

        this.heartRateTimeout = setTimeout(() => {
          this.finalizeMeasurement();
        }, 12000);
      }
    } else if (packet.type === 'heart_rate') {
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
    if (this.device?.gatt?.connected) {
      try {
        if (this.notifyChar) {
          await this.notifyChar.stopNotifications();
        }
        await this.device.gatt.disconnect();
      } catch (e) {
        // cleanup ignore
      }
    }
  }

  isScanningOrConnected(): boolean {
    return this.isRunning;
  }
}
