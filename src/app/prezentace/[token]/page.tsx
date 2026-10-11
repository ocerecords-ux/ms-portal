import { notFound } from 'next/navigation';
import { computeTotals, formatMoney } from '@/lib/doklady';
import { nactiProKlienta, zapisOtevreni } from '@/lib/prezentaceServer';
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
  const data = await nactiProKlienta(params.token);
  if (!data) notFound();

  // Že se na to klient podíval. Nesmí stránku zdržet ani shodit.
  void zapisOtevreni(data.id).catch(() => undefined);

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
          cena: formatMoney(Math.round(p.mnozstvi * p.cenaZaJednotku), mena),
        })),
        bezDph: formatMoney(soucty?.exVat ?? 0, mena),
        dph: formatMoney(soucty?.vat ?? 0, mena),
        celkem: formatMoney(soucty?.incVat ?? 0, mena),
        sleva: soucty && soucty.sleva > 0 ? formatMoney(soucty.sleva, mena) : null,
        slevaPopis: soucty?.slevaPopis ?? null,
      }
    : null;

  return <Prezentace token={params.token} data={data} cenik={cenik} />;
}
