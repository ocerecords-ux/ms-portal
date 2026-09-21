import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { cookiePosluchace, pristupKPreposlechu } from '@/lib/preposlechPristup';
import { nactiPosluchace, zapisDoHistorie } from '@/lib/preposlechPosluchaciServer';
import { urlPreposlechu, zajistiOdkaz } from '@/lib/preposlechOdkaz';
import { sendPreposlechPredanEmail } from '@/lib/email';

/**
 * Posluchači odkazu do AudioTaggeru (zadání 21. 9. 2026) - viz
 * lib/preposlechPosluchaciServer.ts.
 *
 * GET    seznam + kdo z nich jsem já + e-mail, na který šel odkaz (předvyplní
 *        se v okně při prvním otevření)
 * POST   { lide: [{ email, jmeno? }], ja?: email } - přidá lidi; `ja` si
 *        prohlížeč zapamatuje jako „tohle jsem já". Kdo je přidaný někým
 *        jiným (předaný přeposlech), dostane e-mail s odkazem.
 * PATCH  { id, notifikace?, jmeno?, ja?: true }
 * DELETE ?id=
 *
 * Smí kdokoli, kdo smí do přeposlechu - klient z odkazu i my.
 */
export const dynamic = 'force-dynamic';

const ROK_S = 365 * 24 * 3600;

async function pristup(req: NextRequest, id: string) {
  return pristupKPreposlechu(id, req.nextUrl.searchParams.get('k'));
}

function zapamatuj(res: ReturnType<typeof NextResponse.json>, caflouProjectId: string, posluchacId: string) {
  res.cookies.set(cookiePosluchace(caflouProjectId), posluchacId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ROK_S,
  });
}

const cistyEmail = (e: string) => e.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const p = await pristup(req, params.id);
  if (!p.ok) return NextResponse.json({ error: p.message }, { status: p.status });

  const [lide, projekt] = await Promise.all([
    nactiPosluchace(params.id),
    prisma.projectMeta
      .findUnique({ where: { caflouProjectId: params.id }, select: { klient: { select: { email: true } } } })
      .catch(() => null),
  ]);
  return NextResponse.json({
    lide,
    ja: p.posluchacId ?? null,
    vychoziEmail: projekt?.klient?.email ?? null,
    // Nas clovek na klientove odkazu - okno „Kdo bude poslouchat?" mu
    // nevyskakuje (21. 9. 2026).
    interni: p.interni,
  });
}

const postSchema = z.object({
  lide: z
    .array(z.object({ email: z.string().trim().max(200), jmeno: z.string().trim().max(120).nullable().optional() }))
    .max(20),
  ja: z.string().trim().max(200).nullable().optional(),
});
type PostVstup = { lide: { email: string; jmeno?: string | null }[]; ja?: string | null };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const p = await pristup(req, params.id);
  if (!p.ok) return NextResponse.json({ error: p.message }, { status: p.status });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data as PostVstup;

  const lide = d.lide
    .map((l) => ({ email: cistyEmail(l.email), jmeno: l.jmeno?.trim() || null }))
    .filter((l) => l.email);
  const spatny = lide.find((l) => !EMAIL.test(l.email));
  if (spatny) return NextResponse.json({ error: `„${spatny.email}" není platný e-mail.` }, { status: 400 });
  const ja = d.ja ? cistyEmail(d.ja) : null;

  const stavajici = await prisma.preposlechPosluchac.findMany({
    where: { caflouProjectId: params.id },
    select: { email: true },
  });
  const uzBylo = new Set(stavajici.map((s) => s.email));

  // Kdo zapisuje: predstaveny posluchac, nas clovek, nebo prave ten, kdo se
  // ted predstavuje.
  const jaZaznam = ja ? lide.find((l) => l.email === ja) : null;
  const kdo = p.jmeno ?? (jaZaznam ? jaZaznam.jmeno || jaZaznam.email : p.pres_odkaz ? 'Klient' : null);

  const ulozeni: { id: string; email: string; jmeno: string | null }[] = [];
  for (const l of lide) {
    const z = await prisma.preposlechPosluchac.upsert({
      where: { caflouProjectId_email: { caflouProjectId: params.id, email: l.email } },
      create: { caflouProjectId: params.id, email: l.email, jmeno: l.jmeno, pridal: kdo },
      update: l.jmeno ? { jmeno: l.jmeno } : {},
      select: { id: true, email: true, jmeno: true },
    });
    ulozeni.push(z);
  }

  // Vychozi pocet stop pro zpravy o novych - posluchac se dozvi jen o tom,
  // co pribude OD TED (viz oznamNoveStopy).
  const stav = await prisma.preposlechStav
    .findUnique({ where: { caflouProjectId: params.id }, select: { pocetStop: true, oznamenoStop: true } })
    .catch(() => null);
  if (stav && stav.oznamenoStop === null) {
    await prisma.preposlechStav
      .update({ where: { caflouProjectId: params.id }, data: { oznamenoStop: stav.pocetStop } })
      .catch(() => undefined);
  }

  // Predany preposlech: novym lidem (krome toho, kdo se prave predstavil)
  // odejde odkaz mailem.
  const novi = ulozeni.filter((u) => !uzBylo.has(u.email) && u.email !== ja);
  if (novi.length > 0) {
    const [token, projekt] = await Promise.all([
      zajistiOdkaz(params.id, kdo),
      prisma.projectMeta.findUnique({ where: { caflouProjectId: params.id }, select: { name: true } }).catch(() => null),
    ]);
    const odeslano: string[] = [];
    if (token) {
      for (const n of novi) {
        try {
          const r = await sendPreposlechPredanEmail({
            to: n.email,
            jmeno: n.jmeno,
            nazevProjektu: projekt?.name || 'Nahrávka',
            odkaz: urlPreposlechu(token),
            kdo,
          });
          if (r.sent) odeslano.push(n.email);
        } catch (err) {
          console.error(`Předání přeposlechu na ${n.email} selhalo:`, err);
        }
      }
    }
    await zapisDoHistorie(
      params.id,
      'POSLUCHAC',
      `Předal(a) přeposlech: ${novi.map((n) => n.email).join(', ')}${
        odeslano.length > 0 ? ' - odkaz odešel e-mailem.' : ' - e-mail se nepodařilo odeslat.'
      }`,
      kdo,
    );
  }

  const jaUlozen = ja ? ulozeni.find((u) => u.email === ja) : null;
  if (jaUlozen && !uzBylo.has(jaUlozen.email)) {
    await zapisDoHistorie(params.id, 'POSLUCHAC', `Představil(a) se jako ${jaUlozen.email}.`, jaUlozen.jmeno || jaUlozen.email);
  } else if (jaUlozen) {
    await zapisDoHistorie(params.id, 'POSLUCHAC', `Přihlásil(a) se k odkazu jako ${jaUlozen.email}.`, jaUlozen.jmeno || jaUlozen.email);
  }

  const res = NextResponse.json({ ok: true, lide: await nactiPosluchace(params.id), ja: jaUlozen?.id ?? p.posluchacId ?? null });
  // „Tohle jsem ja" si pamatuje jen prohlizec klienta - nas clovek je
  // podepsany uctem.
  if (jaUlozen && !p.userId) zapamatuj(res, params.id, jaUlozen.id);
  return res;
}

