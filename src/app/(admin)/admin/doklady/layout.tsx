import { DokladyTabs } from './DokladyTabs';
import { OzubeneKolo } from '@/components/OzubeneKolo';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { smiDoBanky } from '@/lib/bankaPristup';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

// Sekce Doklady (zadani 6. 9. 2026) - Nabídky, Faktury, Výdaje a Moje firmy.
// Pristup ma jen Zuzo-labuzo; hlida to nadrazeny (admin)/admin/layout.tsx a
// middleware.ts, tady uz jen spolecna hlavicka a zalozky.
export default async function DokladyLayout({ children }: { children: React.ReactNode }) {
  const jazyk = nactiJazyk();
  // Zalozka Banka se ukazuje jen tomu, kdo na ni ma pravo (17. 9. 2026).
  const banka = await smiDoBanky();
  return (
    <section className="flex flex-col gap-3 sm:gap-6">
      <div className="hidden sm:flex items-center gap-3">
        <h1 className="font-display text-3xl text-ink m-0">{prelozit(jazyk, 'doklady.nadpis')}</h1>
        {/* OZUBENÉ KOLO (zadání 28. 9. 2026) - maily k dokladům, upomínky
            a údaje našich firem. Do sekce se stejně dostane jen
            Žůžo-labůžo, takže se tu už na právo neptáme znovu. */}
        <OzubeneKolo
          cesta={nastaveniSekce('DOKLADY')?.cesta ?? '/admin/nastaveni/doklady'}
          popis={prelozit(jazyk, 'doklady.nastaveniSekce')}
        />
      </div>

      <DokladyTabs banka={banka} />

      {children}
    </section>
  );
}
