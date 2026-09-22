import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { VYCHOZI_NAVODY } from './vychoziNavody';
import { GOOGLE_KALENDAR } from './importKalendare/googleKalendar';
import { prahaNaUtc, rozeberUdalost, srovnej } from '../src/lib/importGoogleKalendar';
import { bezTitulu } from '../src/lib/jmena';
import { PODPIS_ONDREJ } from './podpisOndrej';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  await nastavBarvyStudii();
  await doplnKalendarDoListy();
  await zapniRodnyListURadiovehoSpotu();

  await backfillCodes();
  await prenesHerceDoSeznamu();
  await skupinaProCelyTym();
  await doplnIkonyTypu();
  await srovnejPriznakFotky();
  await zalozVychoziNavody();
  await zalozDruhyLicence();
  await doplnStudiaZvukaru();
  await doplnZadavateleUkolu();
  await peterTakyZvukar();
  await nazvyProjektuVelkymi();
  await vycistiBrnoII();
  await prevezmiGoogleKalendar();
  await brunoZpetneOznamPreposlech();
  await vlozPodpisNaFaktury();
  await backlogZListyDoPrehledu();
  await vedouciPobocek();
  await importujFakturyZCaflou('caflou-2026.json', 'import-faktur-caflou-2026');
  await importujFakturyZCaflou('caflou-2026-duben-cerven.json', 'import-faktur-caflou-2026-b');

  // Datum dokončení z objednávky do projektu (oprava 22. 9. 2026: objednávka
  // chtěla 17. 11., v projektu bylo 22. 9.). Jednorázově dorovná projekty
  // založené z objednávky, kde datum dokončení chybí nebo je den založení.
  {
    const ZNAMKA = 'objednavky-datum-dokonceni-2026-09-22';
    try {
      const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
      if (!uz) {
        const objednavky = await prisma.order.findMany({
          where: { deadline: { not: null }, caflouProjectId: { not: null } },
          select: { caflouProjectId: true, deadline: true },
        });
        let opraveno = 0;
        for (const o of objednavky) {
          const meta = await prisma.projectMeta.findUnique({
            where: { caflouProjectId: o.caflouProjectId! },
            select: { endDate: true, createdAt: true },
          });
          if (!meta) continue;
          const den = (d: Date) => d.toISOString().slice(0, 10);
          const dnyObjednavky = den(o.deadline!);
          if (meta.endDate && den(meta.endDate) !== den(meta.createdAt)) continue;
          if (meta.endDate && den(meta.endDate) === dnyObjednavky) continue;
          await prisma.projectMeta.update({
            where: { caflouProjectId: o.caflouProjectId! },
            data: { endDate: new Date(`${dnyObjednavky}T00:00:00.000Z`) },
          });
          opraveno += 1;
        }
        await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
        console.log(`  objednavky: datum dokonceni doplneno u ${opraveno} projektu`);
      }
    } catch (err) {
      console.error('Doplneni data dokonceni z objednavek selhalo:', err);
    }
  }

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
// Barvy podle kalendáře, na který je tým zvyklý z Googlu (21. 9. 2026:
// „ještě nastavme takto barvy kalendáře"). Viz nastavBarvyStudii níž.
const STUDIA: { name: string; shortName: string; location: string; color: string; timezone: string }[] = [
  { name: 'MS Studio - Brno I', shortName: 'Brno I', location: 'Brno', color: '#5422F1', timezone: 'Europe/Prague' },
  { name: 'MS Studio - Brno II', shortName: 'Brno II', location: 'Brno', color: '#D320AE', timezone: 'Europe/Prague' },
  { name: 'MS Studio - Praha', shortName: 'Praha', location: 'Praha', color: '#34C12E', timezone: 'Europe/Prague' },
  { name: 'MS Studio - London', shortName: 'London', location: 'London', color: '#9395F4', timezone: 'Europe/London' },
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
    update: { name: 'Bruno', role: 'ROBOT', active: true, photoUrl: brunoFotka },
    create: {
      email: 'bruno@mediaspace.cz',
      passwordHash: brunoHash,
      name: 'Bruno',
      role: 'ROBOT',
      active: true,
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

/**
 * Srovná příznak „má fotku" s tím, co je v databázi (12. 9. 2026).
 *
 * Fotky jsou uložené jako data: URL a mají desítky kilobajtů. Seznamy si
 * o ně dřív říkaly při každém doptání chatu, i když do prohlížeče posílaly
 * jen adresu — a Supabase to počítal jako odchozí přenos, až organizace
 * přerostla kvótu. Teď se v seznamech vybírá jen tenhle příznak.
 *
 * Běží při každém nasazení, je to jediný příkaz a srovná i fotky nahrané
 * mimo portál (třeba přímo v databázi).
 */
async function srovnejPriznakFotky() {
  const zmeneno = await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "maFotku" = ("photoUrl" IS NOT NULL AND "photoUrl" <> '')
     WHERE "maFotku" <> ("photoUrl" IS NOT NULL AND "photoUrl" <> '')`,
  );
  if (zmeneno > 0) console.log(`  priznak fotky srovnan u ${zmeneno} uzivatelu`);
}

/**
 * JEDNORÁZOVÉ VYČIŠTĚNÍ KALENDÁŘE BRNA II (zadání 20. 9. 2026: „všechno
 * v Brně II teď vymaž a pak půjdem na události v Brně II" - upřesněno:
 * úplně všechno, i natáčení z nabídek herců).
 *
 * Běží JEDNOU (značka v Counteru), a to PŘED převzetím Google kalendáře -
 * události Brna II, které se převezmou potom, už zůstanou.
 *
 * Smaže:
 *  - všechny události studia (ruční i převzaté),
 *  - všechny termíny z nabídek herců v Brně II (nabídnuté, vybrané i potvrzené).
 * Nabídka, které tím nezbyde žádný termín, se vrátí do konceptu (DRAFT) -
 * herec ji nevidí a produkce ji může poslat znovu.
 *
 * Nic se neztratí nadobro: všechno, co se maže, se napřed uloží do Archivu
 * (Admin ▸ Archiv, druh „Kalendář studia").
 */
async function vycistiBrnoII() {
  const ZNAMKA = 'kalendar-vycisteni-brno-ii-2026-09-20';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;

    const studio = await prisma.studio.findUnique({ where: { name: 'MS Studio - Brno II' }, select: { id: true } });
    if (!studio) {
      await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
      return;
    }

    const [bloky, sloty] = await Promise.all([
      prisma.studioBlock.findMany({ where: { studioId: studio.id } }),
      prisma.recordingSlot.findMany({ where: { studioId: studio.id } }),
    ]);

    if (bloky.length + sloty.length > 0) {
      await prisma.archiv.create({
        data: {
          druh: 'KALENDAR',
          nazev: 'MS Studio - Brno II',
          puvodniId: studio.id,
          souhrn: `${bloky.length}x událost studia, ${sloty.length}x termín z nabídky`,
          pocetZaznamu: bloky.length + sloty.length,
          obsah: JSON.parse(JSON.stringify({ udalosti: bloky, terminy: sloty })),
          uzivatelJmeno: 'Vyčištění kalendáře (seed)',
        },
      });
    }

    const dotceneNabidky = Array.from(new Set(sloty.map((s) => s.requestId)));
    await prisma.$transaction([
      prisma.studioBlock.deleteMany({ where: { studioId: studio.id } }),
      prisma.recordingSlot.deleteMany({ where: { studioId: studio.id } }),
    ]);

    // Nabidka bez jedineho terminu -> zpet do konceptu.
    let doKonceptu = 0;
    for (const requestId of dotceneNabidky) {
      const zbyva = await prisma.recordingSlot.count({ where: { requestId } });
      if (zbyva === 0) {
        await prisma.recordingRequest.update({ where: { id: requestId }, data: { status: 'DRAFT' } });
        doKonceptu += 1;
      }
    }

    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    console.log(
      `  brno II: smazano ${bloky.length} udalosti a ${sloty.length} terminu (archivovano), ${doKonceptu} nabidek do konceptu`,
    );
  } catch (err) {
    console.warn('  vycisteni Brna II se nepodarilo:', err);
  }
}

/**
 * PŘEVZETÍ STARÉHO GOOGLE KALENDÁŘE (zadání 20. 9. 2026). Data jsou
 * v prisma/importKalendare/googleKalendar.ts, rozbor textu v
 * src/lib/importGoogleKalendar.ts.
 *
 * - Natáčení / střih se zapíšou jako událost studia (StudioBlock) s druhem
 *   NATACENI / STRIH, stejně jako ručně zapsaná událost v Kalendáři.
 * - Herec, zvukař a projekt se napárují na účty a projekty v portálu podle
 *   jména (bez diakritiky a titulů). Co se nenapáruje, zůstane jako text.
 * - Každý řádek má klíč (importKlic): založí se jednou, opravený řádek se
 *   přepíše, smazaný řádek zmizí. Ruční události se nemění.
 */
async function prevezmiGoogleKalendar() {
  try {
    const [studia, lide, projekty] = await Promise.all([
      prisma.studio.findMany({ select: { id: true, name: true, shortName: true } }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true } }),
      prisma.projectMeta.findMany({
        where: { name: { not: null } },
        select: { caflouProjectId: true, name: true, finished: true },
      }),
    ]);

    const smazane = new Set(
      (await prisma.smazanyImport.findMany({ select: { importKlic: true } })).map((x) => x.importKlic),
    );

    const najdiStudio = (nazev: string) =>
      studia.find((s) => srovnej(s.shortName ?? '') === srovnej(nazev) || srovnej(s.name) === srovnej(nazev)) ??
      studia.find((s) => srovnej(s.name).endsWith(srovnej(nazev)));
    const najdiCloveka = (jmeno: string | null, role: string[]) => {
      if (!jmeno) return null;
      const hledane = srovnej(jmeno);
      const shody = lide.filter((u) => role.includes(u.role) && srovnej(bezTitulu(u.name)) === hledane);
      return shody.length === 1 ? shody[0] : null;
    };
    const najdiProjekt = (nazev: string) => {
      const hledane = srovnej(nazev);
      if (!hledane) return null;
      const presne = projekty.filter((p) => srovnej(p.name ?? '') === hledane);
      const zacina = presne.length ? presne : projekty.filter((p) => srovnej(p.name ?? '').startsWith(hledane + ' '));
      // Radeji rozpracovany; kdyz je jich vic, nehada se.
      const kandidati = zacina.filter((p) => !p.finished).length ? zacina.filter((p) => !p.finished) : zacina;
      return kandidati.length === 1 ? kandidati[0] : null;
    };

    const klice = new Set<string>();
    let zalozeno = 0;
    let neznameStudio = 0;
    for (const r of GOOGLE_KALENDAR) {
      const studio = najdiStudio(r.studio);
      if (!studio) {
        neznameStudio += 1;
        continue;
      }
      const u = rozeberUdalost(r.text);
      const start = prahaNaUtc(r.datum, r.od);
      const end = prahaNaUtc(r.doDatum ?? r.datum, r.do);
      const importKlic = `gcal:${studio.id}:${start.toISOString()}:${end.toISOString()}:${srovnej(r.text)}`.slice(0, 250);
      klice.add(importKlic);

      const herec = najdiCloveka(u.herec, ['HEREC']);
      const zvukar = najdiCloveka(u.zvukar, ['ADMIN', 'ZVUKAR', 'PRODUKCE']);
      // Uklid a porada nejsou prace na projektu - zadne parovani.
      const pracovni = u.druh === 'NATACENI' || u.druh === 'STRIH' || u.druh === 'CASTING';
      const projekt = pracovni && u.projekt ? najdiProjekt(u.projekt) : null;
      const data = {
        studioId: studio.id,
        start,
        end,
        kind: u.druh,
        title: projekt?.name ?? (u.projekt || u.herec || 'Casting'),
        // Znacky z Googlu (☎ ✈️ 📝 ‼️ CUT) se neprenaseji (20. 9. 2026: „ty značky dej pryč,
        // uděláme nové postupně") - poznamka zustava prazdna.
        note: null,
        caflouProjectId: projekt?.caflouProjectId ?? null,
        // Strih bez projektu (jen 'Střih (TI)') projekt nema.
        projectName: !pracovni ? null : projekt?.name ?? (u.druh === 'STRIH' && u.projekt === 'Střih' ? null : u.projekt || null),
        actorUserId: herec?.id ?? null,
        actorName: herec ? bezTitulu(herec.name) : u.herec,
        zvukarUserId: zvukar?.id ?? null,
        zvukarName: zvukar ? bezTitulu(zvukar.name) : u.zvukar ?? u.zvukarZkratka,
      };
      // Smazané v portálu se nevrací (21. 9. 2026).
      if (smazane.has(importKlic)) continue;
      const uz = await prisma.studioBlock.findUnique({
        where: { importKlic },
        select: { id: true, upravenoVPortalu: true },
      });
      if (uz) {
        // Co tým v portálu upravil (doplněný projekt u střihu, jiný čas),
        // se už z dat Googlu nepřepisuje - jinak by to s každým nasazením
        // zmizelo (21. 9. 2026).
        if (!uz.upravenoVPortalu) await prisma.studioBlock.update({ where: { id: uz.id }, data });
      } else {
        await prisma.studioBlock.create({ data: { ...data, importKlic } });
        zalozeno += 1;
      }
    }

    // Radek z dat zmizel (opraveny cas, smazana udalost) - pryc i z portalu.
    const smazano = await prisma.studioBlock.deleteMany({
      where: { importKlic: { startsWith: 'gcal:', notIn: Array.from(klice) } },
    });
    console.log(
      `  google kalendar: ${GOOGLE_KALENDAR.length} radku, nove ${zalozeno}, odebrano ${smazano.count}` +
        (neznameStudio ? `, ${neznameStudio} s neznamym studiem preskoceno` : ''),
    );
  } catch (err) {
    // Import je jen obsah - nesmi shodit cely seed (a s nim nasazeni).
    console.warn('  google kalendar se nepodarilo prevzit:', err);
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


/**
 * SKUPINA, VE KTERÉ JE CELÝ TÝM (zadání 12. 9. 2026: „a ještě nějakou skupinu
 * Mediaspace All, kde budou vždy přidáni všichni, i když se přidá uživatel
 * později").
 *
 * Existující skupinu se stejným smyslem převezmeme, ať se nezaloží druhá a
 * historie nezůstane v té staré — hledá se podle názvu. Členství se pak
 * dorovnává tady při každém nasazení a navíc při každém otevření chatu
 * (viz lib/chatServer.ts), takže nový člověk ji má hned, aniž by ho tam
 * musel někdo dávat.
 *
 * Roboti v ní nejsou: Bruno má do rozhovorů vstupovat na zavolání, ne
 * poslouchat všechno.
 */
async function skupinaProCelyTym() {
  const NAZEV = 'Mediaspace All';
  const STARE_NAZVY = [NAZEV, 'All MediaSpace', 'All Mediaspace', 'Mediaspace all'];

  const tym = await prisma.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (tym.length === 0) return;

  let skupina = await prisma.conversation.findFirst({ where: { vsichni: true }, select: { id: true } });
  if (!skupina) {
    const stara = await prisma.conversation.findFirst({
      where: { kind: 'SKUPINA', name: { in: STARE_NAZVY } },
      select: { id: true },
    });
    skupina = stara
      ? await prisma.conversation.update({
          where: { id: stara.id },
          data: { vsichni: true, name: NAZEV },
          select: { id: true },
        })
      : await prisma.conversation.create({
          data: { kind: 'SKUPINA', name: NAZEV, vsichni: true, createdById: tym[0].id },
          select: { id: true },
        });
  }

  const { count } = await prisma.conversationMember.createMany({
    data: tym.map((u) => ({ conversationId: skupina!.id, userId: u.id })),
    skipDuplicates: true,
  });
  if (count > 0) console.log(`  skupina „${NAZEV}": doplneno clenu ${count}`);
}


/**
 * IKONY U TYPŮ PROJEKTU (zadání 12. 9. 2026: „pojďme ještě vytvořit další
 * ikony pro typy projektu").
 *
 * Doplňuje se JEN TAM, KDE ŽÁDNÁ IKONA NENÍ — co si tým vybral v Cenících, se
 * nepřepisuje. Je to jednorázová laskavost při nasazení, ne hádání: nová
 * položka ceníku dostane ikonu ručně, tady se řeší jen ty, které tu byly
 * dřív, než ikony vůbec existovaly.
 */
async function doplnIkonyTypu() {
  const PODLE_NAZVU: { hledej: RegExp; ikona: string }[] = [
    { hledej: /voiceover.*(mix|mix[áa]ž)/i, ikona: 'mikrofon-mix' },
    { hledej: /audiokni|audiokní/i, ikona: 'kniha-mikrofon' },
    { hledej: /r[áa]diov/i, ikona: 'radio' },
    { hledej: /voiceover/i, ikona: 'mikrofon' },
  ];

  // JEDNORÁZOVÁ OPRAVA DVOU STARÝCH VOLEB. Audiokniha měla obyčejnou knihu a
  // rádiový spot sluchátka — obojí proto, že v době, kdy se to vybíralo, lepší
  // ikona neexistovala. Zadání 12. 9. 2026 říká, jak to má být; přepisují se
  // proto právě tyhle dvě dvojice a nic jiného.
  const OPRAVY: { hledej: RegExp; stara: string; nova: string }[] = [
    { hledej: /audiokni/i, stara: 'kniha', nova: 'kniha-mikrofon' },
    { hledej: /r[áa]diov/i, stara: 'sluchatka', nova: 'radio' },
  ];
  for (const oprava of OPRAVY) {
    const stare = await prisma.priceListItem.findMany({
      where: { ikona: oprava.stara },
      select: { id: true, name: true },
    });
    for (const polozka of stare) {
      if (!oprava.hledej.test(polozka.name)) continue;
      await prisma.priceListItem.update({ where: { id: polozka.id }, data: { ikona: oprava.nova } });
      console.log(`  ikona „${polozka.name}": ${oprava.stara} -> ${oprava.nova}`);
    }
  }

  const polozky = await prisma.priceListItem.findMany({
    where: { OR: [{ ikona: null }, { ikona: '' }] },
    select: { id: true, name: true },
  });
  let doplneno = 0;
  for (const polozka of polozky) {
    const trefa = PODLE_NAZVU.find((v) => v.hledej.test(polozka.name));
    if (!trefa) continue;
    await prisma.priceListItem.update({ where: { id: polozka.id }, data: { ikona: trefa.ikona } });
    doplneno += 1;
  }
  if (doplneno > 0) console.log(`  ikony typu projektu doplneny u ${doplneno} polozek ceniku`);
}

/**
 * VÝCHOZÍ NÁVODY DO NÁPOVĚDY.
 *
 * Zakládají se jen jednou. Kdyby je seed přepisoval při každém nasazení,
 * přišel by člověk o každou svoji úpravu - a návody se mají psát v portálu,
 * ne tady.
 */
async function zalozVychoziNavody() {
  for (const n of VYCHOZI_NAVODY) {
    try {
      /**
       * NÁVOD, DO KTERÉHO NĚKDO SÁHL, SE UŽ NEPŘEPISUJE (18. 9. 2026).
       *
       * Dřív se návod zakládal jen jednou a pak už se k němu seed nevracel -
       * jenže tím se nedala opravit ani vlastní chyba v textu, který nikdo
       * nečetl. Rozhoduje proto AUTOR: návod založený portálem ho nemá,
       * a jakmile ho někdo uloží v Adminu ▸ Návody, autorem se stane on
       * a seed od textu dá ruce pryč.
       */
      const uz = await prisma.navod.findUnique({
        where: { slug: n.slug },
        select: { id: true, autorId: true },
      });
      if (uz?.autorId) continue;

      const hledaci = [n.nazev, n.perex, n.obsah]
        .join(' \n ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      const data = {
        nazev: n.nazev,
        perex: n.perex,
        kategorie: n.kategorie,
        poradi: n.poradi,
        obsah: n.obsah,
        hledaci,
      };

      if (uz) {
        await prisma.navod.update({ where: { id: uz.id }, data });
        console.log('  navod: aktualizovan "' + n.nazev + '"');
        continue;
      }

      await prisma.navod.create({ data: { slug: n.slug, ...data, zverejneno: true } });
      console.log('  navod: zalozen "' + n.nazev + '"');
    } catch (err) {
      // Navod je jen obsah - kdyby se nepovedl, nesmi to shodit cely seed.
      console.warn('  navod "' + n.nazev + '" se nepodarilo zalozit:', err);
    }
  }
}

/**
 * ZÁKLADNÍ DRUHY LICENCE (zadání 18. 9. 2026: „teď potřebuju základ. Online,
 * TV, rádio").
 *
 * Zakládají se jen tehdy, když číselník ještě žádný druh nemá - jakmile si
 * tým seznam upraví, seed do něj nesahá. Přejmenovaný ani smazaný druh se
 * proto nevrací zpátky.
 */
async function zalozDruhyLicence() {
  try {
    const uz = await prisma.druhLicence.count();
    if (uz > 0) return;

    const zaklad = [
      { nazev: 'Online', ikona: 'globus', poradi: 10 },
      { nazev: 'TV', ikona: 'obrazovka', poradi: 20 },
      { nazev: 'Rádio', ikona: 'radio', poradi: 30 },
    ];
    for (const d of zaklad) {
      await prisma.druhLicence.create({ data: d });
    }
    console.log('  druhy licence: zalozeny (Online, TV, Radio)');
  } catch (err) {
    // Ciselnik je jen nabidka - kdyby se nepovedl, nesmi to shodit cely seed.
    console.warn('  druhy licence se nepodarilo zalozit:', err);
  }
}

/**
 * LOKALIZACE ZVUKAŘŮ (zadání 20. 9. 2026: „ještě pojďme udělat lokalizace
 * zvukařů ... udělej asi ze zvukařů v uživatelích zaškrtávátka").
 *
 * Kdo v kterém studiu točí, se zaškrtává na kartě uživatele. Tohle jen jednou
 * doplní, jak to je dnes — jinak by po nasazení byla všechna zaškrtávátka
 * prázdná a kalendář by o tom nevěděl nic.
 *
 * BĚŽÍ PRÁVĚ JEDNOU za život databáze (známka v Counteru) a sahá jen na
 * zvukaře, kteří zatím nemají zaškrtnuté ŽÁDNÉ studio. Když si to tým
 * přepíše, seed už do toho nemluví.
 */
async function doplnStudiaZvukaru() {
  const ZNAMKA = 'zvukari-backfill-studia';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;

    // Brno I a Brno II drží ti samí lidé, Praha svoje (zadání 20. 9. 2026).
    const ROZDELENI: { jmena: string[]; studia: string[] }[] = [
      {
        jmena: ['Richard Hanula', 'Tomáš Ilavský', 'Tomáš Moravec'],
        studia: ['MS Studio - Brno I', 'MS Studio - Brno II'],
      },
      {
        jmena: ['Ondřej Černý ml.', 'Jonáš Čupa', 'Daniel Vlček'],
        studia: ['MS Studio - Praha'],
      },
    ];

    const [studia, lide] = await Promise.all([
      prisma.studio.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({
        where: { role: { in: ['ZVUKAR', 'ADMIN', 'PRODUKCE'] } },
        select: { id: true, name: true, zvukarStudia: { select: { id: true } } },
      }),
    ]);

    let doplneno = 0;
    for (const skupina of ROZDELENI) {
      const idStudii = skupina.studia
        .map((nazev) => studia.find((s) => srovnej(s.name) === srovnej(nazev))?.id)
        .filter((x): x is string => Boolean(x));
      if (idStudii.length === 0) continue;

      for (const jmeno of skupina.jmena) {
        const hledane = srovnej(bezTitulu(jmeno));
        const shody = lide.filter((u) => srovnej(bezTitulu(u.name)) === hledane);
        // Když jsou dva stejná jména, nehádáme se - ať si to tým zaškrtne sám.
        if (shody.length !== 1) continue;
        const clovek = shody[0];
        if (clovek.zvukarStudia.length > 0) continue;
        await prisma.user.update({
          where: { id: clovek.id },
          data: { zvukarStudia: { set: idStudii.map((id) => ({ id })) } },
        });
        doplneno += 1;
      }
    }

    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    if (doplneno > 0) console.log(`  zvukari: doplnena studia u ${doplneno} lidi`);
  } catch (err) {
    // Je to jen doplneni udaje - kdyby se nepovedlo, nesmi to shodit seed.
    console.warn('  studia zvukaru se nepodarilo doplnit:', err);
  }
}

/**
 * BARVY KALENDÁŘŮ JAKO V GOOGLU (zadání 21. 9. 2026: „ještě nastavme takto
 * barvy kalendáře" + screenshot z Google kalendáře).
 *
 * Brno I fialová, Brno II purpurová, Praha zelená, London levandulová.
 * Kalendář Mimo studio (v Googlu „Dovolené") má vlastní barvu a nechává se
 * být; Schůzky zatím v portálu nejsou.
 *
 * Studia už v databázi existují a seed je jinak nechává na pokoji, takže se
 * barvy přepíšou JEDNOU (známka v Counteru). Když je pak někdo změní
 * v Administraci → Studia, seed už do toho nesahá.
 */
async function nastavBarvyStudii() {
  const ZNAMKA = 'studia-barvy-google-2026-09-21';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;
    for (const studio of STUDIA) {
      const zmena = await prisma.studio.updateMany({ where: { name: studio.name }, data: { color: studio.color } });
      if (zmena.count > 0) console.log(`  studio ${studio.shortName}: barva ${studio.color}`);
    }
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
  } catch (err) {
    // Je to jen vzhled - kdyby se nepovedl, nesmi to shodit seed.
    console.warn('  barvy studii se nepodarilo nastavit:', err);
  }
}

