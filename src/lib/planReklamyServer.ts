import { prisma } from '@/lib/db';
import { zapisZmenyProjektu } from '@/lib/projektLogServer';
import { posliNotifikaciPoProdleve } from '@/lib/prodlevaNotifikaciServer';
import { zalozKanalProjektu } from '@/lib/kanalProjektuServer';
import { jeReklamaPodleMeta, nactiCiselnikReklam, type CiselnikReklam } from '@/lib/reklamniProjektServer';
import { STAV_NATACIME } from '@/lib/zacatekNataceniServer';

/**
 * REKLAMA SE PŘEKLOPÍ NA „NATÁČÍME", JAK JE NAPLÁNOVÁNO (zadání 9. 10. 2026:
 * „projekty - reklamy, by se měly automaticky oproti audioknihám překlápět do
 * stavu natáčíme ve chvíli, kdy budou v kalendáři naplánovaní všichni herci,
 * kteří jsou u projektu").
 *
 * PROČ U REKLAMY JINAK NEŽ U AUDIOKNIHY. Kniha se točí týdny a „Natáčíme" u ní
 * začíná dnem první frekvence (lib/zacatekNataceniServer.ts) - do té doby se
 * ještě domlouvá, kdo a kdy. Spot se naplánuje jednou: ve chvíli, kdy má každý
 * herec projektu termín v kalendáři, je na projektu hotová celá příprava
 * a čekat s přepnutím na den natáčení nedává smysl - klient i tým se mají
 * dozvědět teď, že se jde točit.
 *
 * DENNÍ PŘEKLÁPĚNÍ ZŮSTÁVÁ. Tohle je navíc, ne místo něj: reklama bez
 * vyplněných herců nebo naplánovaná po částech se překlopí dnem první
 * frekvence jako dřív.
 *
 * PŘEKLÁPÍ SE JEN DOPŘEDU, ze „V přípravě" a „Plánujeme". Smazání termínu
 * projekt nikdy nevrací zpátky - stav si od té chvíle řídí produkce a automat
 * jí do něj nesmí sahat.
 */

/** Stavy, ze kterých se na „Natáčíme" překlápí - stejné jako u denní úlohy. */
const PRED_NATACENIM = ['V přípravě', 'Plánujeme'];

/**
 * Jméno na porovnání. Herec zapsaný v kalendáři ručně nemá navázaný účet
 * (actorUserId je prázdné) a jeho jméno se v portálu píše různě - „Ondřej
 * Novák" i „ondrej novak". Bez tohohle by projekt s ručně zapsaným hercem
 * zůstal navždy „V přípravě".
 */
