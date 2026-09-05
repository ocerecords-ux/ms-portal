import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Zakladni data pro prvni spusteni:
 *  - jeden interni ADMIN ucet (Mediaspace),
 *  - jedna ukazkova firma s prihlasenim (ocerecords), stejna jako ve
 *    verejnem prototypu vzhledu.
 *
 * Spustit: npm run db:seed
 * Hesla po prvnim prihlaseni doporucujeme zmenit / zalozit ostre ucty
 * primo v Prisma Studiu (npx prisma studio), dokud neni hotova admin obrazovka.
 */
async function main() {
  // --- Univerzalni admin ucet Mediaspace (zadani 5. 9. 2026) ---
  //
  // Adresa admin@mediaspace.cz neni skutecna schranka, takze na ni nechodi ani
  // obnova hesla. Ucet se proto ridi dvema promennymi prostredi na Vercelu:
  //
  //   ADMIN_EMAIL             - adresa, kterou se tym prihlasuje (nastavte
  //                             skutecnou schranku, at funguje "zapomenute
  //                             heslo"). Kdyz neni vyplnena, zustava puvodni
  //                             admin@mediaspace.cz.
  //   ADMIN_INITIAL_PASSWORD  - kdyz je vyplnena, seed pri nasazeni nastavi
  //                             tomuto uctu toto heslo. PO PRIHLASENI JI ZASE
  //                             SMAZTE, at heslo nezustava v nastaveni projektu.
  //
  // Ucet se nikdy nezaklada podruhe: kdyz uz existuje puvodni
  // admin@mediaspace.cz a ADMIN_EMAIL je jiny, jen se mu adresa prepise -
  // zustanou tak vsechny jeho vazby.
  const LEGACY_ADMIN_EMAIL = 'admin@mediaspace.cz';
  const adminEmail = (process.env.ADMIN_EMAIL?.trim() || LEGACY_ADMIN_EMAIL).toLowerCase();
  const adminResetPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  const adminPasswordHash = await bcrypt.hash(adminResetPassword || 'zmente-toto-heslo', 10);

  if (adminEmail !== LEGACY_ADMIN_EMAIL) {
    const legacyAdmin = await prisma.user.findUnique({ where: { email: LEGACY_ADMIN_EMAIL } });
    const alreadyMoved = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (legacyAdmin && !alreadyMoved) {
      await prisma.user.update({ where: { id: legacyAdmin.id }, data: { email: adminEmail } });
    }
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    // Jmeno se pri kazdem seedu srovna na aktualni podobu brandu (5. 9. 2026:
    // "Mediaspace", ne "MEDIA SPACE") - jinak by uz zalozenemu uctu zustal
    // stary nazev v topbaru.
    update: {
      name: 'Mediaspace admin',
      role: 'ADMIN',
      ...(adminResetPassword ? { passwordHash: adminPasswordHash, active: true } : {}),
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Mediaspace admin',
      role: 'ADMIN',
    },
  });

  const demoCompany = await prisma.company.upsert({
    where: { id: 'demo-ocerecords' },
    update: {},
    create: {
      id: 'demo-ocerecords',
      name: 'Ocecords s.r.o.',
      ratePerPage: 180,
      driveFolderUrl: '', // doplnit odkaz na slozku klienta na Google Disku
    },
  });

  const clientPasswordHash = await bcrypt.hash('zmente-toto-heslo', 10);
  await prisma.user.upsert({
    where: { email: 'ocerecords@gmail.com' },
    update: {},
    create: {
      email: 'ocerecords@gmail.com',
      passwordHash: clientPasswordHash,
      name: 'ocerecords',
      role: 'CLIENT',
      companyId: demoCompany.id,
    },
  });

  await backfillCodes();

  console.log('Seed hotov.');
  console.log(`  admin ucet: ${adminEmail}${adminResetPassword ? ' (heslo nastaveno z ADMIN_INITIAL_PASSWORD)' : ''}`);
  console.log('  ocerecords@gmail.com / zmente-toto-heslo');
}

/**
 * Verejna citelna ID (zadani 5. 9. 2026) - viz src/lib/codes.ts pro stejnou
 * logiku pouzivanou z aplikacniho kodu. Tady je zamerne zduplikovana (misto
 * importu z src/lib), aby seed skript nezavisel na alias-resolveni "@/..." v
 * behovem prostredi tsx. Dopocita chybejici kody vsem zaznamum, ktere je
 * jeste nemaji (existujici data pred zavedenim teto funkce, i nove seedovane
 * demo ucty vyse) - podle poradi zalozeni. Idempotentni, muze bezet pri
 * kazdem deployi.
 */
async function nextSeedCode(prefix: 'F' | 'I' | 'H' | 'K'): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name: prefix },
    create: { name: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `MS${prefix}${String(counter.value).padStart(4, '0')}`;
}

function codePrefixForSeedRole(role: string): 'I' | 'H' | 'K' {
  if (role === 'HEREC') return 'H';
  if (role === 'CLIENT') return 'K';
  return 'I';
}

async function backfillCodes() {
  const companiesWithoutCode = await prisma.company.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' },
  });
  for (const c of companiesWithoutCode) {
    const code = await nextSeedCode('F');
    await prisma.company.update({ where: { id: c.id }, data: { code } });
  }

  const usersWithoutCode = await prisma.user.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' },
  });
  for (const u of usersWithoutCode) {
    const code = await nextSeedCode(codePrefixForSeedRole(u.role));
    await prisma.user.update({ where: { id: u.id }, data: { code } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
