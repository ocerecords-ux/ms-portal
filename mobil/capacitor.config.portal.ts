import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Aplikace MS Portal pro App Store a Google Play (zadani 10. 9. 2026).
 *
 * Obal ukazuje zivy portal na www.msportal.cz - diky tomu je v aplikaci
 * vzdycky to same, co na webu, a do obchodu se posila znovu jen kvuli
 * zmenam samotneho obalu.
 *
 * Chat v teto aplikaci NENI. Portal ho sam skryva, kdyz bezi jako aplikace
 * (viz ChatDock), a start na /projekty?app=portal ten priznak nastavi.
 */
const config: CapacitorConfig = {
  appId: 'cz.msportal.portal',
  appName: 'MS Portal',

  // Slozka se statickym webem se nepouziva - obsah chodi ze serveru.
  // Musi ale existovat, jinak si Capacitor stezuje pri prvnim sestaveni.
  webDir: 'prazdno',

  server: {
    url: 'https://www.msportal.cz/projekty?app=portal',
    // Jen https, zadny obsah po http - jinak by to iOS stejne zablokoval.
    androidScheme: 'https',
    // Odkazy mimo portal (Google Disk, Caflou) ať se otevřou v prohlížeči,
    // ne uvnitř aplikace, kde by se z nich uživatel nedostal zpátky.
    allowNavigation: ['www.msportal.cz'],
  },

  ios: {
    // Fialová lišta nahoře, světlý obsah pod ní.
    backgroundColor: '#6B2AF0',
    // Aplikace není webová stránka - ať se nedá omylem odzoomovat.
    scrollEnabled: true,
  },

  android: {
    backgroundColor: '#6B2AF0',
    // Bez toho by webview u starších Androidů hlásilo smíšený obsah.
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#6B2AF0',
      showSpinner: false,
    },
  },
};

export default config;
