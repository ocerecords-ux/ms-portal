import { prisma } from '@/lib/db';
import {
  DRIVE_WRITE_SCOPE,
  extractDriveFolderId,
  getAccessToken,
  hledejNaDisku,
  rodiceNaDisku,
  zkopirujNaDisku,
  type SouborNaDisku,
} from '@/lib/googleDrive';

/**
 * ZÁLOHA TEXTŮ _RE (zadání 22. 9. 2026: „když se ve složce projektu vytvoří
 * PDF s _RE, musí se duplikovat a udělat záloha textu do složky […] Zároveň
 * musíme hlídat duplicity").
 *
 * Pouští to cron každou čtvrthodinu (viz vercel.json → /api/cron/zaloha-textu):
 *
 * 1. Najde na Disku PDF změněná za poslední dva dny, v jejichž názvu je
 *    „_RE" (velikost písmen nerozhoduje, „_REŽIE" ani „_RECEPT" se nepočítá).
 * 2. Nechá jen ta, která leží ve složce projektu z portálu (nebo o patro níž).
 * 3. Zkopíruje je do zálohové složky.
 *
 * DUPLICITY: podle otisku obsahu (md5 z Disku). Stejný obsah, který už
 * v zálohové složce je - ať pod jakýmkoli názvem - se nekopíruje. Když se
 * v projektu PDF přepíše novou verzí, obsah je jiný, a záloha vznikne znovu;
 * při shodném názvu dostane kopie za název datum, ať se verze nepřepíšou.
 * Každé rozhodnutí se zapíše do ZalohaTextu, takže se dvakrát nekopíruje ani
 * mezi běhy.
 */

/** Zálohová složka (odkaz od Ondřeje z 22. 9. 2026). Dá se přepsat v env. */
const ZALOHOVA_SLOZKA =
  process.env.ZALOHA_TEXTU_SLOZKA_ID?.trim() || '1X8B347t2DS5yUV-KkpUaN62OpYVQlga_';

/** Jak daleko do minulosti se při každém běhu dívá. Zápisy v DB hlídají opakování. */
const OKNO_HODIN = 48;

/** „_RE" jako samostatná značka: za ní konec, tečka, mezera, podtržítko, pomlčka nebo číslo. */
export function jeTextRE(nazev: string): boolean {
  const bezPripony = nazev.replace(/\.pdf$/i, '');
  return /_RE(?=$|[\s._\-()\d])/i.test(bezPripony);
}

function nazevSDatem(nazev: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return /\.pdf$/i.test(nazev) ? nazev.replace(/\.pdf$/i, ` (${d}).pdf`) : `${nazev} (${d})`;
}

export type VysledekZalohy = {
  nalezeno: number;
  zalohovano: string[];
  duplicity: number;
  chyby: string[];
};

export async function zalohujTextyRE(): Promise<VysledekZalohy> {
  const vysledek: VysledekZalohy = { nalezeno: 0, zalohovano: [], duplicity: 0, chyby: [] };

  const token = await getAccessToken(DRIVE_WRITE_SCOPE);
  if (!token) {
    vysledek.chyby.push('Portál se nepřihlásil ke Google Disku.');
    return vysledek;
  }

  // Složky projektů z portálu.
  const projekty = await prisma.projectMeta.findMany({
    where: { driveUrl: { not: null } },
    select: { driveUrl: true },
  });
  const slozkyProjektu = new Set(
    projekty.map((p) => (p.driveUrl ? extractDriveFolderId(p.driveUrl) : null)).filter((x): x is string => Boolean(x)),
  );
  if (slozkyProjektu.size === 0) return vysledek;

  const od = new Date(Date.now() - OKNO_HODIN * 3600_000).toISOString();
  const kandidati = (
    await hledejNaDisku(
      `mimeType = 'application/pdf' and trashed = false and modifiedTime > '${od}'`,
      token,
    )
  ).filter((f) => jeTextRE(f.name) && !f.parents.includes(ZALOHOVA_SLOZKA));

  // Jen soubory ve složce projektu, nebo o patro níž (podsložka „Texty" apod.).
  const rodiceCache = new Map<string, string[]>();
  const vProjektu: SouborNaDisku[] = [];
  for (const f of kandidati) {
    if (f.parents.some((p) => slozkyProjektu.has(p))) {
      vProjektu.push(f);
      continue;
    }
    let nalezen = false;
    for (const rodic of f.parents) {
      if (!rodiceCache.has(rodic)) rodiceCache.set(rodic, await rodiceNaDisku(rodic, token));
      if ((rodiceCache.get(rodic) ?? []).some((p) => slozkyProjektu.has(p))) nalezen = true;
    }
    if (nalezen) vProjektu.push(f);
  }
  vysledek.nalezeno = vProjektu.length;
  if (vProjektu.length === 0) return vysledek;

  // Co už v zálohové složce leží (obsah i názvy).
  const vZaloze = await hledejNaDisku(`'${ZALOHOVA_SLOZKA}' in parents and trashed = false`, token);
  const otiskyVZaloze = new Set(vZaloze.map((f) => f.md5Checksum).filter(Boolean) as string[]);
  const nazvyVZaloze = new Set(vZaloze.map((f) => f.name));

  for (const f of vProjektu) {
    const md5 = f.md5Checksum ?? `bez-otisku:${f.id}`;
    const uz = await prisma.zalohaTextu.findUnique({ where: { zdrojId_md5: { zdrojId: f.id, md5 } } });
    if (uz) continue;

    if (f.md5Checksum && otiskyVZaloze.has(f.md5Checksum)) {
      vysledek.duplicity += 1;
      await prisma.zalohaTextu
        .create({ data: { zdrojId: f.id, md5, nazev: f.name, poznamka: 'duplicita' } })
        .catch(() => undefined);
      continue;
    }

    const nazev = nazvyVZaloze.has(f.name) ? nazevSDatem(f.name) : f.name;
    const kopie = await zkopirujNaDisku(f.id, ZALOHOVA_SLOZKA, nazev, token);
    if (!kopie.ok) {
      vysledek.chyby.push(`${f.name}: ${kopie.duvod}`);
      continue;
    }
    await prisma.zalohaTextu
      .create({ data: { zdrojId: f.id, md5, kopieId: kopie.id, nazev } })
      .catch(() => undefined);
    if (f.md5Checksum) otiskyVZaloze.add(f.md5Checksum);
    nazvyVZaloze.add(nazev);
    vysledek.zalohovano.push(nazev);
  }

  return vysledek;
}
