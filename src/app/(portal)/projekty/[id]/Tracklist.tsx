'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { Napoveda } from '@/components/Napoveda';
import { useNeulozeno } from '@/app/(portal)/components/NeulozeneZmeny';
import {
  bezDiakritiky,
  cisloTracku,
  precislujTracky,
  upravNazevTracku,
  zakladKapitoly,
  type Track,
} from '@/lib/tracklist';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';
import { navrhniTracky, VYCHOZI_LIMIT_NORMOSTRAN } from '@/lib/tracklistZTextu';

/**
 * TRACKLIST AUDIOKNIHY (zadání 15. 10. 2026: „vytvoř v detailu každého
 * projektu, který je audiokniha, ještě záložku tracklist. Tam bude seznam
 * tracků editovatelný" → „pořadové číslo, název tracku, název kapitoly"
 * → „01, 02, 03").
 *
 * TRACKLIST SE NIKDE NENAČÍTÁ (upřesnění 15. 10. 2026: „nechci nikde načítat
 * tracklist. Tohle by se mělo dít v první fázi, když tam nebude žádný track.
 * Tohle je právě manuál na to, jak to popisovat"). Je to PŘEDPIS, ne soupis
 * toho, co už na Disku leží: podle něj se stopy teprve pojmenují. Proto se
 * zakládá na začátku a z vlastního vzoru, ne z hotových souborů.
 *
 * ZALOŽENÍ NARÁZ (upřesnění: „chci mít i možnost přidat naráz i třeba 50
 * tracků jedním klikem. Nastaví se pořadová čísla a názvy tracků podle vzoru.
 * Na to může být někde pole"). Padesát řádků po jednom nikdo klikat nebude.
 *
 * NÁZEV KAPITOLY ZŮSTÁVÁ PRÁZDNÝ („jen je doplním") - ten se z ničeho
 * odvodit nedá a vypisuje se ručně z knihy.
 *
 * GENEROVÁNÍ Z TEXTU - JEN U FIREM, KTERÉ TO MAJÍ ZAPNUTÉ (zadání
 * 30. 10. 2026: „tohle je model, který se dělá u firmy Audiotéka. Pojďme to
 * implementovat, že dáme tlačítko generovat tracklist. Ale takto jen
 * u Audiotéky"). Tlačítko projde režijní text projektu a vypíše stopy podle
 * kapitol - viz lib/tracklistZTextu.ts, kde je celý model popsaný.
 *
 * TEXT SE ČTE V PROHLÍŽEČI, ne na serveru: pdf.js tu portál stejně má (čte
 * z něj AudioTagger i počítadlo normostran) a server žádnou PDF knihovnu
 * nemá. Vygenerované řádky jen SPADNOU DO TABULKY - do databáze se nedostanou
 * dřív, než na to někdo klikne, takže je čas je projít.
 *
 * BRUNO POD TABULKOU (zadání 30. 10. 2026: „u těch tracklistů by mohl být
 * Bruno, kterého bychom si vycvičili na to, když tam budeme chtít hromadnou
 * změnu nebo to udělat podle nějakého vzoru. Normálně chatovací okno").
 * Hromadná úprava se napíše větou a Bruno vrátí celý přepsaný seznam - taky
 * jen do tabulky. Co umí a co ne, je v lib/brunoTracklist.ts.
 */
type Radek = { nazevTracku: string; nazevKapitoly: string };

