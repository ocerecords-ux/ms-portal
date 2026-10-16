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
 * HUDBA VYBRANÁ PRO PROJEKT (zadání 16. 10. 2026).
 *
 * Soubor leží v Dropboxu, databáze drží jen záznam o něm. Portál se souboru
 * nikdy nedotkne - jen vyrobí adresu, na kterou ho prohlížeč pošle, a potom
 * ověří, že tam opravdu je.
 */

export type SkladbaProjektu = {
  id: string;
  nazev: string;
  zdroj: string | null;
  poznamka: string | null;
  cesta: string;
  velikost: number;
  pridal: string | null;
  kdy: string;
};

/** Složka projektu: `<kořen>/<rok>/<název projektu>`. */
export function slozkaProjektu(nazevProjektu: string, kdy: Date = new Date()): string {
  return `${korenHudby()}/${kdy.getFullYear()}/${bezpecnyNazev(nazevProjektu || 'Projekt')}`;
}

export async function nactiHudbu(caflouProjectId: string): Promise<SkladbaProjektu[]> {
  const radky = await prisma.hudbaProjektu
    .findMany({
      where: { caflouProjectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nazev: true,
        zdroj: true,
        poznamka: true,
        cesta: true,
        velikost: true,
        createdAt: true,
        pridal: { select: { name: true, email: true } },
      },
    })
    .catch((err) => {
      console.error('Hudbu projektu se nepodařilo načíst:', err);
      return [];
    });

  return (radky as {
    id: string;
    nazev: string;
    zdroj: string | null;
    poznamka: string | null;
    cesta: string;
    velikost: number;
    createdAt: Date;
    pridal: { name: string | null; email: string } | null;
  }[]).map((r) => ({
    id: r.id,
    nazev: r.nazev,
    zdroj: r.zdroj,
    poznamka: r.poznamka,
    cesta: r.cesta,
    velikost: r.velikost,
    pridal: r.pridal ? r.pridal.name || r.pridal.email : null,
    kdy: r.createdAt.toISOString(),
  }));
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
}): Promise<{ odkaz: string; cesta: string } | null> {
  const slozka = slozkaProjektu(vstup.nazevProjektu);
  await zalozSlozku(slozka);
  const cesta = `${slozka}/${bezpecnyNazev(vstup.nazevSouboru)}`;
  const odkaz = await odkazNaNahrani(cesta);
  return odkaz ? { odkaz, cesta } : null;
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
  zdroj?: string | null;
  poznamka?: string | null;
  pridalId: string | null;
}): Promise<SkladbaProjektu | null> {
  const soubor = await metadataSouboru(vstup.cesta);
  if (!soubor) return null;

  const zaznam = await prisma.hudbaProjektu
    .create({
      data: {
        caflouProjectId: vstup.caflouProjectId,
        nazev: vstup.nazev.trim() || soubor.nazev,
        zdroj: vstup.zdroj?.trim() || null,
        poznamka: vstup.poznamka?.trim() || null,
        cesta: soubor.cesta,
        dropboxId: soubor.id,
        velikost: soubor.velikost,
        pridalId: vstup.pridalId,
      },
      select: {
        id: true,
        nazev: true,
        zdroj: true,
        poznamka: true,
        cesta: true,
        velikost: true,
        createdAt: true,
        pridal: { select: { name: true, email: true } },
      },
    })
    .catch((err) => {
      console.error('Skladbu se nepodařilo zapsat:', err);
      return null;
    });
  if (!zaznam) return null;

  const r = zaznam as {
    id: string;
    nazev: string;
    zdroj: string | null;
    poznamka: string | null;
    cesta: string;
    velikost: number;
    createdAt: Date;
    pridal: { name: string | null; email: string } | null;
  };
  return {
    id: r.id,
    nazev: r.nazev,
    zdroj: r.zdroj,
    poznamka: r.poznamka,
    cesta: r.cesta,
    velikost: r.velikost,
    pridal: r.pridal ? r.pridal.name || r.pridal.email : null,
    kdy: r.createdAt.toISOString(),
  };
}

export async function upravSkladbu(
  id: string,
  zmena: { nazev?: string; zdroj?: string | null; poznamka?: string | null },
): Promise<boolean> {
  try {
    await prisma.hudbaProjektu.update({
      where: { id },
      data: {
        ...(zmena.nazev !== undefined ? { nazev: zmena.nazev.trim() || 'Bez názvu' } : {}),
        ...(zmena.zdroj !== undefined ? { zdroj: zmena.zdroj?.trim() || null } : {}),
        ...(zmena.poznamka !== undefined ? { poznamka: zmena.poznamka?.trim() || null } : {}),
      },
    });
    return true;
  } catch (err) {
    console.error('Skladbu se nepodařilo upravit:', err);
    return false;
  }
}

/**
 * ODPOJENÍ, NE SMAZÁNÍ. Záznam z karty zmizí, soubor v Dropboxu zůstává.
 * Mazat cizí data z portálu je past: hudební knihovna je společná a jedno
 * zbrklé kliknutí by vzalo soubor i projektům, které ho používají taky.
 */
export async function odpojSkladbu(id: string): Promise<boolean> {
  try {
    await prisma.hudbaProjektu.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error('Skladbu se nepodařilo odpojit:', err);
    return false;
  }
}

/** Adresa na přehrání jedné skladby; platí čtyři hodiny. */
export async function odkazNaSkladbu(id: string): Promise<string | null> {
  const zaznam = await prisma.hudbaProjektu
    .findUnique({ where: { id }, select: { cesta: true } })
    .catch(() => null);
  if (!zaznam) return null;
  return odkazNaPrehrani((zaznam as { cesta: string }).cesta);
}
