import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole, canEditProjectMeta } from '@/lib/roles';
import { klicZAdresyUloziste, podepsanyOdkazNaPrilohu } from '@/lib/storage';
import { nahrajPrilohuObjednavkyNaDisk } from '@/lib/prilohaObjednavkyServer';

/**
 * PŘÍLOHA OBJEDNÁVKY (zadání 22. 9. 2026: „z mailu nejde text otevřít
 * z notifikace nové objednávky").
 *
 * Mail dřív odkazoval přímo do úložiště - to je soukromé, takže odkaz končil
 * chybou „Access denied". Teď vede sem: portál ověří, kdo se ptá (tým
 * Mediaspace, nebo klient firmy, která objednávala), a pošle ho na
 * krátkodobý podepsaný odkaz. Nepřihlášeného pošle nejdřív na přihlášení.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const zpet = `/api/orders/${encodeURIComponent(params.id)}/priloha`;
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(zpet)}`, req.url));
  }
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { attachmentUrl: true, attachmentName: true, companyId: true },
  });
  if (!order?.attachmentUrl) return NextResponse.json({ error: 'Objednávka nemá přílohu.' }, { status: 404 });
  const smi = isInternalRole(session.user.role) || session.user.companyId === order.companyId;
  if (!smi) return NextResponse.json({ error: 'K této příloze nemáte přístup.' }, { status: 403 });

  const klic = klicZAdresyUloziste(order.attachmentUrl);
  const odkaz = klic ? await podepsanyOdkazNaPrilohu(klic, order.attachmentName || 'priloha', false) : null;
  if (!odkaz) return NextResponse.json({ error: 'Přílohu se nepodařilo otevřít.' }, { status: 502 });
  return NextResponse.redirect(odkaz);
}

/** Znovu nahrát přílohu do složky projektu na Disku (tlačítko v detailu projektu). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const vysledek = await nahrajPrilohuObjednavkyNaDisk(params.id);
  if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 502 });
  return NextResponse.json({ ok: true });
}
