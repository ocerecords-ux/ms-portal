import { prisma } from '@/lib/db';
import { caflouConfigured, caflouFetch, mapOneCaflouProject } from '@/lib/caflou';

/**
 * Jednorázový přenos projektů z Caflou do portálu (zadání 10. 9. 2026:
 * "chci v jednu chvíli propojení zrušit, ale aby nám ta data o projektech
 * zůstala").
 *
 * PROČ TO TAKHLE
 * Doklady, výkazy, rozpočty i rodné listy si projekt drží jako textové ID
 * (caflouProjectId) - žádný databázový vztah tam není. Když si tedy to ID
 * podržíme i po odpojení Caflou, nerozbije se ani jedna z těch vazeb. Přenos
 * proto NEPŘEČÍSLOVÁVÁ; jen k existujícím ID doplní data, která se do teď
 * četla při každém zobrazení z Caflou.
 *
 * Přenos se dá pustit opakovaně. Vlastní atributy zadané v portálu (manažer,
 * priorita, odkaz na složku, rodný list) se NIKDY nepřepisují - přenášejí se
 * jen údaje z Caflou, a to jen u projektů, které z Caflou pocházejí. Projekt
 * založený v portálu už žádný přenos nesmí přepsat.
 */

/** Kolik projektů si vyžádat najednou. Caflou dá nejvýš sto na stránku. */
const NA_STRANKU = 100;
/** Pojistka proti nekonečnu, kdyby Caflou vracelo pořád dokola totéž. */
const MAX_STRANEK = 20;

export type VysledekPrenosu = {
  precteno: number;
  zalozeno: number;
  aktualizovano: number;
  preskoceno: number;
  /** Projekty, ke kterým se nepodařilo dohledat firmu v portálu. */
  bezFirmy: string[];
  chyba: string | null;
};

function text(hodnota: unknown, maxDelka = 300): string | null {
  if (typeof hodnota !== 'string') return null;
  const o = hodnota.trim();
  return o ? o.slice(0, maxDelka) : null;
}

/**
 * Přenese projekty z Caflou.
 *
 * Nic nemaže. Projekt, který v Caflou mezitím zmizel, v portálu zůstane -
 * visí na něm doklady a smazat ho kvůli přenosu by byla ta horší varianta.
 */
export async function prenesProjektyZCaflou(): Promise<VysledekPrenosu> {
  const vysledek: VysledekPrenosu = {
    precteno: 0,
    zalozeno: 0,
    aktualizovano: 0,
    preskoceno: 0,
    bezFirmy: [],
    chyba: null,
  };

  if (!caflouConfigured()) {
    vysledek.chyba = 'Caflou API není nastavené (chybí CAFLOU_API_KEY nebo CAFLOU_ACCOUNT_ID).';
    return vysledek;
  }

  // Firmy si načteme jednou dopředu - projekt z Caflou nese jen ID firmy.
  const firmy = await prisma.company.findMany({
    where: { caflouCompanyId: { not: null } },
    select: { id: true, name: true, caflouCompanyId: true },
  });
  const firmaPodleCaflou = new Map(firmy.map((f) => [String(f.caflouCompanyId), f]));

  // Co už v portálu je - ať poznáme, co se zakládá a co jen doplňuje, a ať
  // nesáhneme na projekty založené přímo v portálu.
  const stavajici = await prisma.projectMeta.findMany({
    select: { caflouProjectId: true, zdroj: true },
  });
  const zdrojPodleId = new Map(stavajici.map((s) => [s.caflouProjectId, s.zdroj]));

  try {
    for (let stranka = 1; stranka <= MAX_STRANEK; stranka += 1) {
      const odpoved = await caflouFetch(`/projects?per=${NA_STRANKU}&page=${stranka}`);
      const radky = (odpoved.body as { results?: unknown } | null)?.results;
      if (!odpoved.ok) {
        vysledek.chyba = `Caflou odpovědělo chybou ${odpoved.status}. Přeneseno bylo, co se stihlo.`;
        break;
      }
      if (!Array.isArray(radky) || radky.length === 0) break;

      for (const radek of radky as Record<string, unknown>[]) {
        vysledek.precteno += 1;

        const caflouProjectId = String(radek.id ?? '').trim();
        if (!caflouProjectId) {
          vysledek.preskoceno += 1;
          continue;
        }

        // Projekt založený v portálu se z Caflou přepisovat nesmí - v portálu
        // je pravda, ne v systému, který opouštíme.
        if (zdrojPodleId.get(caflouProjectId) === 'PORTAL') {
          vysledek.preskoceno += 1;
          continue;
        }

        // Mapování názvu, stavu, priority, normostran a herce má portál už
        // hotové - používá se při každém zobrazení, takže je odladěné.
        const p = mapOneCaflouProject(radek);
        const caflouCompanyId = radek.company_id === null || radek.company_id === undefined
          ? null
          : String(radek.company_id);
        const firma = caflouCompanyId ? firmaPodleCaflou.get(caflouCompanyId) : undefined;
        const nazevFirmy = firma?.name ?? text(radek.company_name, 200);

        if (!firma && p.name) vysledek.bezFirmy.push(p.name);

        const data = {
          name: p.name || null,
          companyId: firma?.id ?? null,
          companyName: nazevFirmy,
          statusName: p.statusName || null,
          finished: p.finished,
          pageCount: p.pageCount,
          narrator: p.narrator,
          releaseDate: p.releaseDate,
          startDate: p.startDate,
          endDate: p.endDate,
          popis: text(radek.description, 5000),
          zdroj: 'CAFLOU' as const,
          prenesenoAt: new Date(),
        };

        if (zdrojPodleId.has(caflouProjectId)) {
          // Vlastní atributy z portálu (manažer, priorita, odkaz na složku,
          // rodný list) se nechávají být - píšeme jen sloupce z `data`.
          await prisma.projectMeta.update({ where: { caflouProjectId }, data });
          vysledek.aktualizovano += 1;
        } else {
          await prisma.projectMeta.create({
            data: { caflouProjectId, ...data, priority: p.priority ?? undefined },
          });
          vysledek.zalozeno += 1;
        }
        zdrojPodleId.set(caflouProjectId, 'CAFLOU');
      }

      if ((radky as unknown[]).length < NA_STRANKU) break;
    }
  } catch (err) {
    vysledek.chyba = err instanceof Error ? err.message : 'Přenos se nepodařilo dokončit.';
  }

  // Ať se seznam nezvrhne v tisícovku jmen - stačí ukázat, že se to děje.
  vysledek.bezFirmy = [...new Set(vysledek.bezFirmy)].slice(0, 30);
  return vysledek;
}

/** Kolik projektů portál drží a odkud pocházejí - pro kontrolu po přenosu. */
export async function prehledProjektu(): Promise<{
  celkem: number;
  zCaflou: number;
  zPortalu: number;
  rozpracovane: number;
  bezNazvu: number;
}> {
  const [celkem, zCaflou, zPortalu, rozpracovane, bezNazvu] = await Promise.all([
    prisma.projectMeta.count(),
    prisma.projectMeta.count({ where: { zdroj: 'CAFLOU' } }),
    prisma.projectMeta.count({ where: { zdroj: 'PORTAL' } }),
    prisma.projectMeta.count({ where: { finished: false } }),
    prisma.projectMeta.count({ where: { name: null } }),
  ]);
  return { celkem, zCaflou, zPortalu, rozpracovane, bezNazvu };
}
