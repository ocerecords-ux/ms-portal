import { FORMATY, SABLONY, najdiFormat, prazdnePlatno, type Platno } from '@/lib/socialni';

/**
 * EMA A NAŠE SÍTĚ (zadání 19. 11. 2026: „bylo by super, kdyby Ema pracovala
 * i s našimi sociálními sítěmi").
 *
 * Ema nekreslí. Napíše, CO má na příspěvku stát - nadpis, podnadpis, popisek
 * a hashtagy - a tenhle modul z toho složí plátno podle naší šablony. Vznikne
 * rozpracovaný příspěvek v sekci Sítě, který se otevře v editoru a dodělá se
 * grafika. Nic se nikam neodesílá.
 *
 * ŽÁDNÁ PRISMA ANI DOM - čistý převod, dá se otestovat.
 */

export type NavrhPrispevku = {
  format: string;
  nazev: string;
  nadpis: string;
  podnadpis: string;
  popisek: string;
  hashtagy: string;
};

/** Klíče formátů, ze kterých smí Ema vybírat - ať nevymýšlí vlastní. */
export function klicFormatu(): string[] {
  return FORMATY.map((f) => f.klic);
}

/** Popis formátů do zadání pro Emu. */
export function nabidkaFormatu(): string {
  return FORMATY.map((f) => `${f.klic} = ${f.nazev} (${f.sit}, ${f.popis})`).join('\n');
}

/**
 * Plátno z návrhu. Bere šablonu „Nový spot" a přepíše v ní dva textové bloky:
 * první je nadpis, druhý podnadpis. Podpis MEDIA SPACE zůstává.
 *
 * Kdyby se šablona někdy přejmenovala, nic nespadne - vrátí se prázdné plátno
 * a text se doplní v editoru.
 */
export function platnoZNavrhu(navrh: NavrhPrispevku): Platno {
  const sablona = SABLONY.find((s) => s.klic === 'novy-spot');
  if (!sablona) return prazdnePlatno();
  const platno = sablona.platno();

  const texty = platno.vrstvy.filter((v) => v.druh === 'text');
  if (texty[0] && texty[0].druh === 'text' && navrh.nadpis.trim()) {
    texty[0].text = navrh.nadpis.trim();
  }
  if (texty[1] && texty[1].druh === 'text' && navrh.podnadpis.trim()) {
    texty[1].text = navrh.podnadpis.trim();
  }
  return platno;
}

/** Očistí, co přišlo od Emy, na tvar, se kterým se dá pracovat. */
export function navrhZeVstupu(vstup: Record<string, unknown>): NavrhPrispevku {
  const text = (klic: string, strop: number) => {
    const h = vstup[klic];
    return typeof h === 'string' ? h.trim().slice(0, strop) : '';
  };
  const zadany = text('format', 40);
  return {
    format: klicFormatu().includes(zadany) ? zadany : najdiFormat('').klic,
    nazev: text('nazev', 120) || 'Návrh od Emy',
    nadpis: text('nadpis', 200),
    podnadpis: text('podnadpis', 400),
    popisek: text('popisek', 2200),
    hashtagy: text('hashtagy', 400),
  };
}
