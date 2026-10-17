import { prisma } from '@/lib/db';
import { firmaDodavaHudbu, vyzvaPujdeSama } from '@/lib/hudbaOdKlienta';
import { jeReklamaPodleMeta, nactiCiselnikReklam } from '@/lib/reklamniProjektServer';
import { stavJeDokonceny } from '@/lib/stavyProjektu';

/**
 * HUDBA K AUDIOKNIHÁM - PODKLADY PRO STRÁNKU (zadání 17. 10. 2026: „ještě
 * bychom měli dát někde samostatnou stránku hudba-audioknihy, kde budeme
 * spravovat databázi").
 *
 * Tři pohledy na jednu věc: co všechno jsme kdy použili (Databáze), co se
 * používá v celé sérii (Série) a kde hudba zatím chybí, i když se blíží
 * natáčení (Chybí hudba).
 */

export type RadekKnihovny = {
  /** Cesta v Dropboxu - podle ní se pozná, že jde o tentýž soubor. */
  cesta: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  velikost: number;
  /** Id jednoho ze záznamů - podle něj se skladba přehraje a vezme obal. */
  ukazkaId: string;
  /** Adresa, na které se dá ta ukázka přehrát (liší se u projektu a u série). */
  odkazPolozky: string;
  /** Adresa obalu. */
  odkazObalu: string;
  maObal: boolean;
  /** Kde všude se používá. */
  projekty: { id: string; nazev: string }[];
  serie: string[];
};

/**
 * KNIHOVNA = CO UŽ JSME NĚKDY POUŽILI. Není to samostatná tabulka: skladba
 * vzniká vždycky u projektu nebo u série a knihovna je pohled přes obojí.
 * Vlastní tabulka by znamenala třetí místo, kde může záznam chybět nebo
 * přebývat - a soubor v Dropboxu je stejně jeden, ať se na něj odkazuje
 * odkudkoliv. Slučuje se podle CESTY k souboru, ne podle názvu: dvě různé
 * skladby se můžou jmenovat stejně a jeden soubor může mít v různých dílech
 * jinou poznámku.
 */
export async function nactiKnihovnu(): Promise<RadekKnihovny[]> {
  const [uProjektu, uSerii] = await Promise.all([
    prisma.hudbaProjektu
      .findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          caflouProjectId: true,
          nazev: true,
          autor: true,
          delkaS: true,
          velikost: true,
          cesta: true,
          obalKlic: true,
        },
      })
      .catch(() => []),
    prisma.hudbaSerie
      .findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          serie: true,
          nazev: true,
          autor: true,
          delkaS: true,
          velikost: true,
          cesta: true,
          obalKlic: true,
        },
      })
      .catch(() => []),
  ]);

  const projekty = uProjektu as {
    id: string;
    caflouProjectId: string;
    nazev: string;
    autor: string | null;
    delkaS: number;
    velikost: number;
    cesta: string;
    obalKlic: string | null;
  }[];
  const serie = uSerii as {
    id: string;
    serie: string;
    nazev: string;
    autor: string | null;
    delkaS: number;
    velikost: number;
    cesta: string;
    obalKlic: string | null;
  }[];

  // Názvy projektů jedním dotazem - bez toho by to byl dotaz na každou skladbu.
  const idProjektu = [...new Set(projekty.map((r) => r.caflouProjectId))];
  const nazvy = new Map<string, string>();
  if (idProjektu.length > 0) {
    const meta = (await prisma.projectMeta
      .findMany({
        where: { caflouProjectId: { in: idProjektu } },
        select: { caflouProjectId: true, name: true },
      })
      .catch(() => [])) as { caflouProjectId: string; name: string | null }[];
    for (const m of meta) nazvy.set(m.caflouProjectId, m.name || m.caflouProjectId);
  }

  const mapa = new Map<string, RadekKnihovny>();
  function zalozNeboVrat(
    zdroj: {
      id: string;
      nazev: string;
      autor: string | null;
      delkaS: number;
      velikost: number;
      cesta: string;
      obalKlic: string | null;
    },
    odkazy: { polozka: string; obal: string },
  ): RadekKnihovny {
    const uz = mapa.get(zdroj.cesta);
    if (uz) {
      // Obal i délka se berou z prvního záznamu, který je má - starší řádky
      // vznikly dřív, než se metadata četla.
      if (!uz.maObal && zdroj.obalKlic) {
        uz.maObal = true;
        uz.ukazkaId = zdroj.id;
        uz.odkazPolozky = odkazy.polozka;
        uz.odkazObalu = odkazy.obal;
      }
      if (!uz.delkaS && zdroj.delkaS) uz.delkaS = zdroj.delkaS;
      if (!uz.autor && zdroj.autor) uz.autor = zdroj.autor;
      return uz;
    }
    const novy: RadekKnihovny = {
      cesta: zdroj.cesta,
      nazev: zdroj.nazev,
      autor: zdroj.autor,
      delkaS: zdroj.delkaS,
      velikost: zdroj.velikost,
      ukazkaId: zdroj.id,
      odkazPolozky: odkazy.polozka,
      odkazObalu: odkazy.obal,
      maObal: Boolean(zdroj.obalKlic),
      projekty: [],
      serie: [],
    };
    mapa.set(zdroj.cesta, novy);
    return novy;
  }

  for (const r of projekty) {
    const radek = zalozNeboVrat(r, {
      polozka: `/api/projekty/${encodeURIComponent(r.caflouProjectId)}/hudba/${r.id}`,
      obal: `/api/projekty/${encodeURIComponent(r.caflouProjectId)}/hudba/${r.id}/obal`,
    });
    if (!radek.projekty.some((p) => p.id === r.caflouProjectId)) {
      radek.projekty.push({
        id: r.caflouProjectId,
        nazev: nazvy.get(r.caflouProjectId) ?? r.caflouProjectId,
      });
    }
  }
  for (const r of serie) {
    const radek = zalozNeboVrat(r, {
      polozka: `/api/hudba-serie/${r.id}`,
      obal: `/api/hudba-serie/${r.id}/obal`,
    });
    if (!radek.serie.includes(r.serie)) radek.serie.push(r.serie);
  }

  return [...mapa.values()].sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
}

