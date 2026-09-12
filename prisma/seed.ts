import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

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

  // --- Testovaci ucty (zadani 10. 9. 2026) ------------------------------
  // "Udelali bychom podle vzoru Test - herec, Test - zvukar, Test - klient
  // nejake profily, ktere bychom pouzivali na testy. Tyhle testy by tam mohly
  // zustat do budoucna, at je nemusim zakladat."
  //
  // ADRESY: vsechny jsou aliasy jedne schranky (ocerecords+neco@gmail.com).
  // Gmail cast za plusem ignoruje pri doruceni, ale portal je bere jako ruzne
  // ucty - dorucuje se tedy vsechno na ocerecords@gmail.com a pritom jde
  // o tri samostatne uzivatele s ruznymi pravy.
  //
  // HESLO se tady schvalne nenastavuje na nic pouzitelneho. Prihlaseni se
  // resi tlacitkem "Odeslat pozvanku" u uzivatele - odkaz prijde do te same
  // schranky a heslo si nastavite sam. Heslo napsane v kodu by skoncilo
  // na GitHubu.
  const testovaciFirma = await prisma.company.upsert({
    where: { id: 'test-klient' },
    update: {},
    create: {
      id: 'test-klient',
      name: 'Test - klient s.r.o.',
      ratePerPage: 180,
    },
  });

  // Nepouzitelny hash - ucet se odemkne az pozvankou.
  const bezHesla = await bcrypt.hash(randomBytes(24).toString('hex'), 10);

  const TESTOVACI_UCTY = [
    { email: 'ocerecords+herec@gmail.com', name: 'Test - herec', role: 'HEREC' as const, companyId: null },
    { email: 'ocerecords+zvukar@gmail.com', name: 'Test - zvukař', role: 'ZVUKAR' as const, companyId: null },
    {
      email: 'ocerecords+klient@gmail.com',
      name: 'Test - klient',
      role: 'CLIENT' as const,
      companyId: testovaciFirma.id,
    },
    { email: 'ocerecords+produkce@gmail.com', name: 'Test - produkce', role: 'PRODUKCE' as const, companyId: null },
  ];

  for (const ucet of TESTOVACI_UCTY) {
    await prisma.user.upsert({
      where: { email: ucet.email },
      // Existujici testovaci ucet se nepretahuje - kdyz si u nej nekdo zmeni
      // heslo nebo jmeno, seed pri dalsim nasazeni tu zmenu nesmi vratit.
      update: {},
      create: {
        email: ucet.email,
        passwordHash: bezHesla,
        name: ucet.name,
        role: ucet.role,
        companyId: ucet.companyId,
      },
    });
  }

  // Cenik (zadani 5. 9. 2026) - pri prvnim spusteni zalozime vychozi polozky,
  // ktere zaroven slouzi jako typy projektu. Pokud uz v ceniku neco je,
  // nesahame na nej.
  // Zamerne bez importu z src/lib/priceList: seed bezi pres tsx mimo Next.js,
  // kde by se alias "@/..." uvnitr toho souboru nerozresil.
  const RADIOVY_SPOT = 'Výroba rádiového spotu';
  const DEFAULT_PRICE_LIST_ITEMS = [
    'Natáčení a postprodukce audioknihy',
    RADIOVY_SPOT,
    'Natáčení voiceoveru',
  ];
  const priceListCount = await prisma.priceListItem.count();
  if (priceListCount === 0) {
    await prisma.priceListItem.createMany({
      data: DEFAULT_PRICE_LIST_ITEMS.map((name, index) => ({
        name,
        sortOrder: (index + 1) * 10,
        // U radioveho spotu se vyrabi Rodny list (upresneni 9. 9. 2026).
        rodnyList: name === RADIOVY_SPOT,
      })),
      skipDuplicates: true,
    });
  }

  await seedStudios();
  await doplnKalendarDoListy();
  await zapniRodnyListURadiovehoSpotu();

  await backfillCodes();
  await prenesHerceDoSeznamu();

  console.log('Seed hotov.');
  console.log(`  admin ucet: ${adminEmail}${adminResetPassword ? ' (heslo nastaveno z ADMIN_INITIAL_PASSWORD)' : ''}`);
  console.log('  ocerecords@gmail.com / zmente-toto-heslo');
}

