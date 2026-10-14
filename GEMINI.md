# GEMINI.md — AI Context & Assistant Guidelines

This document provides system context, architectural constraints, and engineering conventions for AI assistants collaborating on the **Kult Konnect** codebase.

---

## 1. Project Mission

Kult Konnect is an open-source, privacy-first mobile companion app built with **Capacitor** for the **Cult Smart Scale Pro** (8-electrode body fat analyzer scale). The project solves the unreliability and feature shortcomings of generic tools (like openScale) by providing:
1. Reliable, real-time BLE GATT streaming with explicit handle/impedance detection.
2. Clinical-grade BIA calculation from raw impedance values.
3. Offline-first local data storage using Dexie.js (IndexedDB).
4. Direct synchronization with **Google Health Connect** (Android).
5. Comprehensive historical health trend analytics.

---

## 2. Hardware Protocol Quick Reference

- **Service UUID**: `0000FFF0-0000-1000-8000-00805F9B34FB` (16-bit: `0xFFF0`)
- **Notify Characteristic UUID**: `0000FFF4-0000-1000-8000-00805F9B34FB` (16-bit: `0xFFF4`)
- **Write Characteristic UUID**: `0000FFF1-0000-1000-8000-00805F9B34FB` (16-bit: `0xFFF1`)
- **Enable Notifications**: Write `0x01, 0x00` to CCCD `0x2902`.

### Packet Dispatching (`0xFFF4`)
- **`0xCF` (11 bytes)**: Live weight stream.
  - Weight in kg: `((data[4] << 8) | data[3]) / 100.0`.
  - Status byte `data[9]`:
    - `0x01`: Live/unstable.
    - `0x00`: Stable weight (no handles). Publish weight-only immediately.
    - `0x08`: Impedance measurement in progress (handles held).
    - `0x05`: Measurement complete with handles held.
  - Checksum: XOR of bytes `0..9`.
- **`0xBE` (13 bytes)**: Raw multi-frequency impedance (2 packets).
  - Packet 0 (`data[1] == 0x00`):
    - `imp[2]` (bytes `6..7`, uint16-LE) is the **whole-body impedance** ($\approx 200\text{–}300\,\Omega$).
- **`0xDF` (17 bytes)**: Body composition completion signal (4 packets transmitted).

---

## 3. Architectural Rules & Conventions

### 3.1 Offline-First & Storage
- Always commit measurements to **Dexie.js** first before attempting Health Connect sync.
- Never block the UI on Bluetooth disconnections or Health Connect network/API latency.
- Measurements must maintain an idempotency flag `syncedToHealthConnect: boolean` and store Google Health Connect record IDs when synced.

### 3.2 BIA Computations
- Maintain all BIA formulas in isolated, pure functions under `src/core/bia/`.
- Formulas must accept an explicit user profile (`gender`, `age`, `heightCm`, `weightKg`, `impedanceOhm`) and return bounded values (e.g., Body Fat % clamped between $3\%$ and $70\%$).

### 3.3 BLE Abstraction
- Wrap `@capacitor-community/bluetooth-le` behind a typed interface (`ScaleBleDriver`).
- Provide a `MockScaleBleDriver` that can replay real captured byte packets for development and testing in standard desktop browsers.

### 3.4 Coding Standards
- **TypeScript**: Strict mode enabled (`noImplicitAny: true`, `strictNullChecks: true`).
- **Styling**: Tailwind CSS for UI layout and styling; adhere to mobile-friendly touch targets ($\ge 44\text{px}$).
- **Testing**: All pure logic (packet parsers, XOR checksums, BIA calculations, profile matchers) must have corresponding unit tests in Vitest.

---

## 4. Key References
- [design.md](file:///Users/harikrishnar/projects/kult-konnect/design.md): In-depth system design, protocol layouts, data models, and test strategy.
- [instructions.md](file:///Users/harikrishnar/projects/kult-konnect/instructions.md): Setup, build commands, and Android permission setup.
- [README.md](file:///Users/harikrishnar/projects/kult-konnect/README.md): Project summary and features.