export type ProjektBezHudby = {
  id: string;
  nazev: string;
  firma: string | null;
  serie: string | null;
  /** První natáčecí den, nebo prázdno, když ještě není naplánovaný. */
  prvniFrekvence: string | null;
  /** Kolik dní do něj zbývá; záporné číslo = už začalo. */
  zaDni: number | null;
  /** Hudbu u téhle firmy dodává klient. */
  hudbuDodavaKlient: boolean;
  /**
   * Odejde výzva sama? U projektů starších než zaškrtnutí u firmy ne - tam
   * se musí poslat ručně (17. 10. 2026).
   */
  vyzvaPujdeSama: boolean;
  /** Stav výzvy klientovi, když nějaká je. */
  vyzva: { odeslanoAt: string | null; vlozenoAt: string | null } | null;
};

/**
 * PRVNÍ FREKVENCE = nejbližší natáčecí den projektu. Bere se ze dvou míst,
 * protože termín může vzniknout dvěma cestami: blokem v kalendáři studia
 * a potvrzeným termínem z nabídky herci.
 */
export async function prvniFrekvence(idProjektu: string[]): Promise<Map<string, Date>> {
  if (idProjektu.length === 0) return new Map();
  const [bloky, sloty] = await Promise.all([
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI' as never, caflouProjectId: { in: idProjektu } },
        select: { caflouProjectId: true, start: true },
      })
      .catch(() => []),
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          request: { caflouProjectId: { in: idProjektu } },
        },
        select: { start: true, request: { select: { caflouProjectId: true } } },
      })
      .catch(() => []),
  ]);

  const nejdriv = new Map<string, Date>();
  function zapis(id: string | null | undefined, kdy: Date | null | undefined) {
    if (!id || !kdy) return;
    const uz = nejdriv.get(id);
    if (!uz || kdy < uz) nejdriv.set(id, kdy);
  }
  for (const b of bloky as { caflouProjectId: string | null; start: Date }[]) {
    zapis(b.caflouProjectId, b.start);
  }
  for (const s of sloty as { start: Date; request: { caflouProjectId: string | null } }[]) {
    zapis(s.request?.caflouProjectId, s.start);
  }
  return nejdriv;
}

/**
 * AUDIOKNIHY, KTERÉ JEŠTĚ NEMAJÍ HUDBU.
 *
 * Reklamy se vynechávají (zadání 17. 10. 2026: „nastavme jen u audioknih") -
 * u spotu se hudba vede v Rodném listu, ne tady. Dokončené projekty taky:
 * doplňovat hudbu do hotové knihy nemá smysl.
 */
