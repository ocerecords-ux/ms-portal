import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { navodNaHtml, sediDruh, vidiNavod } from '@/lib/navody';
import { druhyKlienta } from '@/lib/navodyServer';
import { isInternalRole } from '@/lib/roles';

/**
 * NÁVOD K TOMU, CO MÁM PRÁVĚ PŘED SEBOU (zadání 24. 9. 2026: „ten návod na
 * AudioTagger by mohl být i přímo někde v něm pod nějakým otazníkem").
 *
 * Otazník v hlavičce si tudy vytáhne návod a ukáže ho rovnou v okně - člověk
 * kvůli jedné větě neodchází z rozdělané práce do Nápovědy.
 *
 * PTÁ SE NA TÉMA, NE NA ADRESU. Ke stejnému místu patří jiný návod nám a jiný
 * klientovi (přeposlech audioknihy vs. připomínky ke spotu), a rozhodnout to
 * podle role a druhu zakázek umí server - prohlížeč by o tom vědět neměl.
 *
 * Návod, který ten člověk nemá vidět, se tváří, jako by nebyl (404) - stejně
 * jako v Nápovědě samotné.
 */
export const dynamic = 'force-dynamic';

/** Co se ke kterému tématu nabízí: nejdřív to, co sedí, pak záloha. */
const TEMATA: Record<string, { tym: string[]; klient: string[] }> = {
  preposlech: {
    tym: ['audiotagger'],
    klient: ['poslech-pripominky-schvaleni', 'pripominky-ke-spotu'],
  },
  reklamy: {
    tym: ['reklamy-pripominkovani-schvalovani'],
    klient: ['pripominky-ke-spotu'],
  },
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const tema = req.nextUrl.searchParams.get('tema') ?? '';
  const nabidka = TEMATA[tema];
  if (!nabidka) return NextResponse.json({ error: 'Neznámé téma.' }, { status: 400 });

  const role = String(session.user.role);
  const slugy = isInternalRole(session.user.role) ? nabidka.tym : nabidka.klient;

  const druhy = await druhyKlienta(role, (session.user as { companyId?: string | null }).companyId);

  for (const slug of slugy) {
    const navod = await prisma.navod
      .findUnique({
        where: { slug },
        select: { slug: true, nazev: true, perex: true, obsah: true, zverejneno: true, proRole: true, proDruhy: true },
      })
      .catch(() => null);
    if (!navod || !navod.zverejneno) continue;
    if (!vidiNavod(navod.proRole, role)) continue;
    if (!sediDruh(navod.proDruhy ?? [], druhy)) continue;

    return NextResponse.json({
      slug: navod.slug,
      nazev: navod.nazev,
      perex: navod.perex,
      html: navodNaHtml(navod.obsah),
    });
  }

  return NextResponse.json({ error: 'Návod zatím není.' }, { status: 404 });
}
