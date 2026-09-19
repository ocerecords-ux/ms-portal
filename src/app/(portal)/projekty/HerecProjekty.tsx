import { prisma } from '@/lib/db';
import { posledniStrany } from '@/lib/brunoServer';

/**
 * PROJEKTY HERCE (zadání 19. 9. 2026: „v projektech by měl herec vidět
 * název projektu, počet NS, stránku, na které se skončilo na poslední
 * frekvenci, link na text").
 *
 * Herec nemá firmu, takže dřív spadl do klientské větve a viděl prázdnou
 * tabulku s klientskými sloupci a hláškou o „kontaktní osobě". Tady vidí
 * jen projekty, u kterých je vedený jako herec, a jen to, co potřebuje
 * k natáčení.
 *
 * - NS: normostrany pro TOHOTO herce z nabídky termínů (kniha dělená mezi
 *   víc herců), jinak normostrany projektu.
 * - Strana: poslední zápis „kam jsme se dotočili" (Bruno z chatu) pro tohoto
 *   herce; u projektu s jediným hercem zápis bez herce.
 * - Text: PDF ze složky projektu přes /api/projekty/[id]/text - herec do
 *   složky na Disku přístup nemá.
 */
export async function HerecProjekty({ userId }: { userId: string }) {
  const projekty = await prisma.projectMeta.findMany({
    where: {
      name: { not: null },
      OR: [{ actorUserId: userId }, { herci: { some: { id: userId } } }],
    },
    select: { caflouProjectId: true, name: true, pageCount: true, finished: true, endDate: true },
    orderBy: { name: 'asc' },
  });
  const ids = projekty.map((p) => p.caflouProjectId);

  const [strany, nabidky, frekvence, dotoceno] = await Promise.all([
    posledniStrany(ids),
    ids.length
      ? prisma.recordingRequest.findMany({
          where: { caflouProjectId: { in: ids }, actorUserId: userId, pageCount: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { caflouProjectId: true, pageCount: true },
        })
      : Promise.resolve([]),
    // Frekvence herce na projektech (Progres natáčení, zadání 19. 9. 2026).
    ids.length
      ? prisma.recordingRequest.findMany({
          where: {
            caflouProjectId: { in: ids },
            actorUserId: userId,
            status: { notIn: ['DRAFT', 'PREPARING', 'CANCELLED', 'REJECTED'] },
          },
          select: {
            caflouProjectId: true,
            requiredSessions: true,
            slots: { where: { state: 'CONFIRMED' }, select: { end: true } },
          },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.herecDotocen.findMany({
          where: { caflouProjectId: { in: ids }, userId },
          select: { caflouProjectId: true },
        })
      : Promise.resolve([]),
  ]);

  /**
   * PROGRES NATÁČENÍ (zadání 19. 9. 2026: „progres projektu nějakým
   * horizontálním válcem"). Počítá se z FREKVENCÍ, ne ze stran: strana
   * ve scénáři a normostrany jsou jiné jednotky a počet stran PDF portál
   * nezná. Odtočená frekvence = potvrzený termín, který už skončil.
   * Tlačítko Dotočeno u herce znamená 100 % bez ohledu na počty.
   */
  const ted = Date.now();
  const progres = new Map<string, { hotovo: number; celkem: number }>();
  for (const f of frekvence) {
    const p = progres.get(f.caflouProjectId) ?? { hotovo: 0, celkem: 0 };
    p.celkem += Math.max(f.requiredSessions, f.slots.length);
    p.hotovo += f.slots.filter((sl) => sl.end.getTime() <= ted).length;
    progres.set(f.caflouProjectId, p);
  }
  const dotocenoIds = new Set(dotoceno.map((d) => d.caflouProjectId));
  const nsHerce = new Map<string, number>();
  for (const n of nabidky) {
    if (n.pageCount != null && !nsHerce.has(n.caflouProjectId)) nsHerce.set(n.caflouProjectId, n.pageCount);
  }

  const radky = projekty.map((p) => ({
    id: p.caflouProjectId,
    nazev: p.name ?? '',
    ns: nsHerce.get(p.caflouProjectId) ?? p.pageCount,
    strana: strany.get(`${p.caflouProjectId}:${userId}`) ?? strany.get(`${p.caflouProjectId}:`) ?? null,
    progres: dotocenoIds.has(p.caflouProjectId)
      ? { hotovo: 1, celkem: 1, dotoceno: true }
      : progres.has(p.caflouProjectId)
        ? { ...progres.get(p.caflouProjectId)!, dotoceno: false }
        : null,
    hotovo: p.finished,
    konec: p.endDate?.getTime() ?? Infinity,
  }));
  const aktivni = radky.filter((r) => !r.hotovo).sort((a, b) => a.konec - b.konec);
  const dokoncene = radky.filter((r) => r.hotovo);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Projekty</h1>

      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
          Aktivní projekty
        </h2>
        <TabulkaHerce
          radky={aktivni}
          prazdne="Zatím tu nemáte žádný rozpracovaný projekt. Jakmile vás k nějakému přiřadíme, objeví se tady."
        />
      </div>

      {dokoncene.length > 0 && (
        <details>
          <summary className="cursor-pointer font-heading font-semibold text-sm text-muted uppercase tracking-wide mb-3">
            Dokončené projekty ({dokoncene.length})
          </summary>
          <TabulkaHerce radky={dokoncene} prazdne="" />
        </details>
      )}
    </section>
  );
}

type Progres = { hotovo: number; celkem: number; dotoceno: boolean } | null;
type Radek = { id: string; nazev: string; ns: number | null; strana: number | null; progres: Progres };

/** Vodorovný válec s procenty - Progres natáčení (19. 9. 2026). */
function ValecProgresu({ progres }: { progres: Progres }) {
  if (!progres || progres.celkem === 0) {
    return <span className="text-sm font-body text-muted">termíny se plánují</span>;
  }
  const procenta = Math.min(100, Math.round((progres.hotovo / progres.celkem) * 100));
  const popis = progres.dotoceno
    ? 'Dotočeno'
    : `${progres.hotovo} z ${progres.celkem} ${progres.celkem === 1 ? 'frekvence' : 'frekvencí'}`;
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div
        className="h-3 w-full rounded-pill bg-field border border-line overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={procenta}
        aria-label="Progres natáčení"
      >
        <div
          className="h-full rounded-pill bg-brand-green transition-[width] duration-500"
          style={{ width: `${procenta}%` }}
        />
      </div>
      <span className="text-xs font-body text-muted tabular-nums">
        {popis} · {procenta} %
      </span>
    </div>
  );
}

function TabulkaHerce({ radky, prazdne }: { radky: Radek[]; prazdne: string }) {
  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap w-56">Progres natáčení</th>
              <th className="text-right px-4 py-3.5 whitespace-nowrap w-20" title="Normostrany">
                NS
              </th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap w-48">Skončili jsme na straně</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap w-48">Text</th>
            </tr>
          </thead>
          <tbody>
            {radky.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {prazdne}
                </td>
              </tr>
            )}
            {radky.map((r) => (
              <tr key={r.id} className="h-[56px] border-t border-line hover:bg-surfaceSoft">
                <td className="px-4 py-2 font-heading font-semibold text-sm text-ink">{r.nazev}</td>
                <td className="px-4 py-2">
                  <ValecProgresu progres={r.progres} />
                </td>
                <td className="px-4 py-2 text-right text-sm font-body text-ink tabular-nums">{r.ns ?? '–'}</td>
                <td className="px-4 py-2 text-sm font-body">
                  {r.strana != null ? (
                    <span className="inline-flex items-center rounded-pill bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight font-heading font-semibold px-3 py-1">
                      str. {r.strana}
                    </span>
                  ) : (
                    <span className="text-muted">ještě se netočilo</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm">
                  {/* Otevrit i stahnout (zadani 19. 9. 2026). */}
                  <span className="inline-flex items-center gap-3 whitespace-nowrap">
                    <a
                      href={`/api/projekty/${encodeURIComponent(r.id)}/text`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-heading font-semibold text-brand-purpleDeep dark:text-brand-purpleLight no-underline hover:underline"
                    >
                      Otevřít ↗
                    </a>
                    <a
                      href={`/api/projekty/${encodeURIComponent(r.id)}/text?stahnout=1`}
                      download
                      title="Stáhnout text jako PDF"
                      className="inline-flex items-center gap-1 font-heading font-semibold text-brand-purpleDeep dark:text-brand-purpleLight no-underline hover:underline"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                        <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
                      </svg>
                      Stáhnout
                    </a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
