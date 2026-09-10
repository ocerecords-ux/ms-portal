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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

spust('Naplnění výchozích dat (seed)', 'npx', ['tsx', 'prisma/seed.ts']);
