/**
 * TEXT NA PŘÍBĚHU (zadání 6. 10. 2026: „chtělo by to ještě nějaký textový
 * editor, aby se dalo i hýbat s tím textem na tom příspěvku").
 *
 * TEXT SE VYPALUJE DO FOTKY, UŽ V PROHLÍŽEČI. Instagram u příběhů popisek
 * přes API nebere - co má být vidět, musí být v obrázku. Skládá se to na
 * plátně v prohlížeči, ne na serveru: portál by kvůli tomu potřeboval další
 * knihovnu na obrázky a hlavně by se mohl rozejít s tím, co měl člověk před
 * očima. Takhle kreslí náhled i výsledek stejná čísla.
 *
 * SOUŘADNICE JSOU V PROCENTECH rámu, ne v pixelech - náhled je široký pár set
 * bodů, hotový příběh 1080×1920 a mezi tím je ještě telefon. Procenta platí
 * všude stejně.
 *
 * Soubor je BEZ REACTU i bez prismy, ať se dá použít v náhledu i při skládání.
 */

export type ZarovnaniTextu = 'left' | 'center' | 'right';

export type StylTextu = {
  /** Střed bloku vodorovně, 0-100 % šířky. */
  x: number;
  /** Střed bloku svisle, 0-100 % výšky. */
  y: number;
  /** Výška písma v procentech výšky rámu. */
  velikost: number;
  barva: string;
  /** Klíč podkladu pod písmem - viz PODKLADY. */
  podklad: string;
  zarovnani: ZarovnaniTextu;
};

export const VYCHOZI_STYL: StylTextu = {
  x: 50,
  y: 78,
  velikost: 5,
  barva: '#FFFFFF',
  podklad: 'tmavy',
  zarovnani: 'center',
};

/** Barvy písma - značka plus bílá a tmavá, nic dalšího se na fotku nehodí. */
export const BARVY_TEXTU = ['#FFFFFF', '#201A33', '#7B55FF', '#1FDF67'];

/** Podklad pod řádky. Průhlednost je schválně vysoká, ať je fotka vidět. */
export const PODKLADY: Record<string, string> = {
  zadny: 'transparent',
  tmavy: 'rgba(0, 0, 0, 0.55)',
  svetly: 'rgba(255, 255, 255, 0.85)',
  fialovy: 'rgba(123, 85, 255, 0.85)',
};

/** Šířka textového bloku v procentech rámu - zbytek jsou okraje. */
export const SIRKA_BLOKU = 84;
/** Výška řádku jako násobek písma. */
export const RADEK = 1.25;

export const MIN_VELIKOST = 3;
export const MAX_VELIKOST = 10;

/** Hotový příběh. Instagram chce 1080×1920; víc nemá smysl posílat. */
export const SIRKA_PRIBEHU = 1080;
export const VYSKA_PRIBEHU = 1920;

export function orezStyl(styl: StylTextu): StylTextu {
  const mezi = (h: number, min: number, max: number) => Math.min(max, Math.max(min, h));
  return {
    ...styl,
    x: mezi(styl.x, 5, 95),
    y: mezi(styl.y, 5, 95),
    velikost: mezi(styl.velikost, MIN_VELIKOST, MAX_VELIKOST),
  };
}

/** Rodina písma do plátna - stejná jako v portálu, se zálohami. */
export const PISMO = '"Acid Grotesk", Poppins, Inter, Helvetica, Arial, sans-serif';

/** Rozláme text na řádky, které se vejdou do šířky. Dělí i na vlastní enterech. */
export function naRadky(ctx: CanvasRenderingContext2D, text: string, sirka: number): string[] {
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
      if (ctx.measureText(zkouska).width > sirka && radek) {
        radky.push(radek);
        radek = slovo;
      } else {
        radek = zkouska;
      }
    }
    if (radek) radky.push(radek);
  }
  return radky;
}

/** Obdélník se zakulacenými rohy - podklad pod jedním řádkem. */
function zakulaceny(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, v: number, r: number) {
  const polomer = Math.min(r, s / 2, v / 2);
  ctx.beginPath();
  ctx.moveTo(x + polomer, y);
  ctx.arcTo(x + s, y, x + s, y + v, polomer);
  ctx.arcTo(x + s, y + v, x, y + v, polomer);
  ctx.arcTo(x, y + v, x, y, polomer);
  ctx.arcTo(x, y, x + s, y, polomer);
  ctx.closePath();
  ctx.fill();
}

