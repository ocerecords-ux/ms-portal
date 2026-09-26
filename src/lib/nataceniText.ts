/**
 * NATÁČECÍ TEXT (zadání 26. 9. 2026: „v rámci těch výstupů bych pracoval
 * i s textem. Že bychom měli nějaké vzory pro natáčení, kde by bylo jasně
 * označené, jak se spot jmenuje a jakou má délku a pro jakou licenci.
 * Ukládalo by se to do editovatelného dokumentu na disku ve složce projektu").
 *
 * JEDEN DOKUMENT ZA PROJEKT, SPOTY POD SEBOU (rozhodnutí téhož dne). V natáčecí
 * den je otevřený jeden list a jede se spot po spotu; každý má vlastní hlavičku
 * s názvem, délkou a licencí a pod ní místo na text.
 *
 * PODOBA LISTU (zadání 26. 9. 2026: „formát náhledu držme vždy jako A4, datum
 * pryč - dejme tam spíš poslední datum úpravy, pod zelené logo fialové pozadí
 * a udělejme to graficky hezčí"). List má stejnou hlavičku jako smlouva
 * a nabídka: fialový pruh, zelené logo v něm a zelená linka pod ním.
 *
 * TENHLE SOUBOR JE BEZ PRISMY - skládá jen text. Vyrobení dokumentu a jeho
 * uložení na Disk řeší nataceniTextServer.ts.
 */

/** Barvy značky - tytéž hodnoty jako v tailwind.config (brand.*). */
const FIALOVA = '#6B2AF0';
const FIALOVA_SVETLA = '#D9CCFF';
const ZELENA = '#1FDF67';
const INKOUST = '#201a33';
const SEDA = '#6b6880';
const LINKA = '#E3E0EC';

/** Co se dá do vzoru napsat jako proměnná. */
export const PROMENNE_NATACENI = [
  { klic: 'projekt', popis: 'Název projektu' },
  { klic: 'klient', popis: 'Název firmy klienta' },
  { klic: 'upraveno', popis: 'Datum poslední úpravy listu' },
  { klic: 'spot', popis: 'Název výstupu (jen v bloku spotu)' },
  { klic: 'delka', popis: 'Délka spotu - 30s, 2min. (jen v bloku spotu)' },
  { klic: 'licence', popis: 'Licence výstupu - Rádio, Online (jen v bloku spotu)' },
  { klic: 'poradi', popis: 'Pořadové číslo spotu v dokumentu' },
] as const;

/**
 * VÝCHOZÍ PODOBA VZORU. Úvod je schválně prázdný - název projektu, klienta
 * i datum úpravy nese hlavička listu, takže v textu by stály podruhé.
 */
export const VYCHOZI_VZOR_NATACENI = {
  nazev: 'Natáčecí list',
  uvod: '',
  blok: `{{spot}}
{{delka}} · {{licence}}

[text spotu]`,
};

/**
 * Podoba vzoru, kterou portál rozesílal do 26. 9. 2026 (číslovaný spot
 * a datum v úvodu). Seed podle ní pozná vzor, do kterého nikdo nesáhl,
 * a srovná ho na novou podobu - ručně upravený vzor nechá být.
 */
export const STARY_VZOR_NATACENI = {
  uvod: `NATÁČECÍ LIST
{{projekt}} — {{klient}}
Datum: {{datum}}`,
  blok: `{{poradi}}. {{spot}}  ·  {{delka}}  ·  {{licence}}

[text spotu]`,
};

export type VystupProText = {
  nazev: string;
  delka: string;
  licence: string;
};

export type PodkladyTextu = {
  projekt: string;
  klient: string;
  /** Kdy se naposledy měnily výstupy - místo dnešního data (26. 9. 2026). */
  upraveno: string;
  /** Absolutní adresa loga - v dokumentu na Disku i v náhledu v portálu. */
  logoUrl?: string | null;
};

/**
 * Dosadí proměnné. Co vzor nepoužije, se zahodí; co v datech není, zmizí
 * i se svou značkou - v listu má zůstat prázdné místo, ne „{{delka}}".
 */