export async function projektyBezHudby(): Promise<ProjektBezHudby[]> {
  const ciselnik = await nactiCiselnikReklam();

  const meta = (await prisma.projectMeta
    .findMany({
      where: { finished: false },
      orderBy: { name: 'asc' },
      select: {
        caflouProjectId: true,
        name: true,
        serie: true,
        statusName: true,
        projectType: true,
        companyName: true,
        createdAt: true,
        company: {
          select: {
            name: true,
            dealsAds: true,
            dealsAudiobooks: true,
            hudbuDodavaKlient: true,
            // Od kdy to u firmy platí - zpětně se výzvy neposílají
            // (17. 10. 2026), viz lib/hudbaOdKlienta.ts.
            hudbaKlientOd: true,
          },
        },
      },
    })
    .catch(() => [])) as {
    caflouProjectId: string;
    name: string | null;
    serie: string | null;
    statusName: string | null;
    projectType: string | null;
    companyName: string | null;
    createdAt: Date;
    company: {
      name: string;
      dealsAds: boolean;
      dealsAudiobooks: boolean;
      hudbuDodavaKlient: boolean;
      hudbaKlientOd: Date | null;
    } | null;
  }[];

  const audioknihy = meta.filter(
    (m) => !jeReklamaPodleMeta(m, ciselnik) && stavJeDokonceny(m.statusName) !== true,
  );
  if (audioknihy.length === 0) return [];

  const ids = audioknihy.map((m) => m.caflouProjectId);
  const [sHudbou, terminy, vyzvy] = await Promise.all([
    prisma.hudbaProjektu
      .findMany({ where: { caflouProjectId: { in: ids } }, select: { caflouProjectId: true } })
      .catch(() => []),
    prvniFrekvence(ids),
    prisma.vyzvaHudba
      .findMany({
        where: { caflouProjectId: { in: ids } },
        select: { caflouProjectId: true, odeslanoAt: true, vlozenoAt: true },
      })
      .catch(() => []),
  ]);

  const maHudbu = new Set(
    (sHudbou as { caflouProjectId: string }[]).map((r) => r.caflouProjectId),
  );
  const vyzvaPodleId = new Map(
    (vyzvy as { caflouProjectId: string; odeslanoAt: Date | null; vlozenoAt: Date | null }[]).map(
      (v) => [v.caflouProjectId, v],
    ),
  );

  const dnesek = new Date();
  return audioknihy
    .filter((m) => !maHudbu.has(m.caflouProjectId))
    .map((m) => {
      const kdy = terminy.get(m.caflouProjectId) ?? null;
      const vyzva = vyzvaPodleId.get(m.caflouProjectId) ?? null;
      return {
        id: m.caflouProjectId,
        nazev: m.name || m.caflouProjectId,
        firma: m.company?.name ?? m.companyName ?? null,
        serie: m.serie,
        prvniFrekvence: kdy ? kdy.toISOString() : null,
        zaDni: kdy ? dniDo(dnesek, kdy) : null,
        hudbuDodavaKlient: firmaDodavaHudbu(m.company),
        vyzvaPujdeSama: vyzvaPujdeSama(m.company, m.createdAt),
        vyzva: vyzva
          ? {
              odeslanoAt: vyzva.odeslanoAt ? vyzva.odeslanoAt.toISOString() : null,
              vlozenoAt: vyzva.vlozenoAt ? vyzva.vlozenoAt.toISOString() : null,
            }
          : null,
      };
    })
    .sort((a, b) => {
      // Napřed to, co hoří; projekty bez termínu až za tím.
      if (a.zaDni === null && b.zaDni === null) return a.nazev.localeCompare(b.nazev, 'cs');
      if (a.zaDni === null) return 1;
      if (b.zaDni === null) return -1;
      return a.zaDni - b.zaDni;
    });
}

/** Počet celých dní mezi dvěma dny, bez ohledu na hodiny. */
export function dniDo(odkdy: Date, dokdy: Date): number {
  const a = Date.UTC(odkdy.getFullYear(), odkdy.getMonth(), odkdy.getDate());
  const b = Date.UTC(dokdy.getFullYear(), dokdy.getMonth(), dokdy.getDate());
  return Math.round((b - a) / 86400000);
}
