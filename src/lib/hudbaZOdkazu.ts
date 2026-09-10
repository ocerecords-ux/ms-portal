/**
 * Vytažení názvu a autora skladby z odkazu (zadání 10. 9. 2026: „nešlo by,
 * abych nemusel vyplňovat autora, abych tam nahrál třeba odkaz na song na
 * Artlist.io a vzalo si to z toho informace o autorovi a hudbě?").
 *
 * Hudební knihovny mají na stránce skladby běžné sdílecí značky (og:title,
 * og:description), takže se dá přečíst, co je za skladbu, bez jakéhokoliv
 * API klíče. Artlist tam má přesně to, co potřebujeme:
 *
 *   og:title       "Hopeful by Paper Planes - Royalty Free Music | Artlist"
 *   og:description "Listen to Hopeful, a song by Paper Planes from the album Simple Things"
 *
 * VYPLNĚNÍ RUKOU ZŮSTÁVÁ (upřesnění 10. 9. 2026). Odkaz je zkratka, ne
 * jediná cesta: hudba může být z archivu, od skladatele nebo odkudkoliv,
 * kde žádná stránka není.
 */

export type HudbaZOdkazu = {
  nazev: string | null;
  autor: string | null;
  album: string | null;
};

/**
 * Odkud se smí načítat.
 *
 * Portál si tu stránku stahuje SÁM ZE SERVERU, takže bez seznamu by se přes
 * tohle pole dalo poslat na jakoukoliv adresu, i na vnitřní službu, která
 * zvenčí není vidět. Seznam je proto plot, ne rozmar - přidat další knihovnu
 * je jeden řádek.
 */
export const POVOLENE_ZDROJE: string[] = [
  'artlist.io',
  'epidemicsound.com',
  'soundstripe.com',
  'musicbed.com',
  'premiumbeat.com',
  'audiojungle.net',
  'elements.envato.com',
  'uppbeat.io',
  'bensound.com',
  'pixabay.com',
  'freesound.org',
  'soundcloud.com',
  'bandcamp.com',
  'open.spotify.com',
  'youtube.com',
  'youtu.be',
];

/** Je adresa z povoleného zdroje? Bere i subdomény (www, cdn). */
export function jePovolenyZdroj(adresa: string): boolean {
  try {
    const url = new URL(adresa);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return POVOLENE_ZDROJE.some((z) => host === z || host.endsWith(`.${z}`));
  } catch {
    return false;
  }
}

/** Základní HTML entity - v meta značkách se běžně vyskytují. */
function dekoduj(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Obsah meta značky. Pořadí atributů se liší web od webu, proto se nejdřív
 * vyberou všechny <meta> a teprve v nich hledá jméno a obsah.
 */
function metaZnacka(html: string, jmeno: string): string | null {
  const znacky = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const znacka of znacky) {
    const jmenoZnacky = znacka.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!jmenoZnacky || jmenoZnacky.toLowerCase() !== jmeno.toLowerCase()) continue;
    const obsah = znacka.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1];
    if (obsah) return dekoduj(obsah);
  }
  return null;
}

/** Ocas typu " - Royalty Free Music | Artlist" - nazev skladby to neni. */
function bezOcasu(text: string): string {
  return text.split(/\s+[-|–]\s+/)[0].trim();
}

/**
 * Přečte skladbu z HTML stránky.
 *
 * Zkouší to od nejspolehlivějšího: popisek (jediné místo, kde jsou název
 * i autor oddělené), pak titulek, pak strukturovaná data. Co se nepovede
 * přečíst, vrátí prázdné - vymýšlet si autora by bylo horší než nechat
 * pole nevyplněné.
 */
export function vytahniHudbu(html: string): HudbaZOdkazu {
  const popis = metaZnacka(html, 'og:description');
  if (popis) {
    // "Listen to Hopeful, a song by Paper Planes from the album Simple Things"
    const shoda = popis.match(/^listen to\s+(.+?),\s*a song by\s+(.+?)(?:\s+from the album\s+(.+?))?\.?$/i);
    if (shoda) {
      return { nazev: shoda[1].trim(), autor: shoda[2].trim(), album: shoda[3]?.trim() ?? null };
    }
  }

  const titulek = metaZnacka(html, 'og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (titulek) {
    const cisty = dekoduj(titulek);
    // "Hopeful by Paper Planes - Royalty Free Music | Artlist"
    const shoda = cisty.match(/^(.+?)\s+by\s+(.+)$/i);
    if (shoda) {
      return { nazev: bezOcasu(shoda[1]), autor: bezOcasu(shoda[2]), album: null };
    }
  }

  // Strukturovana data (JSON-LD). Nektere knihovny je maji, Artlist ne.
  const jsonLd = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const blok of jsonLd) {
    const telo = blok.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(telo);
      const uzly = Array.isArray(data) ? data : [data];
      for (const uzel of uzly) {
        if (typeof uzel?.name !== 'string') continue;
        const autor = uzel?.byArtist?.name ?? uzel?.author?.name ?? uzel?.creator?.name ?? null;
        return { nazev: uzel.name, autor: typeof autor === 'string' ? autor : null, album: null };
      }
    } catch {
      // Rozbite JSON-LD nas nezajima, zkusime dalsi blok.
    }
  }

  return { nazev: titulek ? bezOcasu(dekoduj(titulek)) : null, autor: null, album: null };
}

/**
 * Název skladby odhadnutý z adresy - záchrana, když stránku nejde stáhnout.
 *
 * Artlist má slug v adrese:
 *   /royalty-free-music/song/hopeful/60936  ->  "Hopeful"
 *
 * Autor v adrese není, ten se musí dopsat. Pořád je to lepší než prázdno:
 * půlka práce odpadne a je vidět, že portál odkazu rozuměl.
 */
export function nazevZAdresy(adresa: string): string | null {
  try {
    const casti = new URL(adresa).pathname.split('/').filter(Boolean);
    // Posledni cast byva cislo (ID skladby) - nazev je ten kousek pred nim.
    const slug = /^\d+$/.test(casti[casti.length - 1] ?? '')
      ? casti[casti.length - 2]
      : casti[casti.length - 1];
    if (!slug || slug.length < 2 || /^\d+$/.test(slug)) return null;
    const slova = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim();
    if (!slova) return null;
    return slova.charAt(0).toUpperCase() + slova.slice(1);
  } catch {
    return null;
  }
}