export function Tracklist({
  caflouProjectId,
  nazevProjektu,
  pocatecni,
  zTextu = false,
  apiAdresa,
  sBrunem = true,
  brunoAdresa,
  sDelenim = true,
}: {
  caflouProjectId: string;
  nazevProjektu: string;
  pocatecni: Track[];
  /** Firma má zapnuté generování z textu (Company.tracklistZTextu). */
  zTextu?: boolean;
  /**
   * KAM SE UKLÁDÁ (19. 11. 2026). Výchozí je naše cesta přes ID projektu;
   * klient, který přišel odkazem z mailu, nemá účet a jde přes token své
   * výzvy. Tatáž tabulka, tentýž editor - jen jiné dveře.
   */
  apiAdresa?: string;
  /** Okno s Brunem pod tabulkou. */
  sBrunem?: boolean;
  /**
   * KAM SE PTÁ BRUNO. Klient bez účtu jde přes token své výzvy, stejně jako
   * u ukládání - tatáž obrazovka, jiné dveře (19. 11. 2026).
   */
  brunoAdresa?: string;
  /**
   * ROZDĚLOVÁNÍ STOP JE NAŠE VĚC (zadání 19. 11. 2026: „klient by tam neměl
   * mít možnost rozdělit track. To děláme my, až podle toho, jak ty tracky
   * vyjdou časově"). Klientovi se tlačítko u řádku vůbec nevykreslí.
   */
  sDelenim?: boolean;
}) {
  const t = usePreklad();
  const router = useRouter();
  const adresa = apiAdresa ?? `/api/projekty/${encodeURIComponent(caflouProjectId)}/tracklist`;
  const naRadky = (seznam: Track[]): Radek[] =>
    seznam.map((x) => ({ nazevTracku: x.nazevTracku, nazevKapitoly: x.nazevKapitoly }));

  const [tracky, setTracky] = useState<Radek[]>(naRadky(pocatecni));
  const [ulozene, setUlozene] = useState<string>(JSON.stringify(naRadky(pocatecni)));
  const [pocet, setPocet] = useState('20');
  const [vzor, setVzor] = useState(nazevProjektu);
  const [vkladani, setVkladani] = useState(false);
  const [vlozeny, setVlozeny] = useState('');
  const [bezi, setBezi] = useState(false);
  const [ctuText, setCtuText] = useState(false);
  /** Čtení nahraného TXT/PDF se seznamem kapitol (19. 11. 2026). */
  const [ctuSoubor, setCtuSoubor] = useState(false);
  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  /**
   * NEJDELŠÍ STOPA (16. 11. 2026: „samozřejmě bude třeba i rozdělovat na
   * části"). Kapitola delší než tolik normostran se rozpadne na víc stop.
   * Prázdno nebo nula = nedělit.
   */
  const [maxNormostran, setMaxNormostran] = useState(String(VYCHOZI_LIMIT_NORMOSTRAN));
  /** Okno s Brunem pod tabulkou - drží se jen do odchodu ze stránky. */
  const [zpravyBruna, setZpravyBruna] = useState<{ odBruna: boolean; text: string }[]>([]);
  const [dotazBrunovi, setDotazBrunovi] = useState('');
  const [brunoPremysli, setBrunoPremysli] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  /**
   * ZÁLOHA PŘED HROMADNÝM PŘEPSÁNÍM (19. 11. 2026). Dokud se ukládalo
   * tlačítkem, byl „projdi si návrh" krok navíc, který hotovou práci chránil.
   * Teď se ukládá samo, takže ochranou je návrat zpátky - jedno kliknutí
   * vrátí tabulku do stavu před generováním, Brunem nebo vložením seznamu.
   */
  const [zaloha, setZaloha] = useState<Radek[] | null>(null);

  const zmeneno = JSON.stringify(tracky) !== ulozene;

  /** Hromadné přepsání tabulky - schová, co tam bylo, ať je kam se vrátit. */
  function prepis(nove: Radek[]) {
    setZaloha(tracky);
    setTracky(nove);
  }

  /**
   * POJISTKA PŘI ODCHODU ZE STRÁNKY (zadání 15. 10. 2026: „měli jsme vyplněný
   * tracklist a překlikli se a všechno zmizelo"). Portál se zeptá a na jedno
   * kliknutí tracklist uloží - viz components/NeulozeneZmeny.tsx.
   */
  useNeulozeno(zmeneno, uloz);

  /**
   * UKLÁDÁ SE SAMO (zadání 19. 11. 2026: „pryč uložit. Když to napíšu, ať se
   * to rovnou ukládá" - a totéž z připomínek Petera 18. 11. 2026).
   *
   * Vteřina ticha po poslední změně a zápis odejde. Psaní se tím nepřerušuje
   * a tlačítko „Uložit tracklist" zmizelo úplně.
   *
   * PO CHYBĚ SE SAMO NEZKOUŠÍ ZNOVU. Když zápis selže, zůstane u tabulky
   * hláška s tlačítkem „Zkusit znovu" - jinak by portál mlčky zkoušel pořád
   * dokola a člověk by se o nic nedozvěděl, dokud by nezavřel stránku.
   */
  const ulozRef = useRef(uloz);
  ulozRef.current = uloz;
  /**
   * Co už jednou odešlo. Server může řádky vrátit srovnané jinak (přečíslování,
   * oříznuté mezery) a pak se tabulka pořád tváří jako změněná - bez téhle
   * pojistky by se tatáž data ukládala pořád dokola.
   */
  const poslanoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!zmeneno || bezi || chyba) return;
    const otisk = JSON.stringify(tracky);
    if (poslanoRef.current === otisk) return;
    const casovac = setTimeout(() => {
      poslanoRef.current = otisk;
      void ulozRef.current(true);
    }, 1000);
    return () => clearTimeout(casovac);
  }, [zmeneno, bezi, chyba, tracky]);

  const pole =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';
  const popisek = 'text-[11px] font-heading font-semibold uppercase tracking-wide text-muted';

  /**
   * POŘADOVÉ ČÍSLO V NÁZVU TRACKU DRŽÍ KROK S POŘADÍM (upřesnění 15. 10. 2026:
   * „ten název tracku musí jít zkopírovat i s tím pořadovým číslem tracku.
   * Zvukaři to takto kopírují do názvu tracku").
   *
   * Název stopy se kopíruje do DAW i do názvu souboru, takže v něm číslo být
   * musí - a nesmí lhát. Po rozdělení, přidání nebo odebrání stopy se proto
   * číslo na konci názvu přepíše podle nového pořadí. Název, který na číslo
   * nekončí, zůstane, jak je: do něj portál nemá co mluvit.
   */
  function precisluj(seznam: Radek[]): Radek[] {
    return precislujTracky(seznam);
  }

  /** Název stopy do schránky - zvukař si ho lepí do DAW. */
  async function zkopiruj(nazev: string) {
    try {
      await navigator.clipboard.writeText(nazev);
      setHlaska(t('tracklist.zkopirovano', { nazev }));
    } catch {
      setChyba(t('tracklist.kopirovaniNeslo'));
    }
  }

  function nastav(i: number, co: keyof Radek, hodnota: string) {
    const nove = [...tracky];
    // Z názvu tracku se stává název souboru: diakritika pryč a mezery na
    // pomlčky, rovnou při psaní (15. 10. 2026). Název kapitoly zůstává.
    //
    // U firmy, která má vlastní model (Audiotéka, 30. 10. 2026), MEZERY
    // ZŮSTÁVAJÍ: pomlčka místo mezery je naše pravidlo, ne její.
    nove[i] = {
      ...nove[i],
      [co]: co === 'nazevTracku' ? upravNazevTracku(hodnota, zTextu) : hodnota,
    };
    setTracky(nove);
  }

  /**
   * Název tracku ze vzoru. TVAR JE „01 NÁZEV" (zadání 19. 11. 2026: „odstraň
   * prosím ‚_' a ‚-' a nahraď je mezerami" → „změň ten vzor takhle") - číslo
   * napřed, mezera, pak název. Do 19. 11. 2026 tu bylo podtržítko a pomlčky
   * mezi slovy. Tak se jmenují i soubory, takže se název dá z portálu rovnou
   * zkopírovat do DAW.
   */
  function podleVzoru(poradi: number): string {
    const cislo = cisloTracku(poradi);
    const text = vzor.trim();
    return text ? `${cislo} ${upravNazevTracku(text, zTextu)}` : cislo;
  }

  /**
   * VYPÍŠE STOPY Z TEXTU KNIHY (model Audiotéky, 30. 10. 2026).
   *
   * PDF si vyžádá přes portál (`api/projekty/[id]/text` - tatáž cesta, ze
   * které text čte herec i AudioTagger), přečte ho pdf.js v prohlížeči
   * a rozbor nadpisů udělá lib/tracklistZTextu.ts. Výsledek se jen vloží do
   * tabulky; ULOŽENÍ ZŮSTÁVÁ NA ČLOVĚKU.
   */
  async function generujZTextu() {
    setCtuText(true);
    setChyba(null);
    setHlaska(null);
    // PDF se predava JAKO ADRESA (blob:), ne jako pole bajtu - stejne jako
    // v pocitadle normostran, kde varianta s `data` v nekterych prohlizecich
    // zlobila (viz lib/normostrany.ts).
    let adresa: string | null = null;
    try {
      const odpoved = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/text`);
      const typ = odpoved.headers.get('content-type') ?? '';
      if (!odpoved.ok || !typ.includes('pdf')) {
        setChyba(t('preposlech.bezTextu'));
        return;
      }
      adresa = URL.createObjectURL(await odpoved.blob());
      const pdfjs = await nactiPdfJs();
      await nastavPdfWorker(pdfjs);
      const doc = await pdfjs.getDocument({ url: adresa }).promise;

      const stranky: string[] = [];
      for (let strana = 1; strana <= doc.numPages; strana += 1) {
        const obsah = await (await doc.getPage(strana)).getTextContent();
        const polozky: { str?: string }[] = obsah?.items ?? [];
        // Mezera mezi kusy: nadpis bývá rozlámaný na „KAPITOLA" a „DRUHÁ"
        // a bez ní by z toho bylo jedno slovo.
        stranky.push(polozky.map((polozka) => polozka.str ?? '').join(' '));
      }

      const navrh = navrhniTracky(stranky, { maxNormostran: Number(maxNormostran) || 0 });
      if (navrh.length === 0) {
        setChyba(t('tracklist.nicNenalezeno'));
        return;
      }
      prepis(navrh);
      setHlaska(t('tracklist.vygenerovano', { pocet: navrh.length }));
    } catch (err) {
      console.error('Generovani tracklistu z textu selhalo:', err);
      setChyba(t('tracklist.cteniNeslo'));
    } finally {
      if (adresa) URL.revokeObjectURL(adresa);
      setCtuText(false);
    }
  }

  /**
   * ZEPTÁ SE BRUNA NA HROMADNOU ÚPRAVU (30. 10. 2026).
   *
   * Posílá se TABULKA, jak je teď - i s neuloženými změnami: Bruno má
   * pracovat s tím, co má člověk před sebou, ne s tím, co leží v databázi.
   * Zpátky chodí celý nový seznam; ten se jen vloží do tabulky.
   */
  async function zeptejSeBruna() {
    const text = dotazBrunovi.trim();
    if (!text || brunoPremysli) return;
    const historie = zpravyBruna;
    setZpravyBruna([...historie, { odBruna: false, text }]);
    setDotazBrunovi('');
    setBrunoPremysli(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(brunoAdresa ?? `${adresa}/bruno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zprava: text, tracky, historie }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZpravyBruna((z) => [...z, { odBruna: true, text: data?.error || t('tracklist.brunoNeslo') }]);
        return;
      }
      setZpravyBruna((z) => [...z, { odBruna: true, text: String(data?.text || '') }]);
      if (Array.isArray(data?.tracky)) {
        const nove = (data.tracky as Radek[]).map((x) => ({
          nazevTracku: x.nazevTracku ?? '',
          nazevKapitoly: x.nazevKapitoly ?? '',
        }));
        prepis(nove);
        setHlaska(t('tracklist.brunoPrepsal', { pocet: nove.length }));
      }
    } catch (err) {
      console.error('Bruno u tracklistu neodpovedel:', err);
      setZpravyBruna((z) => [...z, { odBruna: true, text: t('tracklist.brunoNeslo') }]);
    } finally {
      setBrunoPremysli(false);
    }
  }

  /**
   * Založí stopy naráz. Když už nějaké jsou, PŘIDÁ SE ZA NĚ a čísluje se dál -
   * přepsat hotovou práci jedním kliknutím by byla past.
   */
  function zalozNaraz() {
    const kolik = Math.min(300, Math.max(1, parseInt(pocet.replace(/\D/g, ''), 10) || 0));
    if (kolik <= 0) return;
    const od = tracky.length;
    const nove: Radek[] = Array.from({ length: kolik }, (_, i) => ({
      nazevTracku: podleVzoru(od + i + 1),
      // Kapitola zůstává prázdná - doplňuje se ručně z knihy.
      nazevKapitoly: '',
    }));
    setTracky(precisluj([...tracky, ...nove]));
    setHlaska(t('tracklist.zalozeno', { pocet: kolik }));
  }

  /**
   * ROZDĚLENÍ TRACKU (upřesnění 15. 10. 2026: „když to tlačítko zmáčknu, tak
   * se jen změní pořadové číslo, název tracku zůstane a zkopíruje se název
   * kapitoly, protože tu kapitolu dělíme, a přidá se ‚Část 1'").
   *
   * Vznikne druhá stopa se stejným názvem tracku a toutéž kapitolou; obě
   * dostanou „Část 1" a „Část 2". Když je kapitola rozdělená už teď, přibyde
   * další část a CELÁ SKUPINA SE PŘEČÍSLUJE - jinak by po rozdělení prostřední
   * části vznikly dvě „Část 2".
   */
  function rozdel(i: number) {
    const puvodni = tracky[i];
    const base = zakladKapitoly(puvodni.nazevKapitoly);
    const cast = (poradi: number) =>
      base ? base + ', ' + t('tracklist.cast', { cislo: poradi }) : t('tracklist.cast', { cislo: poradi });

    /**
     * ČÁST PATŘÍ I DO NÁZVU STOPY (připomínky Richarda Hanuly 12. 11. 2026
     * a Tomáše Ilavského 17. 11. 2026: „keď sa rozdelí stopa, automaticky tam
     * pribudne ‚časť X'… keď sa kopíruje pomocou tlačítka copy, skopíruje sa
     * iba názov, bez ‚časť x' a zvukár to tam musí aj tak manuálne dopisovať
     * do markru v Cubase").
     *
     * Tlačítko Kopírovat bere NÁZEV STOPY - ten se lepí do markeru v Cubase
     * i do jména souboru. Dokud v něm část nebyla, zvukař ji tam dopisoval
     * ručně. Píše se bez diakritiky, stejně jako zbytek názvu stopy, a ve
     * stejném tvaru, jaký vypisuje generátor tracklistu („, Cast 1").
     */
    const castTracku = (nazev: string, poradi: number) =>
      `${zakladKapitoly(nazev)}, ${bezDiakritiky(t('tracklist.cast', { cislo: poradi }))}`;

    const nove = [...tracky];
    // Nova stopa je kopie te puvodni - vsechno ostatni zustava, meni se jen
    // nazev kapitoly a poradova cisla stop za ni (ta se dopocitavaji sama).
    nove.splice(i + 1, 0, { ...puvodni });

    /**
     * SKUPINU HLEDAME JEN U POJMENOVANE KAPITOLY (oprava 15. 10. 2026).
     * Dokud jsou kapitoly prazdne - a hned po zalozeni seznamu jsou - maji
     * prazdny zaklad VSECHNY stopy, takze by precislovani udelalo z cele
     * knihy "Cast 1" az "Cast 50". U prazdne kapitoly se proto deli jen ta
     * jedna dvojice.
     */
    let od = i;
    let doKonce = i + 1;
    if (base) {
      while (od > 0 && zakladKapitoly(nove[od - 1].nazevKapitoly) === base) od -= 1;
      while (doKonce + 1 < nove.length && zakladKapitoly(nove[doKonce + 1].nazevKapitoly) === base) doKonce += 1;
    }

    for (let k = od; k <= doKonce; k += 1) {
      const poradiCasti = k - od + 1;
      nove[k] = {
        ...nove[k],
        nazevKapitoly: cast(poradiCasti),
        nazevTracku: castTracku(nove[k].nazevTracku, poradiCasti),
      };
    }
    setTracky(precisluj(nove));
  }

  /** Nalepený seznam jde do NÁZVŮ KAPITOL - z obsahu knihy se kopírují ty. */
  function vlozSeznam() {
    if (!vlozText(vlozeny)) return;
    setVlozeny('');
    setVkladani(false);
  }

  /**
   * Jeden rozbor pro obě cesty: nalepený text i nahraný soubor. Vrací, jestli
   * se z textu dalo něco vyčíst - podle toho se pozná, že se má zavřít
   * políčko, nebo naopak napsat, že v souboru nic nebylo.
   */
  function vlozText(text: string): boolean {
    const radky = text
      .split('\n')
      .map((r) => r.replace(/^\s*\d{1,3}\s*[._)\-]\s*/, '').trim())
      .filter(Boolean);
    if (radky.length === 0) return false;
    const nove: Radek[] = radky.map((kapitola, i) => ({
      nazevTracku: tracky[i]?.nazevTracku ?? podleVzoru(i + 1),
      nazevKapitoly: kapitola,
    }));
    prepis(precisluj([...nove, ...tracky.slice(radky.length)]));
    return true;
  }

  /**
   * TRACKLIST Z NAHRANÉHO SOUBORU (zadání 19. 11. 2026: „nebo případně nahrát
   * textový soubor nebo pdf").
   *
   * Soubor se nikam neukládá - přečte se v prohlížeči a do tabulky spadnou
   * jen řádky, stejně jako u nalepeného seznamu. PDF čte pdf.js, který tu
   * portál stejně má; konec řádku se bere z `hasEOL`, jinak by z celé stránky
   * byla jedna věta. Co se vloží, jde vzít zpátky tlačítkem Vrátit zpět.
   */
  async function nactiZeSouboru(soubor: File | null | undefined) {
    if (!soubor) return;
    setCtuSoubor(true);
    setChyba(null);
    setHlaska(null);
    let adresaPdf: string | null = null;
    try {
      let text = '';
      if (/\.pdf$/i.test(soubor.name) || soubor.type === 'application/pdf') {
        adresaPdf = URL.createObjectURL(soubor);
        const pdfjs = await nactiPdfJs();
        await nastavPdfWorker(pdfjs);
        const doc = await pdfjs.getDocument({ url: adresaPdf }).promise;
        const kusy: string[] = [];
        for (let strana = 1; strana <= doc.numPages; strana += 1) {
          const obsah = await (await doc.getPage(strana)).getTextContent();
          const polozky: { str?: string; hasEOL?: boolean }[] = obsah?.items ?? [];
          for (const polozka of polozky) {
            kusy.push(polozka.str ?? '');
            if (polozka.hasEOL) kusy.push('\n');
          }
          kusy.push('\n');
        }
        text = kusy.join('');
      } else {
        text = await soubor.text();
      }
      if (!vlozText(text)) {
        setChyba(t('tracklist.vSouboruNic'));
        return;
      }
      setHlaska(t('tracklist.zeSouboru', { soubor: soubor.name }));
    } catch (err) {
      console.error('Cteni tracklistu ze souboru selhalo:', err);
      setChyba(t('tracklist.cteniNeslo'));
    } finally {
      if (adresaPdf) URL.revokeObjectURL(adresaPdf);
      if (vstupSouboru.current) vstupSouboru.current.value = '';
      setCtuSoubor(false);
    }
  }

  /** Vrací, jestli se uložení povedlo - podle toho se pozná, že se smí odejít. */
  async function uloz(tise = false): Promise<boolean> {
    setBezi(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(adresa, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracky }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Stav odpovědi do hlášky - bez něj se nepozná, jestli jde o práva,
        // o data nebo o chybu serveru (stejně jako u názvu projektu).
        setChyba(`${data?.error || t('tracklist.ulozeniNeslo')} (${res.status})`);
        return false;
      }
      const nove = naRadky((data.tracky ?? []) as Track[]);
      setTracky(nove);
      setUlozene(JSON.stringify(nove));
      setHlaska(t('tracklist.ulozeno'));
      /**
       * BEZ TOHOHLE ŘÁDKU SE ULOŽENÝ TRACKLIST „ZTRATÍ" (oprava 15. 10. 2026:
       * „ten tracklist se celkově nějak neukládá i když dám uložit").
       *
       * Stránka projektu se vykresluje na serveru, ale prohlížeč si její
       * podobu drží v paměti pro návrat zpátky. Uložit se uložilo, jen se
       * při návratu ukázala ta stará, prázdná verze. `refresh` tu paměť
       * zahodí a stránka se natáhne znovu - stejně to dělají ostatní
       * formuláře v detailu projektu.
       */
      /**
       * OBNOVA MUSÍ BÝT I PŘI TICHÉM UKLÁDÁNÍ (oprava 19. 11. 2026: „akorát
       * se teď neukládá, když tam něco přepíšu").
       *
       * Chvíli jsem ji u automatického ukládání vynechal, ať se po každé
       * napsané větě nepřekresluje celá karta projektu - jenže tím se vrátila
       * přesně ta chyba z 15. 10. 2026, kvůli které tu `refresh` je: zápis
       * projde, ale prohlížeč si drží starou podobu stránky a po návratu
       * ukáže tracklist, jaký byl předtím. Vypadá to, že se neuložilo.
       * Ukládá se po vteřině ticha, takže obnova nepřijde po každé klávese.
       */
      router.refresh();
      return true;
    } catch {
      setChyba(t('tracklist.ulozeniNeslo'));
      return false;
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1100px]">
      {/* NÁPOVĚDA POD OTAZNÍKEM (19. 11. 2026: „ať je portál čistý") - vysvětlující
          věty se schovaly, text zůstal na jedno klepnutí. */}
      <div className="flex justify-end -mb-2">
        <Napoveda text={t('tracklist.uvod')} vlevo />
      </div>

      {/* GENEROVÁNÍ Z TEXTU - jen u firem, které to mají na kartě zapnuté
          (30. 10. 2026: „ale takto jen u Audiotéky"). */}
      {zTextu && (
        <div className="rounded-card border border-line bg-field p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generujZTextu}
            disabled={ctuText}
            className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {ctuText ? t('tracklist.generuji') : t('tracklist.generovat')}
          </button>
          <Napoveda text={t('tracklist.generovatPopis')} />
          <label className="flex flex-col gap-1.5 w-[150px]">
            <span className="text-xs font-heading font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
              {t('tracklist.nejdelsiStopa')}
              <Napoveda text={t('tracklist.nejdelsiStopaPopis')} />
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={maxNormostran}
              onChange={(e) => setMaxNormostran(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink"
            />
          </label>
        </div>
      )}

      {/* ZALOŽENÍ NARÁZ - padesát stop jedním kliknutím. */}
      <div className="rounded-card border border-line bg-field p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 w-[110px]">
          <span className={popisek}>{t('tracklist.pocetStop')}</span>
          <input
            inputMode="numeric"
            value={pocet}
            onChange={(e) => setPocet(e.target.value.replace(/\D/g, ''))}
            className={pole}
          />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <span className={`${popisek} flex items-center gap-1.5`}>
            {t('tracklist.vzorNazvu')}
            <Napoveda text={t('tracklist.vzorPopis', { priklad: podleVzoru(tracky.length + 1) })} />
          </span>
          <input value={vzor} onChange={(e) => setVzor(e.target.value)} className={pole} />
        </label>
        <button
          type="button"
          onClick={zalozNaraz}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer hover:bg-brand-purpleDeep transition-colors"
        >
          {t('tracklist.zalozit')}
        </button>

      </div>

      {tracky.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{t('tracklist.zadne')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* Záhlaví kopíruje rozměry řádku níž - jedna a tatáž struktura. */}
          <div className="hidden sm:flex items-center gap-2 px-0.5">
            <span className={`${popisek} w-8 text-right`}>{t('tracklist.cislo')}</span>
            <span className={`${popisek} flex-1 min-w-[180px]`}>{t('tracklist.nazevTracku')}</span>
            <span className={`${popisek} flex-1 min-w-[180px]`}>{t('tracklist.nazevKapitoly')}</span>
            <span className="w-[180px]" />
          </div>

          <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
            {tracky.map((radek, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-8 shrink-0 text-right text-xs font-heading font-semibold text-muted tabular-nums">
                  {cisloTracku(i + 1)}
                </span>
                <input
                  value={radek.nazevTracku}
                  onChange={(e) => nastav(i, 'nazevTracku', e.target.value)}
                  className={`${pole} flex-1 min-w-[180px]`}
                  placeholder={t('tracklist.nazevTracku')}
                />
                <input
                  value={radek.nazevKapitoly}
                  onChange={(e) => nastav(i, 'nazevKapitoly', e.target.value)}
                  className={`${pole} flex-1 min-w-[180px]`}
                  placeholder={t('tracklist.nazevKapitoly')}
                />
                <span className="w-[180px] shrink-0 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void zkopiruj(radek.nazevTracku)}
                    title={t('tracklist.zkopirovat')}
                    aria-label={t('tracklist.zkopirovat')}
                    className="text-muted hover:text-brand-purple px-1.5 bg-transparent border-0 cursor-pointer"
                  >
                    ⧉
                  </button>
                  {sDelenim && (
                    <button
                      type="button"
                      onClick={() => rozdel(i)}
                      title={t('tracklist.rozdelitPopis')}
                      className="font-heading font-semibold text-xs rounded-lg px-2.5 py-1.5 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent whitespace-nowrap"
                    >
                      {t('tracklist.rozdelit')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTracky(precisluj(tracky.filter((_, j) => j !== i)))}
                    title={t('tracklist.odebrat')}
                    aria-label={t('tracklist.odebrat')}
                    className="text-muted hover:text-danger px-1.5 bg-transparent border-0 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setTracky([...tracky, { nazevTracku: podleVzoru(tracky.length + 1), nazevKapitoly: '' }])}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.pridat')}
        </button>
        <button
          type="button"
          onClick={() => setVkladani((v) => !v)}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
        >
          {t('tracklist.vlozitSeznam')}
        </button>
        {/* NAHRÁT SOUBOR (19. 11. 2026) - TXT nebo PDF se seznamem kapitol.
            Soubor se nikam neukládá, jen se z něj přečtou řádky. */}
        <button
          type="button"
          onClick={() => vstupSouboru.current?.click()}
          disabled={ctuSoubor}
          className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent disabled:opacity-50"
        >
          {ctuSoubor ? t('tracklist.ctuSoubor') : t('tracklist.nahratSoubor')}
        </button>
        <input
          ref={vstupSouboru}
          type="file"
          accept=".txt,.csv,.md,.pdf,text/plain,application/pdf"
          onChange={(e) => void nactiZeSouboru(e.target.files?.[0])}
          className="hidden"
        />
        {/* VRÁTIT ZPĚT místo potvrzovacího tlačítka (19. 11. 2026) - hromadné
            přepsání tabulky se ukládá samo, takže musí jít vzít zpátky. */}
        {zaloha && (
          <button
            type="button"
            onClick={() => {
              setTracky(zaloha);
              setZaloha(null);
              setHlaska(t('tracklist.vraceno'));
            }}
            className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent"
          >
            {t('tracklist.vratitZpet')}
          </button>
        )}
        {/* Stav ukládání místo tlačítka: ukládám / uloženo / chyba a zkusit znovu. */}
        {chyba ? (
          <>
            <span className="text-xs font-body text-danger">{chyba}</span>
            <button
              type="button"
              onClick={() => {
                setChyba(null);
                void uloz(true);
              }}
              className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-danger text-danger hover:bg-dangerTint transition-colors cursor-pointer bg-transparent"
            >
              {t('tracklist.zkusitZnovu')}
            </button>
          </>
        ) : bezi ? (
          <span className="text-xs font-body text-muted">{t('obecne.ukladam')}</span>
        ) : zmeneno ? (
          <span className="text-xs font-body text-muted">{t('tracklist.neulozeno')}</span>
        ) : (
          hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>
        )}
      </div>

      {/* BRUNO POD TABULKOU (30. 10. 2026) - hromadná úprava větou. Klientovi
          se neukazuje: je to náš pomocník u naší práce (19. 11. 2026). */}
      {sBrunem && (
      <div className="rounded-card border border-line bg-field p-4 flex flex-col gap-3">
        {/* HLAVIČKA S BRUNOVOU ZNAČKOU (19. 11. 2026: „ať je jasné, že jde
            o nástroj. Dejme tam minimálně ikonu jeho, co má v chatu").
            Tatáž fotka, jakou má jeho účet v chatu. */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bruno-znacka.png"
            alt=""
            aria-hidden
            className="w-9 h-9 rounded-full shrink-0 object-cover border border-line bg-surface"
          />
          <span className="min-w-0 flex flex-col">
            <span className="flex items-center gap-1.5">
              <span className="font-heading font-semibold text-sm text-ink">
                {t('tracklist.bruno')}
              </span>
              <Napoveda text={t('tracklist.brunoPopis')} />
            </span>
            <span className="text-[11px] font-body text-muted">{t('tracklist.brunoRole')}</span>
          </span>
        </div>

        {zpravyBruna.length > 0 && (
          <ul className="list-none m-0 p-0 flex flex-col gap-2 max-h-[280px] overflow-y-auto">
            {zpravyBruna.map((z, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                  {z.odBruna ? 'Bruno' : t('tracklist.ja')}
                </span>
                <span
                  className={`text-sm font-body whitespace-pre-wrap rounded-lg px-3 py-2 ${
                    z.odBruna ? 'bg-surface text-ink border border-line' : 'bg-tint text-ink'
                  }`}
                >
                  {z.text}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 items-end flex-wrap">
          <textarea
            value={dotazBrunovi}
            onChange={(e) => setDotazBrunovi(e.target.value)}
            onKeyDown={(e) => {
              // Enter odesílá, Shift+Enter dělá nový řádek - jako v chatu.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void zeptejSeBruna();
              }
            }}
            /* Vyšší pole (19. 11. 2026: „to pole dej takhle třeba defaultně,
               ať je to širší") - dvouřádkové bylo na větu o hromadné úpravě
               malé a každý si ho stejně roztahoval. Táhnout se dá dál. */
            rows={6}
            placeholder={t('tracklist.brunoPole')}
            className={`${pole} flex-1 min-w-[240px] font-body resize-y`}
          />
          <button
            type="button"
            onClick={() => void zeptejSeBruna()}
            disabled={brunoPremysli || !dotazBrunovi.trim()}
            className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {brunoPremysli ? t('tracklist.brunoPremysli') : t('tracklist.brunoPoslat')}
          </button>
        </div>
      </div>
      )}

      {vkladani && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-field p-3">
          <span className="text-xs font-body text-muted">{t('tracklist.vlozitPopis')}</span>
          <textarea
            value={vlozeny}
            onChange={(e) => setVlozeny(e.target.value)}
            rows={8}
            className={`${pole} font-body`}
            placeholder={t('tracklist.vlozitPriklad')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={vlozSeznam}
              disabled={!vlozeny.trim()}
              className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
            >
              {t('tracklist.nahraditSeznam')}
            </button>
            <button
              type="button"
              onClick={() => {
                setVkladani(false);
                setVlozeny('');
              }}
              className="font-heading text-sm text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
            >
              {t('obecne.zrusit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
