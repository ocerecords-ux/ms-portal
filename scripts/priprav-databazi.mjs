/**
 * Příprava databáze při buildu na Vercelu (10. 9. 2026).
 *
 * PROČ TO TU JE: build spouštěl `prisma db push && npm run db:seed` napřímo
 * a dvakrát po sobě spadl na
 *
 *     FATAL: (EMAXCONNSESSION) max clients reached in session mode
 *            - max clients are limited to pool_size: 15
 *
 * Supabase pooler má v session módu patnáct míst. Když jsou zrovna plná
 * (běžící funkce portálu, předchozí build), Prisma se nemá kam připojit a
 * build skončí — přestože s kódem není nic špatně. Za pár vteřin se místo
 * uvolní.
 *
 * Proto se každý krok zkusí několikrát. Čekání je krátké a strop nízký:
 * když se databáze neuvolní ani po minutě, není to zahlcení a build má
 * spadnout, ať je vidět, že se děje něco jiného.
 *
 * OPAKUJE SE JEN NA ZAHLCENÍ SPOJENÍ. Chyba ve schématu nebo v seedu se
 * opakováním nespraví — ta build shodí hned, aby ji bylo vidět.
 *
 * A HLAVNĚ: když se schéma od minulého nasazení nezměnilo, `db push` se
 * vůbec nespouští. Většina nasazení mění jen kód a sahat kvůli tomu na
 * databázi je zbytečné — právě tím padaly buildy, ve kterých nebylo co
 * měnit. Otisk schématu se ukládá do build cache Vercelu; když cache není
 * (první build, vyčištěná cache), push proběhne normálně.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const POKUSY = 5;
const CEKANI_MS = 12_000;

/** Chyby, které znamenají „teď se nemám kam připojit", ne „něco je špatně". */
const ZAHLCENI = [
  'EMAXCONNSESSION',
  'max clients reached',
  'too many clients',
  'Timed out fetching a new connection',
  "Can't reach database server",
  'Connection terminated',
  'ECONNRESET',
  'ETIMEDOUT',
];

function jeZahlceni(vystup) {
  return ZAHLCENI.some((v) => vystup.includes(v));
}

function spust(popis, prikaz, argumenty) {
  for (let pokus = 1; pokus <= POKUSY; pokus++) {
    const vysledek = spawnSync(prikaz, argumenty, { encoding: 'utf8', shell: false });
    const vystup = `${vysledek.stdout ?? ''}${vysledek.stderr ?? ''}`;
    process.stdout.write(vystup);

    if (vysledek.status === 0) return;

    if (pokus < POKUSY && jeZahlceni(vystup)) {
      const vteriny = Math.round(CEKANI_MS / 1000);
      console.log(
        `\n${popis}: databáze je zrovna plná (pokus ${pokus} z ${POKUSY}). Zkusím to znovu za ${vteriny} s.\n`,
      );
      // Uspani bez zavislosti navic - build nema cekat na dalsi balicek.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, CEKANI_MS);
      continue;
    }

    console.error(`\n${popis} se nepodařilo dokončit.\n`);
    process.exit(vysledek.status ?? 1);
  }
}

// Otisk schematu. Lezi v build cache, kterou Vercel mezi nasazenimi
// obnovuje - kdyz chybi, jen se pushne navic, nic se nerozbije.
const SCHEMA = 'prisma/schema.prisma';
const OTISK_SOUBOR = 'node_modules/.cache/ms-portal/schema-hash';

function otiskSchematu() {
  return createHash('sha256').update(readFileSync(SCHEMA)).digest('hex');
}

function ulozenyOtisk() {
  try {
    return existsSync(OTISK_SOUBOR) ? readFileSync(OTISK_SOUBOR, 'utf8').trim() : null;
  } catch {
    return null;
  }
}

function zapisOtisk(otisk) {
  try {
    mkdirSync(dirname(OTISK_SOUBOR), { recursive: true });
    writeFileSync(OTISK_SOUBOR, otisk);
  } catch {
    // Kdyz se otisk neulozi, pristi build jen pushne navic. Nic vazneho.
  }
}

const otisk = otiskSchematu();
const stejneSchema = ulozenyOtisk() === otisk;

if (stejneSchema) {
  console.log('Schéma se od minulého nasazení nezměnilo — prisma db push se přeskakuje.');
} else {
  spust('Úprava schématu (prisma db push)', 'npx', [
    'prisma',
    'db',
    'push',
    '--accept-data-loss',
    // Klient uz je vygenerovany krokem pred timhle - podruhe to nema smysl.
    '--skip-generate',
  ]);
  zapisOtisk(otisk);
}

/**
 * SEED SE PŘESKAKUJE, KDYŽ SE NEMĚNIL (1. 10. 2026 - účet od Vercelu).
 *
 * Stavění portálu stálo za tři týdny přes 200 dolarů a skoro celé to byly
 * minuty strávené buildem. Při každém nasazení se přitom pouštěl celý seed:
 * porovnal 1551 řádků převzatého kalendáře, přepsal návody, prošel všechny
 * jednorázové úpravy. V logu to vypadá stejně pokaždé - „nove 0, odebrano 0".
 *
 * Seed je řízený obsahem souborů ve složce `prisma/`: seed.ts sám, texty
 * návodů (navod*.ts), převzatý kalendář a importní JSONy. Když se ani jeden
 * z nich nezměnil, nemá seed co udělat - jednorázové úpravy navíc hlídají
 * counters v databázi.
 *
 * ČEHO SI BÝT VĚDOM: kdyby seed začal záviset na souboru mimo `prisma/`
 * (třeba na seznamu sekcí v src/lib/pristupy.ts), otisk to nepozná a seed se
 * přeskočí. Proto se při takové změně sahá i do seed.ts - což je přesně to,
 * co se dělá, když se přidává nová jednorázová úprava. Vynutit jde seed
 * proměnnou SEED_VZDY=1.
 */
const SEED_OTISK_SOUBOR = 'node_modules/.cache/ms-portal/seed-hash';

function otiskSeedu() {
  const hash = createHash('sha256');
  const projdi = (adresar) => {
    for (const polozka of readdirSync(adresar, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      // Migrace řeší prisma db push, schéma má vlastní otisk.
      if (polozka.name === 'migrations' || polozka.name === 'schema.prisma') continue;
      const cesta = `${adresar}/${polozka.name}`;
      if (polozka.isDirectory()) projdi(cesta);
      else hash.update(cesta).update(readFileSync(cesta));
    }
  };
  projdi('prisma');
  return hash.digest('hex');
}

const otiskSeed = otiskSeedu();
let ulozenySeed = null;
try {
  ulozenySeed = existsSync(SEED_OTISK_SOUBOR) ? readFileSync(SEED_OTISK_SOUBOR, 'utf8').trim() : null;
} catch {
  ulozenySeed = null;
}

if (!process.env.SEED_VZDY && stejneSchema && ulozenySeed === otiskSeed) {
  console.log('Seed se od minulého nasazení nezměnil — přeskakuje se.');
} else {
  spust('Naplnění výchozích dat (seed)', 'npx', ['tsx', 'prisma/seed.ts']);
  try {
    mkdirSync(dirname(SEED_OTISK_SOUBOR), { recursive: true });
    writeFileSync(SEED_OTISK_SOUBOR, otiskSeed);
  } catch {
    // Neuložený otisk znamená jen seed navíc při příštím nasazení.
  }
}
