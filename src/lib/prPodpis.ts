import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * PODPIS EMY POD MAILEM (zadání 20. 11. 2026: „musí psát ze svého mailu se
 * svým podpisem a v podpisu musí být její jméno s naším logem, tak jak mám
 * udělaný vzor podpisový").
 *
 * Skládá se podle Ondřejova podpisu: oslovení, jméno a role, logo, kontakt
 * a čtyři adresy studií. Telefon tu není - Emě žádný nepatří a číslo na
 * člověka by do jejího podpisu lhalo.
 *
 * STYLY JSOU PSANÉ U PRVKŮ. Poštovní klienti stylopis v hlavičce zahazují,
 * takže všechno, co má držet, musí být přímo u elementu (stejně jako
 * podpisCloveka v lib/email.ts).
 *
 * LOGO JE ODKAZ, NE PŘÍLOHA - klient si ho stáhne sám, a když nestáhne,
 * zůstane čitelný text. Bere se statická verze; animovaný gif v podpisu
 * působí jako banner.
 *
 * ADRESA, ZE KTERÉ EMA PÍŠE, je v proměnné PR_ODPOVED (výchozí
 * pr@mediaspace.cz); přihlášení k té schránce drží PR_SMTP_USER
 * a PR_SMTP_PASSWORD - viz transportPR v lib/email.ts.
 */

export const EMA_JMENO = 'Ema Piarová';
export const EMA_ROLE = 'PR a komunikace | MEDIA SPACE s.r.o.';

const STUDIA: [string, string][] = [
  ['STUDIO BRNO I:', 'Pod kaštany 30, 616 00 Brno'],
  ['STUDIO BRNO II:', 'Veveří 102, 616 00 Brno'],
  ['STUDIO PRAHA:', 'Bohuslava ze Švamberka 8, 140 00 Praha'],
  ['STUDIO LONDÝN:', '99-103 Lomond Grove, SE5 7HN London'],
];

const WEB = 'www.mediaspace.cz';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Podpis jako čistý text - pro klienty, které HTML nezajímá. */
export function podpisEmyText(adresa: string): string {
  return [
    'S pozdravem',
    '',
    EMA_JMENO,
    EMA_ROLE,
    '',
    `E: ${adresa}`,
    `W: ${WEB}`,
    '',
    ...STUDIA.map(([k, v]) => `${k} ${v}`),
  ].join('\n');
}

export function podpisEmyHtml(adresa: string): string {
  /**
   * LOGO V BAREVNOSTI PODPISU (20. 11. 2026: „ten podpis je hrozný,
   * potřebuju to nastavit přesně podle toho našeho podpisu").
   *
   * Portálové `mediaspace-logo-still.png` je ZELENÉ a je to čtverec 280×280
   * s velkým prázdným okrajem - v mailu z něj byla zelená cedule přes půl
   * obrazovky. `mediaspace-podpis.png` je tentýž nápis přebarvený do fialové
   * značky a oříznutý na samotný text, stejně jako v Ondřejově podpisu.
   */
  const logo = `${zakladPortalu()}/mediaspace-podpis.png`;
  const studia = STUDIA.map(
    ([k, v]) =>
      `<div style="margin:0;"><strong>${escapeHtml(k)}</strong> ${escapeHtml(v)}</div>`,
  ).join('');

  return `
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:#000000;">
      <div style="margin-top:20px;">S pozdravem</div>
      <div style="margin-top:20px;"><strong>${escapeHtml(EMA_JMENO)}</strong></div>
      <div>${escapeHtml(EMA_ROLE)}</div>
      <div style="margin:18px 0 16px;">
        <img src="${logo}" width="240" alt="MEDIA SPACE" style="display:block;width:240px;height:auto;border:0;" />
      </div>
      <div><strong>E:</strong> <a href="mailto:${escapeHtml(adresa)}" style="color:#000000;text-decoration:none;">${escapeHtml(adresa)}</a></div>
      <div><strong>W:</strong> <a href="https://${WEB}" style="color:#000000;text-decoration:none;">${WEB}</a></div>
      <div style="margin-top:14px;">${studia}</div>
    </div>`;
}

/** Tělo mailu: co napsala Ema, pod tím podpis. Odstavce zůstanou odstavci. */
export function teloMailuHtml(text: string, adresa: string): string {
  const odstavce = text
    .split(/\n{2,}/)
    .map((o) => `<p style="margin:0 0 14px;">${escapeHtml(o).replace(/\n/g, '<br />')}</p>`)
    .join('');

  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#201A33;">${odstavce}${podpisEmyHtml(adresa)}</div>`;
}
