import { defineConfig } from 'vitest/config';

// Testy vypoctu frekvenci, kolizi, pracovni doby a stavoveho automatu
// (zadani 8. 9. 2026). Bezi bez databaze - logika je zamerne v cistych
// funkcich v src/lib/calendar.ts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
