import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canEditProjectMeta } from '@/lib/roles';
import { STAVY_S_NOTIFIKACI } from '@/lib/notifikaceFirmy';
import { posliNotifikaciKeStavu, znackaStavu } from '@/lib/notifikaceProjektuServer';

/**
 * Poslat zprávu o stavu projektu znovu (zadání 11. 9. 2026).
 *
 * PROČ TO TU JE: zpráva ke každému stavu odejde z projektu jen jednou —
 * jinak by ji klient dostal pokaždé, co někdo stav přehodí tam a zpátky.
 * Jenže pak nejde nic vyzkoušet a nejde ji poslat znovu, když spadla
 * klientovi do spamu. Tohle tu jednorázovou známku smaže a zprávu pošle
 * znovu podle stavu, ve kterém projekt PRÁVĚ je.
 *
 * Komu a jestli vůbec, to pořád rozhoduje nastavení u firmy — tohle nic
 * neobchází, jen znovu spustí to, co by se stalo při přehození stavu.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canEditProjectMeta(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  /**
   * Věta navíc nad textem ze vzoru - typicky omluva, když předchozí zpráva
   * dorazila s rozbitým odkazem (zadání 11. 9. 2026). Nepovinná; vzor se tím
   * nemění, platí jen pro tohle jedno odeslání.
   */
  const telo = (await req.json().catch(() => null)) as { uvod?: unknown } | null;
  const uvod = typeof telo?.uvod === 'string' ? telo.uvod.trim().slice(0, 600) : null;

  const meta = await prisma.projectMeta.findUnique({
    where: { caflouProjectId: params.id },
    select: { statusName: true },
  });
  const stav = meta?.statusName ?? '';
  if (!stav) {
    return NextResponse.json({ zprava: 'Projekt nemá vyplněný stav, není co poslat.' });
  }
  if (!STAVY_S_NOTIFIKACI.includes(stav)) {
    return NextResponse.json({ zprava: `Ke stavu „${stav}" se zpráva neposílá.` });
  }

  // Smazat jednorazovou znamku, jinak by se zprava povazovala za odeslanou.
  await prisma.notifikaceOdeslana
    .deleteMany({ where: { caflouProjectId: params.id, znacka: znackaStavu(stav) } })
    .catch(() => undefined);

  const vysledek = await posliNotifikaciKeStavu(params.id, stav, { uvod });

  const zprava =
    vysledek.stav === 'odeslano'
      ? `Odesláno na: ${vysledek.prijemci.join(', ')}`
      : vysledek.stav === 'vypnuto'
        ? `Firma má zprávu ke stavu „${stav}" vypnutou (karta firmy → Notifikace).`
        : vysledek.stav === 'chybi-prijemce'
          ? 'Projekt nemá vyplněného klienta, komu to poslat.'
          : vysledek.stav === 'chyba'
            ? `Nepodařilo se odeslat: ${vysledek.zprava}`
            : 'Zpráva už byla odeslaná.';

  return NextResponse.json({ zprava, vysledek: vysledek.stav });
}
