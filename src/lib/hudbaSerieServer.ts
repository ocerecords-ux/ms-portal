import { prisma } from '@/lib/db';
import {
  bezpecnyNazev,
  korenHudby,
  metadataSouboru,
  odkazNaNahrani,
  odkazNaPrehrani,
  zalozSlozku,
} from '@/lib/dropbox';

/**
 * HUDBA CELÉ SÉRIE (zadání 17. 10. 2026: „v případě, že je to série, tak se
 * tam automaticky nakopíruje hudba, která se používá celou sérií. někdy je to
 * i více skladeb").
 *
 * JE TO PŘEDLOHA, NE SDÍLENÝ ZÁZNAM. Když vznikne další díl, z těchhle řádků
 * se u projektu vyrobí vlastní záznamy (HudbaProjektu, původ „serie"). U dílu
 * jde pak skladbu odebrat, aniž by zmizela ostatním, a poznámku si každý díl
 * drží svoji. Soubor v Dropboxu zůstává jeden - kopíruje se jen záznam o něm.
 *
 * Série se poznává PODLE NÁZVU A FIRMY: název série je prostý text u projektu
 * (ProjectMeta.serie) a dvě firmy můžou mít sérii stejného jména. Řádek bez
 * firmy platí pro každou.
 */

export type SkladbaSerie = {
  id: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  maObal: boolean;
  poznamka: string | null;
  usekOd: number | null;
  usekDo: number | null;
  cesta: string;
  velikost: number;
  pridal: string | null;
  kdy: string;
};

const VYBER = {
  id: true,
  nazev: true,
  autor: true,
  delkaS: true,
  obalKlic: true,
  poznamka: true,
  usekOd: true,
  usekDo: true,
  cesta: true,
  velikost: true,
  createdAt: true,
  pridal: { select: { name: true, email: true } },
} as const;

type RadekSerie = {
  id: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  obalKlic: string | null;
  poznamka: string | null;
  usekOd: number | null;
  usekDo: number | null;
  cesta: string;
  velikost: number;
  createdAt: Date;
  pridal: { name: string | null; email: string } | null;
};

function naSkladbu(r: RadekSerie): SkladbaSerie {
  return {
    id: r.id,
    nazev: r.nazev,
    autor: r.autor,
    delkaS: r.delkaS,
    maObal: Boolean(r.obalKlic),
    poznamka: r.poznamka,
    usekOd: r.usekOd,
    usekDo: r.usekDo,
    cesta: r.cesta,
    velikost: r.velikost,
    pridal: r.pridal ? r.pridal.name || r.pridal.email : null,
    kdy: r.createdAt.toISOString(),
  };
}

/**
 * Podmínka „tahle série téhle firmy". Název se porovnává BEZ OHLEDU NA
 * VELIKOST PÍSMEN - sérii píše do objednávky klient a „Agent JJ" a „agent jj"
 * je pro něj totéž.
 */
function kdeSerie(serie: string, companyId: string | null) {
  return {
    serie: { equals: serie, mode: 'insensitive' as const },
    ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
  };
}

/** Složka série v Dropboxu: `<kořen>/Série/<název série>`. */
export function slozkaSerie(serie: string): string {
  return `${korenHudby()}/Série/${bezpecnyNazev(serie || 'Série')}`;
}

export async function nactiHudbuSerie(
  serie: string,
  companyId: string | null,
): Promise<SkladbaSerie[]> {
  if (!serie.trim()) return [];
  const radky = await prisma.hudbaSerie
    .findMany({ where: kdeSerie(serie.trim(), companyId), orderBy: { createdAt: 'asc' }, select: VYBER })
    .catch((err) => {
      console.error('Hudbu série se nepodařilo načíst:', err);
      return [];
    });
  return (radky as RadekSerie[]).map(naSkladbu);
}

export async function pripravNahraniSerie(vstup: {
  serie: string;
  nazevSouboru: string;
}): Promise<{ odkaz: string; cesta: string } | { chyba: string }> {
  const slozka = slozkaSerie(vstup.serie);
  const pripravena = await zalozSlozku(slozka);
  if (!pripravena.ok) return { chyba: pripravena.duvod };
  const cesta = `${slozka}/${bezpecnyNazev(vstup.nazevSouboru)}`;
  const odkaz = await odkazNaNahrani(cesta);
  return odkaz ? { odkaz, cesta } : { chyba: 'Dropbox nevydal adresu na nahrání.' };
}

