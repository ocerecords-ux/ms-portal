import { DokladyTabs } from './DokladyTabs';
import { smiDoBanky } from '@/lib/bankaPristup';

// Sekce Doklady (zadani 6. 9. 2026) - Nabídky, Faktury, Výdaje a Moje firmy.
// Pristup ma jen Zuzo-labuzo; hlida to nadrazeny (admin)/admin/layout.tsx a
// middleware.ts, tady uz jen spolecna hlavicka a zalozky.
export default async function DokladyLayout({ children }: { children: React.ReactNode }) {
  // Zalozka Banka se ukazuje jen tomu, kdo na ni ma pravo (17. 9. 2026).
  const banka = await smiDoBanky();
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="hidden sm:block font-display text-3xl text-ink m-0">Doklady</h1>
      </div>

      <DokladyTabs banka={banka} />

      {children}
    </section>
  );
}
