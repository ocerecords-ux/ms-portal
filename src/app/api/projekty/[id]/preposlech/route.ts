import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Záznamy chyb z přeposlechu nahrávky (AudioTagger) — zadání 11. 9. 2026.
 *
 * ČÍST A ZAPSAT smí i klient — buď přihlášený u projektu své firmy, nebo
 * odkazem z mailu. Právě proto se přeposlech posílá: aby napsal, co mu vadí.
 * Poznámka od nepřihlášeného klienta se podepíše „Klient", protože z odkazu
 * se jméno poznat nedá.
 *
 * UPRAVIT A SMAZAT SVŮJ ZÁZNAM smí i klient (zadání 12. 9. 2026: „potřebuju,
 * ať mají ještě klienti možnost upravit nebo smazat chyby, v tomhle bych jim
 * úpravy povolil"). Cizí záznamy klient nechává být — přepsat poznámku
 * někoho jiného není oprava, ale zmatek. Tým Mediaspace může všechno.
 *
 * Kdo přišel odkazem z mailu, nemá účet, takže „svoje" jsou pro něj záznamy
 * bez účtu — tedy ty z toho odkazu. Odkaz patří jednomu projektu a sdílí ho
 * lidé z jedné firmy, takže si mezi sebou opravit poznámku můžou.
 *
 * ODŠKRTNOUT PŘEPOSLECHNUTO smí i klient (zadání 12. 9. 2026: „na straně
 * klienta není možnost označit jako přeposlechnuté, mělo by to být asi vy").
 * Je to jeho slovo, že nahrávku poslechl — my se to jen dozvíme. U záznamu
 * zůstává jméno, takže je vidět, kdo to odškrtl.
 *
 * HISTORIE. Každý zásah se zapisuje do PreposlechUdalost, ať je zpětně vidět,
 * kdo kdy co udělal — i u poznámky, která už byla smazaná.
 *
 * `[id]` je ID projektu; stopy se neukládají, záznam ukazuje na stopu jejím
 * pořadím a nese i její název — viz komentář u modelu v schema.prisma.
 */
export const dynamic = 'force-dynamic';

async function over(req: NextRequest, caflouProjectId: string, jenInterni: boolean) {
  const pristup = await pristupKPreposlechu(caflouProjectId, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) {
    return { chyba: NextResponse.json({ error: pristup.message }, { status: pristup.status }) };
  }
  if (jenInterni && !pristup.interni) {
    return { chyba: NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 }) };
  }
  return {
    userId: pristup.userId,
    interni: pristup.interni,
    jmeno: pristup.jmeno ?? (pristup.pres_odkaz ? 'Klient' : null),
  };
}

/** Řádek do historie. Nikdy nevyhazuje - historie nesmí shodit samotný zápis. */
async function zapisUdalost(
  caflouProjectId: string,
  typ: string,
  popis: string,
  kdo: string | null,
  /** Které poznámky se to týkalo a jak vypadala PŘED tímhle krokem. */
  krok?: { chybaId?: string | null; snimek?: unknown },
) {
  await prisma.preposlechUdalost
    .create({
      data: {
        caflouProjectId,
        typ,
        popis,
        kdo,
        chybaId: krok?.chybaId ?? null,
        snimek: (krok?.snimek as never) ?? undefined,
      },
    })
    .catch((err) => console.error('Zápis do historie přeposlechu selhal:', err));
}

/** Kdo smí sáhnout na jeden záznam - viz komentář nahoře. */
type Pristup = { userId: string | null; interni: boolean };
function smiUpravit(chyba: { createdByUserId: string | null }, kdo: Pristup): boolean {
  if (kdo.interni) return true;
  // Prihlaseny klient: jen co napsal sam. Odkazem z mailu: zaznamy bez uctu.
  return kdo.userId ? chyba.createdByUserId === kdo.userId : chyba.createdByUserId === null;
}

