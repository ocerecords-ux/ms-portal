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
const ZELENA = '#1FDF67';
const INKOUST = '#201a33';
const SEDA = '#6b6880';
const LINKA = '#E3E0EC';

/** Co se dá do vzoru napsat jako proměnná. */
export const PROMENNE_NATACENI = [
  { klic: 'projekt', popis: 'Název projektu' },
  { klic: 'upraveno', popis: 'Datum poslední úpravy listu' },
  { klic: 'spot', popis: 'Název výstupu (jen v bloku spotu)' },
  { klic: 'delka', popis: 'Délka spotu - 30s, 2min. (jen v bloku spotu)' },
  { klic: 'licence', popis: 'Licence výstupu - Rádio, Online (jen v bloku spotu)' },
  { klic: 'poradi', popis: 'Pořadové číslo spotu v dokumentu' },
  { klic: 'text', popis: 'Text spotu zapsaný u výstupu (jen v bloku spotu)' },
] as const;

/**
 * MÍSTO NA TEXT (30. 9. 2026: „bylo by super, kdybych tady mohl k těm výstupům
 * i nahrát a editovat text").
 *
 * Ve vzorech, které portál rozeslal do dneška, stojí tahle věta natvrdo jako
 * výplň. Teď je z ní přihrádka: co je u výstupu napsané, se sem vloží, a kde
 * text ještě není, zůstane stát ona sama - list se tím tiskne přesně jako dřív
 * a je v něm místo na ruční doplnění. Ručně upravené vzory tak fungují dál
 * a nikdo je nemusí přepisovat na {{text}}.
 */
export const MISTO_NA_TEXT = '[text spotu]';

/**
 * Značka, pod kterou text projde úklidem v `dosad`. Ten srovnává oddělovače
 * a slepuje dvojité mezery, což je správně pro hlavičku spotu, ale ve scénáři
 * by to sebralo odsazení. Text se proto dosadí až po úklidu - značka je
 * schválně bez mezer a bez teček, aby na ni žádné z pravidel nesáhlo.
 */
const ZNACKA_TEXTU = '@@MSTEXT@@';

/**
 * VÝCHOZÍ PODOBA VZORU. Úvod je schválně prázdný - název projektu i datum
 * úpravy nese hlavička listu, takže v textu by stály podruhé.
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
  /** Co se bude natáčet. Prázdné = v listu zůstane volné místo (30. 9. 2026). */
  text?: string | null;
};