export function dosad(sablona: string, hodnoty: Record<string, string>): string {
  const dosazeno = sablona.replace(
    /\{\{\s*([a-zA-Z_]+)\s*\}\}/g,
    (_, klic: string) => hodnoty[klic] ?? '',
  );

  /**
   * Po prázdné proměnné zbyde v řádku osiřelý oddělovač - u výstupu bez délky
   * by stálo „· Online, TV". Tohle ho sebere, ať vzor nemusí počítat s tím,
   * co je zrovna vyplněné.
   */
  return dosazeno
    .split('\n')
    .map((radek) =>
      radek
        .replace(/(?:\s*·\s*){2,}/g, ' · ')
        .replace(/^\s*·\s*/, '')
        .replace(/\s*·\s*$/, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd(),
    )
    .join('\n');
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Odstavce z prostého textu. Prázdný řádek = nový odstavec, jednoduchý řádek
 * zůstane řádkem. Styl se píše rovnou do atributu: Disk si při převodu na
 * dokument bere inline styly, na <style> v hlavičce se spolehnout nedá.
 */
function odstavce(text: string, styl: string, stylPrvniho?: string): string {
  return text
    .split(/\n{2,}/)
    .map((odstavec, i) => {
      const pouzity = i === 0 && stylPrvniho ? stylPrvniho : styl;
      return `<p style="${pouzity}">${escapeHtml(odstavec).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

/**
 * HLAVIČKA LISTU. Tabulka, ne <div> - barevný podklad přežije převod na
 * dokument Google jen v buňce tabulky. Logo je zelené, takže sedí na fialové
 * (zadání 26. 9. 2026: „pro dokumenty na bílém papíře použijme pod zelené
 * logo fialové pozadí").
 */
function hlavicka(podklady: PodkladyTextu): string {
  const logo = podklady.logoUrl
    ? `<img src="${escapeHtml(podklady.logoUrl)}" alt="Mediaspace" height="30" style="height:23pt">`
    : '';

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">
<tr><td bgcolor="${FIALOVA}" style="background-color:${FIALOVA};padding:16pt 18pt">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">
<tr>
<td style="vertical-align:top">
<p style="margin:0;font-family:Arial,sans-serif;font-size:8pt;letter-spacing:1.6pt;color:${ZELENA};text-transform:uppercase"><b>Natáčecí list</b></p>
<p style="margin:5pt 0 0;font-family:Arial,sans-serif;font-size:19pt;line-height:1.15;color:#ffffff"><b>${escapeHtml(podklady.projekt)}</b></p>
${podklady.klient ? `<p style="margin:3pt 0 0;font-family:Arial,sans-serif;font-size:10pt;color:${FIALOVA_SVETLA}">${escapeHtml(podklady.klient)}</p>` : ''}
</td>
<td align="right" width="150" style="vertical-align:top;text-align:right;width:112pt">${logo}</td>
</tr>
</table>
</td></tr>
<tr><td bgcolor="${ZELENA}" style="background-color:${ZELENA};font-size:1pt;line-height:3pt;height:3pt">&nbsp;</td></tr>
</table>
<p style="margin:7pt 0 0;font-family:Arial,sans-serif;font-size:8.5pt;color:${SEDA};text-align:right">Poslední úprava: ${escapeHtml(podklady.upraveno)}</p>`;
}

/**
 * Celý dokument jako HTML. Google Disk si z HTML udělá běžný dokument, do
 * kterého jde rovnou psát - proto ne PDF: rodný list se čte, natáčecí text se
 * píše.
 *
 * `ramecekA4` je jen pro náhled v portálu - obalí týž obsah bílým listem
 * o rozměrech A4, aby bylo předem vidět, co se na stránku vejde (zadání
 * 26. 9. 2026). Do dokumentu na Disku jde obsah bez rámečku, stránkování
 * si tam řeší Disk sám.
 */
export function sestavHtmlNataceni(
  vzor: { uvod?: string | null; blok: string },
  podklady: PodkladyTextu,
  vystupy: VystupProText[],
  ramecekA4 = false,
): string {
  const spolecne = {
    projekt: podklady.projekt,
    klient: podklady.klient,
    upraveno: podklady.upraveno,
  };

  const stylTextu = `margin:0 0 8pt;font-family:Arial,sans-serif;font-size:11pt;line-height:1.55;color:${INKOUST}`;
  const casti: string[] = [hlavicka(podklady)];

  if (vzor.uvod?.trim()) {
    casti.push(
      `<div style="margin-top:14pt">${odstavce(dosad(vzor.uvod, spolecne), stylTextu)}</div>`,
    );
  }

  vystupy.forEach((v, i) => {
    const text = dosad(vzor.blok, {
      ...spolecne,
      spot: v.nazev,
      delka: v.delka,
      licence: v.licence,
      poradi: String(i + 1),
    });

    /**
     * První odstavec bloku je hlavička spotu (název), druhý bývá řádek se
     * stopáží a licencí - ten se sází fialově a menším písmem, ať je na
     * první pohled poznat, kde jeden spot začíná. Zbytek je místo na text.
     */
    const radky = text.split(/\n{2,}/);
    const nazev = radky.shift() ?? '';
    const [prvniRadek, ...dalsiRadky] = nazev.split('\n');
    const popis = dalsiRadky.join(' ').trim();

    casti.push(
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:20pt">` +
        `<tr><td style="border-top:1pt solid ${LINKA};padding-top:9pt">` +
        `<p style="margin:0;font-family:Arial,sans-serif;font-size:13pt;color:${INKOUST}"><b>${escapeHtml(prvniRadek)}</b></p>` +
        (popis
          ? `<p style="margin:3pt 0 0;font-family:Arial,sans-serif;font-size:9pt;letter-spacing:0.4pt;color:${FIALOVA}"><b>${escapeHtml(popis)}</b></p>`
          : '') +
        `</td></tr></table>` +
        `<div style="margin:10pt 0 16pt">${odstavce(radky.join('\n\n'), stylTextu)}</div>`,
    );
  });

  // Patička jako na smlouvě a nabídce - ať je na vytištěném listu poznat,
  // odkud je, i když se z něj utrhne jedna stránka.
  casti.push(
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:22pt">` +
      `<tr>` +
      `<td style="border-top:1pt solid ${LINKA};padding-top:6pt">` +
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:9pt;color:${FIALOVA}"><b>Mediaspace</b></p>` +
      `</td>` +
      `<td align="right" style="border-top:1pt solid ${LINKA};padding-top:6pt;text-align:right">` +
      `<p style="margin:0;font-family:Arial,sans-serif;font-size:8pt;color:${SEDA}">${escapeHtml(podklady.projekt)}</p>` +
      `</td></tr></table>`,
  );

  const obsah = casti.join('\n');

  if (!ramecekA4) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(podklady.projekt)}</title></head>
<body style="margin:0;font-family:Arial,sans-serif">${obsah}</body></html>`;
  }

  // NÁHLED: bílý list A4 (794 × 1123 px při 96 dpi) zmenšený tak, aby se
  // vešel CELÝ - na šířku i na výšku rámečku (26. 9. 2026: „u toho náhledu
  // dokumentu nemůže být nikdy ten posuvník, chci celou A4 hned vždy vidět").
  // Když je textu na víc stránek, list se zmenší dál; posuvník tu nikdy není.
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(podklady.projekt)}</title></head>
<body style="margin:0;padding:0;background:#e9e7f1;font-family:Arial,sans-serif;overflow:hidden">
<div id="obal" style="width:794px;transform-origin:top left;position:absolute;top:0;left:0">
<div id="list" style="width:794px;min-height:1123px;box-sizing:border-box;background:#ffffff;padding:60px 64px;box-shadow:0 2px 16px rgba(32,26,51,0.22)">${obsah}</div>
</div>
<script>
(function(){
  var obal = document.getElementById('obal'), list = document.getElementById('list');
  function srovnej(){
    var okraj = 12;
    var w = document.documentElement.clientWidth - okraj * 2;
    var h = document.documentElement.clientHeight - okraj * 2;
    var vyska = Math.max(list.offsetHeight, 1123);
    var s = Math.min(w / 794, h / vyska);
    if (!(s > 0)) return;
    obal.style.transform = 'translate(' + ((document.documentElement.clientWidth - 794 * s) / 2) +
      'px, ' + okraj + 'px) scale(' + s + ')';
  }
  window.addEventListener('resize', srovnej);
  window.addEventListener('load', srovnej);
  srovnej();
})();
</script>
</body></html>`;
}

/** Název souboru na Disku - „Natáčecí text — Strabag jaro". */
export function nazevDokumentu(nazevProjektu: string, poradi: number): string {
  const zaklad = `Natáčecí text — ${nazevProjektu.trim() || 'projekt'}`;
  return poradi > 1 ? `${zaklad} (${poradi})` : zaklad;
}
