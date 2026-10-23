import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DokladyTabs } from './DokladyTabs';
import { PrepinacFirmy } from './PrepinacFirmy';
import { dostupneFirmy, vybranaFirma } from '@/lib/naseFirmyServer';
import { OzubeneKolo } from '@/components/OzubeneKolo';
import { nastaveniSekce } from '@/lib/nastaveniSekci';
import { smiDoBanky } from '@/lib/bankaPristup';
import { smiDoPokladny } from '@/lib/pokladnaPristup';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit } from '@/lib/jazyk';

// Sekce Doklady (zadani 6. 9. 2026) - Nabídky, Faktury, Výdaje a Moje firmy.
// Pristup ma jen Zuzo-labuzo; hlida to nadrazeny (admin)/admin/layout.tsx a
// middleware.ts, tady uz jen spolecna hlavicka a zalozky.
export default async function DokladyLayout({ children }: { children: React.ReactNode }) {
  const jazyk = nactiJazyk();
  // Zalozka Banka se ukazuje jen tomu, kdo na ni ma pravo (17. 9. 2026).
  const banka = await smiDoBanky();
  // Pokladna ma vlastni pravo, viz lib/pokladnaPristup.ts (23. 10. 2026).
  const pokladna = await smiDoPokladny();
  /**
   * PŘEPÍNAČ NAŠÍ FIRMY (12. 10. 2026) - účetnictví obou našich firem je
   * oddělené, řízení projektů a kalendáře zůstávají společné. Viz
   * lib/naseFirmy.ts. S jedinou firmou se přepínač nekreslí.
   */
  const session = await getServerSession(authOptions);
  const firmy = await dostupneFirmy(session?.user?.id);
  const firma = vybranaFirma(firmy);
  return (
    <section className="flex flex-col gap-3 sm:gap-6">
      {/* `data-doklady-hlavicka`: kdyz se doklad otevre Z PROJEKTU, schova se
          nadpis sekce i jeji zalozky - clovek ma byt porad na projektu
          (zadani 7. 10. 2026). Dela to jedno pravidlo v globals.css; layout
          o adrese nevi, searchParams se do nej nepredavaji. */}
      <div data-doklady-hlavicka className="hidden sm:flex items-center gap-3">
        <h1 className="font-display text-3xl text-ink m-0">{prelozit(jazyk, 'doklady.nadpis')}</h1>
        {/* OZUBENÉ KOLO (zadání 28. 9. 2026) - maily k dokladům, upomínky
            a údaje našich firem. Do sekce se stejně dostane jen
            Žůžo-labůžo, takže se tu už na právo neptáme znovu. */}
        <OzubeneKolo
          cesta={nastaveniSekce('DOKLADY')?.cesta ?? '/admin/nastaveni/doklady'}
          popis={prelozit(jazyk, 'doklady.nastaveniSekce')}
        />
        <div className="ml-auto">
          <PrepinacFirmy firmy={firmy.map((f) => ({ id: f.id, name: f.name }))} vybrana={firma ?? ''} />
        </div>
      </div>

      <div data-doklady-hlavicka>
        <DokladyTabs banka={banka} pokladna={pokladna} />
      </div>

      {children}
    </section>
  );
}
