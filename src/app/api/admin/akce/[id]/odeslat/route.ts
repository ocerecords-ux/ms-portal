import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { smiSpravovatAkce } from '@/lib/akceServer';
import { sendPozvankaAkceEmail } from '@/lib/email';
import { jazykPodleEmailu } from '@/lib/jazykPrijemce';
import { zakladniAdresa } from '@/lib/aplikace';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * ROZESLÁNÍ POZVÁNEK (zadání 25. 11. 2026: „abych mohl rozeslat ze systému").
 *
 * VÝCHOZÍ JE „KOMU JEŠTĚ NEODEŠLA". Tlačítko se mačká víckrát - jak lidi
 * přibývají - a nikdo nemá dostat tutéž pozvánku třikrát. Poslat znovu
 * konkrétnímu člověku jde jen jmenovitě (`pozvanky`).
 *
 * Posílá se po jednom mailu, ne hromadně na kopii: v odkazu je dotazník
 * konkrétního člověka a adresy pozvaných po sobě nemusí nikdo číst.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** Konkrétní pozvánky (poslat znovu). Prázdno = komu ještě neodešla. */
  pozvanky: z.array(z.string().trim().max(60)).max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await smiSpravovatAkce(session.user.id))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return odpovedChyby('chybaApi.neplatnaData', 400);
  const jmenovite = parsed.data.pozvanky ?? [];

  try {
    const akce = await prisma.akce.findUnique({ where: { id: params.id } });
    if (!akce) return odpovedChyby('chybaApi.neplatnaData', 404);

    const pozvanky = await prisma.pozvankaNaAkci.findMany({
      where: {
        akceId: params.id,
        ...(jmenovite.length > 0 ? { id: { in: jmenovite } } : { odeslanoAt: null }),
      },
      orderBy: { jmeno: 'asc' },
    });

    const zaklad = zakladniAdresa();
    let odeslano = 0;
    const nepovedlo: string[] = [];

    for (const p of pozvanky as { id: string; jmeno: string; email: string; token: string }[]) {
      try {
        const vysledek = await sendPozvankaAkceEmail({
          to: p.email,
          jmenoPrijemce: p.jmeno,
          nazevAkce: akce.nazev,
          kdy: akce.kdy,
          misto: akce.misto,
          text: akce.text,
          odpovedDo: akce.odpovedDo,
          odkaz: `${zaklad}/pozvanka/${p.token}`,
          jazyk: await jazykPodleEmailu(p.email),
        });
        if (vysledek.sent) {
          await prisma.pozvankaNaAkci.update({
            where: { id: p.id },
            data: { odeslanoAt: new Date() },
          });
          odeslano += 1;
        } else {
          nepovedlo.push(p.email);
        }
      } catch (err) {
        // Jedna neprůchozí adresa nesmí zastavit zbytek rozesílky.
        console.error(`Pozvánku na akci ${params.id} se nepodařilo odeslat na ${p.email}:`, err);
        nepovedlo.push(p.email);
      }
    }

    return NextResponse.json({ ok: true, odeslano, nepovedlo });
  } catch (err) {
    console.error('POST /api/admin/akce/[id]/odeslat selhalo:', err);
    return odpovedChyby('chybaApi.pozvankaNeodeslana', 500);
  }
}