/**
 * PETER DRATVA I JAKO ZVUKAŘ (22. 9. 2026: „přidej Petera Dratvu, aby se mohl
 * občas i přidat jako zvukař k některým projektům"). Jednou zapne „Může být
 * i zvukař" - kdyby to pak někdo na kartě vypnul, seed to znovu nezapne.
 */
async function peterTakyZvukar() {
  const ZNAMKA = 'peter-dratva-taky-zvukar';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;
    await prisma.user.updateMany({ where: { email: 'peter.dratva@mediaspace.cz' }, data: { takyZvukar: true } });
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
  } catch (err) {
    console.warn('  Petera jako zvukare se nepodarilo nastavit:', err);
  }
}

/**
 * NÁZVY PROJEKTŮ VELKÝMI (22. 9. 2026: „i když ho někdo zadá malými písmeny,
 * držme prosím formát vždy kapitálkama velkými. Ať je to jednotné v názvech
 * i v kanálech v chatu"). Jednou srovná, co v databázi už je - projekty
 * i jejich kanály v chatu. Nové názvy už velkými ukládá portál sám.
 */
async function nazvyProjektuVelkymi() {
  const ZNAMKA = 'nazvy-projektu-velkymi';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;
    const projekty = await prisma.projectMeta.findMany({
      where: { name: { not: null } },
      select: { caflouProjectId: true, name: true },
    });
    let zmeneno = 0;
    for (const p of projekty) {
      const velky = (p.name ?? '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('cs-CZ');
      if (!velky || velky === p.name) continue;
      await prisma.projectMeta.update({ where: { caflouProjectId: p.caflouProjectId }, data: { name: velky } });
      await prisma.conversation
        .updateMany({ where: { caflouProjectId: p.caflouProjectId }, data: { name: velky } })
        .catch(() => undefined);
      zmeneno += 1;
    }
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    if (zmeneno > 0) console.log(`  nazvy projektu velkymi: ${zmeneno}`);
  } catch (err) {
    console.warn('  nazvy projektu se nepodarilo srovnat:', err);
  }
}

