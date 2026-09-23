import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageCalendar, isInternalRole } from '@/lib/roles';
import { zonedToUtc } from '@/lib/calendar';
import { notifyMany } from '@/lib/notifications';
import { userLabel } from '@/lib/chatServer';
import { PASMO_PORAD, platnyOdkaz, popisOpakovani, type Opakovani } from '@/lib/porady';

/**
 * Zápis do kalendáře Porady (zadání 21. 9. 2026).
 *
 * KDO: kdokoli z týmu. Poradu vidí, upravuje a ruší jen její ÚČASTNÍCI -
 * zakladatel je účastníkem vždycky. Kdo na poradě není, k ní přes tuhle adresu
 * nesáhne, ani když spravuje kalendář.
 *
 * Opakovaná porada se upravuje a ruší celá. Jeden výskyt jde vynechat
 * (DELETE s `den=`) - třeba když pondělní porada jednou odpadne.
 */

const OPAKOVANI = ['NE', 'DENNE', 'PRACOVNI_DNY', 'TYDNE', 'KAZDE_DVA_TYDNY', 'MESICNE'] as const;

const schema = z.object({
  /**
   * Do kterého kalendáře to patří (23. 9. 2026). SCHUZKA = Další schůzky,
   * ty zakládá a mění jen Žůžo-labůžo a produkce - vidí je celá produkce,
   * tak ať je nezaloží někdo, komu se pak neukážou.
   */
  druh: z.enum(['PORADA', 'SCHUZKA']).default('PORADA'),
  nazev: z.string().trim().min(1, 'Napište, o čem porada je.').max(200),
  /** YYYY-MM-DD - den (prvního) výskytu */
  den: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  casOd: z.string().regex(/^\d{2}:\d{2}$/),
  casDo: z.string().regex(/^\d{2}:\d{2}$/),
  ucastnici: z.array(z.string().trim().min(1)).max(60),
  opakovani: z.enum(OPAKOVANI).default('NE'),
  /** YYYY-MM-DD nebo nic = opakovat pořád */
  opakovatDo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  odkazVideo: z.string().trim().max(1000).nullable().optional(),
  poznamka: z.string().trim().max(2000).nullable().optional(),
});

/** Ručně, ne přes z.infer - ať je vidět, s čím výpočet pracuje. */
type Vstup = {
  druh: 'PORADA' | 'SCHUZKA';
  nazev: string;
  den: string;
  casOd: string;
  casDo: string;
  ucastnici: string[];
  opakovani: (typeof OPAKOVANI)[number];
  opakovatDo?: string | null;
  odkazVideo?: string | null;
  poznamka?: string | null;
};

async function prihlaseny() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) return null;
  return session.user;
}

const naMinuty = (cas: string) => {
  const [h, m] = cas.split(':').map(Number);
  return h * 60 + m;
};

/** Vstup na data pro databázi, nebo chybová hláška. */
async function priprav(d: Vstup, ja: string) {
  const [y, m, den] = d.den.split('-').map(Number);
  const start = zonedToUtc(y, m, den, naMinuty(d.casOd), PASMO_PORAD);
  const end = zonedToUtc(y, m, den, naMinuty(d.casDo), PASMO_PORAD);
  if (end <= start) return { chyba: 'Konec porady musí být po začátku.' } as const;
  if (d.opakovani !== 'NE' && d.opakovatDo && d.opakovatDo < d.den) {
    return { chyba: 'Opakování nesmí skončit dřív, než porada začne.' } as const;
  }
  const odkaz = d.odkazVideo?.trim() ? platnyOdkaz(d.odkazVideo) : null;
  if (d.odkazVideo?.trim() && !odkaz) return { chyba: 'Odkaz na videohovor není platná adresa.' } as const;

  // Pozvat jde jen aktivní lidi z týmu; zakladatel je u porady vždycky.
  const ids = Array.from(new Set([ja, ...d.ucastnici]));
  const lide = await prisma.user.findMany({
    where: { id: { in: ids }, active: true, role: { in: ['ADMIN', 'PRODUKCE', 'ZVUKAR'] } },
    select: { id: true },
  });
  const ucastnici = lide.map((l) => l.id);
  if (!ucastnici.includes(ja)) ucastnici.push(ja);

  return {
    data: {
      druh: d.druh,
      nazev: d.nazev,
      start,
      end,
      opakovani: d.opakovani,
      opakovatDo: d.opakovani !== 'NE' && d.opakovatDo ? new Date(`${d.opakovatDo}T00:00:00.000Z`) : null,
      odkazVideo: odkaz,
      poznamka: d.poznamka?.trim() || null,
    },
    ucastnici,
  } as const;
}

function popisTerminu(d: Vstup) {
  const den = new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
    new Date(`${d.den}T12:00:00`),
  );
  const opak = d.opakovani !== 'NE' ? ` · ${popisOpakovani(d.opakovani as Opakovani).toLowerCase()}` : '';
  return `${den} ${d.casOd}–${d.casDo}${opak}`;
}

