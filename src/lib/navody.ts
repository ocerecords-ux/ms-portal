/**
 * NÁVODY V PORTÁLU (zadání 16. 9. 2026: „udělejme nějakou přehlednou sekci
 * a tam budeme vše postupně přidávat. I s nějakým fulltext hledáním").
 *
 * Tenhle soubor je bez přístupu do databáze — používá ho i prohlížeč
 * (hledání v seznamu, náhled při psaní). Práce s databází je v routách.
 */

import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * KDO NÁVOD VIDÍ (zadání 19. 9. 2026: „herci a klienti by neměli vidět naše
 * interní nápovědy").
 *
 * - Nic nezaškrtnuto = návod pro CELÝ TÝM (Žůžo-labůžo, Produkce, Zvukař).
 *   Herec ani klient ho nevidí - dřív to znamenalo „všem přihlášeným" a tím
 *   se k herci dostaly i návody o rozpočtech a plánování.
 * - Zaškrtnuté role = jen ty. Návod pro herce se musí herci zaškrtnout.
 * - Žůžo-labůžo vidí všechno (píše je a kontroluje).
 */
export function vidiNavod(proRole: string[], role: string): boolean {
  if (role === 'ADMIN') return true;
  if (proRole.length === 0) return (INTERNAL_ROLES as string[]).includes(role);
  return proRole.includes(role);
}

/** Text bez diakritiky a malými písmeny — základ hledání i adresy návodu. */
export function bezDiakritiky(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Adresa návodu z názvu: „Pozvánka herce" → „pozvanka-herce". */
export function slugZNazvu(nazev: string): string {
  const zaklad = bezDiakritiky(nazev)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return zaklad || 'navod';
}

/**
 * Text, ve kterém se hledá. Skládá se ze všeho, co návod nese, protože lidé
 * hledají podle slova z prostředka věty stejně často jako podle názvu.
 */
export function hledaciText(vstup: { nazev: string; perex?: string | null; obsah: string }): string {
  return bezDiakritiky([vstup.nazev, vstup.perex ?? '', vstup.obsah].join(' \n '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Odpovídá návod hledanému? Všechna slova dotazu musí být v textu — hledání
 * dvou slov má zúžit, ne rozšířit.
 */
export function odpovidaHledani(hledaci: string, dotaz: string): boolean {
  const slova = bezDiakritiky(dotaz).split(/\s+/).filter(Boolean);
  if (slova.length === 0) return true;
  return slova.every((s) => hledaci.includes(s));
}

/** Kousek textu kolem prvního nálezu — ať je v seznamu vidět proč se to našlo. */
export function uryvek(obsah: string, dotaz: string, delka = 160): string | null {
  const slova = bezDiakritiky(dotaz).split(/\s+/).filter(Boolean);
  if (slova.length === 0) return null;
  const cisty = obsah.replace(/[#*`>_\[\]!]|\(([^)]*)\)/g, ' ').replace(/\s+/g, ' ').trim();
  const kde = bezDiakritiky(cisty).indexOf(slova[0]);
  if (kde === -1) return null;
  const od = Math.max(0, kde - Math.floor(delka / 3));
  const text = cisty.slice(od, od + delka).trim();
  return `${od > 0 ? '… ' : ''}${text}${od + delka < cisty.length ? ' …' : ''}`;
}

/* ==========================================================================
   MARKDOWN → HTML

   Vlastní, schválně malý překladač. Návody píše člověk z týmu, ne cizí
   uživatel, ale text stejně nejdřív projde escapováním - kdyby se do návodu
   dostalo `<script>`, nemá co dělat na stránce, kterou čte celý tým.

   Umí to, co návod potřebuje: nadpisy, tučné a kurzívu, odkazy, obrázky,
   odrážky, číslované seznamy, kód a oddělovač. Nic víc; tabulka se v návodu
   zatím neobjevila a přidat ji jde kdykoliv.
   ========================================================================== */

function escapuj(text: string): string {
  return text.replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]!));
}

/** Bezpečná adresa — do href a src pustíme jen to, co vede na web nebo do portálu. */
function bezpecnaAdresa(adresa: string): string | null {
  const a = adresa.trim();
  if (/^https?:\/\//i.test(a)) return a;
  if (a.startsWith('/')) return a;
  return null;
}

/** Text uvnitř řádku: **tučně**, *kurzíva*, `kód`, [odkaz](adresa), ![obrázek](adresa). */
function radek(text: string): string {
  let out = escapuj(text);
  // Obrázek musí být dřív než odkaz - liší se jen vykřičníkem.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (cely, popis, adresa) => {
    const src = bezpecnaAdresa(adresa);
    return src ? `<img src="${src}" alt="${popis}" loading="lazy">` : cely;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (cely, popis, adresa) => {
    const href = bezpecnaAdresa(adresa);
    return href
      ? `<a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>${popis}</a>`
      : cely;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

export function navodNaHtml(markdown: string): string {
  const radky = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let seznam: 'ul' | 'ol' | null = null;
  let odstavec: string[] = [];

  const zavriOdstavec = () => {
    if (odstavec.length) {
      out.push(`<p>${radek(odstavec.join(' '))}</p>`);
      odstavec = [];
    }
  };
  const zavriSeznam = () => {
    if (seznam) {
      out.push(`</${seznam}>`);
      seznam = null;
    }
  };

  for (const r of radky) {
    const text = r.trimEnd();

    if (!text.trim()) {
      zavriOdstavec();
      zavriSeznam();
      continue;
    }

    const nadpis = /^(#{1,4})\s+(.*)$/.exec(text);
    if (nadpis) {
      zavriOdstavec();
      zavriSeznam();
      const uroven = Math.min(4, nadpis[1].length + 1); // # v návodu = <h2>, název nese stránka
      out.push(`<h${uroven}>${radek(nadpis[2])}</h${uroven}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(text.trim())) {
      zavriOdstavec();
      zavriSeznam();
      out.push('<hr>');
      continue;
    }

    const odrazka = /^\s*[-*]\s+(.*)$/.exec(text);
    if (odrazka) {
      zavriOdstavec();
      if (seznam !== 'ul') {
        zavriSeznam();
        out.push('<ul>');
        seznam = 'ul';
      }
      out.push(`<li>${radek(odrazka[1])}</li>`);
      continue;
    }

    const cislo = /^\s*\d+[.)]\s+(.*)$/.exec(text);
    if (cislo) {
      zavriOdstavec();
      if (seznam !== 'ol') {
        zavriSeznam();
        out.push('<ol>');
        seznam = 'ol';
      }
      out.push(`<li>${radek(cislo[1])}</li>`);
      continue;
    }

    zavriSeznam();
    odstavec.push(text.trim());
  }

  zavriOdstavec();
  zavriSeznam();
  return out.join('\n');
}

/** Kategorie, které se nabízejí při psaní. Vlastní jde napsat taky. */
export const KATEGORIE_NAVODU = [
  'Herci',
  'Projekty',
  'Doklady a faktury',
  'Chat',
  'Kalendář',
  'Objednávky',
  'Ostatní',
];
