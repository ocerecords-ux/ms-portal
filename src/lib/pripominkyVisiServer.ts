import { prisma } from '@/lib/db';
import { brunoNapisSoukrome } from '@/lib/brunoOznameni';
import { notify } from '@/lib/notifications';
import { utcParts } from '@/lib/calendar';

/**
 * BRUNO HLÍDÁ, CO V PŘIPOMÍNKÁCH VISÍ DLOUHO (zadání 17. 11. 2026: „občas se
 * tam i můžeš mrknout a zařvat, když tam bude nějaká nedořešená věc nebo tam
 * bude viset něco dlouho. Samozřejmě se to musí udělat opatrně." — a na
 * otázku, kdo to má dělat: „tak že by to dělal třeba Bruno?").
 *
 * PROČ BRUNO A NE NĚKDO ZVENKU: připomínky jsou v portálu a Bruno je v něm
 * doma. Nikomu se nemusí nic odemykat, nic neodchází ven a hlídání běží
 * dál, i když se zrovna nikdo s portálem nebaví.
 *
 * OPATRNĚ ZNAMENÁ:
 *  - Bruno NIC NEODŠKRTÁVÁ. Jen připomene; co je hotové, rozhodne člověk.
 *  - Píše JEDNOU TÝDNĚ, v pondělí ráno, ne každý den - denní štěkání se
 *    přestane číst a tím hlídání končí.
 *  - Píše jen těm, kdo připomínky opravdu vyřizují (ADMIN), ne autorům.
 *    Autor za to, že jeho připomínka čeká, nemůže.
 *  - Jedna zpráva se vším, ne zpráva na položku.
 *  - Nejstarší napřed a nejvýš deset - zbytek se jen sečte. Seznam, který
 *    se nedá přečíst na jednu obrazovku, nikdo neprojde.
 *
 * Práh je čtrnáct dní: mladší připomínka ještě může čekat na nejbližší
 * dávku úprav a není na co upozorňovat.
 */

const PASMO = 'Europe/Prague';
/** Pondělí v osm - po ranním přehledu, ať se netlučou. */
const DEN_V_TYDNU = 1;
const HODINA = 8;
const PRAH_DNI = 14;
const MAX_V_ZPRAVE = 10;

export type VysledekPripominky = { odeslano: number; visi: number };

function dniOd(datum: Date, ted: Date): number {
  return Math.floor((ted.getTime() - datum.getTime()) / 86_400_000);
}

/** Zkrácení na jednu řádku - připomínky bývají na odstavec. */
function jednaVeta(text: string): string {
  const cisty = text.replace(/\s+/g, ' ').trim();
  return cisty.length > 120 ? `${cisty.slice(0, 117)}…` : cisty;
}

export async function posliVisiciPripominky(
  options: { vynutit?: boolean } = {},
): Promise<VysledekPripominky> {
  const ted = new Date();
  const tady = utcParts(ted, PASMO);
  // Cron bezi v UTC; tohle si hlida, ze je v Praze opravdu pondeli rano -
  // jinak by se to v zime a v lete rozeslo o hodinu.
  const denVTydnu = new Date(Date.UTC(tady.year, tady.month - 1, tady.day)).getUTCDay();
  if (!options.vynutit && (denVTydnu !== DEN_V_TYDNU || tady.hour !== HODINA)) {
    return { odeslano: 0, visi: 0 };
  }

  const hranice = new Date(ted.getTime() - PRAH_DNI * 86_400_000);

  const visici = await prisma.pripominkaPortalu
    .findMany({
      where: { stav: 'NOVA', createdAt: { lt: hranice } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        text: true,
        odkud: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })
    .catch(() => []);

  if (visici.length === 0) return { odeslano: 0, visi: 0 };

  // Komu to jde: kdo pripominky vyrizuje. Autorum se nepise - za to, ze
  // jejich pripominka ceka, nemuzou.
  const spravci = await prisma.user
    .findMany({ where: { active: true, role: 'ADMIN' }, select: { id: true } })
    .catch(() => []);
  if (spravci.length === 0) return { odeslano: 0, visi: visici.length };

  const radky = visici.slice(0, MAX_V_ZPRAVE).map((p) => {
    const kdo = p.user?.name || p.user?.email || 'neznámo kdo';
    const dni = dniOd(p.createdAt, ted);
    const kde = p.odkud ? ` · ${p.odkud}` : '';
    return `• ${jednaVeta(p.text)}\n   ${kdo} · visí ${dni} dní${kde}`;
  });

  const zbytek = visici.length - radky.length;
  const text = [
    `V připomínkách k portálu visí ${visici.length} ${visici.length === 1 ? 'věc' : visici.length < 5 ? 'věci' : 'věcí'} déle než ${PRAH_DNI} dní:`,
    '',
    radky.join('\n'),
    zbytek > 0 ? `\n…a dalších ${zbytek}.` : '',
    '',
    'Co je hotové, odškrtni v Můj účet → Připomínky k portálu. Co se dělat nebude, odškrtni taky — ať to tu nevisí.',
  ]
    .filter((r) => r !== '')
    .join('\n');

  let odeslano = 0;
  for (const spravce of spravci) {
    const poslano = await brunoNapisSoukrome(spravce.id, text);
    if (poslano) odeslano += 1;
    // Zvonek k tomu, at to nezapadne mezi zpravy - ale bez mailu, neni to
    // nic, co by nepockalo do pristiho otevreni portalu.
    await notify({
      userId: spravce.id,
      kind: 'PRIPOMINKY_VISI',
      title: 'Připomínky k portálu čekají',
      body: `${visici.length} ${visici.length === 1 ? 'připomínka visí' : 'připomínek visí'} déle než ${PRAH_DNI} dní`,
      url: '/muj-ucet',
    }).catch(() => undefined);
  }

  return { odeslano, visi: visici.length };
}