const patchSchema = z.object({
  id: z.string().min(1).max(60),
  notifikace: z.boolean().optional(),
  jmeno: z.string().trim().max(120).nullable().optional(),
  ja: z.boolean().optional(),
});
type PatchVstup = { id: string; notifikace?: boolean; jmeno?: string | null; ja?: boolean };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const p = await pristup(req, params.id);
  if (!p.ok) return NextResponse.json({ error: p.message }, { status: p.status });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  const d = parsed.data as PatchVstup;

  const posluchac = await prisma.preposlechPosluchac.findFirst({ where: { id: d.id, caflouProjectId: params.id } });
  if (!posluchac) return NextResponse.json({ error: 'Posluchač nenalezen.' }, { status: 404 });

  const data: { notifikace?: boolean; jmeno?: string | null } = {};
  if (d.notifikace !== undefined) data.notifikace = d.notifikace;
  if (d.jmeno !== undefined) data.jmeno = d.jmeno?.trim() || null;
  if (Object.keys(data).length > 0) {
    await prisma.preposlechPosluchac.update({ where: { id: d.id }, data });
  }

  const kdo = d.ja ? posluchac.jmeno || posluchac.email : p.jmeno ?? (p.pres_odkaz ? 'Klient' : null);
  if (d.notifikace !== undefined) {
    await zapisDoHistorie(
      params.id,
      'POSLUCHAC',
      `${d.notifikace ? 'Zapnul(a)' : 'Vypnul(a)'} zprávy o nových stopách pro ${posluchac.email}.`,
      kdo,
    );
  }
  if (d.ja) {
    await zapisDoHistorie(params.id, 'POSLUCHAC', `Přihlásil(a) se k odkazu jako ${posluchac.email}.`, kdo);
  }

  const res = NextResponse.json({ ok: true, lide: await nactiPosluchace(params.id), ja: d.ja ? d.id : p.posluchacId ?? null });
  if (d.ja && !p.userId) zapamatuj(res, params.id, d.id);
  return res;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const p = await pristup(req, params.id);
  if (!p.ok) return NextResponse.json({ error: p.message }, { status: p.status });
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Chybí posluchač.' }, { status: 400 });

  const posluchac = await prisma.preposlechPosluchac.findFirst({ where: { id, caflouProjectId: params.id } });
  if (!posluchac) return NextResponse.json({ error: 'Posluchač nenalezen.' }, { status: 404 });
  await prisma.preposlechPosluchac.delete({ where: { id } });
  await zapisDoHistorie(
    params.id,
    'POSLUCHAC',
    `Odebral(a) ${posluchac.email} ze seznamu posluchačů.`,
    p.jmeno ?? (p.pres_odkaz ? 'Klient' : null),
  );

  const res = NextResponse.json({ ok: true, lide: await nactiPosluchace(params.id), ja: p.posluchacId === id ? null : p.posluchacId ?? null });
  if (p.posluchacId === id) res.cookies.delete(cookiePosluchace(params.id));
  return res;
}
