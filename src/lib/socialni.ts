/**
 * SÍTĚ - PŘÍPRAVA PŘÍSPĚVKŮ (zadání 27. 9. 2026: „chci teď udělat pro sebe
 * modul pro sociální sítě Instagram a LinkedIn. Zatím uvidím jen já a aby tam
 * bylo něco jako Canva").
 *
 * Příspěvek je PLÁTNO: pozadí a na něm vrstvy - text, obrázek, obdélník.
 * Vrstva má pozici a velikost v PROCENTECH plátna, ne v pixelech: tentýž
 * návrh se pak dá přepnout ze stories na LinkedIn a nic z něj nevyleze.
 *
 * TENHLE SOUBOR JE BEZ PRISMY A BEZ DOM - importuje ho editor v prohlížeči
 * i server. Kreslení na <canvas> je níž ve vykresliPlatno(): jedna cesta pro
 * náhled i pro export, jinak by se stáhlo něco jiného, než je vidět.
 */

export type Sit = 'INSTAGRAM' | 'LINKEDIN';

export type FormatPlatna = {
  klic: string;
  sit: Sit;
  nazev: string;
  sirka: number;
  vyska: number;
  popis: string;
};

/**
 * Formáty, se kterými se začíná (zadání 27. 9. 2026: stories/reels 9:16
 * a LinkedIn). Čtverec a 4:5 jsou tu taky - stejný návrh se často dává i do
 * feedu a přepnout formát je otázka jednoho kliknutí.
 */
export const FORMATY: FormatPlatna[] = [
  {
    klic: 'ig-9x16',
    sit: 'INSTAGRAM',
    nazev: 'Stories / Reels',
    sirka: 1080,
    vyska: 1920,
    popis: 'Na celou obrazovku telefonu.',
  },
  {
    klic: 'ig-4x5',
    sit: 'INSTAGRAM',
    nazev: 'Příspěvek na výšku',
    sirka: 1080,
    vyska: 1350,
    popis: 'Ve feedu zabere nejvíc místa.',
  },
  {
    klic: 'ig-1x1',
    sit: 'INSTAGRAM',
    nazev: 'Čtverec',
    sirka: 1080,
    vyska: 1080,
    popis: 'Klasický příspěvek.',
  },
  {
    klic: 'li-1200x627',
    sit: 'LINKEDIN',
    nazev: 'LinkedIn na šířku',
    sirka: 1200,
    vyska: 627,
    popis: 'Doporučený rozměr pro příspěvek s obrázkem.',
  },
  {
    klic: 'li-1x1',
    sit: 'LINKEDIN',
    nazev: 'LinkedIn čtverec',
    sirka: 1080,
    vyska: 1080,
    popis: 'Ve feedu na mobilu zabere víc místa.',
  },
];

export function najdiFormat(klic: string): FormatPlatna {
  return FORMATY.find((f) => f.klic === klic) ?? FORMATY[0];
}

/** Barvy značky - tytéž hodnoty jako v tailwind.config (brand.*). */
export const BARVY = {
  fialova: '#7B55FF',
  fialovaTmava: '#6B2AF0',
  fialovaHodneTmava: '#4B2FB0',
  zelena: '#1FDF67',
  zelenaTmava: '#149E4B',
  inkoust: '#201A33',
  bila: '#FFFFFF',
  cerna: '#0E0B16',
} as const;

export const PISMA = [
  { klic: 'display', nazev: 'Nadpisové', css: '"Bricolage Grotesque", Arial, sans-serif' },
  { klic: 'heading', nazev: 'Popisky', css: 'Outfit, Arial, sans-serif' },
  { klic: 'body', nazev: 'Text', css: '"DM Sans", Arial, sans-serif' },
] as const;

export function pismoCss(klic: string | undefined): string {
  return PISMA.find((p) => p.klic === klic)?.css ?? PISMA[1].css;
}

type Zaklad = {
  id: string;
  /** Pozice a velikost v procentech plátna (0-100). */
  x: number;
  y: number;
  sirka: number;
  vyska: number;
  /** Otočení ve stupních. */
  otoceni?: number;
  zamceno?: boolean;
};

export type VrstvaText = Zaklad & {
  druh: 'text';
  text: string;
  /** Velikost písma v procentech VÝŠKY plátna - přežije změnu formátu. */
  velikost: number;
  pismo: string;
  tucne: boolean;
  kurziva?: boolean;
  barva: string;
  zarovnani: 'left' | 'center' | 'right';
  prolozeni?: number;
  /** Řádkování jako násobek velikosti písma. */
  radkovani?: number;
  velkaPismena?: boolean;
};

