import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { INTERNAL_ROLES } from '@/lib/roles';
import { STAVY_S_NOTIFIKACI, jeToEmail, prazdneNastaveni } from '@/lib/notifikaceFirmy';

/**
 * Nastavení zpráv klientovi podle stavu projektu (zadání 10. 9. 2026).
 *
 * GET vrátí nastavení firmy doplněné o chybějící stavy (co uložené není, se
 * neposílá). PUT uloží celou tabulku najednou - je jich pět řádků, takže
 * ukládat po jednom by znamenalo pět dotazů a pět míst, kde se to může
 * rozejít.
 *
 * Součástí je i seznam interních příjemců (zadání 10. 9. 2026) - komu z nás
 * zprávy téhle firmy chodí. GET k němu přidává nabídku interních účtů, aby
 * je formulář nemusel tahat odjinud.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  nastaveni: z.record(z.enum(['NIKAM', 'KLIENT', 'INTERNE'])),
  interniPrijemci: z.array(z.string()).max(20).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const [radky, firma, ucty] = await Promise.all([
    prisma.notifikaceFirmy.findMany({
      where: { companyId: params.id },
      select: { stav: true, komu: true },
    }),
    prisma.company.findUnique({ where: { id: params.id }, select: { interniPrijemci: true } }),
    // Nabidka k zaskrtnuti - jen aktivni interni ucty Mediaspace. Adresu mimo
    // portal (napr. spolecnou schranku) jde ve formulari dopsat rucne.
    prisma.user.findMany({
      where: { role: { in: INTERNAL_ROLES }, active: true },
      select: { name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const nastaveni = prazdneNastaveni();
  for (const r of radky) {
    if (r.stav in nastaveni) nastaveni[r.stav] = r.komu;
  }
  return NextResponse.json({
    nastaveni,
    interniPrijemci: firma?.interniPrijemci ?? [],
    nabidkaUctu: ucty.map((u) => ({ email: u.email, jmeno: u.name ?? u.email })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

  const firma = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!firma) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  }

  // Ulozi se jen stavy, ktere zname - cokoliv jineho by v tabulce zustalo
  // viset a nikdo by uz nezjistil, odkud se to vzalo.
  const zapisy = Object.entries(parsed.data.nastaveni).filter(([stav]) => STAVY_S_NOTIFIKACI.includes(stav));

  // Interni prijemci - adresy se ocisti a zkontroluji tady, ne az pri
  // odesilani. Preklep v adrese by se jinak projevil tim, ze zprava tise
  // nikam nedojde.
  let prijemci: string[] | undefined;
  const zadane: string[] | undefined = parsed.data.interniPrijemci;
  if (zadane) {
    const ocistene: string[] = Array.from(
      new Set<string>(zadane.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    );
    const spatny = ocistene.find((e) => !jeToEmail(e));
    if (spatny) {
      return NextResponse.json({ error: `"${spatny}" nevypadá jako e-mail.` }, { status: 400 });
    }
    prijemci = ocistene;
  }

  await prisma.$transaction([
    ...zapisy.map(([stav, komu]) =>
      prisma.notifikaceFirmy.upsert({
        where: { companyId_stav: { companyId: params.id, stav } },
        create: { companyId: params.id, stav, komu },
        update: { komu },
      }),
    ),
    ...(prijemci
      ? [prisma.company.update({ where: { id: params.id }, data: { interniPrijemci: prijemci } })]
      : []),
  ]);

  return NextResponse.json({ ulozeno: true });
}
