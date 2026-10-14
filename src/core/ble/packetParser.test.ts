import { describe, it, expect } from 'vitest';
import { parseScalePacket, calculateXorChecksum } from './packetParser';

describe('Cult Smart Scale Pro BLE Packet Parser', () => {
  it('correctly calculates XOR checksum over packet bytes', () => {
    const bytes = new Uint8Array([0xCF, 0x80, 0x00, 0xE8, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const expectedXor = 0xCF ^ 0x80 ^ 0x00 ^ 0xE8 ^ 0x1C ^ 0x00 ^ 0x00 ^ 0x00 ^ 0x00 ^ 0x01;
    expect(calculateXorChecksum(bytes, 10)).toBe(expectedXor);
  });

  it('parses live weight packet (0xCF) with unstable status', () => {
    // Weight = 74.00 kg -> 7400 -> 0x1CE8 -> byte 3 = 0xE8, byte 4 = 0x1C
    const bytes = new Uint8Array([
      0xCF, // [0] type
      0x80, // [1] flags (handles active)
      0x00, // [2] reserved
      0xE8, // [3] weight low
      0x1C, // [4] weight high
      0x00, 0x00, 0x00, 0x00, // [5..8] reserved
      0x01, // [9] status: live/unstable
      0x00, // [10] checksum
    ]);
    bytes[10] = calculateXorChecksum(bytes, 10);

    const packet = parseScalePacket(bytes);
    expect(packet).not.toBeNull();
    if (packet && packet.type === 'live_weight') {
      expect(packet.weightKg).toBe(74.0);
      expect(packet.hasHandles).toBe(true);
      expect(packet.status).toBe('unstable');
    }
  });

  it('parses stable weight-only packet (0xCF, status 0x00)', () => {
    // 68.50 kg -> 6850 -> 0x1AC2 -> byte 3 = 0xC2, byte 4 = 0x1A
    const bytes = new Uint8Array([
      0xCF, 0x00, 0x00, 0xC2, 0x1A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    bytes[10] = calculateXorChecksum(bytes, 10);

    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('live_weight');
    if (packet && packet.type === 'live_weight') {
      expect(packet.weightKg).toBe(68.5);
      expect(packet.hasHandles).toBe(false);
      expect(packet.status).toBe('stable_weight_only');
    }
  });

  it('parses stable handle measurement completed packet (0xCF, status 0x05)', () => {
    // 72.34 kg -> 7234 -> 0x1C42 -> byte 3 = 0x42, byte 4 = 0x1C
    const bytes = new Uint8Array([
      0xCF, 0x80, 0x00, 0x42, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x05, 0x00,
    ]);
    bytes[10] = calculateXorChecksum(bytes, 10);

    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('live_weight');
    if (packet && packet.type === 'live_weight') {
      expect(packet.weightKg).toBe(72.34);
      expect(packet.hasHandles).toBe(true);
      expect(packet.status).toBe('stable_complete');
    }
  });

  it('parses multi-frequency raw impedance packet (0xBE, packetIdx 0x00)', () => {
    // Packet 0x00 with 5 uint16-LE values:
    // imp[0] = 2867 (0x0B33 -> 0x33, 0x0B)
    // imp[1] = 3013 (0x0BC5 -> 0xC5, 0x0B)
    // imp[2] = 248  (0x00F8 -> 0xF8, 0x00) <- whole-body impedance
    // imp[3] = 2904 (0x0B58 -> 0x58, 0x0B)
    // imp[4] = 2668 (0x0A6C -> 0x6C, 0x0A)
    const bytes = new Uint8Array([
      0xBE, 0x00,
      0x33, 0x0B,
      0xC5, 0x0B,
      0xF8, 0x00,
      0x58, 0x0B,
      0x6C, 0x0A,
      0x00, // checksum byte
    ]);

    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('impedance');
    if (packet && packet.type === 'impedance') {
      expect(packet.packetIndex).toBe(0);
      expect(packet.impedances[2]).toBe(248);
      expect(packet.wholeBodyImpedance).toBe(248);
    }
  });

  it('parses completion frame (0xDF)', () => {
    const bytes = new Uint8Array([0xDF, 0x00, 0x01, 0x02, 0x03]);
    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('completion');
    if (packet && packet.type === 'completion') {
      expect(packet.sequenceA).toBe(1);
      expect(packet.sequenceB).toBe(2);
    }
  });

  it('parses dedicated pulse/heart rate packet (0xCE)', () => {
    const bytes = new Uint8Array([0xCE, 0x00, 0x48, 0x00]); // 0x48 = 72 BPM
    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('heart_rate');
    if (packet && packet.type === 'heart_rate') {
      expect(packet.bpm).toBe(72);
    }
  });

  it('parses measuring_heart_rate status in 0xCF packet', () => {
    const bytes = new Uint8Array([
      0xCF, 0x80, 0x00, 0xE8, 0x1C, 0x4A, 0x00, 0x00, 0x00, 0x06, 0x00,
    ]); // byte 5 = 0x4A (74 bpm), status 0x06
    bytes[10] = calculateXorChecksum(bytes, 10);

    const packet = parseScalePacket(bytes);
    expect(packet?.type).toBe('live_weight');
    if (packet && packet.type === 'live_weight') {
      expect(packet.status).toBe('measuring_heart_rate');
      expect(packet.heartRateBpm).toBe(74);
    }
  });
});
