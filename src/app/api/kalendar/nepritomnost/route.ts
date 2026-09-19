import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar, isInternalRole } from '@/lib/roles';
import { zonedToUtc } from '@/lib/calendar';
import { PASMO_NEPRITOMNOSTI } from '@/lib/nepritomnost';

/**
 * Zápis do kalendáře Mimo studio (zadání 19. 9. 2026: „kalendář, do kterého si
 * budou lidi psát dovolené a kdy jsou mimo studio").
 *
 * KDO SMÍ PSÁT: celý tým, i zvukaři. Do kalendáře studií zvukař jen kouká,
 * ale svou dovolenou si má zapsat sám - kdyby to za něj musela dělat
 * produkce, nikdo by to nedělal.
 *
 * ZA KOHO: osobu si vybere každý, předvyplněný je přihlášený (upřesnění
 * 19. 9. 2026: „chci jen vybrat osobu. Ta bude předvyplněná podle
 * přihlášeného uživatele"). Upravit a smazat smí ten, koho se záznam týká,
 * ten, kdo ho zapsal, a správce kalendáře (produkce, Žůžo-labůžo).
 */

const schema = z.object({
  /** Za koho. Kdo kalendář nespravuje, zapisuje vždycky za sebe. */
  userId: z.string().trim().min(1).optional(),
  druh: z.enum(['DOVOLENA', 'MIMO_STUDIO', 'JINE']).default('DOVOLENA'),
  celyDen: z.boolean().default(true),
  /** YYYY-MM-DD */
  od: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** YYYY-MM-DD, u celodenní poslední den včetně */
  do: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** HH:MM - jen když to není celý den */
  casOd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  casDo: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  poznamka: z.string().trim().max(500).optional(),
});

/** Ručně, ne přes z.infer - ať je vidět, s čím výpočet času pracuje. */
type Vstup = {
  userId?: string;
  druh: 'DOVOLENA' | 'MIMO_STUDIO' | 'JINE';
  celyDen: boolean;
  od: string;
  do: string;
  casOd?: string;
  casDo?: string;
  poznamka?: string;
};

function naMinuty(cas: string): number {
  const [h, m] = cas.split(':').map(Number);
  return h * 60 + m;
}

/** Vstup z formuláře na začátek a konec. Vrací chybu jako text. */
function spocitejCas(d: Vstup): { start: Date; end: Date } | { chyba: string } {
  const [y1, m1, d1] = d.od.split('-').map(Number);
  const [y2, m2, d2] = d.do.split('-').map(Number);

  if (d.celyDen) {
    const start = zonedToUtc(y1, m1, d1, 0, PASMO_NEPRITOMNOSTI);
    // Konec je pulnoc PO poslednim dni - stejne jako den v kalendari.
    const end = zonedToUtc(y2, m2, d2 + 1, 0, PASMO_NEPRITOMNOSTI);
    if (end <= start) return { chyba: 'Poslední den nesmí být před prvním.' };
    if (end.getTime() - start.getTime() > 366 * 24 * 3600 * 1000) {
      return { chyba: 'Nepřítomnost delší než rok zapište prosím po částech.' };
    }
    return { start, end };
  }

  if (!d.casOd || !d.casDo) return { chyba: 'Vyplňte čas od a do.' };
  const start = zonedToUtc(y1, m1, d1, naMinuty(d.casOd), PASMO_NEPRITOMNOSTI);
  const end = zonedToUtc(y1, m1, d1, naMinuty(d.casDo), PASMO_NEPRITOMNOSTI);
  if (end <= start) return { chyba: 'Konec musí být po začátku.' };
  return { start, end };
}

async function prihlaseny() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session;
}

/** Za koho se zapisuje - a jestli za něj smí. */
async function urciKoho(
  session: NonNullable<Awaited<ReturnType<typeof prihlaseny>>>,
  chtene: string | undefined,
): Promise<{ id: string; jmeno: string } | { chyba: string; status: number }> {
  const id = chtene || session.user.id;
  const ucet = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!ucet || !ucet.active) return { chyba: 'Takového člověka v týmu nemáme.', status: 400 };
  if (!isInternalRole(ucet.role)) return { chyba: 'Do kalendáře Mimo studio se zapisují jen lidé z týmu.', status: 400 };
  return { id: ucet.id, jmeno: ucet.name || ucet.email };
}

