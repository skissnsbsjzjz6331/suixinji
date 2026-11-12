import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.suixinji.ledger',
  appName: '随心记',
  webDir: 'dist/client',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
