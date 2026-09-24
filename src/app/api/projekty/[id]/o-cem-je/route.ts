import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiZDisku } from '@/lib/preposlechDriveServer';
import { MAX_UKAZKY, jeOCemJeNastaveno, napisOCemJe } from '@/lib/oCemJeServer';

/**
 * O ČEM TA KNIHA JE (zadání 24. 9. 2026: „když se ta má událost v přehledu na
 * dnešek bude týkat první frekvence natáčení audioknihy, tak by mohl Bruno
 * projít text a dát mi alespoň základní info v pár větách, o čem ten příběh
 * je").
 *
 * GET řekne, co u projektu je: hotové shrnutí, nebo který soubor má prohlížeč
 * přečíst, aby se dalo napsat. POST přijme ukázku z toho PDF a shrnutí uloží.
 *
 * PROČ TO CHODÍ PŘES PROHLÍŽEČ: PDF umí portál číst jen tam (pdf.js z CDN).
 * Server by kvůli jednomu shrnutí musel do závislostí přibrat celý čtečkový
 * balík - viz lib/oCemJeServer.ts.
 *
 * Je to jen pro náš tým. Klient ani herec sem nemá co chodit, briefing je
 * naše příprava na natáčení.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  ukazka: z.string().min(500).max(MAX_UKAZKY + 5000),
  zdroj: z.string().trim().max(300),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const meta = await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId: params.id },
      select: { oCemJe: true, oCemJeZdroj: true, name: true },
    })
    .catch(() => null);

  if (!jeOCemJeNastaveno()) {
    return NextResponse.json({ text: meta?.oCemJe ?? null, textId: null, nazev: null });
  }

  /**
   * Který režijní edit je ve složce teď - podle něj se pozná, jestli uložené
   * shrnutí ještě platí. Když přibude nový text, napíše se znovu.
   */
  const zDisku = await nactiZDisku(params.id).catch(() => null);
  const soubor = zDisku && zDisku.ok ? zDisku.text : null;

  if (meta?.oCemJe && (!soubor || !meta.oCemJeZdroj || meta.oCemJeZdroj === soubor.name)) {
    return NextResponse.json({ text: meta.oCemJe, textId: null, nazev: null });
  }

  return NextResponse.json({
    text: meta?.oCemJe ?? null,
    // Co má prohlížeč přečíst. Null = není z čeho, okno nic nedělá.
    textId: soubor?.id ?? null,
    nazev: soubor?.name ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Chybí ukázka z textu.' }, { status: 400 });
  }

  const meta = await prisma.projectMeta
    .findUnique({ where: { caflouProjectId: params.id }, select: { name: true } })
    .catch(() => null);

  const text = await napisOCemJe(meta?.name?.trim() || `projekt ${params.id}`, parsed.data.ukazka);
  if (!text) return NextResponse.json({ text: null });

  try {
    await prisma.projectMeta.update({
      where: { caflouProjectId: params.id },
      data: { oCemJe: text, oCemJeZdroj: parsed.data.zdroj || null, oCemJeAt: new Date() },
    });
  } catch (err) {
    // Shrnutí se hodí i neuložené - ukážeme ho a příště se zkusí znovu.
    console.error('Ulozeni "o cem je" selhalo:', err);
  }

  return NextResponse.json({ text });
}
