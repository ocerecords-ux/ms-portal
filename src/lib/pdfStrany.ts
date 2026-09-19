import { inflateSync } from 'node:zlib';

/**
 * POČET STRAN PDF BEZ KNIHOVNY (zadání 19. 9. 2026 - Progres natáčení).
 *
 * Portál na serveru žádnou PDF knihovnu nemá (pdf.js se načítá jen
 * v prohlížeči), a na jedno číslo ji tahat nechceme. Počet stran nese
 * kořenový uzel stromu stránek: slovník `/Type /Pages` s `/Count N`.
 * Mezilehlé uzly mají Count menší, takže platí NEJVĚTŠÍ nalezený Count.
 *
 * Novější PDF (1.5+) schovávají slovníky do komprimovaných „object
 * streams" - když se v nekomprimované části nic nenajde, rozbalí se
 * FlateDecode proudy a hledá se znovu. Poslední záchrana je spočítat
 * jednotlivé `/Type /Page`.
 *
 * Vrací null, když se nic rozumného nenajde - progres pak radši nic
 * neukáže, než aby lhal.
 */
const PAGES_S_COUNT = /\/Type\s*\/Pages\b[^]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^]*?\/Type\s*\/Pages\b/g;

function najdiCount(text: string): number | null {
  let nejvic = 0;
  // Hledá se po jednotlivých slovnících (<< ... >>) - jinak by se Count
  // z jednoho objektu spároval s Type z vedlejšího.
  const slovniky = text.match(/<<(?:[^<>]|<(?!<)|>(?!>))*\/Type\s*\/Pages\b(?:[^<>]|<(?!<)|>(?!>))*>>/g) ?? [];
  for (const d of slovniky) {
    const m = /\/Count\s+(\d+)/.exec(d);
    if (m) nejvic = Math.max(nejvic, Number(m[1]));
  }
  if (nejvic > 0) return nejvic;
  // Zaloha pro slovniky s vnorenymi << >> (napr. /Resources primo v uzlu).
  for (const m of text.matchAll(PAGES_S_COUNT)) {
    const n = Number(m[1] ?? m[2]);
    if (n > 0 && n < 100000) nejvic = Math.max(nejvic, n);
  }
  return nejvic > 0 ? nejvic : null;
}

function rozbaleneProudy(obsah: Buffer): string {
  const casti: string[] = [];
  let od = 0;
  for (;;) {
    const zacatek = obsah.indexOf('stream', od, 'latin1');
    if (zacatek < 0) break;
    // "endstream" obsahuje "stream" - preskocit.
    if (obsah.toString('latin1', Math.max(0, zacatek - 3), zacatek) === 'end') {
      od = zacatek + 6;
      continue;
    }
    let data = zacatek + 6;
    if (obsah[data] === 0x0d) data++;
    if (obsah[data] === 0x0a) data++;
    const konec = obsah.indexOf('endstream', data, 'latin1');
    if (konec < 0) break;
    try {
      casti.push(inflateSync(obsah.subarray(data, konec)).toString('latin1'));
    } catch {
      // Neni to Flate (obrazek, font) - nevadi.
    }
    od = konec + 9;
  }
  return casti.join('\n');
}

export function pocetStranPdf(obsah: Buffer): number | null {
  const text = obsah.toString('latin1');
  if (!text.startsWith('%PDF')) return null;

  const primo = najdiCount(text);
  if (primo) return primo;

  const rozbalene = rozbaleneProudy(obsah);
  const zeStreamu = najdiCount(rozbalene);
  if (zeStreamu) return zeStreamu;

  const stranky = (text + '\n' + rozbalene).match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  return stranky > 0 ? stranky : null;
}
