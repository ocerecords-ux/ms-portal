import { prisma } from '@/lib/db';
import { recordEvent } from '@/lib/calendarServer';
import {
  sendRecordingOfferEmail,
  sendUpominkaTerminuEmail,
  sendVyberTerminuProdukciEmail,
} from '@/lib/email';
import { notify } from '@/lib/notifications';
import { obnovVolnaMista } from '@/lib/volnaMistaServer';
import { INTERNAL_ROLES } from '@/lib/roles';
import { jazykUzivatele } from '@/lib/jazykPrijemce';
import { uliceStudia } from '@/lib/studioProHerce';

/**
 * Odeslání nabídky termínů herci - společné pro tlačítko v nabídce
 * i pro „Odeslat herci" rovnou z okna na projektu (zadání 19. 9. 2026:
 * „nelíbí se mi, jak je to plánování na dva kroky… vše by mohlo být
 * přehledně v jednom okně").
 *
 * Vrací chybu jako { error, status }, nebo { ok: true }.
 */
export async function odesliNabidkuHerci(
  requestId: string,
  kdo: { id: string; label: string },
): Promise<{ ok: true } | { error: string; status: number }> {
  const params = { id: requestId };
  const session = { user: { id: kdo.id, name: kdo.label, email: kdo.label } };
  // Pred odeslanim se nabidka srovna s kalendarem - od otevreni stranky se
  // mohlo neco obsadit nebo uvolnit.
  await obnovVolnaMista(params.id);

  const request = await prisma.recordingRequest.findUnique({
    where: { id: params.id },
    include: { studio: { select: { name: true, adresa: true } }, slots: { select: { state: true } } },
  });
  if (!request) return { error: 'Nabídka nenalezena.', status: 404 };
  if (['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(request.status)) {
    return { error: 'Tuhle nabídku už poslat nejde.', status: 409 };
  }

  const nabidnuto = request.slots.filter((s) => s.state === 'OFFERED').length;
  if (nabidnuto < request.requiredSessions) {
    return {
      error: `Herec má vybrat ${request.requiredSessions} termínů, ale v kalendáři je v zadaném období volných jen ${nabidnuto}. Posuňte začátek nebo konec období, případně uvolněte kalendář.`,
      status: 400,
    };
  }

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
  const result = await sendRecordingOfferEmail({
    to: request.actorEmail,
    actorName: request.actorName,
    projectName: request.projectName,
    // Hercovi se pobocka oznacuje ulici, ne jako „Brno I" (pripominka Heleny
    // 5. 10. 2026) - viz lib/studioProHerce.ts.
    studioName: uliceStudia(request.studio),
    requiredSessions: request.requiredSessions,
    offeredCount: nabidnuto,
    periodFrom: request.periodFrom,
    periodTo: request.periodTo,
    note: request.note,
    offerUrl: `${baseUrl}/terminy/${request.accessToken}`,
  });

  if (!result.sent) {
    return { error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.', status: 503 };
  }

  await prisma.recordingRequest.update({
    where: { id: request.id },
    data: { status: 'SENT', sentAt: new Date(), decisionNote: null },
  });

  await recordEvent({
    requestId: request.id,
    userId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    type: 'SENT',
    fromStatus: request.status,
    toStatus: 'SENT',
    note: `Odesláno na ${request.actorEmail}, nabídnuto ${nabidnuto} termínů.`,
  });

  if (request.actorUserId) {
    await notify({
      userId: request.actorUserId,
      kind: 'RECORDING_OFFER',
      title: 'Vyberte si natáčecí termíny',
      body: `${request.projectName} · vyberte ${request.requiredSessions} z ${nabidnuto}`,
      url: '/moje-terminy',
    });
  }
  return { ok: true };
}


/** Adresa portálu bez lomítka na konci - stejně jako výš u nabídky. */
function adresaPortalu(): string {
  return (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
}

/** „pá 10. 10. · 9:00–13:00 · Brno I" v pásmu studia - do mailu produkci. */
function popisTerminu(start: Date, end: Date, pasmo: string, studio?: string | null): string {
  const den = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: pasmo,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  }).format(start);
  const cas = (d: Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: pasmo, hour: 'numeric', minute: '2-digit', hour12: false }).format(d);
  // STUDIO U KAŽDÉHO TERMÍNU (připomínka Heleny 6. 10. 2026: „když mi dojde
  // seznam vybraných termínů od herce, ať tam vidím, ve kterém studiu jsou ty
  // termíny navoleny"). Nabídka chodí z víc studií naráz, takže bez něj se
  // z mailu nepoznalo, kam se v ten den jede.
  return `${den} · ${cas(start)}–${cas(end)}${studio ? ` · ${studio}` : ''}`;
}