/**
 * ZADAVATEL U STARŠÍCH ÚKOLŮ Z CHATU (21. 9. 2026: „potřebuji vidět někde, že
 * jsem ho vytvořil a že ho pak ten člověk splnil").
 *
 * Úkoly z chatu mají od 18. 9. uložené JMÉNO zadavatele, ale ne jeho účet -
 * bez toho by v „Zadal jsem" chyběly. Doplní se podle jména (jen jednoznačná
 * shoda); u už splněných se jako čas splnění vezme poslední změna úkolu.
 * Běží jednou (známka v Counteru).
 */
async function doplnZadavateleUkolu() {
  const ZNAMKA = 'ukoly-backfill-zadal-id';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;
    const [ukoly, lide] = await Promise.all([
      prisma.task.findMany({
        where: { zadalJmeno: { not: null }, zadalId: null },
        select: { id: true, zadalJmeno: true, done: true, updatedAt: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'ZVUKAR', 'PRODUKCE'] } },
        select: { id: true, name: true, email: true },
      }),
    ]);
    let doplneno = 0;
    for (const u of ukoly) {
      const shody = lide.filter((c) => (c.name || c.email) === u.zadalJmeno);
      if (shody.length !== 1) continue;
      await prisma.task.update({
        where: { id: u.id },
        data: { zadalId: shody[0].id, ...(u.done ? { splnenoAt: u.updatedAt } : {}) },
      });
      doplneno += 1;
    }
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    if (doplneno > 0) console.log(`  ukoly z chatu: doplnen zadavatel u ${doplneno}`);
  } catch (err) {
    console.warn('  zadavatele ukolu se nepodarilo doplnit:', err);
  }
}