export type VrstvaObrazek = Zaklad & {
  druh: 'obrazek';
  /** Adresa v portálu - /api/site/obrazek/<id>. */
  src: string;
  /** cover = vyplní rámeček a ořízne, contain = vejde se celý. */
  vyplneni: 'cover' | 'contain';
  radius?: number;
  pruhlednost?: number;
};

export type VrstvaTvar = Zaklad & {
  druh: 'tvar';
  barva: string;
  radius?: number;
  pruhlednost?: number;
};

export type Vrstva = VrstvaText | VrstvaObrazek | VrstvaTvar;

export type Pozadi =
  | { druh: 'barva'; barva: string }
  | { druh: 'prechod'; od: string; do: string; uhel: number }
  | { druh: 'obrazek'; src: string; ztmaveni?: number };

export type Platno = {
  pozadi: Pozadi;
  vrstvy: Vrstva[];
};

export function prazdnePlatno(): Platno {
  return { pozadi: { druh: 'prechod', od: BARVY.fialova, do: BARVY.fialovaHodneTmava, uhel: 160 }, vrstvy: [] };
}

/** Jednoduché id vrstvy - stačí, že je v rámci plátna jedinečné. */
export function noveId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* --------------------------------------------------------------------------
   ŠABLONY (zadání 27. 9. 2026: „obojí" - začne se šablonou a pak se v ní dá
   cokoli posunout a přepsat). Šablona je jen hotové plátno; jakmile se vloží,
   je to obyčejný návrh a editor s ním dál nedělá nic zvláštního.
   ------------------------------------------------------------------------ */

export type Sablona = {
  klic: string;
  nazev: string;
  popis: string;
  /** Pro které formáty dává smysl; prázdné = pro všechny. */
  formaty?: string[];
  platno: () => Platno;
};

export const SABLONY: Sablona[] = [
  {
    klic: 'novy-spot',
    nazev: 'Nový spot',
    popis: 'Velký nadpis přes fialový přechod, dole podpis.',
    platno: () => ({
      pozadi: { druh: 'prechod', od: BARVY.fialova, do: BARVY.fialovaHodneTmava, uhel: 160 },
      vrstvy: [
        {
          id: noveId(),
          druh: 'tvar',
          x: 8,
          y: 20,
          sirka: 18,
          vyska: 1.2,
          barva: BARVY.zelena,
          radius: 2,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 8,
          y: 25,
          sirka: 84,
          vyska: 30,
          text: 'Natočili jsme\nnový spot',
          velikost: 8,
          pismo: 'display',
          tucne: true,
          barva: BARVY.bila,
          zarovnani: 'left',
          radkovani: 1.1,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 8,
          y: 58,
          sirka: 84,
          vyska: 12,
          text: 'Pár slov o tom, co v něm je a pro koho vznikl.',
          velikost: 3.2,
          pismo: 'body',
          tucne: false,
          barva: '#E6DEFF',
          zarovnani: 'left',
          radkovani: 1.35,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 8,
          y: 88,
          sirka: 60,
          vyska: 6,
          text: 'MEDIA SPACE',
          velikost: 2.4,
          pismo: 'heading',
          tucne: true,
          barva: BARVY.zelena,
          zarovnani: 'left',
          prolozeni: 4,
          velkaPismena: true,
        },
      ],
    }),
  },
  {
    klic: 'citat',
    nazev: 'Citát',
    popis: 'Výrok uprostřed, jméno pod ním.',
    platno: () => ({
      pozadi: { druh: 'barva', barva: BARVY.inkoust },
      vrstvy: [
        {
          id: noveId(),
          druh: 'text',
          x: 10,
          y: 30,
          sirka: 80,
          vyska: 30,
          text: '„Dobrý hlas se nepřehraje.\nMusí se mu věřit."',
          velikost: 6,
          pismo: 'display',
          tucne: true,
          barva: BARVY.bila,
          zarovnani: 'center',
          radkovani: 1.2,
        },
        {
          id: noveId(),
          druh: 'tvar',
          x: 45,
          y: 64,
          sirka: 10,
          vyska: 0.8,
          barva: BARVY.zelena,
          radius: 2,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 10,
          y: 68,
          sirka: 80,
          vyska: 8,
          text: 'Ondřej Černý, Mediaspace',
          velikost: 2.6,
          pismo: 'heading',
          tucne: false,
          barva: '#A79CC6',
          zarovnani: 'center',
        },
      ],
    }),
  },
  {
    klic: 'fotka-s-titulkem',
    nazev: 'Fotka s titulkem',
    popis: 'Obrázek přes celé plátno, dole ztmavení a text.',
    platno: () => ({
      pozadi: { druh: 'barva', barva: BARVY.cerna },
      vrstvy: [
        {
          id: noveId(),
          druh: 'tvar',
          x: 0,
          y: 55,
          sirka: 100,
          vyska: 45,
          barva: '#0E0B16',
          pruhlednost: 0.75,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 8,
          y: 66,
          sirka: 84,
          vyska: 20,
          text: 'Titulek přes fotku',
          velikost: 6,
          pismo: 'display',
          tucne: true,
          barva: BARVY.bila,
          zarovnani: 'left',
          radkovani: 1.1,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 8,
          y: 88,
          sirka: 84,
          vyska: 6,
          text: 'mediaspace.cz',
          velikost: 2.2,
          pismo: 'heading',
          tucne: true,
          barva: BARVY.zelena,
          zarovnani: 'left',
          prolozeni: 3,
        },
      ],
    }),
  },
  {
    klic: 'linkedin-oznameni',
    nazev: 'Oznámení na LinkedIn',
    popis: 'Vlevo text, vpravo zelený pruh.',
    formaty: ['li-1200x627', 'li-1x1'],
    platno: () => ({
      pozadi: { druh: 'barva', barva: BARVY.bila },
      vrstvy: [
        {
          id: noveId(),
          druh: 'tvar',
          x: 82,
          y: 0,
          sirka: 18,
          vyska: 100,
          barva: BARVY.fialova,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 7,
          y: 22,
          sirka: 70,
          vyska: 30,
          text: 'Co je u nás nového',
          velikost: 9,
          pismo: 'display',
          tucne: true,
          barva: BARVY.inkoust,
          zarovnani: 'left',
          radkovani: 1.1,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 7,
          y: 58,
          sirka: 70,
          vyska: 20,
          text: 'Krátce k věci — jedna myšlenka na jeden příspěvek.',
          velikost: 4,
          pismo: 'body',
          tucne: false,
          barva: '#5B5473',
          zarovnani: 'left',
          radkovani: 1.35,
        },
        {
          id: noveId(),
          druh: 'text',
          x: 7,
          y: 84,
          sirka: 50,
          vyska: 8,
          text: 'MEDIA SPACE',
          velikost: 3,
          pismo: 'heading',
          tucne: true,
          barva: BARVY.fialovaTmava,
          zarovnani: 'left',
          prolozeni: 4,
          velkaPismena: true,
        },
      ],
    }),
  },
  {
    klic: 'cista',
    nazev: 'Prázdné plátno',
    popis: 'Jen pozadí, zbytek si postavím sám.',
    platno: prazdnePlatno,
  },
];

