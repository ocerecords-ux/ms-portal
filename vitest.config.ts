import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// Testy vypoctu frekvenci, kolizi, pracovni doby a stavoveho automatu
// (zadani 8. 9. 2026). Bezi bez databaze - logika je zamerne v cistych
// funkcich v src/lib/calendar.ts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  // Testy Rodneho listu sahaji na src/lib/rodnyListPdf.ts, ktery si vlozena
  // pisma tahne pres alias "@/..." stejne jako zbytek aplikace.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