export type PodkladyTextu = {
  projekt: string;
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
 *
 * ODSAZENÍ NA ZAČÁTKU ŘÁDKU SE DRŽÍ NEZLOMITELNÝMI MEZERAMI (30. 9. 2026:
 * „chci ať to vypadá na disku, jako v tom náhledu"). V prohlížeči ho udrží
 * `white-space:pre-wrap`, jenže tuhle vlastnost převod na dokument Google
 * neumí - scénář, který chodí odsazený, by se na Disku slepil doleva.
 */
function odstavce(text: string, styl: string, stylPrvniho?: string): string {
  return text
    .split(/\n{2,}/)
    .map((odstavec, i) => {
      const pouzity = i === 0 && stylPrvniho ? stylPrvniho : styl;
      const telo = escapeHtml(odstavec)
        .split('\n')
        .map((radek) => radek.replace(/^ +/, (mezery) => '&nbsp;'.repeat(mezery.length)))
        .join('<br>');
      return `<p style="${pouzity}">${telo}</p>`;
    })
    .join('');
}

/**
 * HLAVIČKA LISTU. Tabulka, ne <div> - barevný podklad přežije převod na
 * dokument Google jen v buňce tabulky. Logo je zelené, takže sedí na fialové
 * (zadání 26. 9. 2026: „pro dokumenty na bílém papíře použijme pod zelené
 * logo fialové pozadí").
 *
 * JEDNA TABULKA, NE TABULKA V TABULCE (30. 9. 2026). V prohlížeči vypadaly
 * obě stejně, jenže vnořenou tabulku převod na dokument Google rozhází -
 * fialový pruh se rozpadl na dva bloky a logo skončilo pod textem. Text
 * a logo jsou proto dvě buňky téhož řádku a fialová je na obou.
 */
function hlavicka(podklady: PodkladyTextu): string {
  const logo = podklady.logoUrl
    ? `<img src="${escapeHtml(podklady.logoUrl)}" alt="Mediaspace" height="56" style="height:42pt">`
    : '';

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%">
<tr>
<td bgcolor="${FIALOVA}" style="background-color:${FIALOVA};padding:16pt 6pt 16pt 18pt;vertical-align:middle">
<p style="margin:0;font-family:Arial,sans-serif;font-size:8pt;letter-spacing:1.6pt;color:${ZELENA};text-transform:uppercase"><b>NATÁČECÍ LIST</b></p>
<p style="margin:5pt 0 0;font-family:Arial,sans-serif;font-size:19pt;line-height:1.15;color:#ffffff"><b>${escapeHtml(podklady.projekt)}</b></p>
</td>
<td bgcolor="${FIALOVA}" align="right" width="210" style="background-color:${FIALOVA};padding:16pt 18pt 16pt 6pt;vertical-align:middle;text-align:right;width:158pt">${logo}</td>
</tr>
<tr><td bgcolor="${ZELENA}" colspan="2" style="background-color:${ZELENA};font-size:1pt;line-height:3pt;height:3pt">&nbsp;</td></tr>
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
/**
 * ROZEBRANÝ LIST - společný podklad pro náhled v portálu i pro dokument na
 * Disku (30. 9. 2026). Vzor se dosadí jednou a obě podoby listu pak sázejí
 * TATÁŽ data; dokud to každá skládala po svém, mohly se rozejít.
 */
export type SpotVListu = {
  /** První řádek bloku - název spotu. */
  nazev: string;
  /** Druhý řádek hlavičky bloku - stopáž a licence. Prázdný, když ve vzoru není. */
  popis: string;
  /** Zbytek bloku: text spotu, nebo místo na něj. */
  telo: string;
};

export type ListNataceni = {
  /** Úvod dokumentu ze vzoru. `null`, když vzor žádný nemá. */
  uvod: string | null;
  spoty: SpotVListu[];
};

export function rozeberList(
  vzor: { uvod?: string | null; blok: string },
  podklady: PodkladyTextu,
  vystupy: VystupProText[],
): ListNataceni {
  const spolecne = {
    projekt: podklady.projekt,
    upraveno: podklady.upraveno,
  };

  const spoty = vystupy.map((v, i) => {
    // Starší vzory mají místo na text napsané natvrdo; ať se chová jako {{text}}.
    const sablona = vzor.blok.split(MISTO_NA_TEXT).join('{{text}}');
    const text = dosad(sablona, {
      ...spolecne,
      spot: v.nazev,
      delka: v.delka,
      licence: v.licence,
      poradi: String(i + 1),
      text: ZNACKA_TEXTU,
    })
      .split(ZNACKA_TEXTU)
      .join(v.text?.trim() ? v.text.trim() : MISTO_NA_TEXT);

    /**
     * První odstavec bloku je hlavička spotu (název), druhý bývá řádek se
     * stopáží a licencí - ten se sází fialově a menším písmem, ať je na
     * první pohled poznat, kde jeden spot začíná. Zbytek je místo na text.
     */
    const radky = text.split(/\n{2,}/);
    const nazev = radky.shift() ?? '';
    const [prvniRadek, ...dalsiRadky] = nazev.split('\n');
    return {
      nazev: prvniRadek,
      popis: dalsiRadky.join(' ').trim(),
      telo: radky.join('\n\n'),
    };
  });

  return { uvod: vzor.uvod?.trim() ? dosad(vzor.uvod, spolecne) : null, spoty };
}

export function sestavHtmlNataceni(
  vzor: { uvod?: string | null; blok: string },
  podklady: PodkladyTextu,
  vystupy: VystupProText[],
  ramecekA4 = false,
): string {
  const list = rozeberList(vzor, podklady, vystupy);

  /**
   * `white-space:pre-wrap` kvůli textům spotů (30. 9. 2026): scénáře chodí
   * odsazené a HTML by mezery na začátku řádku samo slepilo.
   */
  const stylTextu = `margin:0 0 8pt;font-family:Arial,sans-serif;font-size:11pt;line-height:1.55;white-space:pre-wrap;color:${INKOUST}`;
  const casti: string[] = [hlavicka(podklady)];

  if (list.uvod) {
    casti.push(`<div style="margin-top:14pt">${odstavce(list.uvod, stylTextu)}</div>`);
  }

  list.spoty.forEach((spot) => {
    casti.push(
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:20pt">` +
        `<tr><td style="border-top:1pt solid ${LINKA};padding-top:9pt">` +
        `<p style="margin:0;font-family:Arial,sans-serif;font-size:13pt;color:${INKOUST}"><b>${escapeHtml(spot.nazev)}</b></p>` +
        (spot.popis
          ? `<p style="margin:3pt 0 0;font-family:Arial,sans-serif;font-size:9pt;letter-spacing:0.4pt;color:${FIALOVA}"><b>${escapeHtml(spot.popis)}</b></p>`
          : '') +
        `</td></tr></table>` +
        `<div style="margin:10pt 0 16pt">${odstavce(spot.telo, stylTextu)}</div>`,
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
