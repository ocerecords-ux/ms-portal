import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { AIR_BANK, bankaNastavena, nactiInstituce, zalozSouhlas, zrusSouhlas } from '@/lib/gocardless';

/**
 * NAPOJENÍ ÚČTU NA PORTÁL (zadání 17. 9. 2026: „potřebuju, ať se ta banka
 * páruje sama").
 *
 * POST založí souhlas u GoCardless a vrátí odkaz - na něm se člověk přihlásí
 * do své banky a souhlas potvrdí. Teprve pak má portál k pohybům přístup.
 * DELETE účet odpojí a souhlas v bance zruší.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  institutionId: z.string().trim().min(3).optional(),
  issuerCompanyId: z.string().trim().min(1).optional(),
  label: z.string().trim().max(80).optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!bankaNastavena()) return NextResponse.json({ banky: [], nastaveno: false });
  try {
    const banky = await nactiInstituce('cz');
    return NextResponse.json({
      nastaveno: true,
      banky: banky.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    });
  } catch (err) {
    console.error('Načtení bank z GoCardless selhalo:', err);
    return NextResponse.json({ error: 'Seznam bank se nepodařilo načíst.' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  if (!bankaNastavena()) {
    return NextResponse.json(
      { error: 'Napojení na banku zatím není nastavené - chybí klíče GoCardless.' },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const institutionId = parsed.data.institutionId || AIR_BANK;
  const zaklad = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host') ?? 'www.msportal.cz'}`;

  try {
    // Kolik dnů souhlas vydrží a jak hluboko do historie se smí, si každá
    // banka určuje sama - zeptáme se, ať to GoCardless neodmítne.
    const banky = await nactiInstituce('cz').catch(() => []);
    const banka = banky.find((b) => b.id === institutionId);
    const maxPlatnost = Number(banka?.max_access_valid_for_days ?? 90);
    const maxHistorie = Number(banka?.transaction_total_days ?? 90);

    const souhlas = await zalozSouhlas({
      institutionId,
      redirect: `${zaklad}/admin/doklady/banka?hotovo=1`,
      reference: `msportal-${Date.now()}`,
      dnuPlatnosti: Number.isFinite(maxPlatnost) && maxPlatnost > 0 ? Math.min(180, maxPlatnost) : 90,
      dnuHistorie: Number.isFinite(maxHistorie) && maxHistorie > 0 ? Math.min(90, maxHistorie) : 90,
    });

    const platiDo = new Date();
    platiDo.setDate(platiDo.getDate() + souhlas.platiDoDnu);

    await prisma.bankConnection.create({
      data: {
        institutionId,
        institutionName: banka?.name || (institutionId === AIR_BANK ? 'Air Bank' : institutionId),
        requisitionId: souhlas.requisitionId,
        agreementId: souhlas.agreementId,
        issuerCompanyId: parsed.data.issuerCompanyId ?? null,
        label: parsed.data.label ?? null,
        consentExpiresAt: platiDo,
        stav: 'CEKA',
      },
    });

    return NextResponse.json({ link: souhlas.link });
  } catch (err) {
    console.error('Založení souhlasu selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Napojení se nepodařilo (${message}).` }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'Chybí id napojení.' }, { status: 400 });

  const napojeni = await prisma.bankConnection.findUnique({ where: { id }, select: { requisitionId: true } });
  if (!napojeni) return NextResponse.json({ error: 'Napojení nenalezeno.' }, { status: 404 });

  if (bankaNastavena()) await zrusSouhlas(napojeni.requisitionId);
  // Stažené pohyby odcházejí s napojením (onDelete: Cascade), spárované
  // faktury zůstávají uhrazené - o tom už rozhodl člověk.
  await prisma.bankConnection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
