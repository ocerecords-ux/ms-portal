import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { kdoJe } from '@/lib/kdoJe';
import {
  celodenniOkno,
  nactiBookingPristup,
  nactiBookingUdalosti,
  zalozRezervaci,
  zrusRezervaci,
} from '@/lib/bookingServer';

/**
 * REZERVACE STUDIA MUZIKANTEM (zadání 25. 9. 2026).
 *
 * SCHVÁLNĚ MIMO /api/admin: tohle volá klient studia, ne náš tým. Kdo se kam
 * smí podívat, rozhoduje `nactiBookingPristup` - muzikant do svého studia
 * a nikam jinam, náš tým kamkoliv (na nahlédnutí).
 *
 * NÁZEV CIZÍ UDÁLOSTI SE SEM VŮBEC NEDOSTANE (zadání: „zbytek uvidí jen
 * zabraná né časy - ne názvy událostí"). Není to schované až v prohlížeči -
 * odpověď ho neobsahuje.
 */
export const dynamic = 'force-dynamic';

const zalozeni = z.object({
  studioId: z.string().trim().min(1).optional(),
  /** Buď konkrétní okno… */
  start: z.string().trim().min(8).optional(),
  end: z.string().trim().min(8).optional(),
  /** …nebo celý den ve tvaru 2026-10-14 - okno se dopočítá z otevírací doby. */
  den: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  celyDen: z.boolean().optional(),
  nazev: z.string().trim().min(1).max(160),
  poznamka: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const pristup = await nactiBookingPristup(ja, req.nextUrl.searchParams.get('studio'));
  if (!pristup) return NextResponse.json({ error: 'Nemáte přístup.' }, { status: 403 });

  const od = new Date(req.nextUrl.searchParams.get('od') ?? '');
  const doKdy = new Date(req.nextUrl.searchParams.get('do') ?? '');
  if (Number.isNaN(od.getTime()) || Number.isNaN(doKdy.getTime()) || doKdy <= od) {
    return NextResponse.json({ error: 'Chybí rozmezí.' }, { status: 400 });
  }

  const udalosti = await nactiBookingUdalosti(pristup.studio.id, od, doKdy, ja.id);
  return NextResponse.json({ studio: pristup.studio, udalosti, jenNahled: pristup.jenNahled });
}

export async function POST(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const parsed = zalozeni.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data;

  const pristup = await nactiBookingPristup(ja, d.studioId ?? null);
  if (!pristup) return NextResponse.json({ error: 'Nemáte přístup.' }, { status: 403 });

  const ucet = await prisma.user.findUnique({
    where: { id: ja.id },
    select: { id: true, name: true, email: true },
  });
  if (!ucet) return NextResponse.json({ error: 'Účet nenalezen.' }, { status: 403 });

  let start: Date;
  let end: Date;
  if (d.den) {
    const [rok, mesic, den] = d.den.split('-').map(Number);
    const okno = celodenniOkno(pristup.studio, { rok, mesic, den });
    if (!okno) return NextResponse.json({ error: 'booking.chybaZavreno', klic: true }, { status: 409 });
    start = okno.start;
    end = okno.end;
  } else {
    start = new Date(d.start ?? '');
    end = new Date(d.end ?? '');
  }

  const vysledek = await zalozRezervaci({
    studio: pristup.studio,
    user: ucet,
    start,
    end,
    celyDen: Boolean(d.den || d.celyDen),
    nazev: d.nazev,
    poznamka: d.poznamka,
  });
  if (!vysledek.ok) {
    // Klíč do slovníku, ne hotová věta - kalendář mluví česky i anglicky.
    return NextResponse.json({ error: vysledek.chyba, klic: true }, { status: 409 });
  }
  return NextResponse.json({ ok: true, id: vysledek.id });
}

export async function DELETE(req: NextRequest) {
  const ja = await kdoJe(req);
  if (!ja) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Chybí rezervace.' }, { status: 400 });

  const ucet = await prisma.user.findUnique({
    where: { id: ja.id },
    select: { id: true, name: true, email: true },
  });
  if (!ucet) return NextResponse.json({ error: 'Účet nenalezen.' }, { status: 403 });

  const vysledek = await zrusRezervaci(id, ucet);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 409 });
  return NextResponse.json({ ok: true });
}
