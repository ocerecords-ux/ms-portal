import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Verejna diagnostika nasazeni (5. 9. 2026) - kdyz se nikdo nedokaze
// prihlasit, tohle rekne, jestli je problem v databazi, v nastaveni NextAuth,
// nebo jinde. Zamerne NEVRACI zadne tajne hodnoty, jen jestli jsou vyplnene.
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || null, // verejna adresa, neni tajna
    NEXTAUTH_SECRET_nastaveno: Boolean(process.env.NEXTAUTH_SECRET),
    DATABASE_URL_nastaveno: Boolean(process.env.DATABASE_URL),
    SMTP_nastaveno: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
    CAFLOU_nastaveno: Boolean(process.env.CAFLOU_API_KEY && process.env.CAFLOU_ACCOUNT_ID),
    GOOGLE_DISK_nastaveno: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    ),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || null,
    ADMIN_INITIAL_PASSWORD_nastaveno: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
  };

  let databaze: unknown;
  try {
    const [pocetUzivatelu, pocetAktivnich, ucty] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.findMany({
        select: { email: true, role: true, active: true },
        orderBy: { createdAt: 'asc' },
        take: 25,
      }),
    ]);
    databaze = {
      spojeni: 'ok',
      pocetUzivatelu,
      pocetAktivnich,
      // Jen e-maily a role - zadna hesla ani jine udaje.
      ucty,
    };
  } catch (err) {
    databaze = {
      spojeni: 'chyba',
      chyba: err instanceof Error ? err.message : 'neznámá chyba',
    };
  }

  return NextResponse.json({ cas: new Date().toISOString(), env, databaze });
}