/* --------------------------------------------------------------------------
   KRESLENÍ. Tatáž funkce kreslí náhled v editoru i PNG ke stažení, takže se
   stáhne přesně to, co je vidět.
   ------------------------------------------------------------------------ */

type Platno2D = CanvasRenderingContext2D;

/** Rozláme text na řádky, které se vejdou do šířky. */
export function rozlamText(ctx: Platno2D, text: string, maxSirka: number): string[] {
  const radky: string[] = [];
  for (const odstavec of text.split('\n')) {
    const slova = odstavec.split(/\s+/).filter(Boolean);
    if (slova.length === 0) {
      radky.push('');
      continue;
    }
    let radek = '';
    for (const slovo of slova) {
      const zkouska = radek ? `${radek} ${slovo}` : slovo;
      if (ctx.measureText(zkouska).width <= maxSirka || !radek) {
        radek = zkouska;
      } else {
        radky.push(radek);
        radek = slovo;
      }
    }
    if (radek) radky.push(radek);
  }
  return radky;
}

function zaoblenyObdelnik(ctx: Platno2D, x: number, y: number, w: number, h: number, r: number) {
  const polomer = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + polomer, y);
  ctx.arcTo(x + w, y, x + w, y + h, polomer);
  ctx.arcTo(x + w, y + h, x, y + h, polomer);
  ctx.arcTo(x, y + h, x, y, polomer);
  ctx.arcTo(x, y, x + w, y, polomer);
  ctx.closePath();
}

/**
 * Vykreslí celé plátno. `obrazky` je mapa adresa → už načtený obrázek;
 * načítání si řeší volající, aby kreslení bylo jednorázové a bez čekání.
 */
