import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { jePushNastaveno } from '@/lib/pushServer';

// Verejna diagnostika nasazeni (5. 9. 2026) - kdyz se nikdo nedokaze
// prihlasit, tohle rekne, jestli je problem v databazi, v nastaveni NextAuth,
// nebo jinde. Zamerne NEVRACI zadne tajne hodnoty, jen jestli jsou vyplnene.
export const dynamic = 'force-dynamic';

/** Ze zadane adresy jen jmeno serveru; z necehokoliv jineho nic. */
function bezpecnyHost(hodnota: string | undefined): string | null {
  const text = (hodnota || '').trim();
  if (!text) return null;
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname;
  } catch {
    return '(neplatná adresa)';
  }
}

export async function GET() {
  // Seznam uctu vidi jen Zuzo-labuzo. Do 9. 9. 2026 ho tahle stranka
  // vypisovala uplne komukoliv, kdo znal adresu - tedy e-maily a role celeho
  // tymu Mediaspace i klientu bez jakehokoli prihlaseni. Diagnostika nastaveni
  // (jestli jsou promenne vyplnene) verejna zustava, tam zadne udaje nejsou.
  const session = await getServerSession(authOptions);
  const jeSpravce = session?.user?.role === 'ADMIN';

  const env = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || null, // verejna adresa, neni tajna
    NEXTAUTH_SECRET_nastaveno: Boolean(process.env.NEXTAUTH_SECRET),
    DATABASE_URL_nastaveno: Boolean(process.env.DATABASE_URL),
    SMTP_nastaveno: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
    CAFLOU_nastaveno: Boolean(process.env.CAFLOU_API_KEY && process.env.CAFLOU_ACCOUNT_ID),
    GOOGLE_DISK_nastaveno: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    ),
    // Uloziste fotek/priloh. Kdyz neni nastavene, fotka uzivatele se od
    // 8. 9. 2026 uklada rovnou do databaze (viz lib/storage.ts).
    ULOZISTE_S3_nastaveno: Boolean(
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET,
    ),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || null,
    ADMIN_INITIAL_PASSWORD_nastaveno: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
    // Adresa uloziste ani oblast nejsou tajne (tajne jsou klice) a bez nich
    // se spatne hleda, proc podepsana adresa neprojde. Presto jen pro spravce.
    // Jen jmeno serveru, nikdy cela hodnota: kdyz se do promenne omylem
    // dostane tajny udaj (stalo se 9. 9. 2026), nesmi ho stranka vypsat ani
    // spravci.
    ULOZISTE_endpoint_server: jeSpravce ? bezpecnyHost(process.env.S3_ENDPOINT) : undefined,
    ULOZISTE_bucket: jeSpravce ? process.env.S3_BUCKET || null : undefined,
    ULOZISTE_region: jeSpravce ? process.env.S3_REGION || '(nenastaveno)' : undefined,
    UPOZORNENI_nastaveno: jePushNastaveno(),
  };

  let databaze: unknown;
  try {
    const [pocetUzivatelu, pocetAktivnich, ucty] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      jeSpravce
        ? prisma.user.findMany({
            select: { email: true, role: true, active: true },
            orderBy: { createdAt: 'asc' },
            take: 25,
          })
        : Promise.resolve(undefined),
    ]);
    databaze = {
      spojeni: 'ok',
      pocetUzivatelu,
      pocetAktivnich,
      // Jen e-maily a role, a jen pro prihlaseneho spravce.
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
