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

  const [strany, nabidky] = await Promise.all([
    posledniStrany(ids),
    ids.length
      ? prisma.recordingRequest.findMany({
          where: { caflouProjectId: { in: ids }, actorUserId: userId, pageCount: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { caflouProjectId: true, pageCount: true },
        })
      : Promise.resolve([]),
  ]);
  const nsHerce = new Map<string, number>();
  for (const n of nabidky) {
    if (n.pageCount != null && !nsHerce.has(n.caflouProjectId)) nsHerce.set(n.caflouProjectId, n.pageCount);
  }

  const radky = projekty.map((p) => ({
    id: p.caflouProjectId,
    nazev: p.name ?? '',
    ns: nsHerce.get(p.caflouProjectId) ?? p.pageCount,
    strana: strany.get(`${p.caflouProjectId}:${userId}`) ?? strany.get(`${p.caflouProjectId}:`) ?? null,
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

type Radek = { id: string; nazev: string; ns: number | null; strana: number | null };

function TabulkaHerce({ radky, prazdne }: { radky: Radek[]; prazdne: string }) {
  return (
    <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="bg-brand-purple text-white font-heading text-xs">
              <th className="text-left px-4 py-3.5">Projekt</th>
              <th className="text-right px-4 py-3.5 whitespace-nowrap w-20" title="Normostrany">
                NS
              </th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap w-48">Skončili jsme na straně</th>
              <th className="text-left px-4 py-3.5 whitespace-nowrap w-32">Text</th>
            </tr>
          </thead>
          <tbody>
            {radky.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-sm font-body">
                  {prazdne}
                </td>
              </tr>
            )}
            {radky.map((r) => (
              <tr key={r.id} className="h-[48px] border-t border-line hover:bg-surfaceSoft">
                <td className="px-4 py-2 font-heading font-semibold text-sm text-ink">{r.nazev}</td>
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
                  <a
                    href={`/api/projekty/${encodeURIComponent(r.id)}/text`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-heading font-semibold text-brand-purpleDeep dark:text-brand-purpleLight no-underline hover:underline whitespace-nowrap"
                  >
                    Otevřít text ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
