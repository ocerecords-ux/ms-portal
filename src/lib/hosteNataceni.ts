/**
 * HOSTÉ NA NATÁČENÍ (zadání 30. 9. 2026: „u některých natáčení bývá klient.
 * Buď osobně, nebo se propojuje přes link do daného studia. A potřebuju tam
 * naházet i více lidí - maily, na které jim rovnou odejde pozvánka na
 * natáčení, která bude obsahovat link pro natáčení online a adresu studia
 * s mapkou a infem o parkování").
 *
 * HOST VISÍ NA TERMÍNU, NE NA PROJEKTU. Zakázka má klidně tři natáčecí dny
 * a na každý přijde někdo jiný; pozvánka tak nese přesný čas, studio i odkaz
 * a po přesunu termínu se pozná, že má odejít znovu.
 *
 * TENHLE SOUBOR JE BEZ PRISMY, aby se dal importovat i v prohlížeči - stejné
 * dělení jako u kalendáře (calendar.ts / calendarServer.ts), výstupů nebo
 * rodného listu. Databáze a odesílání jsou v hosteNataceniServer.ts.
 */

export type HostData = {
  id: string;
  jmeno: string | null;
  email: string;
  /** Připojí se na dálku; jinak přijde do studia. */
  online: boolean;
  /**
   * JAZYK POZVÁNKY (10. 10. 2026: „co když budeme mít anglicky mluvící
   * účastníky?“). V databázi může být prázdno (starší hosté) - sem už
   * se doplňuje čeština, ať to nemusí řešit každé místo zvlášť.
   */
  jazyk: 'cs' | 'en';
  /** Kdy mu naposledy odešla pozvánka (ISO), null = ještě nešla. */
  pozvankaAt: string | null;
  /** Na jaký začátek natáčení byla ta pozvánka. */
  pozvankaStart: string | null;
  chybaOdeslani: string | null;
};

export type NataceniData = {
  /** Id události ve studiovém kalendáři (StudioBlock). */
  id: string;
  start: string;
  end: string;
  nazev: string;
  /** Herec té frekvence - jde do přehledu v pozvánce. */
  actorName: string | null;
  studioId: string;
  studioNazev: string;
  studioBarva: string | null;
  adresa: string | null;
  mapaUrl: string | null;
  parkovani: string | null;
  /** Parkování anglicky (10. 10. 2026); prázdné = použije se česká věta. */
  parkovaniEn: string | null;
  /** Odkaz na hovor zapsaný u tohohle natáčení; null = bere se ze studia. */
  hovorOdkazVlastni: string | null;
  /** Co se opravdu pošle - vlastní odkaz, jinak odkaz studia. */
  hovorOdkaz: string | null;
  hoste: HostData[];
};

/**
 * REZERVA PRO KLIENTA (zadání 9. 10. 2026: „Necháváme si rezervu 15 min.
 * o kterou posouváme pozvánku s klientem. Abychom se stíhli nachystat
 * a udělat zvukovou zkoušku“).
 *
 * Produkce se s hercem dohodne na 11:30, klientovi se pošle 11:45. Jedno
 * číslo na jednom místě: mail, kalendářová příloha hosta i řádek u události
 * v kalendáři berou čas odsud, takže se nemůžou rozejít. V kalendáři studia
 * zůstává doba dohodnutá s hercem - rezerva je ta první čtvrthodina, ne čas
 * navíc.
 */
export const REZERVA_KLIENTA_MIN = 15;

/** Čas, který se říká klientovi - začátek natáčení plus rezerva na zvukovou zkoušku. */
export function casKlienta(start: string | Date): Date {
  return new Date(new Date(start).getTime() + REZERVA_KLIENTA_MIN * 60_000);
}

/**
 * ODKAZ STUDIA JAKO VÝCHOZÍ (rozhodnutí 30. 9. 2026). Každé studio má svůj
 * odkaz na videohovor uložený od 23. 9. 2026, takže se nemusí vypisovat
 * znovu - a kde klient posílá vlastní místnost, se u natáčení přepíše.
 */