/** Dny od `od` do `doo` včetně jako „YYYY-MM-DD". */
function dnyVRozsahu(od: string, doo: string): string[] {
  const dny: string[] = [];
  const d = new Date(`${od}T12:00:00.000Z`);
  const konec = new Date(`${doo}T12:00:00.000Z`);
  while (d <= konec && dny.length <= 366) {
    dny.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dny;
}

/**
 * ROZSAH DAT JEDNÍM ZADÁNÍM (zadání 19. 9. 2026: „abych mohl nastavit jedním
 * zadáním třeba celodenní mimo studio na zvolený počet dnů").
 *
 * Celodenní rozsah je JEDEN záznam od prvního do posledního dne - v kalendáři
 * se ukáže v každém dni a smaže se najednou. Rozsah NA ČAS („každé odpoledne
 * pondělí až středa") se zapíše do každého dne zvlášť: mezi těmi časy člověk
 * ve studiu je, takže to nejde vyjádřit jedním úsekem od-do.
 */
export async function POST(req: NextRequest) {
  const session = await prihlaseny();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  const kdo = await urciKoho(session, d.userId);
  if ('chyba' in kdo) return NextResponse.json({ error: kdo.chyba }, { status: kdo.status });

  const dny = d.celyDen ? [d.od] : dnyVRozsahu(d.od, d.do);
  if (!d.celyDen && dny.length === 0) {
    return NextResponse.json({ error: 'Poslední den nesmí být před prvním.' }, { status: 400 });
  }
  if (!d.celyDen && dny.length > 366) {
    return NextResponse.json({ error: 'Najednou jde zapsat nejvýš 366 dní.' }, { status: 400 });
  }

  const zaznamy: { start: Date; end: Date }[] = [];
  for (const den of dny) {
    // U celodenniho plati cely rozsah od-do, u casoveho jeden den po druhem.
    const cas = spocitejCas(d.celyDen ? d : { ...d, od: den, do: den });
    if ('chyba' in cas) return NextResponse.json({ error: cas.chyba }, { status: 400 });
    zaznamy.push(cas);
  }

  await prisma.nepritomnost.createMany({
    data: zaznamy.map((cas) => ({
      userId: kdo.id,
      jmeno: kdo.jmeno,
      druh: d.druh,
      celyDen: d.celyDen,
      start: cas.start,
      end: cas.end,
      poznamka: d.poznamka || null,
      zapsalId: session.user.id,
    })),
  });
  return NextResponse.json({ pocet: zaznamy.length }, { status: 201 });
}

/** Najde záznam a ověří, že na něj přihlášený smí sáhnout. */
async function zaznamKUprave(id: string | null) {
  const session = await prihlaseny();
  if (!session) return { chyba: 'Nemáte oprávnění.', status: 403 } as const;
  if (!id) return { chyba: 'Chybí, co upravit.', status: 400 } as const;
  const zaznam = await prisma.nepritomnost.findUnique({
    where: { id },
    select: { id: true, userId: true, zapsalId: true },
  });
  if (!zaznam) return { chyba: 'Záznam už neexistuje.', status: 404 } as const;
  const svuj = zaznam.userId === session.user.id || zaznam.zapsalId === session.user.id;
  if (!svuj && !canManageCalendar(session.user.role)) {
    return { chyba: 'Cizí záznam v kalendáři Mimo studio může upravit jen produkce.', status: 403 } as const;
  }
  return { session, zaznam } as const;
}

export async function PATCH(req: NextRequest) {
  const k = await zaznamKUprave(req.nextUrl.searchParams.get('id'));
  if ('chyba' in k) return NextResponse.json({ error: k.chyba }, { status: k.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const cas = spocitejCas(parsed.data);
  if ('chyba' in cas) return NextResponse.json({ error: cas.chyba }, { status: 400 });

  const kdo = await urciKoho(k.session, parsed.data.userId ?? k.zaznam.userId ?? undefined);
  if ('chyba' in kdo) return NextResponse.json({ error: kdo.chyba }, { status: kdo.status });

  await prisma.nepritomnost.update({
    where: { id: k.zaznam.id },
    data: {
      userId: kdo.id,
      jmeno: kdo.jmeno,
      druh: parsed.data.druh,
      celyDen: parsed.data.celyDen,
      start: cas.start,
      end: cas.end,
      poznamka: parsed.data.poznamka || null,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const k = await zaznamKUprave(req.nextUrl.searchParams.get('id'));
  if ('chyba' in k) return NextResponse.json({ error: k.chyba }, { status: k.status });
  await prisma.nepritomnost.delete({ where: { id: k.zaznam.id } });
  return NextResponse.json({ ok: true });
}
