import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isInternalRole } from '@/lib/roles';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { nactiProKlienta, zapisOtevreni } from '@/lib/prezentaceServer';
import { nactiJazyk } from '@/lib/jazykServer';
import { Prezentace } from './Prezentace';

/**
 * NABÍDKOVÁ PREZENTACE PRO KLIENTA (zadání 11. 10. 2026: „potřebuju udělat
 * takový maker cenových nabídek obrandovaných, které pošlu jedním odkazem na
 * klienta. Musí to být něco wow a srozumitelné").
 *
 * VEŘEJNÁ STRÁNKA BEZ PŘIHLÁŠENÍ - klient u nás účet nemá a odkaz je jediné,
 * co dostane. Prezentace se hledá VÝHRADNĚ podle tokenu; nezveřejněná se
 * tváří, že není, ať se mu neotevře rozdělaná.
 *
 * CENY SE POČÍTAJÍ TADY, NE V PROHLÍŽEČI. Jsou to tytéž funkce, které počítají
 * doklad - kdyby se součty skládaly zvlášť pro prezentaci, jednou by se
 * rozešly a klient by viděl jiné číslo, než na které mu přijde faktura.
 */
export const dynamic = 'force-dynamic';

export default async function PrezentacePage({ params }: { params: { token: string } }) {
  const jazyk = nactiJazyk();
  const data = await nactiProKlienta(params.token);
  if (!data) notFound();

  /**
   * ŽE SE NA TO KLIENT PODÍVAL. Nesmí stránku zdržet ani shodit.
   *
   * Náš člověk na klientově odkazu se nepočítá - stejně jako u přeposlechu
   * (21. 9. 2026). Jinak by „klient otevřel nabídku" zazvonilo pokaždé, když
   * si prezentaci zkontrolujeme sami.
   */
  const session = await getServerSession(authOptions).catch(() => null);
  const interni = Boolean(session?.user?.id && isInternalRole(session.user.role));
  if (!interni) void zapisOtevreni(data.id).catch(() => undefined);

  const mena = (data.nabidka?.mena ?? 'CZK') as Parameters<typeof formatMoney>[1];
  const soucty = data.nabidka
    ? computeTotals(
        data.nabidka.polozky.map((p) => ({
          quantity: p.mnozstvi,
          unitPriceMinor: p.cenaZaJednotku,
          vatRate: p.dph,
        })),
        {
          slevaProcent: data.nabidka.slevaProcent,
          slevaMinor: data.nabidka.slevaMinor,
          slevaPopis: data.nabidka.slevaPopis,
        },
      )
    : null;

  const cenik = data.nabidka
    ? {
        cislo: data.nabidka.cislo,
        predmet: data.nabidka.predmet,
        platiDo: data.nabidka.platiDo,
        polozky: data.nabidka.polozky.map((p) => ({
          popis: p.popis,
          mnozstvi: p.mnozstvi,
          jednotka: p.jednotka,
          cena: formatMoney(Math.round(p.mnozstvi * p.cenaZaJednotku), mena, jazyk),
        })),
        bezDph: formatMoney(soucty?.exVat ?? 0, mena, jazyk),
        dph: formatMoney(soucty?.vat ?? 0, mena, jazyk),
        celkem: formatMoney(soucty?.incVat ?? 0, mena, jazyk),
        sleva: soucty && soucty.sleva > 0 ? formatMoney(soucty.sleva, mena, jazyk) : null,
        slevaPopis: soucty?.slevaPopis ?? null,
      }
    : null;

  return <Prezentace token={params.token} data={data} cenik={cenik} jazyk={jazyk} />;
}
