import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';

/**
 * Vrácení jednoho kroku v přeposlechu (zadání 12. 9. 2026: „v té historii bych
 * ještě udělal to, že když to bude nějaký krok v editaci, tak bude možnost se
 * do toho bodu vrátit").
 *
 * Každý krok nad poznámkou si v historii nese SNÍMEK toho, jak poznámka
 * vypadala PŘED ním. Vrácení ten snímek použije:
 *
 *   PŘIDANÁ  → poznámka se odebere (předtím žádná nebyla)
 *   UPRAVENÁ → vrátí se předchozí znění
 *   SMAZANÁ  → poznámka se postaví zpátky
 *
 * Vrátit jde jen krok nad poznámkou, na kterou dotyčný smí sáhnout, a jen
 * jednou — u kroku zůstane značka, takže se v historii nedá donekonečna
 * přepínat tam a zpět. Samotné vrácení je taky krok a zapíše se do historie;
 * historie je záznam o práci, ne stav, který se přepisuje.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({ udalost: z.string().min(1).max(100) });

type Snimek = {
  createdByUserId?: string | null;
  createdByName?: string | null;
  trackIndex?: number;
  trackName?: string;
  localTime?: number;
  pdfPage?: number | null;
  zvyrazneni?: unknown;
  description?: string;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await pristupKPreposlechu(params.id, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) {
    return NextResponse.json({ error: pristup.message }, { status: pristup.status });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const udalost = await prisma.preposlechUdalost.findFirst({
    where: { id: parsed.data.udalost, caflouProjectId: params.id },
  });
  if (!udalost) return NextResponse.json({ error: 'Krok se nenašel.' }, { status: 404 });
  if (udalost.vracenoAt) {
    return NextResponse.json({ error: 'Tenhle krok už je vrácený.' }, { status: 409 });
  }
  if (!udalost.chybaId || !['PRIDANA', 'UPRAVENA', 'SMAZANA'].includes(udalost.typ)) {
    return NextResponse.json({ error: 'Tenhle krok vrátit nejde.' }, { status: 400 });
  }

  const snimek = (udalost.snimek ?? {}) as Snimek;
  const jmeno = pristup.jmeno ?? (pristup.pres_odkaz ? 'Klient' : null);

  // Stejné pravidlo jako u úpravy poznámky: tým všechno, ostatní jen svoje.
  const smi = pristup.interni
    ? true
    : pristup.userId
      ? (snimek.createdByUserId ?? null) === pristup.userId
      : (snimek.createdByUserId ?? null) === null;
  if (!smi) return NextResponse.json({ error: 'Vrátit jde jen vlastní krok.' }, { status: 403 });

  let popis = '';

  if (udalost.typ === 'PRIDANA') {
    await prisma.preposlechChyba.deleteMany({
      where: { id: udalost.chybaId, caflouProjectId: params.id },
    });
    popis = 'Vrátil(a) přidání poznámky — poznámka je pryč.';
  } else if (udalost.typ === 'UPRAVENA') {
    if (typeof snimek.description !== 'string') {
      return NextResponse.json({ error: 'K tomuhle kroku chybí předchozí znění.' }, { status: 400 });
    }
    const kolik = await prisma.preposlechChyba.updateMany({
      where: { id: udalost.chybaId, caflouProjectId: params.id },
      data: { description: snimek.description },
    });
    if (kolik.count === 0) {
      return NextResponse.json({ error: 'Poznámka už neexistuje.' }, { status: 404 });
    }
    popis = 'Vrátil(a) úpravu — poznámka je v předchozím znění.';
  } else {
    if (!snimek.trackName || typeof snimek.trackIndex !== 'number' || !snimek.description) {
      return NextResponse.json({ error: 'K tomuhle kroku chybí obsah poznámky.' }, { status: 400 });
    }
    await prisma.preposlechChyba.create({
      data: {
        caflouProjectId: params.id,
        trackIndex: snimek.trackIndex,
        trackName: snimek.trackName,
        localTime: snimek.localTime ?? 0,
        pdfPage: snimek.pdfPage ?? null,
        zvyrazneni: (snimek.zvyrazneni as never) ?? undefined,
        description: snimek.description,
        createdByUserId: snimek.createdByUserId ?? null,
        createdByName: snimek.createdByName ?? null,
      },
    });
    popis = 'Vrátil(a) smazání — poznámka je zpátky.';
  }

  await prisma.preposlechUdalost.update({
    where: { id: udalost.id },
    data: { vracenoAt: new Date() },
  });
  await prisma.preposlechUdalost
    .create({ data: { caflouProjectId: params.id, typ: 'VRACENO', popis, kdo: jmeno } })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
