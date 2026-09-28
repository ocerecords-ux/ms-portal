import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { nactiCile } from '@/lib/palubovkaServer';
import { nactiKnihyUkazatele, type KnihyUkazatele } from '@/lib/knihyPrehledServer';
import { nactiProgram } from '@/lib/poradaServer';
import { Ukazatele } from './Ukazatele';

/**
 * KNIHY A ROZPOČTY (zadání 28. 9. 2026 pro Petera, zjednodušeno tentýž den:
 * „něco podobného, jako mám palubovku. Jasné ukazatele.").
 *
 * Stránka sama nic nepočítá - ptá se na hotové ukazatele a předá je budíkům.
 * Co který znamená a proč se počítá právě takhle, je v lib/knihyPrehledServer.ts.
 * Původní podoba s filtry, grafy a výpisem výkazů žije dál na /prehledy/knihy/rozpad.
 *
 * Vybrané období i režim porady jsou v adrese, takže se dá přehled poslat
 * odkazem, otevřít rovnou na projektoru a tlačítko Zpět vrací předchozí volbu.
 *
 * Jen pro admina - jsou to mzdové údaje celého týmu a marže knih.
 */
export const dynamic = 'force-dynamic';

/**
 * REŽIM PORADY (zadání 28. 9. 2026: „udělej tam ještě možnost pro prezentaci
 * na zvukařskou poradu, když jim Peter potřebuje ukázat, co kde teče. Ale aby
 * nikde neviděli cenovou nabídku celkovou a zisk, kolik na tom máme.").
 *
 * PENÍZE SE NEPOSÍLAJÍ DO PROHLÍŽEČE VŮBEC, neschovávají se jen v rozhraní.
 * Kdyby se jen skryly stylem, pořád by ležely v HTML stránky a stačilo by
 * otevřít vývojářské nástroje. Tady se vynulují na serveru, takže na
 * projektoru ani v podstránce prohlížeče není co najít.
 *
 * CO ZŮSTÁVÁ: hodiny, procenta čerpání a jména - tedy přesně to, o čem se na
 * poradě mluví („na téhle knize je střih o devět hodin přes"). Co mizí:
 * všechny koruny - cena z nabídky, zisk, náklady, rozpočet i mzdy jednotlivců.
 * Poslední jmenované v zadání není, ale mzda kolegy vedle mzdy dalšího na
 * plátně je přesně ten druh čísla, které na poradu nepatří.
 */
function bezPenez(data: KnihyUkazatele): KnihyUkazatele {
  const nula = { rozpocet: 0, vycerpano: 0 };
  const mesic = (m: KnihyUkazatele['tento']) => ({ ...m, zisk: 0, prumernyZisk: null });
  return {
    ...data,
    celkem: { ...data.celkem, ...nula },
    tento: mesic(data.tento),
    minuly: mesic(data.minuly),
    vybrany: mesic(data.vybrany),
    knihy: data.knihy.map((k) => ({
      ...k,
      rozpocet: 0,
      vycerpano: 0,
      preteceniKc: 0,
      trzba: 0,
      naklady: 0,
      zisk: 0,
      nataceni: { ...k.nataceni, castka: 0 },
      strih: { ...k.strih, castka: 0 },
      ostatni: { ...k.ostatni, castka: 0 },
      lide: k.lide.map((c) => ({ ...c, castka: 0 })),
    })),
  };
}

export default async function KnihyPage({
  searchParams,
}: {
  searchParams?: { obdobi?: string; porada?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/prehledy');

  const zadano = searchParams?.obdobi?.trim() ?? '';
  const obdobi =
    zadano === 'minuly' || zadano === 'vse' || /^\d{4}-\d{2}$/.test(zadano) ? zadano : 'tento';
  const porada = searchParams?.porada === '1';

  const [data, cile, program] = await Promise.all([
    nactiKnihyUkazatele(new Date(), obdobi),
    nactiCile(),
    // Program se tahá jen pro poradu - mimo ni nemá na stránce co dělat.
    porada ? nactiProgram() : Promise.resolve([]),
  ]);

  return (
    <Ukazatele
      data={porada ? bezPenez(data) : data}
      cile={porada ? { ...cile, mesicniZiskKnih: null } : cile}
      obdobi={obdobi}
      porada={porada}
      program={program}
      dnesISO={new Date().toISOString()}
    />
  );
}