/**
 * Vykreslí text do plátna přesně tak, jak ho ukazuje náhled: podklad má každý
 * řádek zvlášť (jako na Instagramu), ne celý blok.
 */
export function vykresliText(
  ctx: CanvasRenderingContext2D,
  text: string,
  styl: StylTextu,
  sirka: number,
  vyska: number,
) {
  const obsah = text.trim();
  if (!obsah) return;

  const pismo = (vyska * styl.velikost) / 100;
  ctx.font = `600 ${pismo}px ${PISMO}`;
  ctx.textBaseline = 'middle';

  const sirkaBloku = (sirka * SIRKA_BLOKU) / 100;
  const radky = naRadky(ctx, obsah, sirkaBloku);
  const vyskaRadku = pismo * RADEK;
  const vyskaBloku = radky.length * vyskaRadku;

  const stred = (sirka * styl.x) / 100;
  const vrch = (vyska * styl.y) / 100 - vyskaBloku / 2;

  const odsazeni = pismo * 0.3;
  const podklad = PODKLADY[styl.podklad] ?? 'transparent';

  radky.forEach((radek, i) => {
    if (!radek) return;
    const sirkaTextu = ctx.measureText(radek).width;
    const stredRadku =
      styl.zarovnani === 'center'
        ? stred
        : styl.zarovnani === 'left'
          ? stred - sirkaBloku / 2 + sirkaTextu / 2
          : stred + sirkaBloku / 2 - sirkaTextu / 2;
    const stredY = vrch + i * vyskaRadku + vyskaRadku / 2;

    if (podklad !== 'transparent') {
      ctx.fillStyle = podklad;
      zakulaceny(
        ctx,
        stredRadku - sirkaTextu / 2 - odsazeni,
        stredY - vyskaRadku / 2,
        sirkaTextu + odsazeni * 2,
        vyskaRadku,
        pismo * 0.22,
      );
    }
    ctx.fillStyle = styl.barva;
    ctx.textAlign = 'center';
    ctx.fillText(radek, stredRadku, stredY);
  });
}

/**
 * SLOŽÍ HOTOVÝ PŘÍBĚH: fotka oříznutá na 9:16 a přes ni text.
 *
 * Ořez je stejný jako `object-cover` v náhledu - širší fotka se ořízne po
 * stranách, vyšší nahoře a dole. Proto se dá v náhledu věřit tomu, co je
 * vidět.
 */
export async function slozPribeh(soubor: File, text: string, styl: StylTextu): Promise<Blob> {
  const obrazek = await nactiObrazek(soubor);
  const platno = document.createElement('canvas');
  platno.width = SIRKA_PRIBEHU;
  platno.height = VYSKA_PRIBEHU;
  const ctx = platno.getContext('2d');
  if (!ctx) throw new Error('canvas');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, platno.width, platno.height);

  const pomerPlatna = platno.width / platno.height;
  const pomerObrazku = obrazek.width / obrazek.height;
  let sx = 0;
  let sy = 0;
  let ss = obrazek.width;
  let sv = obrazek.height;
  if (pomerObrazku > pomerPlatna) {
    ss = obrazek.height * pomerPlatna;
    sx = (obrazek.width - ss) / 2;
  } else {
    sv = obrazek.width / pomerPlatna;
    sy = (obrazek.height - sv) / 2;
  }
  ctx.drawImage(obrazek, sx, sy, ss, sv, 0, 0, platno.width, platno.height);

  vykresliText(ctx, text, styl, platno.width, platno.height);

  const blob = await new Promise<Blob | null>((hotovo) => platno.toBlob(hotovo, 'image/jpeg', 0.92));
  if (!blob) throw new Error('canvas');
  return blob;
}

/** Načte obrázek ze souboru. createImageBitmap by zahodil otočení z EXIFu. */
function nactiObrazek(soubor: File): Promise<HTMLImageElement> {
  return new Promise((hotovo, chyba) => {
    const adresa = URL.createObjectURL(soubor);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(adresa);
      hotovo(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(adresa);
      chyba(new Error('obrazek'));
    };
    img.src = adresa;
  });
}