/**
 * BRUNO ZPĚTNĚ OHLÁSÍ DOKONČENÝ PŘEPOSLECH (zadání 21. 9. 2026: „potřebujeme
 * dostat notifikaci do kanálu projektu do chatu od Bruna o tom, že klient
 * dokončil přeposlech. Teď se to stalo u Annie bot a nevěděli jsme to. Může to
 * vyzkoušet udělat Bruno zpětně?").
 *
 * Nově to Bruno hlásí sám při odškrtnutí PŘEPOSLECHNUTO (lib/brunoOznameni.ts).
 * Tohle jednou dohoní projekty, které byly přeposlechnuté dřív - jen ty
 * s „Annie" v názvu, o které šlo. Známka v Counteru, ať se to neopakuje.
 * Text je zkrácená kopie z lib/brunoOznameni.ts (seed nesahá na „@/..." importy).
 */
async function brunoZpetneOznamPreposlech() {
  const ZNAMKA = 'bruno-zpetne-preposlech-annie';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;

    const bruno = await prisma.user.findUnique({ where: { email: 'bruno@mediaspace.cz' }, select: { id: true } });
    if (!bruno) {
      console.warn('  bruno zpetne: Bruno nema ucet, zkusi se pri dalsim nasazeni');
      return;
    }

    const projekty = await prisma.projectMeta.findMany({
      where: { name: { contains: 'annie', mode: 'insensitive' } },
      select: { caflouProjectId: true, name: true },
    });
    let ohlaseno = 0;
    for (const projekt of projekty) {
      const stav = await prisma.preposlechStav.findUnique({
        where: { caflouProjectId: projekt.caflouProjectId },
        select: { reviewed: true, reviewedAt: true, reviewedByName: true, pocetStop: true },
      });
      if (!stav?.reviewed) continue;

      const poznamek = await prisma.preposlechChyba.count({ where: { caflouProjectId: projekt.caflouProjectId } });
      const kdy = stav.reviewedAt
        ? new Intl.DateTimeFormat('cs-CZ', {
            day: 'numeric',
            month: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Prague',
          }).format(stav.reviewedAt)
        : null;
      const text = [
        `✅ Přeposlech je dokončený (hlásím zpětně). ${stav.reviewedByName?.trim() || 'Klient'} označil(a) nahrávku jako přeposlechnutou${kdy ? ` ${kdy}` : ''}.`,
        `Poznámek k opravě: ${poznamek}${stav.pocetStop ? ` · stop: ${stav.pocetStop}` : ''}.`,
        poznamek > 0 ? 'Poznámky jsou v AudioTaggeru v detailu projektu.' : 'Žádná poznámka k opravě.',
      ].join('\n');

      let kanal = await prisma.conversation.findUnique({
        where: { caflouProjectId: projekt.caflouProjectId },
        select: { id: true },
      });
      if (!kanal) {
        kanal = await prisma.conversation.create({
          data: { kind: 'PROJEKT', name: projekt.name || 'Projekt', caflouProjectId: projekt.caflouProjectId, createdById: bruno.id },
          select: { id: true },
        });
      }
      const ted = new Date();
      await prisma.message.create({ data: { conversationId: kanal.id, userId: bruno.id, body: text, createdAt: ted } });
      await prisma.conversation.update({ where: { id: kanal.id }, data: { lastMessageAt: ted } });
      console.log('  bruno zpetne: ohlasen dokonceny preposlech "' + projekt.name + '"');
      ohlaseno += 1;
    }

    // Znamka jen kdyz se neco ohlasilo - jinak to zkusi pri dalsim nasazeni.
    if (ohlaseno > 0) await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    else console.log('  bruno zpetne: preposlechnuty projekt "Annie" nenalezen');
  } catch (err) {
    console.warn('  bruno zpetne: nepovedlo se', err);
  }
}

