import { prisma } from '@/lib/db';
import { hledaciText } from '@/lib/navody';
import { nactiProfily } from '@/lib/technickeParametryServer';

/**
 * TECHNICKÉ PARAMETRY DO PROCESŮ (zadání 28. 9. 2026: „do těch procesů ulož
 * technické parametry").
 *
 * KAŽDÁ SADA = JEDEN ČLÁNEK v kategorii „Technické parametry". Zvukař tak
 * najde formáty tam, kde hledá postupy, a ne jen u konkrétního projektu.
 *
 * ČLÁNEK JE OTISK, NE DRUHÝ ZDROJ PRAVDY. Sady se dál mění na jednom místě
 * v Administraci; tohle je jejich přepis do čtení. Kdyby se daly upravovat
 * i tady, do týdne by se to rozešlo a nikdo by nepoznal, co platí - proto se
 * článek při každém načtení PŘEPÍŠE celý a v perexu je napsané, odkud je.
 *
 * Co se nepřepisuje: `zverejneno` a `proRole`. Když si u sady rozhodneš, že
 * ji mají vidět jen zvukaři, nebo ji schováš, další načtení ti to nepřepíše.
 */

export const KATEGORIE_PARAMETRU = 'Technické parametry';

type Vysledek = {
  zalozeno: number;
  aktualizovano: number;
  /** Kolik sad dokument nese. */
  celkem: number;
  /** Kolik článků po staré podobě (jeden na sadu) se cestou smazalo. */
  uklizeno: number;
};

/**
 * JEDEN DOKUMENT, UVNITŘ ROZDĚLENÝ (upřesnění 28. 9. 2026: „technické
 * parametry hoď do jeden dokument a v něm rozděl").
 *
 * Deset samostatných článků zaplnilo celý seznam Procesů a postup, kvůli
 * kterému tam člověk šel, se v nich ztratil. Teď je to jeden článek: nahoře
 * výčet sad, pod ním každá sada jako kapitola a v ní její sekce.
 *
 * Nadpisy: sada je `#` (v návodu se vykreslí jako h2), sekce uvnitř `##` -
 * viz navodNaHtml v lib/navody.ts.
 */
function naMarkdown(
  profily: {
    nazev: string;
    perex: string | null;
    druh: string;
    vychozi: boolean;
    firmy: { name: string }[];
    sekce: { nadpis: string; radky: string[] }[];
  }[],
): string {
  const radky: string[] = [];

  radky.push(
    'Formáty a pravidla výroby podle nakladatelství. Sada se k projektu vybírá podle klienta; komu vlastní sada chybí, platí pro něj obecná.',
    '',
    '**V dokumentu najdeš:** ' + profily.map((p) => p.nazev).join(' · '),
  );

  for (const p of profily) {
    const komu = p.vychozi
      ? `obecná sada pro ${p.druh === 'REKLAMA' ? 'reklamy' : 'audioknihy'} - platí, když firma nemá vlastní`
      : `platí pro: ${p.firmy.map((f) => f.name).join(', ') || '(zatím žádná firma)'}`;

    radky.push('', '---', '', `# ${p.nazev}`, '', `*${komu}*`);
    if (p.perex?.trim()) radky.push('', p.perex.trim());

    for (const s of p.sekce) {
      const platne = s.radky.filter((r) => r.trim());
      if (!platne.length) continue;
      radky.push('', `## ${s.nadpis}`, '');
      for (const r of platne) radky.push(`- ${r.trim()}`);
    }
  }

  radky.push(
    '',
    '---',
    '',
    'Sady se udržují v Administraci → Technické parametry a odtud se propisují k projektům i do chatu. Tenhle dokument je jejich přepis pro čtení; úpravy dělej u sady, ne tady.',
  );
  return radky.join('\n');
}

const SLUG = 'technicke-parametry';

/**
 * Přepíše (nebo založí) jeden dokument se všemi aktivními sadami.
 *
 * Vrací počty, ne text - volající je jen ukáže. Vyřazené sady se
 * nepřenášejí. Starší podobu, kdy měla každá sada vlastní článek, to cestou
 * uklidí - jde o články, které tahle funkce sama vyrobila.
 */
export async function ulozParametryDoProcesu(autorId?: string | null): Promise<Vysledek> {
  const profily = (await nactiProfily())
    .filter((p) => p.aktivni)
    .sort((a, b) => Number(b.vychozi) - Number(a.vychozi) || a.nazev.localeCompare(b.nazev, 'cs'));

  // Úklid po starším rozdělení na články po sadách (28. 9. 2026).
  const stare = await prisma.navod.deleteMany({
    where: { druh: 'PROCES', slug: { startsWith: `${SLUG}-` } },
  });

  const nazev = 'Technické parametry výroby';
  const perex = 'Formáty a pravidla podle nakladatelství - jeden dokument, uvnitř po sadách.';
  const obsah = naMarkdown(profily);

  const uz = await prisma.navod.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (uz) {
    await prisma.navod.update({
      where: { id: uz.id },
      data: {
        nazev,
        perex,
        obsah,
        hledaci: hledaciText({ nazev, perex, obsah }),
        kategorie: KATEGORIE_PARAMETRU,
        druh: 'PROCES',
      },
    });
    return { zalozeno: 0, aktualizovano: 1, celkem: profily.length, uklizeno: stare.count };
  }

  await prisma.navod.create({
    data: {
      slug: SLUG,
      nazev,
      perex,
      obsah,
      hledaci: hledaciText({ nazev, perex, obsah }),
      kategorie: KATEGORIE_PARAMETRU,
      druh: 'PROCES',
      // Formáty potřebuje znát celý tým - kdo je má vidět úžeji, doladí se
      // na kartě článku a další načtení to nepřepíše.
      proRole: [],
      zverejneno: true,
      poradi: 10,
      autorId: autorId ?? null,
    },
  });
  return { zalozeno: 1, aktualizovano: 0, celkem: profily.length, uklizeno: stare.count };
}
