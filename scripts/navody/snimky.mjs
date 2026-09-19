/**
 * OBRÁZKY DO NÁVODŮ (zadání 19. 9. 2026: „chybí mi tam obrázky. Návody musí
 * být hodně jasné… a hlavně je pak automaticky přepracuj, jakmile se něco
 * změní").
 *
 * Každý návod s obrázky má tady repliku obrazovek (<navod>.html). Snímek je
 * každý prvek s id „s1", „s2"… a uloží se jako public/navody/<navod>-<n>.png.
 * Růžová čísla v replice odpovídají číslovanému seznamu v textu návodu.
 *
 * Když se změní obrazovka, kterou návod popisuje: upravit repliku, pustit
 *   node scripts/navody/snimky.mjs terminy
 * a opravit text v prisma/navod*.ts.
 *
 * Potřebuje Playwright (npx playwright install chromium).
 */
import playwright from 'playwright';
const { chromium } = playwright;
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const navod = process.argv[2];
if (!navod) {
  console.error('Použití: node scripts/navody/snimky.mjs <navod>   (např. terminy)');
  process.exit(1);
}
const slozka = path.dirname(fileURLToPath(import.meta.url));
const koren = path.resolve(slozka, '../..');

const prohlizec = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const stranka = await prohlizec.newPage({ viewport: { width: 960, height: 900 }, deviceScaleFactor: 2 });
await stranka.goto('file://' + path.join(slozka, `${navod}.html`), { waitUntil: 'load' });
for (let i = 1; ; i++) {
  const prvek = await stranka.$('#s' + i);
  if (!prvek) break;
  const cil = path.join(koren, 'public/navody', `${navod}-${i}.png`);
  await prvek.screenshot({ path: cil });
  console.log('uloženo', path.relative(koren, cil));
}
await prohlizec.close();
