import type { DruhUdalosti } from '@prisma/client';
import { prisma } from '@/lib/db';
import { POLE_S_UCTEM, POPISKY_POLI, citelnaHodnota } from '@/lib/projektLog';

/**
 * Zápis do historie projektu (zadání 10. 9. 2026).
 *
 * NIKDY NEVYHAZUJE. Historie je záznam o práci, ne ta práce sama - kdyby
 * uložení řádku shodilo uložení projektu nebo odeslání zprávy, byla by to ta
 * horší varianta. Chyba se jen zapíše do logu.
 */

export type Puvodce = {
  id: string | null;
  jmeno: string | null;
};

async function zapis(data: {
  caflouProjectId: string;
  druh: DruhUdalosti;
  pole?: string | null;
  popis: string;
  predchozi?: string | null;
  nova?: string | null;
  puvodce?: Puvodce;
}) {
  try {
    await prisma.projektUdalost.create({
      data: {
        caflouProjectId: data.caflouProjectId,
        druh: data.druh,
        pole: data.pole ?? null,
        popis: data.popis,
        predchozi: data.predchozi ?? null,
        nova: data.nova ?? null,
        uzivatelId: data.puvodce?.id ?? null,
        uzivatelJmeno: data.puvodce?.jmeno ?? null,
      },
    });
  } catch (err) {
    console.error('Zápis do historie projektu selhal:', err);
  }
}

/** Projekt vznikl - první řádek historie. */
export async function zapisZalozeniProjektu(
  caflouProjectId: string,
  nazev: string,
  puvodce: Puvodce,
) {
  await zapis({
    caflouProjectId,
    druh: 'ZALOZENO',
    popis: `Projekt „${nazev}" založen v portálu.`,
    puvodce,
  });
}

/**
 * Co do historie zapsal Bruno (zadání 12. 9. 2026).
 *
 * Vlastní druh záznamu schválně: v historii projektu má být na první pohled
 * poznat, co vyčetl asistent z chatu a co tam napsal člověk. Kdyby se to
 * slilo dohromady, nedalo by se Brunovi věřit ani kontrolovat.
 */
export async function zapisBrunoUdalost(vstup: {
  caflouProjectId: string;
  popis: string;
  nova?: string | null;
}) {
  await zapis({
    caflouProjectId: vstup.caflouProjectId,
    druh: 'BRUNO',
    popis: vstup.popis,
    nova: vstup.nova ?? null,
    puvodce: { id: null, jmeno: 'Bruno' },
  });
}

/**
 * Jména navázaných účtů, aby se do historie nedostalo holé ID. Klíč je název
 * pole (managerUserId, ...), hodnota to, co se má ukázat.
 */
export type CitelnaJmena = Partial<Record<string, string | null>>;

/**
 * Porovná, co v projektu bylo, s tím, co se právě uložilo, a na každou
 * skutečnou změnu zapíše jeden řádek.
 *
 * Záměrně se porovnává až proti uloženému záznamu: požadavek může poslat
 * i hodnotu, která se nezměnila (formulář posílá celou svou část), a takový
 * řádek by v historii jen překážel.
 */
export async function zapisZmenyProjektu(vstup: {
  caflouProjectId: string;
  /** Stav před uložením; null u projektu, který teprve vzniká. */
  pred: Record<string, unknown> | null;
  /** Co se ukládalo - podle klíčů se pozná, čeho se změna týkala. */
  ulozeno: Record<string, unknown>;
  /** Čitelné podoby hodnot PŘED změnou (jméno manažera apod.). */
  jmenaPred?: CitelnaJmena;
  /** Čitelné podoby hodnot PO změně. */
  jmenaPo?: CitelnaJmena;
  puvodce: Puvodce;
}) {
  const radky: {
    pole: string;
    popis: string;
    predchozi: string;
    nova: string;
  }[] = [];

  for (const [pole, novaHodnota] of Object.entries(vstup.ulozeno)) {
    const popisek = POPISKY_POLI[pole];
    if (!popisek) continue; // pole, ktere do historie nepatri (napr. companyName)

    const stara = vstup.pred ? vstup.pred[pole] : null;
    // Data porovnavame casem, ne referenci - dva ruzne objekty Date se stejnym
    // dnem jsou tataz hodnota a zadna zmena se nekonala.
    const stejne =
      stara instanceof Date && novaHodnota instanceof Date
        ? stara.getTime() === novaHodnota.getTime()
        : (stara ?? null) === (novaHodnota ?? null);
    if (stejne) continue;

    const predchozi = POLE_S_UCTEM.has(pole)
      ? vstup.jmenaPred?.[pole] || citelnaHodnota(pole, null)
      : citelnaHodnota(pole, stara);
    const nova = POLE_S_UCTEM.has(pole)
      ? vstup.jmenaPo?.[pole] || citelnaHodnota(pole, null)
      : citelnaHodnota(pole, novaHodnota);
    if (predchozi === nova) continue;

    radky.push({ pole, popis: `${popisek}: ${predchozi} → ${nova}`, predchozi, nova });
  }

  if (radky.length === 0) return;

  try {
    await prisma.projektUdalost.createMany({
      data: radky.map((r) => ({
        caflouProjectId: vstup.caflouProjectId,
        druh: 'ZMENA' as DruhUdalosti,
        pole: r.pole,
        popis: r.popis,
        predchozi: r.predchozi,
        nova: r.nova,
        uzivatelId: vstup.puvodce.id,
        uzivatelJmeno: vstup.puvodce.jmeno,
      })),
    });
  } catch (err) {
    console.error('Zápis změn do historie projektu selhal:', err);
  }
}

/**
 * Zpráva o stavu projektu - odeslaná i neodeslaná.
 *
 * Neodeslané se zapisují schválně: „proč tomu klientovi nic nepřišlo" je
 * přesně ta otázka, kvůli které historie vzniká.
 */
export async function zapisNotifikaci(vstup: {
  caflouProjectId: string;
  stav: string;
  popis: string;
  prijemci?: string[];
}) {
  await zapis({
    caflouProjectId: vstup.caflouProjectId,
    druh: 'NOTIFIKACE',
    popis: vstup.popis,
    nova: vstup.prijemci?.length ? vstup.prijemci.join(', ') : null,
    predchozi: vstup.stav,
  });
}

/** Historie projektu od nejnovější. Bere se posledních 200 řádků. */
export async function nactiHistoriiProjektu(caflouProjectId: string) {
  try {
    return await prisma.projektUdalost.findMany({
      where: { caflouProjectId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  } catch (err) {
    console.error('Načtení historie projektu selhalo:', err);
    return [];
  }
}
