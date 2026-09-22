import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { nextCode, codePrefixForRole } from '@/lib/codes';

/**
 * ÚČET TABULE PRO STUDIO (zadání 22. 9. 2026: „vytvořil bych pro každé studio
 * účet, kterým se přihlásím v Chromu na počítači u monitoru"; upřesnění:
 * „nemusí tam být e-mail, to nedává smysl").
 *
 * Účet nemá e-mail, jen přihlašovací jméno podle studia („brno1", „praha").
 * Drží se v políčku `email` (unikátní klíč přihlášení) - přihlašovací
 * formulář bere e-mail i jméno. Heslo portál vymyslí sám a ukáže ho jednou.
 *
 * POST {} - založí účet (nebo existujícímu vymyslí nové heslo) a vrátí
 * { login, heslo }. Po přihlášení vidí jen tabuli svého studia.
 */
const schema = z.object({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{1,40}$/, 'Jméno jen z písmen bez diakritiky, čísel, tečky a pomlčky.')
    .optional(),
});

/** „MS Studio - Brno I" / zkratka „Brno I" → „brno1". */
function loginZeStudia(zkratka: string): string {
  const rimske: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };
  const slova = zkratka
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((s) => rimske[s] ?? s);
  return slova.join('') || 'tabule';
}

/** Heslo, které jde opsat z papírku: bez 0/O a 1/l/I. */
function vymysliHeslo(): string {
  const znaky = 'abcdefghjkmnpqrstuvwxyz23456789';
  let h = '';
  for (let i = 0; i < 10; i++) h += znaky[randomInt(znaky.length)];
  return `${h.slice(0, 5)}-${h.slice(5)}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const studio = await prisma.studio.findUnique({ where: { id: params.id }, select: { id: true, name: true, shortName: true } });
  if (!studio) return NextResponse.json({ error: 'Studio nenalezeno.' }, { status: 404 });

  const heslo = vymysliHeslo();
  const passwordHash = await bcrypt.hash(heslo, 10);

  // Účet tohohle studia už je → jen nové heslo.
  const stavajici = await prisma.user.findFirst({
    where: { role: 'TABULE', tabuleStudioId: studio.id },
    select: { id: true, email: true },
  });
  if (stavajici && !parsed.data.login) {
    await prisma.user.update({ where: { id: stavajici.id }, data: { passwordHash, active: true } });
    return NextResponse.json({ ok: true, login: stavajici.email, heslo });
  }

  const login = parsed.data.login || loginZeStudia(studio.shortName || studio.name);
  const obsazeny = await prisma.user.findUnique({ where: { email: login }, select: { id: true, role: true } });
  if (obsazeny && obsazeny.role !== 'TABULE') {
    return NextResponse.json({ error: `Jméno „${login}" už používá jiný účet.` }, { status: 409 });
  }
  if (obsazeny) {
    await prisma.user.update({
      where: { id: obsazeny.id },
      data: { passwordHash, tabuleStudioId: studio.id, active: true },
    });
    return NextResponse.json({ ok: true, login, heslo });
  }

  const code = await nextCode(codePrefixForRole('TABULE'));
  await prisma.user.create({
    data: {
      code,
      email: login,
      name: `Tabule ${studio.shortName || studio.name}`,
      passwordHash,
      role: 'TABULE',
      tabuleStudioId: studio.id,
    },
  });
  return NextResponse.json({ ok: true, login, heslo });
}

/** Zrušení účtu tabule - vypne se (přihlášení přestane fungovat). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const userId = req.nextUrl.searchParams.get('ucet') ?? '';
  const ucet = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, tabuleStudioId: true } });
  if (!ucet || ucet.role !== 'TABULE' || ucet.tabuleStudioId !== params.id) {
    return NextResponse.json({ error: 'Účet tabule nenalezen.' }, { status: 404 });
  }
  await prisma.user.update({ where: { id: ucet.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
