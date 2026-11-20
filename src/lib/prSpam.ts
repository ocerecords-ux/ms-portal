/**
 * ABY EMA NEPSALA JAKO SPAM (zadání 20. 11. 2026: „měla by vynechat
 * i klíčová slova, která vedou k tomu, že to skončí ve spamu").
 *
 * Filtry u pošty nečtou obsah, čtou signály. Nabídka redakci, která vypadá
 * jako leták - velká písmena, vykřičníky, „zdarma", „akce", „klikněte zde" -
 * skončí ve spamu, i když je poctivá. A co je horší: od toho dne tam padá
 * i všechno ostatní z naší adresy.
 *
 * Tenhle soubor je ČISTÝ - žádná databáze, žádné API. Používá ho obrazovka
 * (varování pod polem), kontrola před odesláním i pokyn pro Emu.
 */

/** Slova a obraty, co dělají ze zprávy leták. Hledá se bez diakritiky. */
const SLOVA: string[] = [
  'zdarma',
  'akce',
  'sleva',
  'slevy',
  'vyprodej',
  'akcni nabidka',
  'jedinecna prilezitost',
  'neopakovatelna',
  'omezena nabidka',
  'posledni sance',
  'jednate ihned',
  'klikněte zde',
  'klikni zde',
  'klikněte sem',
  'objednejte',
  'objednejte ihned',
  'vyhra',
  'vyhrajte',
  'zdarma a bez zavazku',
  'bez zavazku',
  'garantujeme',
  '100% zdarma',
  'nejlepsi na trhu',
  'spickova kvalita',
  'neuveritelny',
  'senzacni',
  'exkluzivni nabidka',
  'investicni prilezitost',
  'vydelejte',
  'penize',
  'free',
  'discount',
  'limited offer',
  'act now',
  'click here',
  'buy now',
  'risk free',
  'guarantee',
  'winner',
  'cash',
];

function bezDiakritiky(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export type NalezSpamu = {
  /** Co se našlo - slovo nebo název jevu („VELKÁ PÍSMENA"). */
  co: string;
  /** Krátké vysvětlení pro člověka. */
  proc: string;
};

/**
 * Projde předmět i text a vrátí, co by mohlo poslat mail do spamu.
 * Nic nemaže ani nepřepisuje - rozhodnout má člověk.
 */
export function zkontrolujSpam(predmet: string, text: string): NalezSpamu[] {
  const vse = `${predmet}\n${text}`;
  const hledaci = bezDiakritiky(vse);
  const nalezy: NalezSpamu[] = [];

  for (const slovo of SLOVA) {
    const klic = bezDiakritiky(slovo);
    if (!klic) continue;
    // Hranice slova, ať „akce" nenajde „akceptovat" a „free" neuvízne v „freelance".
    const vzor = new RegExp(`(^|[^a-z0-9])${klic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    if (vzor.test(hledaci)) {
      nalezy.push({ co: slovo, proc: 'slovo z letáků - filtry na něj slyší' });
    }
  }

  // VELKÁ PÍSMENA - jedno slovo křikem ještě nevadí, věta ano.
  const krik = vse.match(/\b[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{4,}\b/g) ?? [];
  if (krik.length >= 2) {
    nalezy.push({ co: krik.slice(0, 3).join(', '), proc: 'psané velkými písmeny' });
  }

  if ((vse.match(/!/g) ?? []).length >= 2) {
    nalezy.push({ co: '!!', proc: 'vykřičníky' });
  }

  if ((vse.match(/https?:\/\//g) ?? []).length >= 3) {
    nalezy.push({ co: 'odkazy', proc: 'víc než dva odkazy v jedné zprávě' });
  }

  if (/\b(\d{1,3}\s?%|zdarma)\b/i.test(bezDiakritiky(predmet))) {
    nalezy.push({ co: 'předmět', proc: 'procenta nebo „zdarma" v předmětu' });
  }

  // Jeden nález stačí jednou - dvakrát totéž člověku nepomůže.
  const videno = new Set<string>();
  return nalezy.filter((n) => (videno.has(n.co) ? false : (videno.add(n.co), true)));
}

/** Věta pro Emu, ať to rovnou nepíše. Přidává se k zadáním, kde píše mail. */
export const POKYN_PROTI_SPAMU = [
  'Piš tak, aby mail neskončil ve spamu: žádné vykřičníky, žádná slova',
  'velkými písmeny, žádné „zdarma", „akce", „sleva", „exkluzivní nabídka",',
  '„klikněte zde" ani procenta v předmětu. Nejvýš jeden odkaz. Předmět piš',
  'jako věcnou zprávu kolegovi z redakce, ne jako reklamu.',
].join(' ');