/**
 * Podpis na faktury (21. 9. 2026: „na fakturách chybí můj podpis"). Jednorázově
 * ho vloží ke všem vlastním firmám, které podpis ještě nemají. Pak už se
 * nahrává/mění/odebírá v Doklady → Moje firmy → detail firmy.
 */
async function vlozPodpisNaFaktury() {
  const ZNAMKA = 'podpis-na-faktury';
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;
    const r = await prisma.issuerCompany.updateMany({ where: { podpis: null }, data: { podpis: PODPIS_ONDREJ } });
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    console.log(`  podpis na faktury: vlozen k ${r.count} firmam`);
  } catch (e) {
    console.warn('  podpis na faktury selhal:', e);
  }
}

/**
 * FAKTURY Z CAFLOU (21. 9. 2026: „stáhnul jsem fyzicky pdf faktur za letošní
 * rok. Co s tím?"). Údaje jsou vyčtené z PDF do importFaktur/caflou-2026.json
 * (2026157-2026206) a caflou-2026-duben-cerven.json (2026107-2026156) - v portálu
 * pak sedí obrat, přehled klientů i projekty. Každý soubor má vlastní známku.
 *
 * Jednorázově (známka v Counter). Faktura, jejíž číslo už v portálu je, se
 * přeskočí - nic se nepřepisuje. Všechny nesly razítko „Již uhrazeno", takže
 * jdou jako uhrazené; datum úhrady z PDF nejde poznat, bere se splatnost.
 * Odběratel se páruje podle IČO, jinak se založí. Projekt podle názvu.
 */