async function stav(caflouProjectId: string, kdo?: Pristup) {
  const [chyby, preposlech, historie] = await Promise.all([
    prisma.preposlechChyba.findMany({
      where: { caflouProjectId },
      orderBy: [{ trackIndex: 'asc' }, { localTime: 'asc' }],
      take: 2000,
    }),
    prisma.preposlechStav.findUnique({ where: { caflouProjectId } }),
    prisma.preposlechUdalost.findMany({
      where: { caflouProjectId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  return {
    reviewed: Boolean(preposlech?.reviewed),
    reviewedByName: preposlech?.reviewedByName ?? null,
    reviewedAt: preposlech?.reviewedAt ? preposlech.reviewedAt.toISOString() : null,
    chyby: chyby.map((ch) => ({
      id: ch.id,
      trackIndex: ch.trackIndex,
      trackName: ch.trackName,
      localTime: ch.localTime,
      pdfPage: ch.pdfPage,
      zvyrazneni: (ch.zvyrazneni as unknown as Zvyrazneni | null) ?? null,
      description: ch.description,
      createdByName: ch.createdByName,
      createdAt: ch.createdAt.toISOString(),
      // At okno vi, u ktereho zaznamu ma ukazat tuzku a krizek.
      muzuUpravit: kdo ? smiUpravit(ch, kdo) : false,
    })),
    historie: historie.map((u) => ({
      id: u.id,
      typ: u.typ,
      popis: u.popis,
      kdo: u.kdo,
      kdy: u.createdAt.toISOString(),
      /**
       * Da se tenhle krok vratit? Jen kroky nad poznamkou, jen jednou
       * a jen tomu, kdo na tu poznamku smi (zadani 12. 9. 2026).
       */
      muzuVratit: Boolean(
        kdo &&
          !u.vracenoAt &&
          ['PRIDANA', 'UPRAVENA', 'SMAZANA'].includes(u.typ) &&
          u.chybaId &&
          smiUpravit({ createdByUserId: (u.snimek as { createdByUserId?: string | null } | null)?.createdByUserId ?? null }, kdo),
      ),
    })),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;
  return NextResponse.json(await stav(params.id, pristup));
}

/**
 * Zvyrazneny usek textu (zadani 11. 9. 2026). Ramecky jsou zlomky sirky
 * a vysky strany, proto strop 1 - v pixelech by zvyrazneni sedelo jen pri
 * te sirce okna, ve ktere vzniklo.
 */
const zvyrazneniSchema = z.object({
  strana: z.number().int().min(1).max(10000),
  text: z.string().max(2000),
  ramecky: z
    .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]))
    .max(200),
});

type Zvyrazneni = { strana: number; ramecky: [number, number, number, number][]; text: string };

const novaChyba = z.object({
  trackIndex: z.number().int().min(1).max(999),
  trackName: z.string().trim().min(1).max(300),
  localTime: z.number().min(0).max(24 * 3600),
  pdfPage: z.number().int().min(1).max(10000).nullable().optional(),
  zvyrazneni: zvyrazneniSchema.nullable().optional(),
  description: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;

  const parsed = novaChyba.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const vytvorena = await prisma.preposlechChyba.create({
    data: {
      caflouProjectId: params.id,
      ...parsed.data,
      pdfPage: parsed.data.pdfPage ?? null,
      zvyrazneni: parsed.data.zvyrazneni ?? undefined,
      createdByUserId: pristup.userId,
      createdByName: pristup.jmeno,
    },
  });

  await zapisUdalost(
    params.id,
    'PRIDANA',
    `Přidal(a) poznámku u stopy ${parsed.data.trackIndex}.`,
    pristup.jmeno,
    // Pred pridanim nebylo co vracet - snimek nese jen to, kdo poznamku
    // zalozil, aby se dalo overit, kdo ji smi zase odebrat.
    { chybaId: vytvorena.id, snimek: { createdByUserId: pristup.userId } },
  );

  return NextResponse.json(await stav(params.id, pristup));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;

  const telo = await req.json().catch(() => ({}));
  const reviewed = Boolean((telo as { reviewed?: unknown })?.reviewed);

  await prisma.preposlechStav.upsert({
    where: { caflouProjectId: params.id },
    create: {
      caflouProjectId: params.id,
      reviewed,
      reviewedAt: reviewed ? new Date() : null,
      reviewedByName: reviewed ? pristup.jmeno : null,
    },
    update: {
      reviewed,
      reviewedAt: reviewed ? new Date() : null,
      reviewedByName: reviewed ? pristup.jmeno : null,
    },
  });

  await zapisUdalost(
    params.id,
    reviewed ? 'PREPOSLECHNUTO' : 'ZNOVU',
    reviewed ? 'Označil(a) nahrávku jako přeposlechnutou.' : 'Vrátil(a) nahrávku k přeposlechu.',
    pristup.jmeno,
  );

  return NextResponse.json(await stav(params.id, pristup));
}

/** Úprava znění záznamu (zadání 12. 9. 2026). Mění se jen text poznámky. */
const upravaChyby = z.object({
  chyba: z.string().min(1).max(100),
  description: z.string().trim().min(1).max(4000),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;

  const parsed = upravaChyby.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const chyba = await prisma.preposlechChyba.findFirst({
    where: { id: parsed.data.chyba, caflouProjectId: params.id },
    select: { id: true, createdByUserId: true, description: true },
  });
  if (!chyba) return NextResponse.json({ error: 'Záznam se nenašel.' }, { status: 404 });
  if (!smiUpravit(chyba, pristup)) {
    return NextResponse.json({ error: 'Upravit jde jen vlastní záznam.' }, { status: 403 });
  }

  await prisma.preposlechChyba.update({
    where: { id: chyba.id },
    data: { description: parsed.data.description },
  });

  await zapisUdalost(params.id, 'UPRAVENA', 'Upravil(a) znění poznámky.', pristup.jmeno, {
    chybaId: chyba.id,
    snimek: { createdByUserId: chyba.createdByUserId, description: chyba.description },
  });

  return NextResponse.json(await stav(params.id, pristup));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;

  const chybaId = req.nextUrl.searchParams.get('chyba');
  if (!chybaId) return NextResponse.json({ error: 'Chybí ID záznamu.' }, { status: 400 });

  const chyba = await prisma.preposlechChyba.findFirst({
    where: { id: chybaId, caflouProjectId: params.id },
  });
  if (!chyba) return NextResponse.json(await stav(params.id, pristup));
  if (!smiUpravit(chyba, pristup)) {
    return NextResponse.json({ error: 'Smazat jde jen vlastní záznam.' }, { status: 403 });
  }

  await prisma.preposlechChyba.delete({ where: { id: chyba.id } });

  await zapisUdalost(params.id, 'SMAZANA', 'Smazal(a) poznámku.', pristup.jmeno, {
    chybaId: chyba.id,
    // Cely zaznam - z nej se poznamka da postavit zpatky.
    snimek: {
      createdByUserId: chyba.createdByUserId,
      createdByName: chyba.createdByName,
      trackIndex: chyba.trackIndex,
      trackName: chyba.trackName,
      localTime: chyba.localTime,
      pdfPage: chyba.pdfPage,
      zvyrazneni: chyba.zvyrazneni,
      description: chyba.description,
    },
  });

  return NextResponse.json(await stav(params.id, pristup));
}
