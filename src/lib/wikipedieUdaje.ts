/**
 * ÚDAJE → WIKITEXT (zadání 22. 9. 2026: „potřeboval bych na tom portálu nějaké
 * zjednodušení, kde o sobě napíšu nějaká data a převede se to do toho textu").
 *
 * Vyplní se formulář (kdo jsem, odkud, co dělám, co jsem natočil, odkud to jde
 * ověřit) a portál z toho poskládá hotový wikitext - infobox, úvodní větu,
 * oddíly, reference i kategorie. Čistý modul bez databáze, používá ho formulář
 * v prohlížeči.
 */

export type ZdrojUdaju = {
  /** Krátký klíč, kterým se zdroj cituje (např. „youradio"). */
  klic: string;
  titul: string;
  /** Web nebo periodikum, kde to vyšlo. */
  kde: string;
  url: string;
  /** Datum vydání ve tvaru RRRR-MM-DD, nepovinné. */
  datum: string;
};

export type MilnikUdaju = { rok: string; text: string; zdroj: string };
export type DiloUdaju = { nazev: string; rok: string; vydavatel: string; poznamka: string; zdroj: string };

export type UdajeOsoby = {
  jmeno: string;
  /** Co dělá - první věta článku: „je český ...". */
  cimJe: string;
  datumNarozeni: string;
  mistoNarozeni: string;
  povolani: string;
  fotka: string;
  popisekFotky: string;
  web: string;
  kategorie: string;
  /** Volný úvodní odstavec navíc pod první větu. */
  shrnuti: string;
  milniky: MilnikUdaju[];
  dila: DiloUdaju[];
  zdroje: ZdrojUdaju[];
};

export const PRAZDNE_UDAJE: UdajeOsoby = {
  jmeno: '',
  cimJe: '',
  datumNarozeni: '',
  mistoNarozeni: '',
  povolani: '',
  fotka: '',
  popisekFotky: '',
  web: '',
  kategorie: '',
  shrnuti: '',
  milniky: [],
  dila: [],
  zdroje: [],
};

function cisti(t: string): string {
  return (t ?? '').trim();
}

/** „1985-02-18" → {{datum narození a věk|1985|2|18}}; jiný tvar se opíše. */
function sablonaNarozeni(datum: string): string {
  const d = cisti(datum);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  return `{{datum narození a věk|${m[1]}|${Number(m[2])}|${Number(m[3])}}}`;
}

function citace(z: ZdrojUdaju): string {
  const radky = [`| titul = ${cisti(z.titul)}`];
  if (cisti(z.kde)) radky.push(`| periodikum = ${cisti(z.kde)}`);
  if (cisti(z.url)) radky.push(`| url = ${cisti(z.url)}`);
  if (cisti(z.datum)) radky.push(`| datum vydání = ${cisti(z.datum)}`);
  radky.push(`| datum přístupu = ${new Date().toISOString().slice(0, 10)}`);
  return `{{Citace elektronického periodika\n${radky.join('\n')}\n}}`;
}

/** Odkaz na zdroj v textu - poprvé plná citace, podruhé jen jméno. */
function odkazNaZdroj(klic: string, pouzite: Set<string>, zdroje: ZdrojUdaju[]): string {
  const k = cisti(klic);
  if (!k) return '';
  const z = zdroje.find((x) => cisti(x.klic) === k);
  if (!z) return '';
  if (pouzite.has(k)) return `<ref name="${k}" />`;
  pouzite.add(k);
  return `<ref name="${k}">${citace(z)}</ref>`;
}

function vetaSTeckou(t: string): string {
  const v = cisti(t);
  if (!v) return '';
  return /[.!?]$/.test(v) ? v : `${v}.`;
}

/** Z údajů poskládá celý wikitext článku. */
export function sestavWikitext(u: UdajeOsoby): string {
  const jmeno = cisti(u.jmeno) || 'Jméno Příjmení';
  const pouzite = new Set<string>();
  const casti: string[] = [];

  // Infobox
  const infobox = [
    '{{Infobox - osoba',
    `| jméno = ${jmeno}`,
    `| obrázek = ${cisti(u.fotka)}`,
    `| popisek = ${cisti(u.popisekFotky)}`,
    `| datum narození = ${sablonaNarozeni(u.datumNarozeni)}`,
    `| místo narození = ${cisti(u.mistoNarozeni) ? `[[${cisti(u.mistoNarozeni)}]]` : ''}`,
    `| povolání = ${cisti(u.povolani)}`,
    '}}',
  ].join('\n');
  casti.push(infobox);

  // Úvodní věta
  const kdy = cisti(u.datumNarozeni) ? ` (* ${sablonaNarozeni(u.datumNarozeni)}${cisti(u.mistoNarozeni) ? `, [[${cisti(u.mistoNarozeni)}]]` : ''})` : '';
  const cim = vetaSTeckou(cisti(u.cimJe) || 'je český režisér');
  const prvniZdroj = u.zdroje[0] ? odkazNaZdroj(u.zdroje[0].klic, pouzite, u.zdroje) : '';
  casti.push(`'''${jmeno}'''${kdy} ${cim}${prvniZdroj}`);
  if (cisti(u.shrnuti)) casti.push(cisti(u.shrnuti));

  // Život - jeden odstavec z milníků, každý se svým zdrojem
  const milniky = u.milniky.filter((m) => cisti(m.text));
  if (milniky.length) {
    const vety = milniky.map((m) => {
      const rok = cisti(m.rok);
      const text = cisti(m.text);
      const veta = rok ? `${/^\d{4}$/.test(rok) ? `V roce ${rok}` : rok} ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
      return `${vetaSTeckou(veta)}${odkazNaZdroj(m.zdroj, pouzite, u.zdroje)}`;
    });
    casti.push(`== Život ==\n${vety.join(' ')}`);
  }

  // Tvorba
  const dila = u.dila.filter((d) => cisti(d.nazev));
  if (dila.length) {
    const radky = dila.map((d) => {
      const zavorka = [cisti(d.rok), cisti(d.vydavatel)].filter(Boolean).join(', ');
      const poznamka = cisti(d.poznamka) ? ` — ${cisti(d.poznamka)}` : '';
      return `* ''${cisti(d.nazev)}''${zavorka ? ` (${zavorka})` : ''}${poznamka}${odkazNaZdroj(d.zdroj, pouzite, u.zdroje)}`;
    });
    casti.push(`== Tvorba ==\n${radky.join('\n')}`);
  }

  // Reference - nepoužité zdroje se přidají na konec, ať se nic neztratí
  const zbyle = u.zdroje.filter((z) => cisti(z.klic) && cisti(z.titul) && !pouzite.has(cisti(z.klic)));
  const odkazy: string[] = ['== Odkazy ==', '=== Reference ==='];
  if (zbyle.length) {
    odkazy.push('<references>');
    for (const z of zbyle) odkazy.push(`<ref name="${cisti(z.klic)}">${citace(z)}</ref>`);
    odkazy.push('</references>');
  } else {
    odkazy.push('{{Reflist}}');
  }
  if (cisti(u.web)) {
    odkazy.push('', '=== Externí odkazy ===', `* [${cisti(u.web)} Oficiální web]`);
  }
  casti.push(odkazy.join('\n'));

  casti.push('{{Autoritní data}}');

  const kategorie = cisti(u.kategorie)
    .split(/[,;\n]/)
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => `[[Kategorie:${k}]]`);
  if (kategorie.length) casti.push(kategorie.join('\n'));

  return `${casti.join('\n\n')}\n`;
}
