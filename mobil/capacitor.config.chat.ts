import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Aplikace MS Chat pro App Store a Google Play (zadani 10. 9. 2026).
 *
 * Samostatna aplikace jen pro chat - stejne jako u ikony na plose. Startuje
 * rovnou na /chat, coz je stranka na celou obrazovku bez horni listy
 * a bez levych voleb.
 */
const config: CapacitorConfig = {
  appId: 'cz.msportal.chat',
  appName: 'MS Chat',

  // Obsah chodi ze serveru, tahle slozka je jen formalita (viz portal).
  webDir: 'prazdno',

  server: {
    url: 'https://www.msportal.cz/chat?app=chat',
    androidScheme: 'https',
    allowNavigation: ['www.msportal.cz'],
  },

  ios: {
    backgroundColor: '#6B2AF0',
    scrollEnabled: true,
  },

  android: {
    backgroundColor: '#6B2AF0',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#6B2AF0',
      showSpinner: false,
    },
    // POZOR: tenhle plugin jde pres APNs (iOS) a Firebase (Android), ne pres
    // Web Push. Bude potreba druha cesta odesilani na serveru vedle
    // src/lib/pushServer.ts - viz README v teto slozce.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
