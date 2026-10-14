import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isInternalRole } from '@/lib/roles';
import { nactiTagy, tagovaniPovoleno } from '@/lib/tagyServer';

/**
 * TAGY FINÁLNÍ NAHRÁVKY - čtení a uložení hodnot (zadání 14. 10. 2026).
 *
 * JEN NÁŠ TÝM. Klient tagy nevidí ani nenastavuje: je to výrobní krok těsně
 * před předáním, ne něco, co by u nás objednával.
 *
 * GET  = co je ve složce + uložené hodnoty (`?slozka=` přepne na podsložku).
 * PUT  = uloží společné údaje a názvy stop. Do souborů ještě nesahá - na to
 *        je `tagy/zapsat`, ať se dá rozmyslet a uložit rozdělaná práce.
 */
export const dynamic = 'force-dynamic';

async function over(caflouProjectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isInternalRole(session.user.role)) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) };
  }
  if (!(await tagovaniPovoleno(caflouProjectId))) {
    return {
      chyba: NextResponse.json(
        { error: 'Tagování není u firmy tohohle projektu zapnuté.' },
        { status: 403 },
      ),
    };
  }
  return { chyba: null };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { chyba } = await over(params.id);
  if (chyba) return chyba;

  const slozka = req.nextUrl.searchParams.get('slozka') ?? undefined;
  return NextResponse.json(await nactiTagy(params.id, slozka || undefined));
}

const schema = z.object({
  spolecne: z.object({
    autor: z.string().trim().max(200),
    album: z.string().trim().max(200),
    interpret: z.string().trim().max(200),
    rok: z.number().int().min(1900).max(2200).nullable(),
    zanr: z.string().trim().max(60),
    vydavatel: z.string().trim().max(120),
  }),
  stopy: z
    .array(
      z.object({
        driveFileId: z.string().trim().min(5).max(200),
        nazevSouboru: z.string().trim().max(300),
        cislo: z.number().int().min(1).max(999),
        title: z.string().trim().max(300),
      }),
    )
    .max(500),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { chyba } = await over(params.id);
  if (chyba) return chyba;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { spolecne, stopy } = parsed.data;

  try {
    await prisma.projectMeta.update({
      where: { caflouProjectId: params.id },
      data: {
        tagAutor: spolecne.autor || null,
        tagAlbum: spolecne.album || null,
        tagInterpret: spolecne.interpret || null,
        tagRok: spolecne.rok,
        tagZanr: spolecne.zanr || null,
        tagVydavatel: spolecne.vydavatel || null,
      },
    });

    // Název stopy se váže na ID souboru - přejmenovaný soubor si svůj title
    // nese dál, nově přibylý si ho teprve zaslouží.
    for (const stopa of stopy) {
      await prisma.tagStopa.upsert({
        where: {
          caflouProjectId_driveFileId: {
            caflouProjectId: params.id,
            driveFileId: stopa.driveFileId,
          },
        },
        create: {
          caflouProjectId: params.id,
          driveFileId: stopa.driveFileId,
          nazevSouboru: stopa.nazevSouboru,
          cislo: stopa.cislo,
          title: stopa.title,
        },
        update: {
          nazevSouboru: stopa.nazevSouboru,
          cislo: stopa.cislo,
          title: stopa.title,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Tagy: ulozeni selhalo:', err);
    return NextResponse.json({ error: 'Uložení se nepodařilo.' }, { status: 500 });
  }
}
