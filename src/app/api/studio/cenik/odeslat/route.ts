import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { sendCenikEmail } from '@/lib/email';
import { renderCenikPdf } from '@/lib/cenikPdf';
import { cenikFileName } from '@/lib/studioCenik';
import { smiSpravovatCenik, zajistiCenik } from '@/lib/studioCenikServer';

/**
 * Odeslání ceníku e-mailem s PDF v příloze (zadání 28. 9. 2026: „aby se pak
 * dalo poslat někomu PDF nebo stáhnout").
 *
 * PDF SE VYRÁBÍ TADY, ne z toho, co poslal prohlížeč - jinak by šlo poslat
 * jménem Mediaspace jakýkoliv soubor. Bere se uložený ceník, takže co odejde,
 * je přesně to, co je v portálu; neuložené změny v editoru se do přílohy
 * nedostanou (proto se před odesláním ukládá).
 *
 * Odpověď chodí tomu, kdo ceník poslal - je to obchodní zpráva, ne doklad.
 */

const schema = z.object({
  studioId: z.string().trim().min(1),
  komu: z.string().trim().email(),
  predmet: z.string().trim().min(1).max(200),
  zprava: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Nepřihlášeno.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Zkontrolujte adresu, předmět a text zprávy.' }, { status: 400 });
  }
  const d = parsed.data;

  if (!(await smiSpravovatCenik(session.user.id, session.user.role as never, d.studioId))) {
    return NextResponse.json({ error: 'Na ceník tohohle studia nemáte právo.' }, { status: 403 });
  }

  try {
    const cenik = await zajistiCenik(d.studioId);
    const vysledek = await sendCenikEmail({
      to: d.komu,
      predmet: d.predmet,
      zprava: d.zprava,
      odpovedNa: session.user.email ?? null,
      pdf: { nazev: cenikFileName(cenik.nadpis), obsah: renderCenikPdf(cenik) },
    });
    if (!vysledek.sent) {
      return NextResponse.json({ error: 'Odesílání pošty není nastavené.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/studio/cenik/odeslat selhalo:', err);
    return NextResponse.json({ error: 'Ceník se nepodařilo odeslat.' }, { status: 500 });
  }
}