/**
 * Studia jako kalendarove zdroje (zadani 8. 9. 2026). Drive to byly ctyri
 * texty v src/lib/roles.ts (HEREC_STUDIOS) - ted je to tabulka, ze ktere se
 * ten seznam odvozuje.
 *
 * Pracovni doba: po-pa 8:00-20:00 napevno, vikendy taky 8:00-20:00, ale
 * s priznakem byArrangement - natacet o vikendu jde jen po domluve se
 * zvukarem, takze to kalendar oznaci a neblokuje.
 *
 * Presety: nejcastejsi frekvence jsou 9-13 a 13-17. Je to jen zkratka na
 * jedno kliknuti, libovolne okno (treba 8-12) jde vytahnout dal.
 *
 * Idempotentni - bezi po kazdem nasazeni, existujici studia nechava byt.
 */
const STUDIA: { name: string; shortName: string; location: string; color: string; timezone: string }[] = [
  { name: 'MS Studio - Brno I', shortName: 'Brno I', location: 'Brno', color: '#7B55FF', timezone: 'Europe/Prague' },
  { name: 'MS Studio - Brno II', shortName: 'Brno II', location: 'Brno', color: '#1FDF67', timezone: 'Europe/Prague' },
  { name: 'MS Studio - Praha', shortName: 'Praha', location: 'Praha', color: '#F2A03D', timezone: 'Europe/Prague' },
  { name: 'MS Studio - London', shortName: 'London', location: 'London', color: '#4FC3F7', timezone: 'Europe/London' },
];

const PRESETY = [
  { label: 'Dopolední', startMinutes: 9 * 60, endMinutes: 13 * 60, sortOrder: 10 },
  { label: 'Odpolední', startMinutes: 13 * 60, endMinutes: 17 * 60, sortOrder: 20 },
];

async function seedStudios() {
  for (const [index, studio] of STUDIA.entries()) {
    const zaznam = await prisma.studio.upsert({
      where: { name: studio.name },
      update: {},
      create: { ...studio, sortOrder: (index + 1) * 10 },
    });

    const maHodiny = await prisma.studioHours.count({ where: { studioId: zaznam.id } });
    if (maHodiny === 0) {
      await prisma.studioHours.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          studioId: zaznam.id,
          weekday,
          startMinutes: 8 * 60,
          endMinutes: 20 * 60,
          // 0 = nedele, 6 = sobota
          byArrangement: weekday === 0 || weekday === 6,
        })),
        skipDuplicates: true,
      });
    }

    const maPresety = await prisma.studioSlotPreset.count({ where: { studioId: zaznam.id } });
    if (maPresety === 0) {
      await prisma.studioSlotPreset.createMany({
        data: PRESETY.map((p) => ({ ...p, studioId: zaznam.id })),
      });
    }
  }
}

/**
 * Jednorazove doplneni odkazu Kalendar do listy (zadani 8. 9. 2026:
 * "tak ho tam dej nahoru do listy").
 *
 * Lista je od 8. 9. 2026 na kazdeho uzivatele zvlast. Kdo si ji nekdy
 * upravoval, ma v databazi vlastni radky a VYCHOZI sada se mu uz nepromita -
 * novy odkaz by se mu tedy sam neobjevil. Kdo radky nema, vidi vychozi listu
 * a Kalendar v ni uz je, takze toho se to netyka.
 *
 * Bezi PRAVE JEDNOU za zivot databaze - hlida to zaznam v tabulce Counter.
 * Bez toho by se odkaz vracel po kazdem nasazeni i tomu, kdo si ho schvalne
 * odebral.
 */
/**
 * Jednorazove zapnuti priznaku "Rodny list" u polozky ceniku "Vyroba
 * radioveho spotu" (upresneni 9. 9. 2026: "plati to jen u radiovych spotu").
 *
 * Priznak je novy, takze u ceniku, ktery uz existuje, by zustal vsude vypnuty
 * a Rodny list by se nikdy sam nevyrobil. Tohle ho jednou nastavi u vychozi
 * polozky; dal si to tym prepina v administraci a seed uz do toho nesaha -
 * proto ta znamka v Counteru, stejne jako u doplneni kalendare do listy.
 */
