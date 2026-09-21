import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewProjectDocuments } from '@/lib/roles';
import { overPrilohu, podepsanyOdkazNaPrilohu, podepsanyUploadSmlouvy } from '@/lib/storage';
import { userLabel } from '@/lib/chatServer';
import { brunoNapisSoukrome, nactiSmlouvyKlienta, vychoziPrijemceSmlouvy } from '@/lib/smlouvyKlientaServer';

/**
 * SMLOUVY OD KLIENTA u projektu (zadání 21. 9. 2026: „potřebuju někam do
 * dokladů projektu nahrát smlouvu v PDF, kterou nám posílá k podpisu klient
 * na práci ... chci ji jen archivovat. A taky tam chci nějaké tlačítko ...
 * Bruno napíše třeba soukromě do chatu Báře Šiblové, že je tam podepsaná
 * smlouva").
 *
 * GET              seznam (+ výchozí příjemce oznámení a lidi z týmu)
 * GET ?soubor=<id> přesměruje na krátkodobý odkaz na PDF (&stahnout=1 = stáhnout)
 * POST {akce:'nahrat', nazevSouboru}           → podepsaná adresa pro nahrání
 * POST {akce:'ulozit', klic, nazevSouboru, nazev?, podepsanoDne?} → záznam
 * POST {akce:'oznamit', id, komu?}             → Bruno napíše soukromě
 * DELETE ?id=
 *
 * Smí jen ten, kdo vidí doklady projektu (canViewProjectDocuments).
 */
export const dynamic = 'force-dynamic';

async function kdo() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewProjectDocuments(session.user.role)) return null;
  return session.user;
}

const datum = (iso: string) =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(iso));

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ja = await kdo();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const souborId = req.nextUrl.searchParams.get('soubor');
  if (souborId) {
    const s = await prisma.smlouvaKlienta.findFirst({ where: { id: souborId, caflouProjectId: params.id } });
    if (!s) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });
    const odkaz = await podepsanyOdkazNaPrilohu(s.souborKlic, s.nazevSouboru, req.nextUrl.searchParams.get('stahnout') === '1');
    if (!odkaz) return NextResponse.json({ error: 'Úložiště souborů není dostupné.' }, { status: 503 });
    return NextResponse.redirect(odkaz);
  }

  const [smlouvy, vychozi, lide] = await Promise.all([
    nactiSmlouvyKlienta(params.id),
    vychoziPrijemceSmlouvy(),
    prisma.user.findMany({
      where: { active: true, role: { in: ['ADMIN', 'PRODUKCE', 'ZVUKAR'] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return NextResponse.json({
    smlouvy,
    vychoziPrijemce: vychozi,
    lide: lide.map((l) => ({ id: l.id, jmeno: userLabel(l) })),
  });
}

const schema = z.object({
  akce: z.enum(['nahrat', 'ulozit', 'oznamit']),
  nazevSouboru: z.string().trim().max(255).optional(),
  klic: z.string().trim().max(400).optional(),
  nazev: z.string().trim().max(200).nullable().optional(),
  podepsanoDne: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  id: z.string().trim().max(60).optional(),
  komu: z.string().trim().max(60).nullable().optional(),
});
type Vstup = {
  akce: 'nahrat' | 'ulozit' | 'oznamit';
  nazevSouboru?: string;
  klic?: string;
  nazev?: string | null;
  podepsanoDne?: string | null;
  id?: string;
  komu?: string | null;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ja = await kdo();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data as Vstup;
  const jmeno = userLabel({ name: ja.name ?? null, email: ja.email ?? '' });

  if (d.akce === 'nahrat') {
    if (!d.nazevSouboru || !/\.pdf$/i.test(d.nazevSouboru)) {
      return NextResponse.json({ error: 'Nahrát jde jen PDF.' }, { status: 400 });
    }
    const upload = await podepsanyUploadSmlouvy(d.nazevSouboru);
    if (!upload) return NextResponse.json({ error: 'Úložiště souborů není nastavené.' }, { status: 503 });
    return NextResponse.json(upload);
  }

  if (d.akce === 'ulozit') {
    // Klic vyrabi server (viz podepsanyUploadSmlouvy) - cizi soubor sem
    // nikdo nepodstrci.
    if (!d.klic || !d.klic.startsWith('smlouvy-klientu/') || !d.nazevSouboru) {
      return NextResponse.json({ error: 'Chybí soubor.' }, { status: 400 });
    }
    const soubor = await overPrilohu(d.klic);
    if (!soubor) return NextResponse.json({ error: 'Soubor se do úložiště nenahrál. Zkuste to znovu.' }, { status: 400 });
    await prisma.smlouvaKlienta.create({
      data: {
        caflouProjectId: params.id,
        nazev: d.nazev?.trim() || d.nazevSouboru.replace(/\.pdf$/i, ''),
        souborKlic: d.klic,
        nazevSouboru: d.nazevSouboru,
        velikost: soubor.size,
        podepsanoDne: d.podepsanoDne ? new Date(`${d.podepsanoDne}T00:00:00.000Z`) : null,
        nahralUserId: ja.id,
        nahralJmeno: jmeno,
      },
    });
    return NextResponse.json({ smlouvy: await nactiSmlouvyKlienta(params.id) }, { status: 201 });
  }

  // akce === 'oznamit'
  const smlouva = d.id
    ? await prisma.smlouvaKlienta.findFirst({ where: { id: d.id, caflouProjectId: params.id } })
    : null;
  if (!smlouva) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });

  const prijemce = d.komu
    ? await prisma.user
        .findFirst({ where: { id: d.komu, active: true }, select: { id: true, name: true, email: true } })
        .then((u) => (u ? { id: u.id, jmeno: userLabel(u) } : null))
    : await vychoziPrijemceSmlouvy();
  if (!prijemce) {
    return NextResponse.json({ error: 'Nevím, komu to poslat - vyberte člověka z týmu.' }, { status: 400 });
  }

  const projekt = await prisma.projectMeta.findUnique({ where: { caflouProjectId: params.id }, select: { name: true } });
  const text = [
    `📄 Podepsaná smlouva od klienta je v portálu — ${projekt?.name || 'projekt'}.`,
    `„${smlouva.nazev}"${smlouva.podepsanoDne ? `, podepsaná ${datum(smlouva.podepsanoDne.toISOString())}` : ''}. Nahrál(a) ${smlouva.nahralJmeno ?? jmeno}.`,
    `Najdeš ji v detailu projektu v záložce Doklady: /projekty/${params.id}`,
  ].join('\n');

  const ok = await brunoNapisSoukrome(prijemce.id, text);
  if (!ok) return NextResponse.json({ error: 'Bruno nemá v portálu účet, zprávu nemá kdo poslat.' }, { status: 503 });

  await prisma.smlouvaKlienta.update({
    where: { id: smlouva.id },
    data: { oznamenoAt: new Date(), oznamenoKomu: prijemce.jmeno },
  });
  return NextResponse.json({ smlouvy: await nactiSmlouvyKlienta(params.id), komu: prijemce.jmeno });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ja = await kdo();
  if (!ja) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Chybí smlouva.' }, { status: 400 });
  // Soubor v ulozisti zustava - smazani zaznamu nesmi byt nevratne.
  await prisma.smlouvaKlienta.deleteMany({ where: { id, caflouProjectId: params.id } });
  return NextResponse.json({ smlouvy: await nactiSmlouvyKlienta(params.id) });
}