export function platnyHovorOdkaz(
  vlastni: string | null | undefined,
  studia: string | null | undefined,
): string | null {
  const v = vlastni?.trim();
  if (v) return v;
  const s = studia?.trim();
  return s || null;
}

/**
 * Odkaz do map. Vlastní odkaz u studia má přednost (Mapy.cz, sdílené místo
 * s pinem); bez něj se poskládá hledání podle adresy, což funguje všude
 * a nepotřebuje to žádný klíč.
 */
export function odkazNaMapu(
  adresa: string | null | undefined,
  mapaUrl: string | null | undefined,
): string | null {
  const m = mapaUrl?.trim();
  if (m) return m;
  const a = adresa?.trim();
  if (!a) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
}

/**
 * Adresa na jeden řádek - do kalendářové přílohy (.ics) a do předmětu mailu.
 * Zalomení v adrese by v .ics rozbilo pole LOCATION.
 */
export function adresaNaRadek(studio: string, adresa: string | null | undefined): string {
  const a = adresa?.trim().replace(/\s*\n+\s*/g, ', ');
  return a ? `${studio}, ${a}` : studio;
}

/** Vypadá to jako e-mail? Přísnější kontrola nemá smysl - pravdu řekne až pošta. */
export function jeEmail(text: string): boolean {
  const t = text.trim();
  return /^[^\s@,;]+@[^\s@,;.]+\.[^\s@,;]{2,}$/.test(t);
}

/**
 * VÍC LIDÍ NARÁZ (zadání 30. 9. 2026: „potřebuju tam naházet i více lidí").
 * Rozebere, co se do políčka vloží ze schránky nebo z mailu: adresy oddělené
 * čárkou, středníkem, mezerou i novým řádkem, klidně ve tvaru
 * „Jan Novák <jan@firma.cz>". Co e-mail nepřipomíná, vrátí zvlášť, ať to
 * formulář může říct místo tichého zahození.
 */
export function rozeberAdresy(text: string): { hoste: { jmeno: string | null; email: string }[]; spatne: string[] } {
  const hoste: { jmeno: string | null; email: string }[] = [];
  const spatne: string[] = [];
  const videne = new Set<string>();

  for (const kus of text.split(/[\n,;]+/)) {
    const cely = kus.trim();
    if (!cely) continue;

    // „Jan Novák <jan@firma.cz>" i „jan@firma.cz"
    const vZavorce = cely.match(/^(.*?)[<(]\s*([^\s<>()]+)\s*[>)]$/);
    let jmeno = vZavorce ? vZavorce[1].trim().replace(/^["']|["']$/g, '') : null;
    let email = (vZavorce ? vZavorce[2] : cely).trim();

    // Bez závorek může být jméno oddělené mezerou: „Jan Novák jan@firma.cz"
    if (!vZavorce && /\s/.test(email)) {
      const casti = email.split(/\s+/);
      const posledni = casti[casti.length - 1];
      if (jeEmail(posledni)) {
        email = posledni;
        jmeno = casti.slice(0, -1).join(' ') || null;
      }
    }

    if (!jeEmail(email)) {
      spatne.push(cely);
      continue;
    }
    const klic = email.toLowerCase();
    if (videne.has(klic)) continue;
    videne.add(klic);
    hoste.push({ jmeno: jmeno || null, email });
  }

  return { hoste, spatne };
}

/**
 * Má pozvánka odejít znovu? Buď ještě nešla, nebo se od ní termín posunul -
 * a to je přesně ta chvíle, kdy by host jinak dorazil podle starého mailu.
 */
export function pozvankaJeNaPoslani(host: HostData, start: string): boolean {
  if (!host.pozvankaAt) return true;
  if (!host.pozvankaStart) return false;
  return new Date(host.pozvankaStart).getTime() !== new Date(start).getTime();
}

/** Kolik hostů čeká na pozvánku - do odznaku u termínu. */
export function pocetKPoslani(nataceni: NataceniData): number {
  return nataceni.hoste.filter((h) => pozvankaJeNaPoslani(h, nataceni.start)).length;
}