export function vykresliPlatno(
  ctx: Platno2D,
  platno: Platno,
  sirka: number,
  vyska: number,
  obrazky: Map<string, CanvasImageSource>,
) {
  ctx.clearRect(0, 0, sirka, vyska);

  // Pozadí.
  const p = platno.pozadi;
  if (p.druh === 'barva') {
    ctx.fillStyle = p.barva;
    ctx.fillRect(0, 0, sirka, vyska);
  } else if (p.druh === 'prechod') {
    const uhel = ((p.uhel ?? 160) * Math.PI) / 180;
    const dx = Math.cos(uhel) * sirka;
    const dy = Math.sin(uhel) * vyska;
    const g = ctx.createLinearGradient(0, 0, dx, dy);
    g.addColorStop(0, p.od);
    g.addColorStop(1, p.do);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sirka, vyska);
  } else {
    const img = obrazky.get(p.src);
    ctx.fillStyle = BARVY.inkoust;
    ctx.fillRect(0, 0, sirka, vyska);
    if (img) vykresliCover(ctx, img, 0, 0, sirka, vyska);
    if (p.ztmaveni) {
      ctx.fillStyle = `rgba(14,11,22,${Math.min(1, Math.max(0, p.ztmaveni))})`;
      ctx.fillRect(0, 0, sirka, vyska);
    }
  }

  for (const v of platno.vrstvy) {
    const x = (v.x / 100) * sirka;
    const y = (v.y / 100) * vyska;
    const w = (v.sirka / 100) * sirka;
    const h = (v.vyska / 100) * vyska;

    ctx.save();
    if (v.otoceni) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((v.otoceni * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    if (v.druh === 'tvar') {
      ctx.globalAlpha = v.pruhlednost ?? 1;
      ctx.fillStyle = v.barva;
      zaoblenyObdelnik(ctx, x, y, w, h, ((v.radius ?? 0) / 100) * Math.min(sirka, vyska));
      ctx.fill();
    } else if (v.druh === 'obrazek') {
      const img = obrazky.get(v.src);
      if (img) {
        ctx.globalAlpha = v.pruhlednost ?? 1;
        if (v.radius) {
          zaoblenyObdelnik(ctx, x, y, w, h, ((v.radius ?? 0) / 100) * Math.min(sirka, vyska));
          ctx.clip();
        }
        if (v.vyplneni === 'contain') vykresliContain(ctx, img, x, y, w, h);
        else vykresliCover(ctx, img, x, y, w, h);
      } else {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#8E86A8';
        zaoblenyObdelnik(ctx, x, y, w, h, 8);
        ctx.fill();
      }
    } else {
      const velikost = (v.velikost / 100) * vyska;
      ctx.globalAlpha = 1;
      ctx.fillStyle = v.barva;
      ctx.textBaseline = 'top';
      ctx.textAlign = v.zarovnani;
      ctx.font = `${v.kurziva ? 'italic ' : ''}${v.tucne ? '700' : '400'} ${velikost}px ${pismoCss(v.pismo)}`;
      if (v.prolozeni) {
        // letterSpacing zná Chrome i Safari; jinde se jen neprojeví.
        (ctx as Platno2D & { letterSpacing?: string }).letterSpacing = `${(v.prolozeni / 100) * velikost}px`;
      }
      const text = v.velkaPismena ? v.text.toLocaleUpperCase('cs-CZ') : v.text;
      const radky = rozlamText(ctx, text, w);
      const vyskaRadku = velikost * (v.radkovani ?? 1.25);
      const zacatekX = v.zarovnani === 'center' ? x + w / 2 : v.zarovnani === 'right' ? x + w : x;
      radky.forEach((radek, i) => {
        ctx.fillText(radek, zacatekX, y + i * vyskaRadku);
      });
      (ctx as Platno2D & { letterSpacing?: string }).letterSpacing = '0px';
    }

    ctx.restore();
  }
}

function rozmeryObrazku(img: CanvasImageSource): { w: number; h: number } {
  const o = img as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  return { w: o.naturalWidth || o.width || 1, h: o.naturalHeight || o.height || 1 };
}

function vykresliCover(ctx: Platno2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const { w: iw, h: ih } = rozmeryObrazku(img);
  const pomer = Math.max(w / iw, h / ih);
  const sw = w / pomer;
  const sh = h / pomer;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function vykresliContain(ctx: Platno2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const { w: iw, h: ih } = rozmeryObrazku(img);
  const pomer = Math.min(w / iw, h / ih);
  const dw = iw * pomer;
  const dh = ih * pomer;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Všechny adresy obrázků, které plátno potřebuje. */
export function adresyObrazku(platno: Platno): string[] {
  const seznam: string[] = [];
  if (platno.pozadi.druh === 'obrazek' && platno.pozadi.src) seznam.push(platno.pozadi.src);
  for (const v of platno.vrstvy) if (v.druh === 'obrazek' && v.src) seznam.push(v.src);
  return [...new Set(seznam)];
}

/** Název souboru ke stažení. */
export function nazevSouboru(nazev: string, format: string): string {
  const cisty = nazev
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${cisty || 'prispevek'}-${format}.png`;
}