export async function zapisSkladbuSerie(vstup: {
  serie: string;
  companyId: string | null;
  cesta: string;
  nazev: string;
  autor?: string | null;
  delkaS?: number;
  obalKlic?: string | null;
  poznamka?: string | null;
  pridalId: string | null;
}): Promise<SkladbaSerie | null> {
  const soubor = await metadataSouboru(vstup.cesta);
  if (!soubor) return null;

  const zaznam = await prisma.hudbaSerie
    .create({
      data: {
        serie: vstup.serie.trim(),
        companyId: vstup.companyId,
        nazev: vstup.nazev.trim() || soubor.nazev,
        autor: vstup.autor?.trim() || null,
        delkaS: Math.max(0, Math.round(vstup.delkaS ?? 0)),
        obalKlic: vstup.obalKlic || null,
        poznamka: vstup.poznamka?.trim() || null,
        cesta: soubor.cesta,
        dropboxId: soubor.id,
        velikost: soubor.velikost,
        pridalId: vstup.pridalId,
      },
      select: VYBER,
    })
    .catch((err) => {
      console.error('Skladbu série se nepodařilo zapsat:', err);
      return null;
    });
  return zaznam ? naSkladbu(zaznam as RadekSerie) : null;
}

export async function upravSkladbuSerie(
  id: string,
  zmena: { poznamka?: string | null; usekOd?: number | null; usekDo?: number | null },
): Promise<boolean> {
  try {
    await prisma.hudbaSerie.update({
      where: { id },
      data: {
        ...(zmena.poznamka !== undefined ? { poznamka: zmena.poznamka?.trim() || null } : {}),
        ...(zmena.usekOd !== undefined ? { usekOd: zmena.usekOd } : {}),
        ...(zmena.usekDo !== undefined ? { usekDo: zmena.usekDo } : {}),
      },
    });
    return true;
  } catch (err) {
    console.error('Hudbu série se nepodařilo upravit:', err);
    return false;
  }
}

/**
 * Odebrání z předlohy série. Dílům, které hudbu už dostaly, NIC NEBERE -
 * mají vlastní záznamy. Jinak by jedno kliknutí u série sebralo hudbu
 * dvaceti hotovým knihám.
 */
export async function odpojSkladbuSerie(id: string): Promise<boolean> {
  try {
    await prisma.hudbaSerie.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error('Skladbu série se nepodařilo odebrat:', err);
    return false;
  }
}

export async function odkazNaSkladbuSerie(id: string): Promise<string | null> {
  const zaznam = await prisma.hudbaSerie
    .findUnique({ where: { id }, select: { cesta: true } })
    .catch(() => null);
  if (!zaznam) return null;
  return odkazNaPrehrani((zaznam as { cesta: string }).cesta);
}

export async function obalSkladbySerie(id: string): Promise<string | null> {
  const zaznam = await prisma.hudbaSerie
    .findUnique({ where: { id }, select: { obalKlic: true } })
    .catch(() => null);
  return (zaznam as { obalKlic: string | null } | null)?.obalKlic ?? null;
}

/**
 * ZKOPÍRUJE HUDBU SÉRIE K PROJEKTU. Volá se při založení projektu a znovu,
 * když se sérii projekt přiřadí až dodatečně.
 *
 * Co už u projektu leží, se nepřidává znovu - rozhoduje cesta souboru
 * v Dropboxu, ne jméno skladby. Díky tomu je volání BEZPEČNÉ OPAKOVAT:
 * přejmenování projektu, druhý uložený formulář ani opakované přiřazení
 * série hudbu nezdvojí.
 *
 * Vrací počet opravdu přidaných skladeb.
 */
