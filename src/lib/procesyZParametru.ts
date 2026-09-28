import { prisma } from '@/lib/db';
import { hledaciText, bezDiakritiky } from '@/lib/navody';
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

/** Předpona adresy, ať se articles poznají a daly se přepsat na svém místě. */
const PREDPONA = 'technicke-parametry';

export const KATEGORIE_PARAMETRU = 'Technické parametry';

type Vysledek = { zalozeno: number; aktualizovano: number; celkem: number };

/** Markdown jedné sady - nadpis sekce a pod ním parametry po řádcích. */
function naMarkdown(profil: {
  nazev: string;
  perex: string | null;
  druh: string;
  vychozi: boolean;
  firmy: { name: string }[];
  sekce: { nadpis: string; radky: string[] }[];
}): string {
  const radky: string[] = [];

  const komu = profil.vychozi
    ? 'Obecná sada - platí pro firmy, které vlastní nemají.'
    : profil.firmy.length
      ? `Platí pro: ${profil.firmy.map((f) => f.name).join(', ')}.`
      : 'Zatím není přiřazená žádné firmě.';
  const druhPopis = profil.druh === 'REKLAMA' ? 'Reklamy' : 'Audioknihy';
  radky.push(`**${druhPopis}.** ${komu}`);
  if (profil.perex?.trim()) radky.push('', profil.perex.trim());

  for (const s of profil.sekce) {
    const platne = s.radky.filter((r) => r.trim());
    if (!platne.length) continue;
    radky.push('', `# ${s.nadpis}`, '');
    for (const r of platne) radky.push(`- ${r.trim()}`);
  }

  radky.push(
    '',
    '---',
    '',
    'Sada se udržuje v Administraci → Technické parametry a odtud se propisuje k projektům i do chatu. Tenhle článek je její přepis pro čtení; úpravy dělej u sady, ne tady.',
  );
  return radky.join('\n');
}

/**
 * Přepíše (nebo založí) článek ke každé aktivní sadě parametrů.
 *
 * Vrací počty, ne text - volající je jen ukáže. Sady vyřazené z provozu se
 * nepřenášejí; jejich články zůstanou, dokud je někdo nesmaže ručně, aby se
 * omylem neztratil postup, na který někde vede odkaz.
 */
export async function ulozParametryDoProcesu(autorId?: string | null): Promise<Vysledek> {
  const profily = (await nactiProfily()).filter((p) => p.aktivni);
  let zalozeno = 0;
  let aktualizovano = 0;

  for (const p of profily) {
    const slug = `${PREDPONA}-${bezDiakritiky(p.nazev).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const nazev = `Technické parametry — ${p.nazev}`;
    const obsah = naMarkdown(p);
    const perex = p.vychozi
      ? 'Obecná sada formátů pro audioknihy - platí, když firma nemá vlastní.'
      : `Formáty a pravidla výroby pro ${p.firmy.map((f) => f.name).join(', ') || p.nazev}.`;

    const uz = await prisma.navod.findUnique({ where: { slug }, select: { id: true } });
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
      aktualizovano += 1;
    } else {
      await prisma.navod.create({
        data: {
          slug,
          nazev,
          perex,
          obsah,
          hledaci: hledaciText({ nazev, perex, obsah }),
          kategorie: KATEGORIE_PARAMETRU,
          druh: 'PROCES',
          // Formáty potřebuje znát celý tým - kdo je má vidět úžeji, doladí
          // se na kartě článku a další načtení to nepřepíše.
          proRole: [],
          zverejneno: true,
          poradi: p.vychozi ? 10 : 50,
          autorId: autorId ?? null,
        },
      });
      zalozeno += 1;
    }
  }

  return { zalozeno, aktualizovano, celkem: profily.length };
}
