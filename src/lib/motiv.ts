/**
 * Světlý a tmavý režim portálu (zadání 9. 9. 2026).
 *
 * Volba se ukládá do prohlížeče, tedy na zařízení - ne k uživateli do
 * databáze. Na Macu tak můžeš mít tmavý a na mobilu světlý, a hlavně se na
 * nic nečeká: režim je nastavený dřív, než se stránka vůbec vykreslí.
 *
 * Když v úložišti nic není, řídí se portál nastavením systému.
 *
 * Soubor je bez Prismy i Reactu, ať se dá použít i v malém skriptu v hlavičce
 * dokumentu (viz SKRIPT_MOTIVU níž).
 */

export type Motiv = 'svetly' | 'tmavy';

/** Klíč v localStorage. Prázdno = řídit se systémem. */
export const KLIC_MOTIVU = 'ms-motiv';

export function systemovyMotiv(): Motiv {
  if (typeof window === 'undefined' || !window.matchMedia) return 'svetly';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'tmavy' : 'svetly';
}

export function nactiMotiv(): Motiv {
  if (typeof window === 'undefined') return 'svetly';
  try {
    const ulozeny = window.localStorage.getItem(KLIC_MOTIVU);
    if (ulozeny === 'tmavy' || ulozeny === 'svetly') return ulozeny;
  } catch {
    // Soukromé okno nebo zakázané úložiště - nevadí, jedeme podle systému.
  }
  return systemovyMotiv();
}

export function ulozMotiv(motiv: Motiv): void {
  try {
    window.localStorage.setItem(KLIC_MOTIVU, motiv);
  } catch {
    // Když se uložit nedá, aspoň zůstane přepnuto do konce návštěvy.
  }
}

/**
 * Skript, který běží v hlavičce dokumentu JEŠTĚ PŘED vykreslením stránky.
 *
 * Bez něj by se při každém načtení na okamžik mihla bílá stránka, než by se
 * React probudil a třídu doplnil - a to je na tmavém režimu to nejotravnější,
 * co může být. Proto je to obyčejný řetězec vložený do <script>: musí se
 * vykonat dřív, než dorazí jakýkoliv balík JavaScriptu.
 *
 * Celé je to v try/catch - když prohlížeč localStorage zakáže, portál prostě
 * zůstane světlý, nikde nic nespadne.
 */
export const SKRIPT_MOTIVU = `(function(){try{
var u=localStorage.getItem('${KLIC_MOTIVU}');
var t=u==='tmavy'||u==='svetly'?u:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'tmavy':'svetly');
if(t==='tmavy'){document.documentElement.classList.add('dark');}
}catch(e){}})();`;