async function importujFakturyZCaflou(soubor: string, ZNAMKA: string) {
  try {
    const uz = await prisma.counter.findUnique({ where: { name: ZNAMKA } });
    if (uz) return;

    type Polozka = { popis: string; mnozstvi: number; cena: number; zaklad: number; dph: number };
    type Faktura = {
      cislo: string;
      vystaveno: string;
      duzp: string | null;
      splatnost: string | null;
      mena: 'CZK' | 'EUR';
      odberatel: string;
      ico: string | null;
      dic: string | null;
      ulice: string | null;
      mesto: string | null;
      psc: string | null;
      predmet: string | null;
      projekt: string | null;
      polozky: Polozka[];
    };
    const faktury = JSON.parse(
      readFileSync(join(process.cwd(), 'prisma/importFaktur', soubor), 'utf8'),
    ) as Faktura[];

    const vydavatel =
      (await prisma.issuerCompany.findFirst({ where: { ic: '07459424' } })) ??
      (await prisma.issuerCompany.findFirst({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }));
    if (!vydavatel) {
      console.warn('  import faktur: neni fakturacni firma, zkusi se pri dalsim nasazeni');
      return;
    }
    const ucet = await prisma.bankAccount.findFirst({
      where: { issuerCompanyId: vydavatel.id, accountNumber: { contains: '3169021011' } },
      select: { id: true },
    });
    const den = (d: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);
    const projekty = await prisma.projectMeta.findMany({
      where: { name: { not: null } },
      select: { caflouProjectId: true, name: true },
    });
    const podleNazvu = new Map(projekty.map((p: { caflouProjectId: string; name: string | null }) => [(p.name ?? '').trim().toLowerCase(), p]));

    let vlozeno = 0;
    const preskoceno: string[] = [];
    for (const f of faktury) {
      const existuje = await prisma.invoice.findUnique({ where: { number: f.cislo }, select: { id: true } });
      if (existuje) {
        preskoceno.push(f.cislo);
        continue;
      }

      let firma = f.ico
        ? await prisma.company.findFirst({ where: { ic: f.ico }, select: { id: true } })
        : null;
      if (!firma) {
        firma = await prisma.company.findFirst({
          where: { name: { equals: f.odberatel, mode: 'insensitive' } },
          select: { id: true },
        });
      }
      if (!firma) {
        const c = await prisma.counter.upsert({
          where: { name: 'F' },
          create: { name: 'F', value: 1 },
          update: { value: { increment: 1 } },
        });
        firma = await prisma.company.create({
          data: {
            code: `MSF${String(c.value).padStart(4, '0')}`,
            type: 'KLIENT',
            name: f.odberatel,
            ic: f.ico,
            dic: f.dic,
            addressStreet: f.ulice,
            addressCity: f.mesto,
            addressZip: f.psc,
            addressCountry: 'CZ',
          },
          select: { id: true },
        });
      }

      const projekt = f.projekt ? podleNazvu.get(f.projekt.trim().toLowerCase()) : undefined;
      const splatnost = den(f.splatnost);
      const vystaveno = den(f.vystaveno)!;
      const ted = new Date();
      await prisma.invoice.create({
        data: {
          number: f.cislo,
          variableSymbol: f.cislo.replace(/\D/g, ''),
          issuerCompanyId: vydavatel.id,
          companyId: firma.id,
          bankAccountId: ucet?.id ?? null,
          currency: f.mena,
          exchangeRate: 1,
          issueDate: vystaveno,
          taxDate: den(f.duzp),
          dueDate: splatnost,
          subject: f.projekt || f.predmet,
          note: 'Importováno z PDF faktury z Caflou.',
          status: 'PAID',
          sentAt: vystaveno,
          paidAt: splatnost && splatnost < ted ? splatnost : vystaveno,
          caflouProjectId: projekt?.caflouProjectId ?? null,
          projectName: projekt?.name ?? f.projekt,
          items: {
            create: f.polozky.map((p, i) => ({
              description: p.popis,
              quantity: p.mnozstvi,
              unitPriceMinor: Math.round(p.cena * 100),
              vatRate: p.dph,
              sortOrder: i,
            })),
          },
        },
      });
      vlozeno += 1;
    }

    await prisma.counter.create({ data: { name: ZNAMKA, value: vlozeno } });
    console.log(`  import faktur z Caflou: vlozeno ${vlozeno}, preskoceno (cislo uz je v portalu): ${preskoceno.join(', ') || '-'}`);
  } catch (e) {
    console.warn('  import faktur z Caflou selhal:', e);
  }
}

