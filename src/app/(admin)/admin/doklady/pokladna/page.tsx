import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { formatMoney } from '@/lib/doklady';
import { dostupneFirmy, vybranaFirma } from '@/lib/naseFirmyServer';
import { pristupKPokladne } from '@/lib/pokladnaPristup';
import { nactiKnihu } from '@/lib/pokladnaServer';
import { rozpisDph, VYCHOZI_NAZEV } from '@/lib/pokladna';
import { nactiJazyk } from '@/lib/jazykServer';
import { formatDatum } from '@/lib/jazyk';
import { PokladnaKlient, type RadekProKlienta } from './PokladnaKlient';

/**
 * POKLADNA (zadání 23. 10. 2026: „potřebuju někde udělat pokladnu").
 *
 * Hotovostní pokladní kniha jedné naší firmy - která to je, říká přepínač
 * v liště Dokladů. Účetnictví firem je oddělené, takže i hotovost má každá
 * firma svou; viz lib/naseFirmy.ts.
 */
export const dynamic = 'force-dynamic';

export default async function PokladnaPage({
  searchParams,
}: {
  searchParams?: { rok?: string };
}) {
  const jazyk = nactiJazyk();

  // Kdo na pokladnu nemá povolení, ať se ani nedozví, že stránka existuje
  // (stejné pravidlo jako u Banky).
  const pristup = await pristupKPokladne();
  if (!pristup.smi) notFound();

  const session = await getServerSession(authOptions);
  const firmy = await dostupneFirmy(session?.user?.id);
  if (firmy.length === 0) notFound();

  /**
   * Pokladna je VŽDYCKY jedné firmy. Když je v přepínači „všechny", vezme se
   * ta výchozí - a její název je v hlavičce vidět, aby nebylo pochyb, čí
   * hotovost se počítá.
   */
  const vybrana = vybranaFirma(firmy);
  const firma = firmy.find((f) => f.id === vybrana) ?? firmy[0];
  const vsechnyFirmy = !vybrana && firmy.length > 1;

  const rok = Number.parseInt(searchParams?.rok ?? '', 10);
  const kniha = await nactiKnihu(firma.id, Number.isFinite(rok) ? rok : undefined);
  if (!kniha) notFound();

  const mena = kniha.pokladna.mena;

  const radky: RadekProKlienta[] = kniha.radky.map((r) => {
    const { zaklad, dph } = rozpisDph(r.castkaMinor, r.vatRate);
    return {
      id: r.id,
      cislo: r.cislo,
      prijem: r.smer === 'PRIJEM',
      datum: formatDatum(jazyk, r.datum),
      datumIso: r.datum.toISOString().slice(0, 10),
      castka: formatMoney(r.castkaMinor, mena, jazyk),
      castkaMinor: r.castkaMinor,
      vatRate: r.vatRate,
      dph: r.vatRate ? `${formatMoney(zaklad, mena, jazyk)} + ${formatMoney(dph, mena, jazyk)}` : null,
      ucel: r.ucel,
      protistrana: r.protistrana,
      poznamka: r.poznamka,
      kdo: r.kdoJmeno,
      zustatek: formatMoney(r.zustatekMinor, mena, jazyk),
      zaporny: r.zustatekMinor < 0,
      expenseId: r.expenseId,
    };
  });

  return (
    <PokladnaKlient
      jazyk={jazyk}
      otevrenaVsem={pristup.otevrenaVsem}
      vsechnyFirmy={vsechnyFirmy}
      firma={{ id: firma.id, nazev: firma.name }}
      nazev={kniha.pokladna.nazev || VYCHOZI_NAZEV}
      mena={mena}
      rok={kniha.rok}
      roky={kniha.roky}
      radky={radky}
      souhrn={{
        pocatek: formatMoney(kniha.pocatekRokuMinor, mena, jazyk),
        prijmy: formatMoney(kniha.prijmyMinor, mena, jazyk),
        vydaje: formatMoney(kniha.vydajeMinor, mena, jazyk),
        zustatek: formatMoney(kniha.zustatekMinor, mena, jazyk),
        zaporny: kniha.zustatekMinor < 0,
      }}
      nastaveni={{
        pocatecniStav: (kniha.pokladna.pocatecniStavMinor / 100).toFixed(2),
        pocatecniDatum: kniha.pokladna.pocatecniDatum.toISOString().slice(0, 10),
        radaPrijem: kniha.pokladna.radaPrijem,
        dalsiPrijem: kniha.pokladna.dalsiPrijem,
        radaVydej: kniha.pokladna.radaVydej,
        dalsiVydej: kniha.pokladna.dalsiVydej,
      }}
    />
  );
}
