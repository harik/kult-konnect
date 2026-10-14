export interface LiveWeightPacket {
  type: 'live_weight';
  weightKg: number;
  hasHandles: boolean;
  status: 'unstable' | 'stable_weight_only' | 'measuring_impedance' | 'stable_complete' | 'unknown';
  rawStatus: number;
}

export interface ImpedancePacket {
  type: 'impedance';
  packetIndex: number;
  impedances: number[]; // 5 values in Ohms
  wholeBodyImpedance?: number; // imp[2] in packet 0
}

export interface BodyCompCompletionPacket {
  type: 'completion';
  sequenceA: number;
  sequenceB: number;
}

export type ParsedPacket = 
  | LiveWeightPacket 
  | ImpedancePacket 
  | BodyCompCompletionPacket 
  | { type: 'unknown'; rawType: number };

/**
 * Calculates XOR checksum across a slice of bytes
 */
export function calculateXorChecksum(data: Uint8Array, length: number): number {
  let xor = 0;
  for (let i = 0; i < length; i++) {
    xor ^= data[i];
  }
  return xor;
}

/**
 * Parses raw characteristic notification bytes received from Cult Smart Scale Pro (0xFFF4)
 */
export function parseScalePacket(data: Uint8Array): ParsedPacket | null {
  if (!data || data.length === 0) return null;

  const packetType = data[0];

  // 1. Live Weight Stream (0xCF, 11 bytes)
  if (packetType === 0xCF) {
    if (data.length < 11) return null;

    // Checksum verification
    const expectedChecksum = data[10];
    const calculatedChecksum = calculateXorChecksum(data, 10);
    if (expectedChecksum !== calculatedChecksum) {
      console.warn(`[BLE Parser] 0xCF checksum mismatch: got ${calculatedChecksum}, expected ${expectedChecksum}`);
      // Proceed gracefully if scale firmware deviates slightly
    }

    const flags = data[1];
    const hasHandles = (flags & 0x80) !== 0;

    // uint16-LE: (byte 4 << 8) | byte 3
    const rawWeight = (data[4] << 8) | data[3];
    const weightKg = Number((rawWeight / 100.0).toFixed(2));
    const statusByte = data[9];

    let status: LiveWeightPacket['status'] = 'unknown';
    if (statusByte === 0x01) {
      status = 'unstable';
    } else if (statusByte === 0x00) {
      status = 'stable_weight_only';
    } else if (statusByte === 0x08) {
      status = 'measuring_impedance';
    } else if (statusByte === 0x05) {
      status = 'stable_complete';
    }

    return {
      type: 'live_weight',
      weightKg,
      hasHandles,
      status,
      rawStatus: statusByte,
    };
  }

  // 2. Multi-frequency raw impedance (0xBE, 13 bytes)
  if (packetType === 0xBE) {
    if (data.length < 13) return null;

    const packetIndex = data[1];
    const impedances: number[] = [];

    for (let i = 0; i < 5; i++) {
      const lo = data[2 + i * 2];
      const hi = data[3 + i * 2];
      impedances.push((hi << 8) | lo);
    }

    // Packet 0x00: imp[2] (bytes 6..7) is the whole-body impedance in ~200-300 Ohm range
    const wholeBodyImpedance = packetIndex === 0 ? impedances[2] : undefined;

    return {
      type: 'impedance',
      packetIndex,
      impedances,
      wholeBodyImpedance,
    };
  }

  // 3. Body comp completion signal (0xDF, 17 bytes)
  if (packetType === 0xDF) {
    if (data.length < 4) return null;
    return {
      type: 'completion',
      sequenceA: data[2],
      sequenceB: data[3],
    };
  }

  return { type: 'unknown', rawType: packetType };
}