export async function POST(req: NextRequest) {
  const ja = await prihlaseny();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    if (parsed.data.druh === 'SCHUZKA' && !canManageCalendar(ja.role)) {
      return NextResponse.json({ error: 'Další schůzky zakládá produkce.' }, { status: 403 });
    }

    const p = await priprav(parsed.data, ja.id);
    if ('chyba' in p) return NextResponse.json({ error: p.chyba }, { status: 400 });

    const porada = await prisma.porada.create({
      data: {
        ...p.data,
        zalozilId: ja.id,
        ucastnici: { create: p.ucastnici.map((userId) => ({ userId })) },
      },
    });

    // Pozvaní se to dozvědí pod zvonkem - jinak by poradu našli, až když
    // se náhodou podívají do kalendáře.
    const jmeno = userLabel({ name: ja.name ?? null, email: ja.email ?? '' });
    await notifyMany(
      p.ucastnici.filter((id) => id !== ja.id),
      {
        kind: 'porada-pozvanka',
        title: `${jmeno} vás pozval(a) na ${parsed.data.druh === 'SCHUZKA' ? 'schůzku' : 'poradu'}`,
        body: `${parsed.data.nazev} — ${popisTerminu(parsed.data)}`,
        url: `/kalendar?datum=${parsed.data.den}`,
      },
    );

    return NextResponse.json({ id: porada.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/kalendar/porady selhalo:', err);
    return NextResponse.json({ error: 'Uložit se nepodařilo.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ja = await prihlaseny();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Chybí porada.' }, { status: 400 });
  try {
    // Poradu smí měnit jen její účastník; Další schůzku kdokoliv z produkce -
    // je to společný kalendář, ne soukromá skupina.
    const puvodni = await prisma.porada.findFirst({
      where: { id, ...(canManageCalendar(ja.role) ? {} : { ucastnici: { some: { userId: ja.id } } }) },
      include: { ucastnici: { select: { userId: true } } },
    });
    if (!puvodni) return NextResponse.json({ error: 'Porada nenalezena.' }, { status: 404 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    if (
      (parsed.data.druh === 'SCHUZKA' || puvodni.druh === 'SCHUZKA') &&
      !canManageCalendar(ja.role)
    ) {
      return NextResponse.json({ error: 'Další schůzky mění produkce.' }, { status: 403 });
    }

    const p = await priprav(parsed.data, ja.id);
    if ('chyba' in p) return NextResponse.json({ error: p.chyba }, { status: 400 });

    await prisma.$transaction([
      prisma.poradaUcastnik.deleteMany({ where: { poradaId: id } }),
      prisma.porada.update({
        where: { id },
        data: {
          ...p.data,
          // Posunutý začátek = jiné výskyty; staré vynechané dny už neplatí.
          ...(p.data.start.getTime() !== puvodni.start.getTime() ? { vynechano: [] } : {}),
          ucastnici: { create: p.ucastnici.map((userId) => ({ userId })) },
        },
      }),
    ]);

    // Změna se ohlásí všem, kdo na poradě byli nebo jsou - i tomu, kdo
    // z ní právě vypadl.
    const jmeno = userLabel({ name: ja.name ?? null, email: ja.email ?? '' });
    const puvodniLide = puvodni.ucastnici.map((u) => u.userId);
    const noviLide = p.ucastnici.filter((u) => !puvodniLide.includes(u));
    const odebrani = puvodniLide.filter((u) => !p.ucastnici.includes(u));
    const zustali = p.ucastnici.filter((u) => puvodniLide.includes(u));
    const popis = `${parsed.data.nazev} — ${popisTerminu(parsed.data)}`;
    const url = `/kalendar?datum=${parsed.data.den}`;
    await notifyMany(zustali.filter((u) => u !== ja.id), { kind: 'porada-zmena', title: `${jmeno} upravil(a) poradu`, body: popis, url });
    await notifyMany(noviLide.filter((u) => u !== ja.id), { kind: 'porada-pozvanka', title: `${jmeno} vás pozval(a) na poradu`, body: popis, url });
    await notifyMany(odebrani.filter((u) => u !== ja.id), { kind: 'porada-zrusena', title: `Na poradě už nejste`, body: puvodni.nazev, url: null });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/kalendar/porady selhalo:', err);
    return NextResponse.json({ error: 'Uložit se nepodařilo.' }, { status: 500 });
  }
}

/**
 * Zrušení porady. S `den=YYYY-MM-DD` se vynechá jen ten jeden výskyt
 * opakované porady; bez něj zmizí celá.
 */
export async function DELETE(req: NextRequest) {
  const ja = await prihlaseny();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const den = url.searchParams.get('den');
  if (!id) return NextResponse.json({ error: 'Chybí porada.' }, { status: 400 });
  try {
    const porada = await prisma.porada.findFirst({
      where: { id, ...(canManageCalendar(ja.role) ? {} : { ucastnici: { some: { userId: ja.id } } }) },
      include: { ucastnici: { select: { userId: true } } },
    });
    if (!porada) return NextResponse.json({ error: 'Porada nenalezena.' }, { status: 404 });
    if (porada.druh === 'SCHUZKA' && !canManageCalendar(ja.role)) {
      return NextResponse.json({ error: 'Další schůzky ruší produkce.' }, { status: 403 });
    }

    const jmeno = userLabel({ name: ja.name ?? null, email: ja.email ?? '' });
    const ostatni = porada.ucastnici.map((u) => u.userId).filter((u) => u !== ja.id);

    if (den && /^\d{4}-\d{2}-\d{2}$/.test(den) && porada.opakovani !== 'NE') {
      await prisma.porada.update({
        where: { id },
        data: { vynechano: Array.from(new Set([...porada.vynechano, den])) },
      });
      const kdy = new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
        new Date(`${den}T12:00:00`),
      );
      await notifyMany(ostatni, { kind: 'porada-zrusena', title: `${jmeno} zrušil(a) poradu ${kdy}`, body: porada.nazev, url: `/kalendar?datum=${den}` });
      return NextResponse.json({ ok: true });
    }

    await prisma.porada.delete({ where: { id } });
    await notifyMany(ostatni, {
      kind: 'porada-zrusena',
      title: `${jmeno} zrušil(a) poradu`,
      body: porada.opakovani !== 'NE' ? `${porada.nazev} (celá řada)` : porada.nazev,
      url: null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kalendar/porady selhalo:', err);
    return NextResponse.json({ error: 'Zrušit se nepodařilo.' }, { status: 500 });
  }
}
