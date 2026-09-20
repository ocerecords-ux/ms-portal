import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar } from '@/lib/roles';
import { loadOccupancy } from '@/lib/calendarServer';
import { jePraceVeStudiu, maHerce, popisUdalosti, zabiraStudio } from '@/lib/calendar';

/**
 * Blokace založená přímo z kalendáře dvojklikem (zprava uzivatele 9. 9. 2026:
 * "do kalendáře by mělo jít přidávat dvojklikem").
 *
 * Na rozdíl od /api/admin/studia/blokace sem smí i Produkce — je to její
 * denní práce, ne administrace.
 */
const schema = z.object({
  studioId: z.string().trim().min(1),
  start: z.string().trim().min(8),
  end: z.string().trim().min(8),
  kind: z
    .enum(['NATACENI', 'STRIH', 'CASTING', 'HOLIDAY', 'VACATION', 'MAINTENANCE', 'INTERNAL', 'OTHER'])
    .optional(),
  // U natáčení a střihu se popis skládá ze zapsaných polí, takže sem nechodí.
  title: z.string().trim().max(160).optional(),
  note: z.string().trim().max(1000).optional(),
  // Ručně zapsaná událost (zadání 14. 9. 2026).
  caflouProjectId: z.string().trim().max(100).optional(),
  projectName: z.string().trim().max(300).optional(),
  actorUserId: z.string().trim().max(100).optional(),
  actorName: z.string().trim().max(200).optional(),
  zvukarUserId: z.string().trim().max(100).optional(),
  zvukarName: z.string().trim().max(200).optional(),
});

type Vstup = z.infer<typeof schema>;

/**
 * Co musí být vyplněné (zadání 14. 9. 2026: „událost, která bude obsahovat
 * název projektu, herce (když to bude natáčení) nebo střih a jméno zvukaře").
 *
 * Herec se vyžaduje jen u natáčení - u střihu žádný není a prázdné pole by
 * tam jen strašilo. Stejná pravidla platí pro zápis i pro úpravu, proto to
 * sedí tady a ne dvakrát v obou routách.
 */
function zkontrolujVstup(kind: string, d: Vstup): string | null {
  if (jePraceVeStudiu(kind)) {
    // U castingu projekt povinny neni (20. 9. 2026).
    if (kind !== 'CASTING' && !d.projectName?.trim()) return 'Vyberte projekt.';
    if (!d.zvukarName?.trim()) return 'Vyberte zvukaře.';
    if (maHerce(kind) && !d.actorName?.trim()) return 'Vyberte herce.';
    return null;
  }
  return d.title?.trim() ? null : 'Vyplňte, čeho se blokace týká.';
}

/** Rozepsané údaje události. U střihu se herec neukládá - žádný není. */
function poliUdalosti(kind: string, d: Vstup) {
  return {
    caflouProjectId: d.caflouProjectId || null,
    projectName: d.projectName || null,
    actorUserId: maHerce(kind) ? d.actorUserId || null : null,
    actorName: maHerce(kind) ? d.actorName || null : null,
    zvukarUserId: d.zvukarUserId || null,
    zvukarName: d.zvukarName || null,
  };
}

/**
 * ZVUKAŘ MUSÍ PATŘIT KE STUDIU (zadání 20. 9. 2026: „hlavně by nemělo jít
 * přiřadit zvukaře a mělo by to jen nabízet zvukaře v Brně na brněnské
 * frekvence a pražské na Prahu").
 *
 * Nabídku ve formuláři filtruje prohlížeč, tohle je pojistka na serveru -
 * adresa API je otevřená komukoli z týmu a překlep v ní by jinak přiřadil
 * pražského zvukaře do Brna.
 *
 * Komu studia zaškrtnutá nejsou, ten projde: dokud je nemá vyplněný celý tým,
 * nesmí to zablokovat zápis do kalendáře.
 */
