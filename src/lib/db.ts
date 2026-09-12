import { PrismaClient } from '@prisma/client';

/**
 * Pripojeni k databazi.
 *
 * Oprava 8. 9. 2026: nasazeni obcas padalo na
 * "FATAL: (EMAXCONNSESSION) max clients reached in session mode - pool_size: 15".
 * Supabase pousti pres pooler jen omezeny pocet spojeni a kazda serverless
 * funkce na Vercelu si drzi vlastni pool - pri vic soubeznych funkcich se to
 * vycerpa. Kazda instance si proto bere jen JEDNO spojeni; na serverless je to
 * spravne nastaveni (funkce stejne obslouzi jeden pozadavek po druhem) a
 * poolovani nechavame na Supabase.
 *
 * Parametry pripojujeme az tady za behu, aby v promenne DATABASE_URL zustal
 * cisty pripojovaci retezec - neni potreba do nej nikde sahat.
 */
/**
 * TRANSAKCNI REZIM MISTO SESSION (oprava 12. 9. 2026).
 *
 * Portal spadl na bilou stranku a chat vratil prazdny seznam, obojí kvuli
 *
 *     FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *            - max clients are limited to pool_size: 15
 *
 * Session rezim Supavisoru (port 5432) drzi jedno misto na kazdou zijici
 * funkci. Pri nekolika lidech naraz - a chat se doptava kazdych par vterin -
 * je patnact mist malo. Transakcni rezim (port 6543) pujcuje spojeni jen na
 * dobu dotazu, takze jich zvladne radove vic; je to doporucene nastaveni pro
 * Prismu na serverless.
 *
 * Prepina se TADY ZA BEHU, ne v promenne prostredi: do pripojovaciho retezce
 * (je v nem heslo) tak neni potreba nikomu sahat a `prisma db push` pri buildu
 * dal jede pres session rezim, kde umi menit schema. Prepne se jen Supabase
 * pooler na portu 5432 - jineho hostitele se to netyka. Vypnout jde
 * promennou DB_REZIM=session.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);

    const jePooler = url.hostname.includes('pooler.supabase.com');
    const chceSession = process.env.DB_REZIM === 'session';
    if (jePooler && !chceSession && (url.port === '5432' || url.port === '')) {
      url.port = '6543';
      // Bez tohohle by Prisma poslala prepared statements, ktere transakcni
      // rezim neumi.
      if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
    }

    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch {
    // Nestandardni tvar retezce - radeji necháme puvodni hodnotu.
    return raw;
  }
}

// Standardni Next.js vzor - v dev rezimu znovupouzit jednu instanci Prisma
// klienta mezi hot-reloady, aby se nevycerpaly DB spojeni.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const url = connectionUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
