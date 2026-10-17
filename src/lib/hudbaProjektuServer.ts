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
 * HUDBA VYBRANÁ PRO PROJEKT (zadání 16. 10. 2026, rozšířeno 17. 10. 2026).
 *
 * Soubor leží v Dropboxu, databáze drží jen záznam o něm. Portál se souboru
 * nikdy nedotkne - jen vyrobí adresu, na kterou ho prohlížeč pošle, a potom
 * ověří, že tam opravdu je.
 *
 * NÁZEV A AUTOR SE SEM POSÍLAJÍ Z PROHLÍŽEČE, kde se přečetly z metadat
 * souboru (lib/metadataHudby.ts). Jinak to nejde: server ten soubor nikdy
 * nevidí. Zapisují se JEDNOU a dál se nemění - měnit se smí jen poznámka
 * („ten název autor by neměl jít měnit").
 */

/** Projekt, u kterého tatáž hudba hraje taky. */
export type PouzitiJinde = { projektId: string; nazev: string };

export type SkladbaProjektu = {
  id: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  /** Má obal z metadat? Samotný obrázek se stahuje podepsanou adresou. */
  maObal: boolean;
  /** Už se do souboru koukalo na štítky? Starší skladby mají prázdno. */
  metadataCtena: boolean;
  poznamka: string | null;
  /** Která část nahrávky se má použít; vteřiny od začátku. */
  usekOd: number | null;
  usekDo: number | null;
  puvod: 'my' | 'klient' | 'serie';
  vlozilKlient: string | null;
  cesta: string;
  velikost: number;
  pridal: string | null;
  kdy: string;
  /**
   * KDE JEŠTĚ TAHLE HUDBA HRAJE (zadání 17. 10. 2026: „v případě, že už bude
   * hudba někde použita u jiného projektu, tak by to mělo zařvat. Pokud to
   * teda není série"). Prázdné = nikde jinde.
   */
  pouzitoJinde: PouzitiJinde[];
};

const VYBER = {
  id: true,
  nazev: true,
  autor: true,
  delkaS: true,
  obalKlic: true,
  metadataCtenaAt: true,
  poznamka: true,
  usekOd: true,
  usekDo: true,
  puvod: true,
  vlozilKlient: true,
  cesta: true,
  velikost: true,
  createdAt: true,
  pridal: { select: { name: true, email: true } },
} as const;

type RadekZDatabaze = {
  id: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  obalKlic: string | null;
  metadataCtenaAt: Date | null;
  poznamka: string | null;
  usekOd: number | null;
  usekDo: number | null;
  puvod: string;
  vlozilKlient: string | null;
  cesta: string;
  velikost: number;
  createdAt: Date;
  pridal: { name: string | null; email: string } | null;
};

function naSkladbu(r: RadekZDatabaze): SkladbaProjektu {
  return {
    id: r.id,
    nazev: r.nazev,
    autor: r.autor,
    delkaS: r.delkaS,
    maObal: Boolean(r.obalKlic),
    metadataCtena: Boolean(r.metadataCtenaAt),
    poznamka: r.poznamka,
    usekOd: r.usekOd,
    usekDo: r.usekDo,
    puvod: r.puvod === 'klient' || r.puvod === 'serie' ? r.puvod : 'my',
    vlozilKlient: r.vlozilKlient,
    cesta: r.cesta,
    velikost: r.velikost,
    pridal: r.pridal ? r.pridal.name || r.pridal.email : null,
    kdy: r.createdAt.toISOString(),
    pouzitoJinde: [],
  };
}

/** Složka projektu: `<kořen>/<rok>/<název projektu>`. */
export function slozkaProjektu(nazevProjektu: string, kdy: Date = new Date()): string {
  return `${korenHudby()}/${kdy.getFullYear()}/${bezpecnyNazev(nazevProjektu || 'Projekt')}`;
}

export async function nactiHudbu(caflouProjectId: string): Promise<SkladbaProjektu[]> {
  const radky = await prisma.hudbaProjektu
    .findMany({ where: { caflouProjectId }, orderBy: { createdAt: 'asc' }, select: VYBER })
    .catch((err) => {
      console.error('Hudbu projektu se nepodařilo načíst:', err);
      return [];
    });
  const skladby = (radky as RadekZDatabaze[]).map(naSkladbu);
  return doplnPouzitiJinde(caflouProjectId, skladby, radky as RadekZDatabaze[]);
}

/**
 * HRAJE TAHLE HUDBA JEŠTĚ NĚKDE? (zadání 17. 10. 2026: „v případě, že už bude
 * hudba někde použita u jiného projektu, tak by to mělo zařvat. Pokud to teda
 * není série.")
 *
 * Shoda se hledá podle NÁZVU A AUTORA, ne podle cesty k souboru: tatáž
 * skladba nahraná ke dvěma projektům leží v Dropboxu dvakrát, každá ve své
 * složce. Cesta se porovnává taky, protože hudba zkopírovaná ze série míří
 * na jeden a týž soubor.
 *
 * DÍLY JEDNÉ SÉRIE SE NEHLÁSÍ. Tam je opakování záměr - série má svou hudbu
 * a každý další díl ji dostane; upozorňovat na to by znamenalo varování
 * u každé knihy, která vyjde.
 */
async function doplnPouzitiJinde(
  caflouProjectId: string,
  skladby: SkladbaProjektu[],
  radky: RadekZDatabaze[],
): Promise<SkladbaProjektu[]> {
  if (skladby.length === 0) return skladby;

  try {
    const nazvy = [...new Set(radky.map((r) => r.nazev))];
    const cesty = [...new Set(radky.map((r) => r.cesta))];

    const [muj, jinde] = await Promise.all([
      prisma.projectMeta
        .findUnique({ where: { caflouProjectId }, select: { serie: true } })
        .catch(() => null),
      prisma.hudbaProjektu
        .findMany({
          where: {
            caflouProjectId: { not: caflouProjectId },
            OR: [{ nazev: { in: nazvy } }, { cesta: { in: cesty } }],
          },
          select: { caflouProjectId: true, nazev: true, autor: true, cesta: true },
        })
        .catch(() => []),
    ]);

    const nalezene = jinde as {
      caflouProjectId: string;
      nazev: string;
      autor: string | null;
      cesta: string;
    }[];
    if (nalezene.length === 0) return skladby;

    // Názvy a série protějšků jedním dotazem.
    const idJinych = [...new Set(nalezene.map((r) => r.caflouProjectId))];
    const metaJinych = (await prisma.projectMeta
      .findMany({
        where: { caflouProjectId: { in: idJinych } },
        select: { caflouProjectId: true, name: true, serie: true },
      })
      .catch(() => [])) as { caflouProjectId: string; name: string | null; serie: string | null }[];
    const popisProjektu = new Map(metaJinych.map((m) => [m.caflouProjectId, m]));

    const mojeSerie = ((muj as { serie: string | null } | null)?.serie ?? '').trim().toLowerCase();

    return skladby.map((s, i) => {
      const radek = radky[i];
      const klic = `${radek.nazev.toLowerCase()}|${(radek.autor ?? '').toLowerCase()}`;

      const kde: PouzitiJinde[] = [];
      for (const r of nalezene) {
        const shoda =
          r.cesta === radek.cesta ||
          `${r.nazev.toLowerCase()}|${(r.autor ?? '').toLowerCase()}` === klic;
        if (!shoda) continue;

        const meta = popisProjektu.get(r.caflouProjectId);
        const jehoSerie = (meta?.serie ?? '').trim().toLowerCase();
        // Stejná série = opakování je záměr, nehlásí se.
        if (mojeSerie && jehoSerie && mojeSerie === jehoSerie) continue;
        if (kde.some((p) => p.projektId === r.caflouProjectId)) continue;

        kde.push({
          projektId: r.caflouProjectId,
          nazev: meta?.name || r.caflouProjectId,
        });
      }
      return kde.length > 0 ? { ...s, pouzitoJinde: kde } : s;
    });
  } catch (err) {
    console.error('Použití hudby u jiných projektů se nepodařilo zjistit:', err);
    return skladby;
  }
}

/**
 * Adresa, na kterou prohlížeč pošle jeden soubor.
 *
 * Složka se zakládá tady, ne při nahrávání: Dropbox cestu k souboru vytvoří
 * sám, ale na prázdnou složku projektu se pak nedá odkázat a člověk, který si
 * ji chce otevřít v Dropboxu, nemá kam jít.
 */
export async function pripravNahrani(vstup: {
  nazevProjektu: string;
  nazevSouboru: string;
}): Promise<{ odkaz: string; cesta: string } | { chyba: string }> {
  const slozka = slozkaProjektu(vstup.nazevProjektu);
  // Když složka nejde založit, nemá smysl vydávat adresu na nahrání - soubor
  // by se poslal a Dropbox by ho stejně odmítl (16. 10. 2026).
  const pripravena = await zalozSlozku(slozka);
  if (!pripravena.ok) return { chyba: pripravena.duvod };
  const cesta = `${slozka}/${bezpecnyNazev(vstup.nazevSouboru)}`;
  const odkaz = await odkazNaNahrani(cesta);
  return odkaz ? { odkaz, cesta } : { chyba: 'Dropbox nevydal adresu na nahrání.' };
}

/**
 * Zápis po nahrání. Nevěří prohlížeči: nejdřív se Dropboxu ověří, že soubor
 * na té cestě opravdu leží, a teprve pak vzniká záznam - jinak by v kartě
 * visely skladby, které nikde nejsou. Z Dropboxu se bere i skutečná velikost
 * a konečná cesta, protože při shodě názvů mohl soubor dostat číslo navíc.
 */
export async function zapisSkladbu(vstup: {
  caflouProjectId: string;
  cesta: string;
  nazev: string;
  autor?: string | null;
  delkaS?: number;
  obalKlic?: string | null;
  poznamka?: string | null;
  usekOd?: number | null;
  usekDo?: number | null;
  puvod?: 'my' | 'klient' | 'serie';
  vlozilKlient?: string | null;
  pridalId: string | null;
}): Promise<SkladbaProjektu | null> {
  const soubor = await metadataSouboru(vstup.cesta);
  if (!soubor) return null;

  const zaznam = await prisma.hudbaProjektu
    .create({
      data: {
        caflouProjectId: vstup.caflouProjectId,
        nazev: vstup.nazev.trim() || soubor.nazev,
        autor: vstup.autor?.trim() || null,
        delkaS: Math.max(0, Math.round(vstup.delkaS ?? 0)),
        obalKlic: vstup.obalKlic || null,
        // Prohlížeč štítky přečetl při vkládání - znovu se do souboru nekouká.
        metadataCtenaAt: new Date(),
        poznamka: vstup.poznamka?.trim() || null,
        usekOd: vstup.usekOd ?? null,
        usekDo: vstup.usekDo ?? null,
        puvod: vstup.puvod ?? 'my',
        vlozilKlient: vstup.vlozilKlient?.trim() || null,
        cesta: soubor.cesta,
        dropboxId: soubor.id,
        velikost: soubor.velikost,
        pridalId: vstup.pridalId,
      },
      select: VYBER,
    })
    .catch((err) => {
      console.error('Skladbu se nepodařilo zapsat:', err);
      return null;
    });
  if (!zaznam) return null;

  // Jakmile projekt hudbu má, upozornění „chybí hudba" nemá o čem zvonit -
  // a kdyby se hudba zase odebrala, značka se vyprázdní a zvonek se vrátí.
  await oznacUpozorneni(vstup.caflouProjectId, null);
  return naSkladbu(zaznam as RadekZDatabaze);
}

/**
 * PŘEPSAT JDE JEN POZNÁMKA A OZNAČENÝ ÚSEK (zadání 17. 10. 2026). Název
 * a autor pocházejí z metadat souboru a přepsat je by znamenalo, že v kartě
 * svítí něco jiného než v souboru, který se pustí do knihy.
 *
 * Úsek je POZNÁMKA PRO STŘIH, ne ořez souboru - v Dropboxu zůstává celá
 * skladba. Prázdný úsek znamená „použít celou".
 */
export async function upravSkladbu(
  id: string,
  zmena: { poznamka?: string | null; usekOd?: number | null; usekDo?: number | null },
): Promise<boolean> {
  try {
    await prisma.hudbaProjektu.update({
      where: { id },
      data: {
        ...(zmena.poznamka !== undefined ? { poznamka: zmena.poznamka?.trim() || null } : {}),
        ...(zmena.usekOd !== undefined ? { usekOd: zmena.usekOd } : {}),
        ...(zmena.usekDo !== undefined ? { usekDo: zmena.usekDo } : {}),
      },
    });
    return true;
  } catch (err) {
    console.error('Skladbu se nepodařilo upravit:', err);
    return false;
  }
}

/** Stará cesta, kterou používá veřejná stránka klienta - jen poznámka. */
export async function upravPoznamku(id: string, poznamka: string | null): Promise<boolean> {
  return upravSkladbu(id, { poznamka });
}

/**
 * ODPOJENÍ, NE SMAZÁNÍ. Záznam z karty zmizí, soubor v Dropboxu zůstává.
 * Mazat cizí data z portálu je past: hudební knihovna je společná a jedno
 * zbrklé kliknutí by vzalo soubor i projektům, které ho používají taky.
 */
export async function odpojSkladbu(id: string): Promise<boolean> {
  try {
    const zaznam = (await prisma.hudbaProjektu.delete({
      where: { id },
      select: { caflouProjectId: true },
    })) as { caflouProjectId: string };
    // Projekt může zůstat bez hudby - ať se o tom zase ozve upozornění.
    await oznacUpozorneni(zaznam.caflouProjectId, null);
    return true;
  } catch (err) {
    console.error('Skladbu se nepodařilo odpojit:', err);
    return false;
  }
}

/**
 * Kde skladba leží - projekt a cesta souboru v Dropboxu. Čte se těsně PŘED
 * odpojením: po smazání řádku už není odkud vzít, co se má odebrat i ostatním
 * dílům série (17. 10. 2026).
 */
export async function kdeSkladbaLezi(
  id: string,
): Promise<{ caflouProjectId: string; cesta: string } | null> {
  const zaznam = await prisma.hudbaProjektu
    .findUnique({ where: { id }, select: { caflouProjectId: true, cesta: true } })
    .catch(() => null);
  return (zaznam as { caflouProjectId: string; cesta: string } | null) ?? null;
}

/** Adresa na přehrání jedné skladby; platí čtyři hodiny. */
export async function odkazNaSkladbu(id: string): Promise<string | null> {
  const zaznam = await prisma.hudbaProjektu
    .findUnique({ where: { id }, select: { cesta: true } })
    .catch(() => null);
  if (!zaznam) return null;
  return odkazNaPrehrani((zaznam as { cesta: string }).cesta);
}

/** Klíč obalu v úložišti - podle něj se podepíše adresa na obrázek. */
export async function obalSkladby(id: string): Promise<string | null> {
  const zaznam = await prisma.hudbaProjektu
    .findUnique({ where: { id }, select: { obalKlic: true } })
    .catch(() => null);
  return (zaznam as { obalKlic: string | null } | null)?.obalKlic ?? null;
}

/** Značka „už jsme upozornili, že chybí hudba" - viz cron hudba-pripominky. */
export async function oznacUpozorneni(caflouProjectId: string, kdy: Date | null): Promise<void> {
  try {
    await prisma.projectMeta.update({
      where: { caflouProjectId },
      data: { hudbaUpozornenoAt: kdy },
    });
  } catch {
    // Projekt bez vlastního řádku v ProjectMeta nebo závod dvou zápisů -
    // značka je jen prevence opakovaného zvonění, ne nic, kvůli čemu by
    // měla spadnout celá akce.
  }
}