async function zvukarNepatriKeStudiu(zvukarUserId: string | undefined, studioId: string): Promise<string | null> {
  if (!zvukarUserId) return null;
  const zvukar = await prisma.user.findUnique({
    where: { id: zvukarUserId },
    select: { name: true, email: true, zvukarStudia: { select: { id: true, shortName: true } } },
  });
  if (!zvukar || zvukar.zvukarStudia.length === 0) return null;
  if (zvukar.zvukarStudia.some((s) => s.id === studioId)) return null;
  const kde = zvukar.zvukarStudia.map((s) => s.shortName).join(', ');
  return `${zvukar.name || zvukar.email} točí jen ve studiu ${kde} - do tohohle studia ho zapsat nejde. Studia se zaškrtávají na kartě uživatele.`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;

    const kind = d.kind ?? 'INTERNAL';
    const jePrace = jePraceVeStudiu(kind);

    const chyba = zkontrolujVstup(kind, d);
    if (chyba) return NextResponse.json({ error: chyba }, { status: 400 });

    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Konec události musí být po začátku.' }, { status: 400 });
    }
    const mimoStudio = await zvukarNepatriKeStudiu(jePrace ? d.zvukarUserId : undefined, d.studioId);
    if (mimoStudio) return NextResponse.json({ error: mimoStudio }, { status: 400 });

    // Pres uz domluvene nataceni se blokace nedava. Strih se ale vejde
    // vedle cehokoliv - viz zabiraStudio (20. 9. 2026).
    if (zabiraStudio(kind)) {
      const obsazeno = await loadOccupancy([d.studioId], start, end);
      if (obsazeno.slots.length > 0) {
        return NextResponse.json(
          { error: `V tomhle čase je natáčení: ${obsazeno.slots.map((s) => s.label).join(', ')}.` },
          { status: 409 },
        );
      }
      const prekazka = obsazeno.blocks.find((b) => zabiraStudio(b.kind));
      if (prekazka) {
        return NextResponse.json({ error: `V tomhle čase už ve studiu je: ${prekazka.title}.` }, { status: 409 });
      }
    }

    const block = await prisma.studioBlock.create({
      data: {
        studioId: d.studioId,
        start,
        end,
        kind,
        // Popis se u natáčení a střihu skládá ze zapsaných polí - v mřížce
        // pak všechny události vypadají stejně a nikdo nevymýšlí názvy.
        title: jePrace ? popisUdalosti({ ...poliUdalosti(kind, d), kind }) : (d.title ?? ''),
        note: d.note || null,
        ...(jePrace ? poliUdalosti(kind, d) : {}),
        createdById: session.user.id,
      },
    });

    return NextResponse.json(block, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/blokace selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

/**
 * Úprava už zapsané události (zadání 14. 9. 2026: „chybí mi možnost upravit
 * událost"). Beze změny zůstává jen to, co se neposílá.
 *
 * Kontrola kolize při úpravě MUSÍ VYNECHAT SAMU SEBE - jinak by posun
 * natáčení o půl hodiny narazil na „v tomhle čase už ve studiu něco je",
 * totiž na tu samou událost, kterou člověk zrovna posouvá.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Chybí událost.' }, { status: 400 });

    const puvodni = await prisma.studioBlock.findUnique({ where: { id } });
    if (!puvodni) return NextResponse.json({ error: 'Událost nenalezena.' }, { status: 404 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const d = parsed.data;
    const kind = d.kind ?? puvodni.kind;
    const jePrace = jePraceVeStudiu(kind);

    const chyba = zkontrolujVstup(kind, d);
    if (chyba) return NextResponse.json({ error: chyba }, { status: 400 });

    const start = new Date(d.start);
    const end = new Date(d.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Konec události musí být po začátku.' }, { status: 400 });
    }
    const mimoStudio = await zvukarNepatriKeStudiu(jePrace ? d.zvukarUserId : undefined, d.studioId);
    if (mimoStudio) return NextResponse.json({ error: mimoStudio }, { status: 400 });

    if (zabiraStudio(kind)) {
      const obsazeno = await loadOccupancy([d.studioId], start, end);
      if (obsazeno.slots.length > 0) {
        return NextResponse.json(
          { error: `V tomhle čase je natáčení: ${obsazeno.slots.map((s) => s.label).join(', ')}.` },
          { status: 409 },
        );
      }
      const prekazka = obsazeno.blocks.find((b) => b.id !== id && zabiraStudio(b.kind));
      if (prekazka) {
        return NextResponse.json({ error: `V tomhle čase už ve studiu je: ${prekazka.title}.` }, { status: 409 });
      }
    }

    const upravena = await prisma.studioBlock.update({
      where: { id },
      data: {
        studioId: d.studioId,
        start,
        end,
        kind,
        title: jePrace ? popisUdalosti({ ...poliUdalosti(kind, d), kind }) : (d.title ?? ''),
        note: d.note || null,
        // Kdyz se z natáčení stane svatek, musi rozepsane udaje zmizet -
        // jinak by u nej dal visel herec, ktery s nim nema nic spolecneho.
        ...(jePrace
          ? poliUdalosti(kind, d)
          : {
              caflouProjectId: null,
              projectName: null,
              actorUserId: null,
              actorName: null,
              zvukarUserId: null,
              zvukarName: null,
            }),
      },
    });

    return NextResponse.json(upravena);
  } catch (err) {
    console.error('PATCH /api/kalendar/blokace selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Uložení se nezdařilo (${message}).` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageCalendar(session.user.role)) {
      return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Chybí blokace.' }, { status: 400 });

    await prisma.studioBlock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/blokace selhalo:', err);
    return NextResponse.json({ error: 'Smazání se nezdařilo.' }, { status: 500 });
  }
}
