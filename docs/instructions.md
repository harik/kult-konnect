# Kult Konnect — Developer Instructions & Setup Guide

This guide walks through setting up, developing, testing, and building the Kult Konnect application.

---

## 1. Prerequisites

Ensure your development workstation has:
- **Node.js**: v18.0.0 or later (LTS recommended)
- **Package Manager**: `npm` (v9+)
- **Android Studio**: Ladybug / Hedgehog or newer
- **Android SDK**: API 34+ (compileSdkVersion: 34 or 35)
- **Java**: OpenJDK 17 or 21
- **Physical Android Device**: Android 9+ (Android 14+ recommended for native Health Connect) with Bluetooth 4.2+ enabled.

---

## 2. Project Setup & Scaffolding Workflow

Once approved, the project structure is initialized as follows:

```bash
# 1. Initialize Vite + React + TypeScript in workspace
npm create vite@latest . -- --template react-ts

# 2. Install core application dependencies
npm install @capacitor/core @capacitor/android @capacitor/cli @capacitor-community/bluetooth-le capacitor-health-connect dexie lucide-react clsx tailwind-merge chart.js react-chartjs-2

# 3. Install developer dependencies
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @types/node

# 4. Initialize Tailwind CSS
npx tailwindcss init -p

# 5. Initialize Capacitor
npx cap init "Kult Konnect" "com.kultkonnect.app" --web-dir dist
npx cap add android
```

---

## 3. Android Configuration

### 3.1 Bluetooth LE Permissions (`android/app/src/main/AndroidManifest.xml`)

Add the following permissions inside `<manifest>`:

```xml
<!-- Bluetooth permissions for Android 12+ (API 31+) -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
                 android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Legacy Bluetooth permissions for Android <= 11 -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />

<uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
```

### 3.2 Health Connect Declarations (`AndroidManifest.xml`)

Add Health Connect write permissions and the required intent filter:

```xml
<!-- Health Connect write permissions -->
<uses-permission android:name="android.permission.health.WRITE_WEIGHT" />
<uses-permission android:name="android.permission.health.WRITE_BODY_FAT" />
<uses-permission android:name="android.permission.health.WRITE_BONE_MASS" />
<uses-permission android:name="android.permission.health.WRITE_LEAN_BODY_MASS" />
<uses-permission android:name="android.permission.health.WRITE_BASAL_METABOLIC_RATE" />

<application ...>
    <!-- Health Connect Rationale Activity (Required by Google Play) -->
    <activity-alias
        android:name="ViewPermissionUsageActivity"
        android:exported="true"
        android:targetActivity=".MainActivity"
        android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
        <intent-filter>
            <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
            <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
        </intent-filter>
    </activity-alias>
</application>
```

---

## 4. Development & Running the App

### 4.1 Running in Web Browser (with Mock BLE Simulator)
For rapid UI and BIA algorithm development without needing the physical scale nearby:

```bash
npm run dev
```
The app includes a built-in mock scale simulator that feeds recorded packets (`0xCF`, `0xBE`, `0xDF`) directly into the driver.

### 4.2 Building and Syncing to Native Android
Whenever web assets or Capacitor plugins change:

```bash
# Build the React production bundle
npm run build

# Sync assets and plugins to the native Android project
npx cap sync android

# Open Android Studio
npx cap open android
```

Or run directly to an attached device:
```bash
npx cap run android
```

---

## 5. Testing Guide

### 5.1 Running Automated Unit Tests
```bash
npm test
```
Runs Vitest unit tests for:
- Packet framing, status transitions, and checksum XOR verification.
- BIA formula bounds, edge cases, and unit conversions.
- Dexie.js query performance and multi-user profile matching.

### 5.2 Testing with Health Connect
1. **On Android 14+**: Health Connect is built directly into Android Settings (`Settings > Security & Privacy > Health Connect`).
2. **On Android 9–13**: Install **Health Connect** from the Google Play Store on the test device.
3. Use the **Health Connect Toolbox** companion app (available on Google Play or GitHub) to inspect and verify records inserted by Kult Konnect.

---

## 6. Troubleshooting Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **GATT 133 Disconnect Error** | Android Bluetooth stack cache congestion. | Turn Bluetooth off and on, or clear Bluetooth system app cache in Android settings. |
| **Live weight updates but body composition never arrives** | Scale was stepped on without gripping handlebar electrodes, or user stepped off too quickly. | Ensure palms and fingers make firm contact with the handlebar metal plates until the app displays "Complete". |
| **Health Connect writes fail silently** | Permissions not granted in Health Connect app. | Navigate to `Settings > Apps > Kult Konnect > Permissions` or trigger the permission dialogue in the app. |