/**
 * MAIL PRODUKCI, ŽE SI HEREC NAKLIKAL TERMÍNY (připomínka Heleny 5. 10. 2026:
 * „potřebuju dostávat mailem notifikace o vyplnění termínů").
 *
 * Zvonění v portálu zůstává tomu, kdo nabídku založil - tenhle mail jde
 * KAŽDÉMU z týmu, kdo má na kartě zapnuté „Dostává výběr termínů". Nabídku
 * často zakládá někdo jiný, než kdo plán hlídá, a vybrané termíny se drží jen
 * do konce lhůty; kdo to nestihne potvrdit, o místa ve studiu přijde.
 *
 * CELÉ JE TO V try/catch A NIC NEVRACÍ: běží na konci výběru herce a ten se
 * nesmí pokazit kvůli poště. Když mail nedojde, výběr je uložený a v portálu
 * svítí dál.
 */
export async function oznamProdukciVyberTerminu(requestId: string): Promise<void> {
  try {
    const request = await prisma.recordingRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        projectName: true,
        actorName: true,
        actorNote: true,
        requiredSessions: true,
        holdUntil: true,
        studio: { select: { name: true, timezone: true } },
        slots: {
          where: { state: { in: ['SELECTED', 'CONFIRMED'] } },
          select: { start: true, end: true, studio: { select: { name: true } } },
          orderBy: { start: 'asc' },
        },
      },
    });
    if (!request) return;

    const prijemci = await prisma.user
      .findMany({
        where: { active: true, dostavaVyberTerminu: true, role: { in: INTERNAL_ROLES } },
        select: { email: true },
      })
      .then((lide) => lide.map((u) => u.email));

    if (prijemci.length === 0) {
      console.warn(
        `Vyber terminu (${request.actorName}, ${request.projectName}): mail nema komu poslat - nikdo nema zaskrtnute "Dostava vyber terminu".`,
      );
      return;
    }

    const pasmo = request.studio.timezone;
    await sendVyberTerminuProdukciEmail({
      prijemci,
      actorName: request.actorName,
      projectName: request.projectName,
      studioName: request.studio.name,
      terminy: request.slots.map((s) => popisTerminu(s.start, s.end, pasmo, s.studio?.name)),
      requiredSessions: request.requiredSessions,
      drzenoDo: request.holdUntil
        ? new Intl.DateTimeFormat('cs-CZ', {
            timeZone: pasmo,
            day: 'numeric',
            month: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: false,
          }).format(request.holdUntil)
        : null,
      actorNote: request.actorNote,
      odkazNaNabidku: `${adresaPortalu()}/kalendar/nabidka/${request.id}`,
    });
  } catch (err) {
    console.error('Mail produkci o vyberu terminu selhal:', err);
  }
}

/**
 * UPOMÍNKA HERCI, AŤ SI NAKLIKÁ TERMÍNY (připomínka Heleny 2. 10. 2026:
 * „tlačítko na upomenutí herce, aby si naklikal termíny").
 *
 * Schválně to NENÍ „Poslat znovu": ta posílá celou nabídku a přepisuje čas
 * odeslání i stav. Upomínka se stavu nabídky nedotkne - jen pošle krátkou
 * zprávu s odkazem, zapíše se do historie nabídky a zazvoní hercovi
 * v portálu. Posílat se dá opakovaně; z historie je vidět kdy a od koho.
 */
export async function posliUpominkuHerci(
  requestId: string,
  kdo: { id: string; label: string },
  vzkaz?: string | null,
): Promise<{ ok: true } | { error: string; status: number }> {
  const request = await prisma.recordingRequest.findUnique({
    where: { id: requestId },
    include: { slots: { select: { state: true } } },
  });
  if (!request) return { error: 'Nabídka nenalezena.', status: 404 };
  if (!request.sentAt) {
    return { error: 'Nabídka ještě herci neodešla — pošlete mu ji tlačítkem „Odeslat herci".', status: 409 };
  }
  if (!['SENT', 'PICKING', 'RETURNED'].includes(request.status)) {
    return { error: 'Na tuhle nabídku se nečeká — herec už ji vyřídil, nebo je zrušená.', status: 409 };
  }

  const nabidnuto = request.slots.filter((s) => s.state === 'OFFERED').length;

  const vysledek = await sendUpominkaTerminuEmail({
    to: request.actorEmail,
    actorName: request.actorName,
    projectName: request.projectName,
    requiredSessions: request.requiredSessions,
    offeredCount: nabidnuto,
    periodTo: request.periodTo,
    vzkaz: vzkaz?.trim() || null,
    offerUrl: `${adresaPortalu()}/terminy/${request.accessToken}`,
    jazyk: await jazykUzivatele(request.actorUserId),
  });

  if (!vysledek.sent) {
    return { error: 'E-mail se nepodařilo odeslat — není nastavené SMTP.', status: 503 };
  }

  await recordEvent({
    requestId: request.id,
    userId: kdo.id,
    actorLabel: kdo.label,
    type: 'REMINDED',
    note: vzkaz?.trim()
      ? `Upomínka na ${request.actorEmail} — ${vzkaz.trim()}`
      : `Upomínka na ${request.actorEmail}.`,
  });

  if (request.actorUserId) {
    await notify({
      userId: request.actorUserId,
      kind: 'RECORDING_OFFER',
      title: 'Připomínka: vyberte si natáčecí termíny',
      body: `${request.projectName} · vyberte ${request.requiredSessions} z ${nabidnuto}`,
      url: '/moje-terminy',
    });
  }

  return { ok: true };
}
