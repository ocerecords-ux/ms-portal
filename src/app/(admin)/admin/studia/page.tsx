import { prisma } from '@/lib/db';
import { StudiosManager } from './StudiosManager';

// Studia, jejich pracovni doba a blokace (zadani 8. 9. 2026).
export const dynamic = 'force-dynamic';

export default async function StudiaPage() {
  const [studios, blocks] = await Promise.all([
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
  ]);

  return (
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
  );
}
