import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { recordEvent } from '@/lib/calendarServer';

/**
 * PŘESUN FREKVENCE POD JINÝ PROJEKT (zadání 30. 10. 2026: „nejde změnit
 * v kalendáři projekt. Sice ho změním, ale neuložím").
 *
 * Projekt u frekvence do teď nešel změnit schválně: frekvence patří NABÍDCE
 * a nabídka jednomu projektu a jednomu herci (viz model RecordingRequest).
 * Pole v kalendáři se ale přepsat dalo, uložení se tvářilo, že proběhlo, a
 * server ho tiše zahodil - což je to nejhorší z obou světů.
 *
 * MĚNÍ SE JEN TAHLE JEDNA FREKVENCE (rozhodnutí 30. 10. 2026). Ostatní
 * termíny té nabídky zůstanou, kde byly.
 *
 * JAK: frekvence se PŘEVĚSÍ POD NABÍDKU CÍLOVÉHO PROJEKTU, místo aby si
 * nesla vlastní projekt vedle nabídky. Důvod je praktický: na „projekt téhle
 * frekvence" se portál ptá na deseti místech (kalendář, ikona termínů
 * u projektu, hledání, návrhy výkazů, režie online, termíny klienta, plán
 * reklamy…) a všechna se ptají přes nabídku. Druhá pravda vedle ní by
 * znamenala, že každé z nich - a každé budoucí - na ni musí pamatovat;
 * stačilo by jedno zapomenout a frekvence by se počítala dvakrát jinak.
 * Takhle se nemění ani řádek v těch místech a výsledek je ten samý.
 *
 * NABÍDKA SE HLEDÁ, NEŽ SE ZALOŽÍ. Když ten herec na cílovém projektu
 * nabídku má (obvyklý případ - frekvence se zapsala pod špatnou zakázku),
 * připojí se k ní. Teprve když žádná není, vznikne nabídka jen pro tenhle
 * jeden termín; herci nikam neodejde, slouží jen jako vazba frekvence na
 * projekt.
 *
 * PŮVODNÍ NABÍDCE SE SNÍŽÍ POČET POŽADOVANÝCH TERMÍNŮ, jinak by po zbytek
 * života vypadala, že herci jeden termín dluží.
 */

export type PresunVysledek =
  | { ok: true; presunuto: false }
  | { ok: true; presunuto: true; projectName: string; novaNabidka: boolean }
  | { ok: false; chyba: string };

type SlotProPresun = {
  id: string;
  studioId: string;
  start: Date;
  end: Date;
  request: {
    id: string;
    caflouProjectId: string;
    projectName: string;
    actorUserId: string | null;
    actorName: string;
    actorEmail: string;
    companyId: string | null;
    studioId: string;
    pageCount: number | null;
    requiredSessions: number;
    sessionMinutes: number;
  };
};

export async function presunFrekvenciDoProjektu(vstup: {
  slot: SlotProPresun;
  caflouProjectId: string;
  /** Název projektu z formuláře; když chybí, dohledá se u projektu. */
  projectName?: string | null;
  kdo: { id: string; jmeno: string };
}): Promise<PresunVysledek> {
  const { slot } = vstup;
  const cilovy = vstup.caflouProjectId.trim();
  if (!cilovy || cilovy === slot.request.caflouProjectId) {
    return { ok: true, presunuto: false };
  }

  try {
    // Název projektu je otisk - ať zůstane čitelný i bez Caflou. Z formuláře
    // chodí ten, co člověk viděl v nabídce; jinak se vezme z karty projektu.
    const meta = await prisma.projectMeta
      .findUnique({ where: { caflouProjectId: cilovy }, select: { name: true } })
      .catch(() => null);
    const nazev = (vstup.projectName || '').trim() || meta?.name || cilovy;

    /**
     * Nabídka téhož herce na cílovém projektu. Herec bez účtu se pozná podle
     * jména - u něj žádné id není a nic lepšího k dispozici nemáme.
     */
    const stavajici = await prisma.recordingRequest.findFirst({
      where: {
        caflouProjectId: cilovy,
        status: { notIn: ['CANCELLED', 'REJECTED'] as never },
        ...(slot.request.actorUserId
          ? { actorUserId: slot.request.actorUserId }
          : { actorUserId: null, actorName: slot.request.actorName }),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, requiredSessions: true },
    });

    const cil =
      stavajici ??
      (await prisma.recordingRequest.create({
        data: {
          caflouProjectId: cilovy,
          projectName: nazev,
          companyId: slot.request.companyId,
          actorUserId: slot.request.actorUserId,
          actorName: slot.request.actorName,
          actorEmail: slot.request.actorEmail,
          studioId: slot.studioId || slot.request.studioId,
          pageCount: slot.request.pageCount,
          requiredSessions: 1,
          sessionMinutes: slot.request.sessionMinutes,
          periodFrom: slot.start,
          periodTo: slot.end,
          // Herci nikam neodejde - odkaz je jen proto, ze ho model vyzaduje.
          accessToken: randomUUID(),
          // Termin uz je domluveny a v kalendari stoji; neni co nabizet.
          status: 'CONFIRMED' as never,
          note: `Vzniklo přesunutím frekvence z projektu ${slot.request.projectName}.`,
          createdById: vstup.kdo.id,
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
        select: { id: true, requiredSessions: true },
      }));

    await prisma.recordingSlot.update({
      where: { id: slot.id },
      data: { requestId: cil.id },
    });

    // Puvodni nabidka uz tenhle termin nema - at nevypada, ze herec dluzi.
    if (slot.request.requiredSessions > 1) {
      await prisma.recordingRequest
        .update({
          where: { id: slot.request.id },
          data: { requiredSessions: slot.request.requiredSessions - 1 },
        })
        .catch(() => undefined);
    }

    // Do historie OBOU nabidek - aby slo dohledat, kam termin zmizel.
    await recordEvent({
      requestId: slot.request.id,
      slotId: slot.id,
      userId: vstup.kdo.id,
      actorLabel: vstup.kdo.jmeno,
      type: 'SLOT_EDITED',
      note: `Frekvence přesunuta na projekt ${nazev}.`,
      payload: { zProjektu: slot.request.caflouProjectId, naProjekt: cilovy },
    }).catch(() => undefined);
    await recordEvent({
      requestId: cil.id,
      slotId: slot.id,
      userId: vstup.kdo.id,
      actorLabel: vstup.kdo.jmeno,
      type: 'SLOT_EDITED',
      note: `Frekvence přesunuta z projektu ${slot.request.projectName}.`,
      payload: { zProjektu: slot.request.caflouProjectId, naProjekt: cilovy },
    }).catch(() => undefined);

    return { ok: true, presunuto: true, projectName: nazev, novaNabidka: !stavajici };
  } catch (err) {
    console.error('Přesun frekvence pod jiný projekt selhal:', err);
    return { ok: false, chyba: 'Projekt se nepodařilo změnit.' };
  }
}
