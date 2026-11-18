import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { casSlovy } from '@/lib/delkaNahravkyServer';
import { buildPreposlechDikyHtml } from '@/lib/email';
import { dosadZnacky } from '@/lib/oznameni';
import { zneni } from '@/lib/oznameniServer';

/** Náhled poděkování za kontrolní poslech (18. 11. 2026) - na smyšlených datech. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const hodnoty = {
    projekt: 'Hraniční případ',
    jmeno: 'Jana',
    celkovycas: casSlovy(31335),
    pocetstop: '24',
  };
  const t = await zneni('PREPOSLECH_DIKY');
  const html = buildPreposlechDikyHtml({
    to: session.user.email ?? '',
    predmet: dosadZnacky(t.predmet, hodnoty),
    nadpis: dosadZnacky(t.nadpis, hodnoty),
    text: dosadZnacky(t.text, hodnoty),
    celkovyCas: hodnoty.celkovycas,
    pocetStop: 24,
    odkazPodnet: '#',
  });
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