async function zapniRodnyListURadiovehoSpotu() {
  const ZNAMKA = 'cenik-backfill-rodny-list';
  const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
  if (uz) return;

  const polozka = await prisma.priceListItem.findUnique({
    where: { name: 'Výroba rádiového spotu' },
    select: { id: true, rodnyList: true },
  });
  if (polozka && !polozka.rodnyList) {
    await prisma.priceListItem.update({ where: { id: polozka.id }, data: { rodnyList: true } });
    console.log('  cenik: u "Výroba rádiového spotu" zapnut Rodný list');
  }

  await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
}

async function doplnKalendarDoListy() {
  const ZNAMKA = 'menu-backfill-kalendar';
  const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
  if (uz) return;

  // Kalendar vidi jen tym Mediaspace - viz PAGE_ACCESS v src/lib/menu.ts.
  const uzivatele = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'PRODUKCE', 'ZVUKAR'] } },
    select: { id: true },
  });

  for (const u of uzivatele) {
    const radky = await prisma.userMenuItem.findMany({ where: { userId: u.id } });
    if (radky.length === 0) continue; // vychozi lista, Kalendar uz v ni je
    if (radky.some((r) => r.href === '/kalendar')) continue;
    const posledni = radky.reduce((max, r) => Math.max(max, r.sortOrder), 0);
    await prisma.userMenuItem.create({
      data: { userId: u.id, label: 'Kalendář', href: '/kalendar', sortOrder: posledni + 10 },
    });
  }

  await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
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

  // --- Bruno, asistent studia (zadani 12. 9. 2026) ---
  //
  // Ucet je tu proto, aby Bruno mohl psat do chatu jako kdokoliv jiny a bylo
  // poznat, ze to pise on. PRIHLASIT SE POD NIM NEJDE: heslo je nahodne a
  // nikde se neuklada, takze ani nahodou nesedne na nic, co by nekdo zkusil.
  // Ucet je zaroven neaktivni, takze ho odmitne i prihlasovaci formular.
  const brunoHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
  // Fotka lezi v public/bruno-znacka.png a v uctu je na ni jen odkaz.
  // NAZEV SOUBORU NESE PODOBU, ne jen jmeno: kdyz se Bruno prekresli, musi se
  // zmenit i adresa. Pri prvnim prekresleni zustal soubor „bruno.png" a lidem
  // se dal ukazovala stara podoba z mezipameti prohlizece i z CDN. Fotky lidi se
  // drzi jako data: URL primo v databazi, ale u Bruna by to byl zbytecne
  // vlozeny obrazek v seedu - takhle je kreslena podoba verzovana v repu
  // a da se kdykoliv prekreslit bez zasahu do databaze.
  const brunoFotka = `${(process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '')}/bruno-znacka.png`;
  await prisma.user.upsert({
    where: { email: 'bruno@mediaspace.cz' },
    update: { name: 'Bruno', role: 'ROBOT', active: false, photoUrl: brunoFotka },
    create: {
      email: 'bruno@mediaspace.cz',
      passwordHash: brunoHash,
      name: 'Bruno',
      role: 'ROBOT',
      active: false,
      photoUrl: brunoFotka,
    },
  });

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

/**
 * Jednorázový přenos herce ze starého sloupce do seznamu (zadání 10. 9. 2026:
 * „chci jich tam dát více").
 *
 * Do té doby měl projekt jednoho herce v `actorUserId`. Nový seznam `herci`
 * je prázdný, takže by po nasazení vypadalo, že projekty herce nemají —
 * proto se sem jednou zkopíruje.
 *
 * Bere jen projekty, kde je seznam PRÁZDNÝ. Kdyby někdo herce mezitím
 * upravil, seed mu to nesmí přepsat zpátky.
 */
async function prenesHerceDoSeznamu() {
  const projekty = await prisma.projectMeta.findMany({
    where: { actorUserId: { not: null }, herci: { none: {} } },
    select: { id: true, actorUserId: true },
  });
  for (const p of projekty) {
    if (!p.actorUserId) continue;
    await prisma.projectMeta.update({
      where: { id: p.id },
      data: { herci: { connect: { id: p.actorUserId } } },
    });
  }
  if (projekty.length > 0) {
    console.log(`  herci přeneseni do seznamu: ${projekty.length} projektů`);
  }
}