/**
 * Backlog se přestěhoval do Přehledů (21. 9. 2026). Z upravených lišt se
 * položka /backlog odebere, ať tam nevisí odkaz, který jen přesměrovává.
 */
async function backlogZListyDoPrehledu() {
  const ZNAMKA = 'backlog-do-prehledu';
  try {
    if (await prisma.counter.findUnique({ where: { name: ZNAMKA } })) return;
    const r = await prisma.userMenuItem.deleteMany({ where: { href: '/backlog' } });
    await prisma.counter.create({ data: { name: ZNAMKA, value: r.count } });
    console.log(`  backlog z listy: odebrano ${r.count} polozek`);
  } catch (e) {
    console.warn('  backlog z listy selhal:', e);
  }
}

/**
 * Vedoucí poboček (22. 9. 2026: „Tomáš Ilavský by měl mít přístup k úpravám
 * i brněnských kalendářů. Je to vedoucí pobočky. A to samé Ondřej Černý ml.
 * v Praze"). Jednorázově; dál se to zaškrtává na kartě uživatele.
 */
async function vedouciPobocek() {
  const ZNAMKA = 'vedouci-pobocek';
  try {
    if (await prisma.counter.findUnique({ where: { name: ZNAMKA } })) return;
    const studia = await prisma.studio.findMany({ select: { id: true, shortName: true } });
    const podle = (k: string) => studia.filter((s: { shortName: string }) => s.shortName === k).map((s: { id: string }) => ({ id: s.id }));

    const tomas = await prisma.user.findFirst({
      where: { OR: [{ email: 'tomas.ilavsky@mediaspace.cz' }, { name: { contains: 'Ilavsk', mode: 'insensitive' } }] },
      select: { id: true },
    });
    const ondrej = await prisma.user.findFirst({
      where: {
        OR: [
          { code: 'MSI0013' },
          { email: { contains: 'ondrej.cernyml', mode: 'insensitive' } },
          { name: { contains: 'Černý ml', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (tomas) await prisma.user.update({ where: { id: tomas.id }, data: { vedeStudia: { connect: [...podle('Brno I'), ...podle('Brno II')] } } });
    if (ondrej) await prisma.user.update({ where: { id: ondrej.id }, data: { vedeStudia: { connect: podle('Praha') } } });
    await prisma.counter.create({ data: { name: ZNAMKA, value: 1 } });
    console.log(`  vedouci pobocek: Tomas ${tomas ? 'ano' : 'NENALEZEN'}, Ondrej ml. ${ondrej ? 'ano' : 'NENALEZEN'}`);
  } catch (e) {
    console.warn('  vedouci pobocek selhalo:', e);
  }
}
