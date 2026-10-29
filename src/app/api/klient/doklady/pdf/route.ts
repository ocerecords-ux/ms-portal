import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pdfDokladuKlienta } from '@/lib/dokladKlientaPdfServer';
import { odpovedChybyVJazyce } from '@/lib/chybyApi';
import { nactiJazyk } from '@/lib/jazykServer';

/**
 * PDF DOKLADU PRO KLIENTA (zadání 1. 10. 2026: „tlačítko kde se otevře celý
 * náhled PDF a půjde i stáhnout").
 *
 * Kreslí ho tentýž kód jako naše PDF v administraci, takže klient dostane
 * přesně to, co jsme vystavili. Nic se nikam neukládá — PDF se složí při
 * každém otevření z dat dokladu.
 *
 * `?stahnout=1` pošle soubor jako přílohu, bez něj se otevře v prohlížeči.
 * Cache je vypnutá: doklad se může změnit (zaplatí se, schválí) a uložená
 * kopie v prohlížeči by pak lhala.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // JAZYK Z COOKIE (dávka 7r) - tlačítko v klientském přehledu otevírá PDF
  // odkazem, takže chybu nikdo nepřekládá a klient ji vidí tak, jak odejde.
  const jazyk = nactiJazyk();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return odpovedChybyVJazyce(jazyk, 'chybaApi.neprihlaseno', 401);
  // Klic tenant izolace: companyId vyhradne ze session.
  const companyId = session.user.companyId;
  if (!companyId) return odpovedChybyVJazyce(jazyk, 'nahled.uceBezFirmy', 403);

  const druh = req.nextUrl.searchParams.get('druh');
  const id = req.nextUrl.searchParams.get('id');
  if (!id || (druh !== 'nabidka' && druh !== 'faktura' && druh !== 'objednavka')) {
    return odpovedChybyVJazyce(jazyk, 'nahled.chybiDoklad', 400);
  }

  const firma = await prisma.company
    .findUnique({ where: { id: companyId }, select: { name: true } })
    .catch(() => null);

  const vysledek = await pdfDokladuKlienta(druh, id, companyId, firma?.name ?? '');
  if (!vysledek.ok) {
    return NextResponse.json({ error: vysledek.message }, { status: vysledek.stav });
  }

  const stahnout = req.nextUrl.searchParams.get('stahnout') === '1';
  return new NextResponse(new Uint8Array(vysledek.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${stahnout ? 'attachment' : 'inline'}; filename="${vysledek.nazev}"`,
      'Cache-Control': 'no-store',
    },
  });
}