export async function zkopirujHudbuSerie(vstup: {
  caflouProjectId: string;
  serie: string | null | undefined;
  companyId: string | null;
  pridalId: string | null;
}): Promise<number> {
  const serie = vstup.serie?.trim();
  if (!serie) return 0;

  try {
    const [predloha, uzTam] = await Promise.all([
      prisma.hudbaSerie.findMany({
        where: kdeSerie(serie, vstup.companyId),
        orderBy: { createdAt: 'asc' },
      }),
      prisma.hudbaProjektu.findMany({
        where: { caflouProjectId: vstup.caflouProjectId },
        select: { cesta: true },
      }),
    ]);

    const mame = new Set((uzTam as { cesta: string }[]).map((r) => r.cesta));
    const kPridani = (predloha as {
      nazev: string;
      autor: string | null;
      delkaS: number;
      obalKlic: string | null;
      poznamka: string | null;
      usekOd: number | null;
      usekDo: number | null;
      cesta: string;
      dropboxId: string | null;
      velikost: number;
    }[]).filter((r) => !mame.has(r.cesta));
    if (kPridani.length === 0) return 0;

    await prisma.hudbaProjektu.createMany({
      data: kPridani.map((r) => ({
        caflouProjectId: vstup.caflouProjectId,
        nazev: r.nazev,
        autor: r.autor,
        delkaS: r.delkaS,
        obalKlic: r.obalKlic,
        poznamka: r.poznamka,
        usekOd: r.usekOd,
        usekDo: r.usekDo,
        puvod: 'serie',
        cesta: r.cesta,
        dropboxId: r.dropboxId,
        velikost: r.velikost,
        pridalId: vstup.pridalId,
      })),
    });

    // Hudbu projekt má - upozornění „chybí hudba" nemá o čem zvonit.
    await prisma.projectMeta
      .update({
        where: { caflouProjectId: vstup.caflouProjectId },
        data: { hudbaUpozornenoAt: null },
      })
      .catch(() => undefined);

    return kPridani.length;
  } catch (err) {
    console.error('Hudbu série se nepodařilo zkopírovat k projektu:', err);
    return 0;
  }
}

/**
 * Přehled sérií, u kterých nějaká hudba je - pro stránku Hudba k audioknihám.
 * Série se slučují podle názvu bez ohledu na velikost písmen, ať se „Agent JJ"
 * a „agent jj" neukážou jako dvě.
 */
export async function prehledSerii(): Promise<
  { serie: string; firma: string | null; skladeb: number }[]
> {
  const radky = await prisma.hudbaSerie
    .findMany({
      orderBy: { serie: 'asc' },
      select: { serie: true, company: { select: { name: true } } },
    })
    .catch(() => []);

  const mapa = new Map<string, { serie: string; firma: string | null; skladeb: number }>();
  for (const r of radky as { serie: string; company: { name: string } | null }[]) {
    const klic = `${r.serie.toLowerCase()}|${r.company?.name ?? ''}`;
    const uz = mapa.get(klic);
    if (uz) uz.skladeb += 1;
    else mapa.set(klic, { serie: r.serie, firma: r.company?.name ?? null, skladeb: 1 });
  }
  return [...mapa.values()].sort((a, b) => a.serie.localeCompare(b.serie, 'cs'));
}

/**
 * VLOŽENÍ DO JEDNOHO DÍLU SE ROZŠÍŘÍ DO CELÉ SÉRIE (zadání 17. 10. 2026:
 * „vložil jsem hudbu do jednoho dílu. Ale potřebuju, když je to série, ať se
 * to automaticky pak vloží do všech").
 *
 * Do teď to fungovalo jen jedním směrem - série měla svou hudbu a nový díl si
 * ji vzal. Jenže v praxi se hudba vybírá u prvního dílu, který se zrovna točí,
 * a teprve z něj se stává hudba celé série. Tahle funkce proto dělá obojí:
 * zapíše skladbu do PŘEDLOHY SÉRIE (takže ji dostane i každý budoucí díl)
 * a nakopíruje ji do všech rozdělaných dílů, které ji ještě nemají.
 *
 * HOTOVÝCH DÍLŮ SE NEDOTKNE. Do knihy, která je dotočená a odevzdaná, nemá
 * smysl dodatečně přidávat hudbu - jen by tam přibyl řádek, který nikdo
 * nepoužije.
 *
 * Co už někde leží, se nepřidává znovu - rozhoduje cesta souboru v Dropboxu,
 * takže opakované volání nic nezdvojí.
 */
