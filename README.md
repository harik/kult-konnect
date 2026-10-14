# Kult Konnect

**Kult Konnect** is a modern, privacy-first mobile application built with **Capacitor** designed specifically as a reliable companion for the **Cult Smart Scale Pro** (8-electrode body fat scale).

It replaces generic and unreliable alternatives with a tailored BLE driver, complete support for live weight streaming and multi-frequency impedance analysis, interactive historical trend visualization, and native **Google Health Connect** synchronization.

---

## Key Features

- **Cult Smart Scale Pro Native Protocol Support**:
  - Full support for the scale's 8-electrode BLE GATT protocol (`0xFFF0` / `0xFFF4`).
  - Real-time live weight streaming (`0xCF` frames).
  - Handlebar grip detection and dual-packet raw bioimpedance capture (`0xBE` frames).
  - Full body composition calculations (Body Fat %, Muscle Mass, Body Water, Bone Mass, BMR, Visceral Fat).
- **Google Health Connect Integration**:
  - Native synchronization with Android Health Connect.
  - Syncs `Weight`, `BodyFat`, `BoneMass`, `LeanBodyMass`, and `BasalMetabolicRate`.
  - Offline sync queue with automatic retry and idempotency protection.
- **Offline-First Local Storage**:
  - Fast, zero-config local storage with IndexedDB (Dexie.js).
  - Private by design: all health data stays strictly on your device unless synced to Health Connect.
  - JSON and CSV data export/import for backups and portability.
  - Optional automatic backup to (and restore from) Google Drive
- **Interactive Health Analytics & Trends**:
  - Timeframe toggles (7D, 30D, 90D, 1Y, All-time).
  - 7-day rolling moving average to filter out natural daily water weight fluctuations.
  - Color-coded BMI and body composition health zone classification.
- **Smart Multi-User Profiles**:
  - Support for multiple household profiles.
  - Automatic profile matching based on historical weight proximity ($\pm 3\text{ kg}$).

---

## Tech Stack

- **Application Shell**: [Capacitor 6+](https://capacitorjs.com/) (Android / iOS)
- **Frontend**: React 18+ / Vite / TypeScript / Tailwind CSS
- **Bluetooth LE**: `@capacitor-community/bluetooth-le`
- **Health Connect**: `capacitor-health-connect`
- **Local Database**: Dexie.js (IndexedDB)
- **Visualization**: Chart.js (`react-chartjs-2`)
- **Unit & Integration Testing**: Vitest + React Testing Library

---

## Repository Documentation

- [design.md](file:///Users/harikrishnar/projects/kult-konnect/docs/design.md): In-depth system architecture, BLE protocol specifications, data schema, UI flows, and test strategy.
- [instructions.md](file:///Users/harikrishnar/projects/kult-konnect/docs/instructions.md): Step-by-step developer environment setup, build workflows, and debugging guide.
- [GEMINI.md](file:///Users/harikrishnar/projects/kult-konnect/GEMINI.md): Context, architectural guidelines, and codebase conventions for AI assistants.

---

## License

MIT License.
