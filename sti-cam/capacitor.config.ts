import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sti.cam',
  appName: 'STI Cam',
  webDir: 'dist',
  server: {
    androidScheme: 'https', // Required for Google OAuth (needs https: origin in WebView)
  },
};

export default config;