function klicJmena(jmeno: string | null | undefined): string {
  return (jmeno ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLocaleLowerCase('cs');
}

/** Kdo z projektu už má termín v kalendáři - účty i jména zapsaná ručně. */
async function naplanovani(caflouProjectId: string): Promise<{ ucty: Set<string>; jmena: Set<string> }> {
  const [bloky, sloty] = await Promise.all([
    prisma.studioBlock
      .findMany({
        where: { caflouProjectId, kind: 'NATACENI' as never },
        select: { actorUserId: true, actorName: true },
      })
      .catch(() => []),
    prisma.recordingSlot
      .findMany({
        where: {
          state: { in: ['SELECTED', 'CONFIRMED'] as never },
          request: { caflouProjectId },
        },
        select: { request: { select: { actorUserId: true, actorName: true } } },
      })
      .catch(() => []),
  ]);

  const ucty = new Set<string>();
  const jmena = new Set<string>();
  const pridej = (id: string | null | undefined, jmeno: string | null | undefined) => {
    if (id) ucty.add(id);
    const k = klicJmena(jmeno);
    if (k) jmena.add(k);
  };
  for (const b of bloky) pridej(b.actorUserId, b.actorName);
  for (const s of sloty) pridej(s.request?.actorUserId, s.request?.actorName);
  return { ucty, jmena };
}

/**
 * Zkusí překlopit JEDEN projekt. Vrací true, když se stav opravdu změnil -
 * volající podle toho nemusí nic dělat, je to jen pro log a denní souhrn.
 *
 * Pouští se po každém uložení události v kalendáři, takže musí být tichá:
 * cokoli nesedí (není to reklama, není to před natáčením, herci nejsou
 * naplánovaní všichni), jen vrátí false a ukládání události to nesmí shodit.
 */
export async function preklopReklamuPodlePlanu(
  caflouProjectId: string | null | undefined,
  pripravenyCiselnik?: CiselnikReklam,
): Promise<boolean> {
  const id = caflouProjectId?.trim();
  if (!id) return false;

  try {
    const meta = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: id },
      select: {
        caflouProjectId: true,
        name: true,
        statusName: true,
        projectType: true,
        managerUserId: true,
        finished: true,
        company: { select: { dealsAds: true, dealsAudiobooks: true } },
        herci: { select: { id: true, name: true } },
      },
    });
    if (!meta || meta.finished) return false;
    if (!PRED_NATACENIM.includes(meta.statusName ?? '')) return false;
    // Bez vyplněných herců se nedá poznat, že je naplánováno všechno.
    if (meta.herci.length === 0) return false;

    const ciselnik = pripravenyCiselnik ?? (await nactiCiselnikReklam());
    if (!jeReklamaPodleMeta(meta, ciselnik)) return false;

    const { ucty, jmena } = await naplanovani(id);
    const vsichni = meta.herci.every((h) => ucty.has(h.id) || jmena.has(klicJmena(h.name)));
    if (!vsichni) return false;

    await prisma.projectMeta.update({
      where: { caflouProjectId: id },
      data: { statusName: STAV_NATACIME },
    });
    await zapisZmenyProjektu({
      caflouProjectId: id,
      pred: { statusName: meta.statusName },
      ulozeno: { statusName: STAV_NATACIME },
      puvodce: { id: null, jmeno: 'Portál (naplánováno s herci)' },
    });

    // Kanál v chatu, kdyby projekt ještě žádný neměl - stejně jako u denní
    // úlohy: zvukař kanál projektu „V přípravě" v chatu nevidí.
    if (meta.managerUserId) {
      await zalozKanalProjektu({
        caflouProjectId: id,
        nazev: meta.name || `Projekt ${id}`,
        zakladatelId: meta.managerUserId,
        managerUserId: meta.managerUserId,
      });
    }

    // Zpráva klientovi jen tam, kde si to firma u tohohle stavu přeje.
    posliNotifikaciPoProdleve(id, STAV_NATACIME);
    return true;
  } catch (err) {
    console.error(`Překlopení reklamy ${id} na "${STAV_NATACIME}" podle plánu selhalo:`, err);
    return false;
  }
}

/**
 * ZÁCHYTNÁ SÍŤ pro denní úlohu: projede reklamy před natáčením a dožene, co se
 * neuložilo hned - termín zapsaný dřív, než tohle pravidlo vzniklo, nebo herec
 * doplněný k projektu až po naplánování termínu.
 */
export async function preklopHotoveReklamy(): Promise<{ caflouProjectId: string; nazev: string | null }[]> {
  try {
    const kandidati = await prisma.projectMeta.findMany({
      where: { finished: false, statusName: { in: PRED_NATACENIM }, herci: { some: {} } },
      select: { caflouProjectId: true, name: true },
    });
    if (kandidati.length === 0) return [];

    const ciselnik = await nactiCiselnikReklam();
    const preklopeno: { caflouProjectId: string; nazev: string | null }[] = [];
    for (const p of kandidati) {
      if (await preklopReklamuPodlePlanu(p.caflouProjectId, ciselnik)) {
        preklopeno.push({ caflouProjectId: p.caflouProjectId, nazev: p.name });
      }
    }
    return preklopeno;
  } catch (err) {
    console.error('Dohledání naplánovaných reklam selhalo:', err);
    return [];
  }
}
