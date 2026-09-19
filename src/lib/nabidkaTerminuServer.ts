import { prisma } from '@/lib/db';
import { recordEvent } from '@/lib/calendarServer';
import { sendRecordingOfferEmail } from '@/lib/email';
import { notify } from '@/lib/notifications';
import { obnovVolnaMista } from '@/lib/volnaMistaServer';

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
    include: { studio: { select: { name: true } }, slots: { select: { state: true } } },
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
    studioName: request.studio.name,
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
