import { prisma } from '@/lib/db';
import { StudiosManager } from './StudiosManager';
import { TabuleStudii } from './TabuleStudii';
import { nazevPolozky } from '@/lib/tabule';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

// Studia, jejich pracovni doba a blokace (zadani 8. 9. 2026).
export const dynamic = 'force-dynamic';

export default async function StudiaPage() {
  const [studios, blocks, tabule] = await Promise.all([
    prisma.studio.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { hours: { orderBy: { weekday: 'asc' } }, presets: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.studioBlock.findMany({
      where: { end: { gte: new Date() } },
      orderBy: { start: 'asc' },
      take: 100,
      include: { studio: { select: { name: true } } },
    }),
    // Tabule ve studiích (21. 9. 2026) - jen hlavní studia, ne místnosti.
    prisma.studio
      .findMany({
        where: { active: true, parentStudioId: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          color: true,
          tabuleKlic: true,
          tabuleUcty: { select: { id: true, email: true, active: true } },
          tabuleChybi: { where: { doplnenoAt: null }, orderBy: { nahlasenoAt: 'asc' } },
          tabulePoznamky: { where: { hotovoAt: null }, orderBy: { createdAt: 'desc' } },
        },
      })
      .catch(() => [] as never[]),
  ]);
  type Tabule = {
    id: string;
    name: string;
    color: string;
    tabuleKlic: string | null;
    tabuleUcty: { id: string; email: string; active: boolean }[];
    tabuleChybi: { polozka: string; nahlasenoAt: Date }[];
    tabulePoznamky: { id: string; text: string; autor: string | null; createdAt: Date }[];
  };
  const tabuleStudii = tabule as unknown as Tabule[];

  return (
    <div className="flex flex-col gap-6">
    <StudiosManager
      studios={studios.map((s) => ({
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        location: s.location,
        color: s.color,
        timezone: s.timezone,
        active: s.active,
        hours: s.hours.map((h) => ({
          weekday: h.weekday,
          startMinutes: h.startMinutes,
          endMinutes: h.endMinutes,
          byArrangement: h.byArrangement,
        })),
        presets: s.presets.map((p) => ({
          label: p.label,
          startMinutes: p.startMinutes,
          endMinutes: p.endMinutes,
        })),
      }))}
      blocks={blocks.map((b) => ({
        id: b.id,
        studioName: b.studio.name,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        kind: b.kind,
        title: b.title,
      }))}
    />
    <TabuleStudii
      zaklad={zakladPortalu()}
      studia={tabuleStudii.map((t) => ({
        id: t.id,
        nazev: t.name,
        barva: t.color,
        klic: t.tabuleKlic,
        ucty: t.tabuleUcty.map((u) => ({ id: u.id, email: u.email, aktivni: u.active })),
        chybi: t.tabuleChybi.map((c) => ({ polozka: c.polozka, nazev: nazevPolozky(c.polozka), kdy: c.nahlasenoAt.toISOString() })),
        poznamky: t.tabulePoznamky.map((p) => ({ id: p.id, text: p.text, autor: p.autor, kdy: p.createdAt.toISOString() })),
      }))}
    />
    </div>
  );
}
