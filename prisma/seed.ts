import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Zakladni data pro prvni spusteni:
 *  - jeden interni ADMIN ucet (MEDIA SPACE),
 *  - jedna ukazkova firma s prihlasenim (ocerecords), stejna jako ve
 *    verejnem prototypu vzhledu.
 *
 * Spustit: npm run db:seed
 * Hesla po prvnim prihlaseni doporucujeme zmenit / zalozit ostre ucty
 * primo v Prisma Studiu (npx prisma studio), dokud neni hotova admin obrazovka.
 */
async function main() {
  const adminPasswordHash = await bcrypt.hash('zmente-toto-heslo', 10);
  await prisma.user.upsert({
    where: { email: 'admin@mediaspace.cz' },
    update: {},
    create: {
      email: 'admin@mediaspace.cz',
      passwordHash: adminPasswordHash,
      name: 'MEDIA SPACE admin',
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

  console.log('Seed hotov. Prihlasovaci udaje (zmente po prvnim prihlaseni):');
  console.log('  admin@mediaspace.cz / zmente-toto-heslo');
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
