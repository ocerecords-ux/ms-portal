import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageCalendar } from '@/lib/roles';
import { jeEmail } from '@/lib/hosteNataceni';
import { nactiNataceni, pridejHosty } from '@/lib/hosteNataceniServer';

/**
 * PŘIDÁNÍ HOSTŮ K NATÁČENÍ (zadání 30. 9. 2026: „potřebuju tam naházet
 * i více lidí").
 *
 * KAŽDÝ HOST ZVLÁŠŤ (9. 10. 2026: „chci tam samostatná pole. takhle můžou
 * vznikat chyby"). Do 9. 10. se posílal jeden text a portál si ho rozebíral
 * podle čárek - jenže jméno s čárkou („Novák, Jan") nebo chybějící mezera
 * udělaly z jednoho hosta dva a chyba byla vidět až v odeslané pozvánce.
 * Teď chodí hotový seznam adres, řádek po řádku. Jméno ani „ve studiu/online“
 * se už neptají (9. 10. 2026: „jméno dej pryč, stačí email“) - mail je pro všechny
 * týž a host se rozhodne sám, jestli přijde nebo se připojí.
 * Rozebírání textu zůstalo ve formuláři, kde slouží jen k rozházení vložené
 * schránky do řádků - a produkce to vidí a může to opravit, než odešle.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  hoste: z.array(z.object({ email: z.string().trim().min(3).max(320) })).min(1).max(50),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });
  if (!canManageCalendar(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { id, blockId } = await params;
  const nalezeno = await nactiNataceni(blockId);
  if (!nalezeno || nalezeno.caflouProjectId !== id) {
    return NextResponse.json({ error: 'Natáčení nenalezeno.' }, { status: 404 });
  }

  const telo = await req.json().catch(() => null);
  const data = schema.safeParse(telo);
  if (!data.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  /**
   * Adresy se kontrolují ZNOVU tady, ne jen ve formuláři - stejnou funkcí.
   * Co neprojde, se vrátí jako `spatne` a produkce to vidí u karty; tiše to
   * zahodit by znamenalo, že si někdo myslí, že pozvánka odešla.
   */
  const hoste = data.data.hoste.map((h) => ({ email: h.email.trim() })).filter((h) => h.email);
  const spatne = hoste.filter((h) => !jeEmail(h.email)).map((h) => h.email);
  const dobre = hoste.filter((h) => jeEmail(h.email));

  if (dobre.length === 0) {
    return NextResponse.json(
      { error: 'Žádná z adres nevypadá jako e-mail.', spatne },
      { status: 400 },
    );
  }

  const pridano = await pridejHosty(blockId, dobre, session.user.id ?? null);

  const nove = await nactiNataceni(blockId);
  return NextResponse.json({ pridano, spatne, nataceni: nove?.data ?? null });
}