export async function rozsirDoSerie(vstup: {
  caflouProjectId: string;
  hudbaId: string;
  pridalId: string | null;
}): Promise<{ serie: string | null; dilu: number }> {
  try {
    const [skladba, meta] = await Promise.all([
      prisma.hudbaProjektu.findUnique({
        where: { id: vstup.hudbaId },
        select: {
          nazev: true,
          autor: true,
          delkaS: true,
          obalKlic: true,
          poznamka: true,
          usekOd: true,
          usekDo: true,
          cesta: true,
          dropboxId: true,
          velikost: true,
        },
      }),
      prisma.projectMeta.findUnique({
        where: { caflouProjectId: vstup.caflouProjectId },
        select: { serie: true, companyId: true },
      }),
    ]);

    const r = skladba as {
      nazev: string;
      autor: string | null;
      delkaS: number;
      obalKlic: string | null;
      poznamka: string | null;
      usekOd: number | null;
      usekDo: number | null;
      cesta: string;
      dropboxId: string | null;
      velikost: number;
    } | null;
    const projekt = meta as { serie: string | null; companyId: string | null } | null;

    const serie = projekt?.serie?.trim();
    if (!r || !serie) return { serie: null, dilu: 0 };

    // 1) do předlohy série, aby ji dostal i každý budoucí díl
    const uzVPredloze = await prisma.hudbaSerie.findFirst({
      where: { ...kdeSerie(serie, projekt?.companyId ?? null), cesta: r.cesta },
      select: { id: true },
    });
    if (!uzVPredloze) {
      await prisma.hudbaSerie.create({
        data: {
          serie,
          companyId: projekt?.companyId ?? null,
          nazev: r.nazev,
          autor: r.autor,
          delkaS: r.delkaS,
          obalKlic: r.obalKlic,
          poznamka: r.poznamka,
          usekOd: r.usekOd,
          usekDo: r.usekDo,
          cesta: r.cesta,
          dropboxId: r.dropboxId,
          velikost: r.velikost,
          pridalId: vstup.pridalId,
        },
      });
    }

    // 2) do ostatních rozdělaných dílů téže série
    const sourozenci = (await prisma.projectMeta.findMany({
      where: {
        caflouProjectId: { not: vstup.caflouProjectId },
        serie: { equals: serie, mode: 'insensitive' },
        finished: false,
        ...(projekt?.companyId ? { companyId: projekt.companyId } : {}),
      },
      select: { caflouProjectId: true },
    })) as { caflouProjectId: string }[];
    if (sourozenci.length === 0) return { serie, dilu: 0 };

    const ids = sourozenci.map((p) => p.caflouProjectId);
    const uzMaji = (await prisma.hudbaProjektu.findMany({
      where: { caflouProjectId: { in: ids }, cesta: r.cesta },
      select: { caflouProjectId: true },
    })) as { caflouProjectId: string }[];
    const vynechat = new Set(uzMaji.map((x) => x.caflouProjectId));
    const kPridani = ids.filter((id) => !vynechat.has(id));
    if (kPridani.length === 0) return { serie, dilu: 0 };

    await prisma.hudbaProjektu.createMany({
      data: kPridani.map((id) => ({
        caflouProjectId: id,
        nazev: r.nazev,
        autor: r.autor,
        delkaS: r.delkaS,
        obalKlic: r.obalKlic,
        poznamka: r.poznamka,
        usekOd: r.usekOd,
        usekDo: r.usekDo,
        puvod: 'serie',
        cesta: r.cesta,
        dropboxId: r.dropboxId,
        velikost: r.velikost,
        pridalId: vstup.pridalId,
        metadataCtenaAt: new Date(),
      })),
    });

    // Díly hudbu mají - upozornění „chybí hudba" nemá o čem zvonit.
    await prisma.projectMeta
      .updateMany({
        where: { caflouProjectId: { in: kPridani } },
        data: { hudbaUpozornenoAt: null },
      })
      .catch(() => undefined);

    return { serie, dilu: kPridani.length };
  } catch (err) {
    console.error('Hudbu se nepodařilo rozšířit do série:', err);
    return { serie: null, dilu: 0 };
  }
}
