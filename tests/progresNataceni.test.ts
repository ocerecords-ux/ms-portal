import { describe, expect, it } from 'vitest';
import { koeficientKnihy, progresProjektu, progresZeStran } from '../src/lib/progresNataceni';

/**
 * Progres natáčení (upřesněno 1. 10. 2026: „ten počet NS u každého herce je
 * celkový počet NS, které mají za celou knihu natočit, a mají to v různých
 * částech knihy… může se stát, že herečka čte kapitolu 1, 3, 7 a herec
 * kapitolu 2, 4, 5 a 6. Ten počet NS u každého herce slouží jen jako poměr
 * a údaj pro to, kolik máme kterému naplánovat frekvencí").
 *
 * Čísla jsou z projektu KOUSEK TEBE: 670 stran textu, 328 normostran,
 * Martina na straně 95, Tomáš na straně 222.
 */
describe('koeficient knihy', () => {
  it('říká, kolik normostran je na straně textu', () => {
    expect(koeficientKnihy(670, 328)?.nsNaStranu).toBeCloseTo(0.4896, 4);
  });

  it('u hustěji vysázené knihy vyjde jiný - proto se počítá vždycky znovu', () => {
    const rida = koeficientKnihy(670, 328)?.nsNaStranu ?? 0;
    const husta = koeficientKnihy(400, 328)?.nsNaStranu ?? 0;
    expect(husta).toBeGreaterThan(rida);
  });

  it('bez jednoho z čísel není co počítat', () => {
    expect(koeficientKnihy(null, 328)).toBeNull();
    expect(koeficientKnihy(670, null)).toBeNull();
    expect(koeficientKnihy(670, 0)).toBeNull();
  });
});

describe('progres herce', () => {
  it('se měří proti celému textu - herec má kapitoly po celé knize', () => {
    const p = progresZeStran(222, 670, false, 169);
    expect(p?.procenta).toBe(33);
    expect(p?.popis).toBe('str. 222 z 670');
  });

  it('nikdy nevyjde nula jen proto, že herec čte druhou půlku knihy', () => {
    // Přesně případ, který to rozbilo: Tomáš na straně 222 ukazoval 0 %.
    expect(progresZeStran(222, 670, false, 169)?.procenta).toBeGreaterThan(0);
  });

  it('zbývající normostrany vycházejí z jeho vlastního rozsahu', () => {
    const p = progresZeStran(222, 670, false, 169);
    // 169 NS × 222/670 = 56 hotových, zbývá 113.
    expect(p?.hotovo).toBe(56);
    expect(p?.zbyvaNs).toBe(113);
    expect(p?.rozsah).toBe(169);
  });

  it('dva herci na stejné straně mají stejná procenta, ale jiné zbývající NS', () => {
    const maly = progresZeStran(335, 670, false, 100);
    const velky = progresZeStran(335, 670, false, 228);
    expect(maly?.procenta).toBe(velky?.procenta);
    expect(maly?.zbyvaNs).toBe(50);
    expect(velky?.zbyvaNs).toBe(114);
  });

  it('bez rozsahu herce se pracuje jen se stranami', () => {
    const p = progresZeStran(95, 670, false, null);
    expect(p?.zbyvaNs).toBeNull();
    expect(p?.rozsah).toBe(670);
  });

  it('dotočeno je sto procent a nic nezbývá', () => {
    const p = progresZeStran(300, 670, true, 169);
    expect(p?.procenta).toBe(100);
    expect(p?.zbyvaNs).toBe(0);
  });

  it('bez počtu stran se ukáže aspoň strana, ne vymyšlené procento', () => {
    const p = progresZeStran(141, null, false, 169);
    expect(p?.neznamyCelek).toBe(true);
    expect(p?.popis).toBe('str. 141');
  });
});

describe('souhrn projektu', () => {
  it('je vážený normostranami herců, ne průměr', () => {
    // Malý rozsah hotový, velký nezačatý: průměr by tvrdil 50 %.
    const maly = progresZeStran(670, 670, false, 50);
    const velky = progresZeStran(0, 670, false, 450);
    expect(progresProjektu([maly, velky])?.procenta).toBe(10);
  });

  it('sečte zbývající normostrany za celý projekt', () => {
    const a = progresZeStran(335, 670, false, 100);
    const b = progresZeStran(335, 670, false, 228);
    expect(progresProjektu([a, b])?.zbyvaNs).toBe(164);
  });

  it('když někomu rozsah chybí, spadne to na průměr a nespadne to', () => {
    const a = progresZeStran(670, 670, false, 50);
    const b = progresZeStran(0, 670, false, null);
    expect(progresProjektu([a, b])?.procenta).toBe(50);
  });

  it('dotočeno u všech je sto procent', () => {
    const a = progresZeStran(95, 670, true, 159);
    const b = progresZeStran(222, 670, true, 169);
    expect(progresProjektu([a, b])?.dotoceno).toBe(true);
  });
});
