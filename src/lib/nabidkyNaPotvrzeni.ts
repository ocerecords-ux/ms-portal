import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';

/**
 * VÝBĚR HERCE, KTERÝ ČEKÁ NA POTVRZENÍ (zadání 16. 11. 2026: „ať to zařve
 * hlavně Helče").
 *
 * Herec si v nabídce vybere termíny; ty se drží jen po dobu holdHours
 * (výchozí 72 hodin) a pak propadnou zpátky do nabídky. Do té doby to musí
 * někdo od nás potvrdit. Zvonek na to nestačil: u Přezrálých moruší herečka
 * odeslala výběr 27. 10. v 16:47, nikdo ho nepotvrdil a 30. 10. v 16:49 celý
 * výběr propadl. Oznámení přišlo dvakrát — při odeslání i při propadnutí —
 * a obojí zapadlo.
 *
 * Proto to teď SVÍTÍ ČERVENĚ V KALENDÁŘI, dokud se s tím něco neudělá:
 *  - výběr čeká na potvrzení (stav SUBMITTED) — s časem, do kdy se drží,
 *  - výběr už propadl a nikdo nabídku neposlal znovu ani nic nevybral.
 * Nejde to zavřít. Zmizí to samo, jakmile se termíny potvrdí nebo herec
 * vybere znovu — kdyby to šlo odklepnout, bylo by to první, co každý udělá.
 *
 * KDO TO VIDÍ: kdo smí zapisovat do kalendáře (canManageCalendar). Je to
 * jejich práce, ne hercova.
 */

export type NabidkaKPotvrzeni = {
  id: string;
  projectName: string;
  actorName: string;
  /** Kolik termínů herec vybral (u propadlých kolik jich propadlo). */
  vybrano: number;
  potreba: number;
  /** Do kdy se termíny drží. Null u propadlých. */
  doKdy: Date | null;
  /** Kdy výběr propadl. Null, dokud se drží. */
  propadloKdy: Date | null;
};

/** Výběry, které čekají na nás — držené i ty, co už propadly. */
export async function nabidkyKPotvrzeni(): Promise<NabidkaKPotvrzeni[]> {
  const [drzene, propadle] = await Promise.all([
    prisma.recordingRequest.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { holdUntil: 'asc' },
      select: {
        id: true,
        projectName: true,
        actorName: true,
        requiredSessions: true,
        holdUntil: true,
        slots: { where: { state: 'SELECTED' }, select: { id: true } },
      },
    }),
    /**
     * PROPADLÉ A NEVYŘEŠENÉ. Po propadnutí se stav vrací na SENT a termíny
     * na OFFERED, takže se nabídka tváří jako každá jiná odeslaná. Poznáme
     * ji podle toho, že v historii je HOLD_EXPIRED a po něm už nepřišel
     * žádný další výběr — a že na ní nic nedrží ani není potvrzené.
     */
    prisma.recordingRequest.findMany({
      where: {
        status: { in: ['SENT', 'PICKING'] },
        events: { some: { type: 'HOLD_EXPIRED' } },
        slots: { none: { state: { in: ['SELECTED', 'CONFIRMED'] } } },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        projectName: true,
        actorName: true,
        requiredSessions: true,
        events: {
          where: { type: { in: ['HOLD_EXPIRED', 'SUBMITTED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { type: true, createdAt: true },
        },
      },
    }),
  ]);

  const zDrzenych: NabidkaKPotvrzeni[] = drzene.map((r) => ({
    id: r.id,
    projectName: r.projectName,
    actorName: r.actorName,
    vybrano: r.slots.length,
    potreba: r.requiredSessions,
    doKdy: r.holdUntil,
    propadloKdy: null,
  }));

  const zPropadlych: NabidkaKPotvrzeni[] = propadle
    .filter((r) => r.events[0]?.type === 'HOLD_EXPIRED')
    .map((r) => ({
      id: r.id,
      projectName: r.projectName,
      actorName: r.actorName,
      vybrano: 0,
      potreba: r.requiredSessions,
      doKdy: null,
      propadloKdy: r.events[0]?.createdAt ?? null,
    }));

  return [...zPropadlych, ...zDrzenych];
}

/** Kolik hodin zbývá do propadnutí (zaokrouhleno dolů, nikdy pod nulu). */
export function zbyvaHodin(doKdy: Date | null, ted = new Date()): number {
  if (!doKdy) return 0;
  return Math.max(0, Math.floor((doKdy.getTime() - ted.getTime()) / 3600000));
}

/** Od kolika zbývajících hodin se připomíná denní úlohou. */
const PRIPOMENOUT_OD_HODIN = 24;

/**
 * Denní připomínka, než výběr propadne (jede z /api/cron/terminy). Chodí
 * tomu, kdo nabídku založil, a herci ne — ten už svoje udělal.
 */
export async function pripomenNepotvrzeneVybery(): Promise<{ pripomenuto: number }> {
  const ted = new Date();
  const hranice = new Date(ted.getTime() + PRIPOMENOUT_OD_HODIN * 3600000);
  const cekajici = await prisma.recordingRequest.findMany({
    where: { status: 'SUBMITTED', holdUntil: { gt: ted, lt: hranice } },
    select: {
      id: true,
      projectName: true,
      actorName: true,
      createdById: true,
      holdUntil: true,
    },
  });

  for (const r of cekajici) {
    await notifyMany([r.createdById], {
      kind: 'RECORDING_HOLD_EXPIRING',
      title: `Termíny ${r.actorName} dnes propadnou`,
      body: `${r.projectName} — zbývá ${zbyvaHodin(r.holdUntil, ted)} h na potvrzení`,
      url: `/kalendar/nabidka/${r.id}`,
    });
  }

  return { pripomenuto: cekajici.length };
}
