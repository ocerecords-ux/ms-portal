import { DokladyTabs } from './DokladyTabs';

// Sekce Doklady (zadani 6. 9. 2026) - Nabídky, Faktury, Výdaje a Moje firmy.
// Pristup ma jen Zuzo-labuzo; hlida to nadrazeny (admin)/admin/layout.tsx a
// middleware.ts, tady uz jen spolecna hlavicka a zalozky.
export default function DokladyLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink m-0">Doklady</h1>
      </div>

      <DokladyTabs />

      {children}
    </section>
  );
}
