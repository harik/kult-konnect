import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kultkonnect.app',
  appName: 'Kult Konnect',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHealth: {
      enableLogging: true,
    },
  },
};

export default config;
