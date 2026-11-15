import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { novyKlicTabule } from '@/lib/tabuleServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * Zapnutí / vypnutí tabule studia a výměna klíče (21. 9. 2026).
 * { akce: 'zapnout' | 'novy' | 'vypnout' }. Nový klíč = stará adresa
 * přestane fungovat (třeba když se displej ztratí nebo se odkaz rozkřikne).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return odpovedChyby('chybaApi.bezOpravneni', 403);
  const telo = (await req.json().catch(() => null)) as { akce?: unknown } | null;
  const akce = telo?.akce;
  if (akce !== 'zapnout' && akce !== 'novy' && akce !== 'vypnout') {
    return odpovedChyby('chybaApi.neplatnaAkce', 400);
  }
  const tabuleKlic = akce === 'vypnout' ? null : novyKlicTabule();
  await prisma.studio.update({ where: { id: params.id }, data: { tabuleKlic } });
  return NextResponse.json({ ok: true, klic: tabuleKlic });
}
