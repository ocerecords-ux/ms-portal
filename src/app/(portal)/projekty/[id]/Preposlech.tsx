'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJazyk, usePreklad } from '../../components/JazykProvider';
import { kodJazyka } from '@/lib/jazyk';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';
import { souborMarkeru } from '@/lib/cubaseMarkery';
// Krivka se od 18. 9. 2026 pocita sdilenou funkci - kresli ji i tagger
// reklamnich spotu, viz lib/krivkaZvuku.ts.
import { STROP_PRO_KRIVKU, spocitejKrivku } from '@/lib/krivkaZvuku';
import type { PostupPreposlechu } from '@/lib/preposlechPostup';
import { PosluchaciPreposlechu } from './PosluchaciPreposlechu';
import { NaCestu } from './NaCestu';
import { HledaniVPdf } from './HledaniVPdf';
import {
  blobZCesty,
  jeChybaSite,
  nactiFrontu,
  novyZapis,
  stazeneAdresy,
  ulozFrontu,
  zaregistrujOfflineWorker,
  type ZapisVeFronte,
} from '@/lib/preposlechOffline';

/**
 * AudioTagger — přeposlech nahrávky proti textu (zadání 11. 9. 2026).
 *
 * Přeneseno z prototypu (viz projektový dokument audiotagger-v1-prototype.md)
 * do portálu. Proti prototypu se změnily dvě podstatné věci:
 *
 * 1. ZÁZNAMY CHYB PATŘÍ PROJEKTU a leží v databázi — přežijí obnovení stránky
 *    i výměnu počítače a vidí je celý tým. Dřív žily v localStorage.
 * 2. STOPY A TEXT SI PORTÁL BERE SÁM ze složky projektu na Disku. Pořadí se
 *    řídí názvem („01_", „02_"…), text je PDF končící „_RE". Ruční výběr
 *    souborů zůstal jako záloha, kdyby složka nebyla po ruce.
 *
 * ZVUK SE PŘEHRÁVÁ PROUDEM přes obyčejný <audio>, ne přes dekódování celé
 * stopy do paměti jako v prototypu. Hodinová nahrávka má po rozbalení přes
 * gigabajt a prohlížeč by to položil; takhle se stahuje jen to, co zrovna
 * hraje, a jde v ní skákat.
 *
 * KŘIVKA se počítá zvlášť a jen pro vybranou stopu: soubor se stáhne a
 * dekóduje do 8 kHz mono (OfflineAudioContext), což je pro obrázek dost a
 * paměť to unese. U příliš velkých souborů se nekreslí vůbec a zůstane
 * časová osa se značkami.
 */

/**
 * Zvýrazněný úsek textu (zadání 11. 9. 2026: „šlo by ještě nějakým
 * zvýrazňovačem, abych zaznačil tu chybu v textu?").
 *
 * Rámečky jsou ZLOMKY šířky a výšky strany, ne pixely. PDF se kreslí na
 * šířku okna, takže v pixelech by zvýraznění sedělo jen na tom monitoru,
 * kde vzniklo.
 */
type Zvyrazneni = {
  strana: number;
  /** [x, y, šířka, výška], všechno 0-1 vůči straně. */
  ramecky: [number, number, number, number][];
  text: string;
};

type ChybaZeServeru = {
  id: string;
  trackIndex: number;
  trackName: string;
  localTime: number;
  pdfPage: number | null;
  zvyrazneni: Zvyrazneni | null;
  description: string;
  createdByName: string | null;
  createdAt: string;
  /**
   * Smim s timhle zaznamem hnout? Rozhoduje server (zadani 12. 9. 2026):
   * tym Mediaspace vsechno, klient jen to, co napsal sam.
   */
  muzuUpravit?: boolean;
};

/** Radek historie preposlechu (zadani 12. 9. 2026). */
type Udalost = {
  id: string;
  typ: string;
  popis: string;
  kdo: string | null;
  kdy: string;
  /** Da se tenhle krok vratit? Rozhoduje server (zadani 12. 9. 2026). */
  muzuVratit?: boolean;
};

type Stav = {
  reviewed: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  chyby: ChybaZeServeru[];
  historie?: Udalost[];
  /** Pořadí stop (od 1), které si přeposlouchávač odškrtl jako hotové. */
  hotoveStopy?: number[];
};

type Stopa = {
  name: string;
  /** Odkaz, ze kterého se stopa přehrává (Disk přes portál, nebo blob z disku). */
  url: string;
  /** Velikost v bajtech — podle ní se rozhoduje, jestli kreslit křivku. */
  velikost: number | null;
  peaks: [number, number][] | null;
  /** Křivku už zkoušíme spočítat / spočítat nešla. */
  krivkaStav: 'ceka' | 'pocita' | 'hotovo' | 'nejde';
};

/** Nabídka rychlostí. Pomalejší než 0,75 už se nedá poslouchat, rychlejší
 *  než 2 nejde rozumět. */
const RYCHLOSTI = [0.75, 1, 1.25, 1.5, 2];

const DELKA_STOPY_V_CUBASE = 3600; // stopa 01 -> 0 h, 02 -> 1 h, 03 -> 2 h…


function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function cas(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${pad2(m)}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * DÉLKA STOPY BEZ STAHOVÁNÍ CELÉHO SOUBORU (zadání 25. 9. 2026: „potřebuji,
 * ať se u jednotlivých tracků v AudioTaggeru zobrazují celkové časy těch
 * tracků").
 *
 * `preload = 'metadata'` si z audia vezme jen hlavičku, ne celou stopu -
 * u dvanácti hodinové knihy by jinak prohlížeč stáhl gigabajty jen proto,
 * aby ukázal čísla. Když se délku zjistit nepodaří (formát, výpadek Disku),
 * vrátí se null a u stopy se prostě nic neukáže.
 */
function delkaZvuku(url: string): Promise<number | null> {
  return new Promise((hotovo) => {
    const zvuk = new Audio();
    zvuk.preload = 'metadata';
    const uklid = () => {
      zvuk.onloadedmetadata = null;
      zvuk.onerror = null;
      zvuk.removeAttribute('src');
    };
    zvuk.onloadedmetadata = () => {
      const d = zvuk.duration;
      uklid();
      hotovo(Number.isFinite(d) && d > 0 ? d : null);
    };
    zvuk.onerror = () => {
      uklid();
      hotovo(null);
    };
    zvuk.src = url;
  });
}

function hms(sec: number): string {
  const cele = Math.max(0, Math.round(sec));
  return `${pad2(Math.floor(cele / 3600))}:${pad2(Math.floor((cele % 3600) / 60))}:${pad2(cele % 60)}`;
}

export function Preposlech({
  caflouProjectId,
  projectName,
  pocatecniStav,
  /** Klientský režim: poslouchá a zapisuje, ale se stopami nehýbe. */
  jenPoslech = false,
  /** Vstupenka z mailu. Když je, jde s každým požadavkem místo přihlášení. */
  token = null,
}: {
  caflouProjectId: string;
  projectName: string;
  pocatecniStav: Stav;
  jenPoslech?: boolean;
  token?: string | null;
}) {
  // Jazyk portalu (zadani 13. 9. 2026). Tagger bezi i mimo skupinu (portal),
  // na klientove odkazu - jazyk mu tam rozdava JazykProvider ve stránce.
  const t = usePreklad();
  const jazyk = useJazyk();
  const [stav, setStav] = useState<Stav>(pocatecniStav);
  // Znacky do PDF kresli funkce mimo React render, potrebuje proto posledni
  // stav i mimo zavislosti efektu.
  const stavRef = useRef(stav);
  stavRef.current = stav;
  const [stopy, setStopy] = useState<Stopa[]>([]);
  const [aktivni, setAktivni] = useState<number | null>(null);
  const [hraje, setHraje] = useState(false);
  const [pozice, setPozice] = useState(0);
  const [delka, setDelka] = useState(0);

  const [zDisku, setZDisku] = useState<'ceka' | 'nacitam' | 'hotovo' | 'nejde'>('ceka');
  /**
   * Ktera zalozka je videt v pravem sloupci (zadani 12. 9. 2026: „podobne
   * jako to mame s ukoly a chatem, by byly nahore zalozky"). Jmenuje se
   * `panel`, protoze `zalozka` uz v tomhle souboru znamena zalozku
   * v nahravce - misto, kde clovek skoncil.
   */
  const [panel, setPanel] = useState<'chyby' | 'historie'>('chyby');
  /**
   * Vysunuty panel se zaznamy (zadani 12. 9. 2026: „chci, at cela sekce, kde
   * je zaznam chyb, je zarolovana vpravo, jak mame chat a ukoly, at se da
   * skryt a odkryt... primarne skryta").
   *
   * Vychozi je ZAVRENY. Pri praci se clovek diva do textu a na stopy;
   * seznam poznamek si otevre, az kdyz ho potrebuje.
   */
  const [zaznamyOtevrene, setZaznamyOtevrene] = useState(false);
  /**
   * VYSKA CELE SEKCE (zadani 12. 9. 2026: „to okno s pdf bych potahl na hranu
   * dolu, co to jde. Je tam zbytecne moc prazdneho mista. Dulezite je
   * zachovat co nejvice roztazeny text na obrazovku").
   *
   * Pevnych 72vh nechavalo pod textem pruh prazdna, protoze o tom, jak
   * vysoko sekce zacina, nevedelo nic. Tady se to zmeri: od horni hrany
   * mrizky po spodni hranu okna. Na uzkem okne (pod xl) zustava null - tam se
   * sloupce radi pod sebe a stranka roluje, takze plati puvodni vysky.
   */
  const mrizkaRef = useRef<HTMLDivElement | null>(null);
  const [vyskaSekce, setVyskaSekce] = useState<number | null>(null);
  /** Ktery zaznam se prave upravuje a co je v policku (zadani 12. 9. 2026). */
  const [upravovana, setUpravovana] = useState<string | null>(null);
  const [upravaText, setUpravaText] = useState('');
  const [poznamka, setPoznamka] = useState<string | null>(null);
  const [slozkaUrl, setSlozkaUrl] = useState<string | null>(null);

  const [pdfNazev, setPdfNazev] = useState('');
  const [pdfStran, setPdfStran] = useState(0);
  const [pdfStrana, setPdfStrana] = useState(1);
  /** Načtené PDF a knihovna - pro hledání v textu (21. 9. 2026). */
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  /**
   * Strana a počet stran i mimo render - zápis záložky je posílá každých
   * deset vteřin a procento přeposlechu se z nich počítá (21. 9. 2026).
   */
  const pdfStranaRef = useRef(1);
  pdfStranaRef.current = pdfStrana;
  const pdfStranRef = useRef(0);
  pdfStranRef.current = pdfStran;
  /** Kolik procent knihy klient přeposlechl - podle stran PDF, viz lib/preposlechPostup. */
  const [postup, setPostup] = useState<PostupPreposlechu | null>(null);
  /**
   * Co je zrovna napsané v políčku s číslem strany.
   *
   * Políčko NENÍ přímo napojené na `pdfStrana` (zadání 11. 9. 2026: „když do
   * stránky PDF chceš napsat číslo stránky ručně, tak to nějak blbne").
   * Kdyby bylo, tak se každý stisk klávesy hned bere jako hotové číslo:
   * smazání políčka znamená nulu a skok na stranu 1, „12" u desetistránkového
   * textu se po první číslici usadí na jedničce, a rolování, které tím samo
   * spustí, přepíše to, co člověk zrovna píše. Proto se psané číslo drží
   * stranou a uplatní se až Enterem nebo odkliknutím.
   */
  const [psanaStrana, setPsanaStrana] = useState<string | null>(null);
  const psanaStranaRef = useRef<string | null>(null);

  const [formOtevreny, setFormOtevreny] = useState(false);
  const [popis, setPopis] = useState('');
  const [zachyt, setZachyt] = useState<{
    trackIndex: number;
    trackName: string;
    localTime: number;
    pdfPage: number | null;
    zvyrazneni: Zvyrazneni | null;
  } | null>(null);
  /**
   * Čas, na kterém stopa stála, KDYŽ ČLOVĚK ZAČAL TÁHNOUT MYŠÍ po textu
   * (zadání 11. 9. 2026: „mohlo by se to časově párovat s tím místem, kde
   * se zastaví track a hodí marker"). Než výběr dotáhne, uteče nahrávce
   * pár vteřin — a marker patří tam, kde tu chybu slyšel.
   */
  const casVyberuRef = useRef<number | null>(null);
  const [uklada, setUklada] = useState(false);
  /** Odškrtnutí PŘEPOSLECHNUTO se ptá - je to krok zpátky ve velké věci. */
  const [rusiPreposlech, setRusiPreposlech] = useState(false);
  /**
   * Ptame se pred oznacenim (zadani 12. 9. 2026: „u volby Oznacit jako
   * preposlechnute dat dotaz Opravdu oznacit? At je tam nejaka pojistka,
   * kdyz se nekdo splete"). Odskrtnuti uz svuj dotaz melo - ted se pta
   * i zaskrtnuti, protoze prave to je ta velka akce.
   */
  const [potvrzujePreposlech, setPotvrzujePreposlech] = useState(false);
  /**
   * Rychlost přehrávání (zadání 11. 9. 2026: „přidej do audiotaggeru
   * přepínání rychlé přehrávání"). Prohlížeč ji při výměně souboru zahodí,
   * proto se po každém výběru stopy nastaví znovu.
   */
  const [rychlost, setRychlost] = useState(1);
  /**
   * Záložka - kde člověk skončil (zadání 11. 9. 2026: „aby si nějak
   * jednoduše pamatoval, kde se skončilo v přeposlechu, když si chce dát
   * člověk pauzu").
   *
   * Neskáče se tam samo. Nabídne se to proužkem nad přehrávačem: kdo si
   * pauzu dal, klikne a je tam; kdo přišel poslouchat od začátku, proužek
   * zavře. Samovolný skok doprostřed nahrávky by mátl víc, než pomohl.
   */
  /**
   * KE STOPĚ A ČASU PATŘÍ I STRANA TEXTU (24. 9. 2026: „nefunguje záložka
   * tak, že si pamatuje i stránku, na které se skončilo"). Server stranu
   * ukládal už od 21. 9. kvůli procentům, ale zpátky ji neposílal a nikdo
   * se na ni neptal — záložka tak vracela jen zvuk a text zůstal na první
   * straně knihy.
   */
  const [zalozka, setZalozka] = useState<{
    trackIndex: number;
    localTime: number;
    strana?: number | null;
  } | null>(null);
  // Kresli se do canvasu mimo React render, proto i ref.
  const zalozkaRef = useRef<{ trackIndex: number; localTime: number; strana?: number | null } | null>(null);
  zalozkaRef.current = zalozka;
  /**
   * Vysunutá záložka (zadání 11. 9. 2026: „vysouvací panel, který vysune
   * přeposlouchávač ve chvíli, kdy si chce dát pauzu, a zasune se jako pruh
   * — mohlo by to fakt vypadat graficky jako záložka — přes obrazovku
   * a zamkne přeposlech").
   *
   * `zasunuta` je to, co je v DOM; `vysunuta` spouští CSS přesun. Dvě
   * proměnné proto, že prohlížeč musí prvek nejdřív vykreslit nahoře mimo
   * obraz a teprve pak ho posunout dolů — jinak se nic neanimuje a záložka
   * jen cukne.
   */
  const [zalozkaZasunuta, setZalozkaZasunuta] = useState(false);
  const [zalozkaVysunuta, setZalozkaVysunuta] = useState(false);

  /**
   * Kdo zrovna poslouchá (zadání 11. 9. 2026: „bylo by dobré mít nějakou
   * signalizaci, že někdo poslouchá — svítilo by to u nás interně").
   *
   * Ptáme se každých dvacet vteřin; posluchač se hlásí po deseti, takže
   * kontrolka zhasne nejpozději minutu po tom, co někdo odejde od stolu.
   * Klientovi se to neukazuje vůbec.
   */
  const [posluchaci, setPosluchaci] = useState<{ jmeno: string; trackIndex: number; localTime: number }[]>([]);

  /** Na celou obrazovku (zadání 11. 9. 2026). */
  const celaObrazovkaRef = useRef<HTMLDivElement | null>(null);
  const [celaObrazovka, setCelaObrazovka] = useState(false);
  const [chybaHlaska, setChybaHlaska] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopyRef = useRef<Stopa[]>([]);
  const aktivniRef = useRef<number | null>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfObalRef = useRef<HTMLDivElement | null>(null);
  const pdfRolovaniRef = useRef<HTMLDivElement | null>(null);
  const pdfVerzeRef = useRef(0);
  /** Vybraná rychlost i mimo React render - viz vyberStopu. */
  const rychlostRef = useRef(1);
  /** Které strany už jsou vykreslené - kreslí se až na dohled, viz vykresliPdf. */
  const nakresleneRef = useRef<Set<number>>(new Set());
  const pozorovatelRef = useRef<IntersectionObserver | null>(null);
  const popisRef = useRef<HTMLTextAreaElement | null>(null);
  const vytvoreneUrl = useRef<string[]>([]);

  useEffect(() => {
    stopyRef.current = stopy;
  }, [stopy]);
  useEffect(() => {
    aktivniRef.current = aktivni;
  }, [aktivni]);
  useEffect(() => {
    psanaStranaRef.current = psanaStrana;
  }, [psanaStrana]);

  // Blob URL z rucne vybranych souboru je potreba po sobe uklidit.
  useEffect(
    () => () => {
      vytvoreneUrl.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/preposlech`;

  /**
   * Klient z mailu není přihlášený, takže se ke každé adrese přilepí token.
   * Týmu se nepřilepuje nic a pozná se podle sezení jako dosud.
   */
  const sKlicem = useCallback(
    (url: string): string => (token ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(token)}` : url),
    [token],
  );

  /* ---------- offline (zadání 21. 9. 2026) ---------- */

  /**
   * PRÁCE BEZ SIGNÁLU (zadání 21. 9. 2026: „bylo by super přidat možnost, aby
   * mohl klient v AudioTaggeru pracovat offline, když bude vědět, že bude mimo
   * signál"). Podrobně v lib/preposlechOffline.ts.
   *
   * `stazene` = adresy nahrávek a textu, které jsou stažené v počítači.
   * `fronta` = zápisy, které čekají na signál.
   */
  const [stazene, setStazene] = useState<Set<string>>(new Set());
  const stazeneRef = useRef<Set<string>>(new Set());
  stazeneRef.current = stazene;
  const [online, setOnline] = useState(true);
  const [fronta, setFronta] = useState<ZapisVeFronte[]>([]);
  const frontaRef = useRef<ZapisVeFronte[]>([]);
  const odesilaFrontuRef = useRef(false);
  /** Adresa PDF z Disku - kvůli stažení na cestu. */
  const [textUrl, setTextUrl] = useState<string | null>(null);

  const nastavFrontu = useCallback(
    (nova: ZapisVeFronte[]) => {
      frontaRef.current = nova;
      setFronta(nova);
      ulozFrontu(caflouProjectId, nova);
    },
    [caflouProjectId],
  );

  /** Zařadí zápis do fronty; se stejným `klic` nahradí ten předchozí. */
  const zarad = useCallback(
    (z: Omit<ZapisVeFronte, 'id' | 'kdy'>) => {
      const bez = z.klic ? frontaRef.current.filter((x) => x.klic !== z.klic) : frontaRef.current;
      nastavFrontu([...bez, novyZapis(z)]);
    },
    [nastavFrontu],
  );

  /** Zápis, který nesmí přijít nazmar: bez signálu počká ve frontě. */
  const odesliNeboZarad = useCallback(
    async (url: string, method: ZapisVeFronte['method'], body: unknown, klic?: string) => {
      const telo = JSON.stringify(body);
      try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: telo, keepalive: true });
        return res;
      } catch (err) {
        if (jeChybaSite(err)) zarad({ url, method, body: telo, klic });
        return null;
      }
    },
    [zarad],
  );

  useEffect(() => {
    frontaRef.current = nactiFrontu(caflouProjectId);
    setFronta(frontaRef.current);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    // Klientsky odkaz se po stazeni otevre i bez signalu - obstara to
    // service worker (public/preposlech-sw.js).
    if (token) zaregistrujOfflineWorker();
  }, [caflouProjectId, token]);

  /**
   * Odeslání fronty, když je signál zpátky. Po řadě, jak se to psalo; při
   * první chybě sítě se zastaví a zkusí to příště. Co server odmítne (4xx),
   * z fronty vypadne - opakovat to nemá smysl a zbytek by se zasekl.
   */
  const odesliFrontu = useCallback(async () => {
    if (odesilaFrontuRef.current || frontaRef.current.length === 0) return;
    odesilaFrontuRef.current = true;
    let neco = false;
    try {
      for (const z of [...frontaRef.current]) {
        let res: Response;
        try {
          res = await fetch(z.url, {
            method: z.method,
            headers: z.body ? { 'Content-Type': 'application/json' } : undefined,
            body: z.body,
          });
        } catch {
          break;
        }
        if (res.status >= 500) break;
        nastavFrontu(frontaRef.current.filter((x) => x.id !== z.id));
        neco = true;
      }
    } finally {
      odesilaFrontuRef.current = false;
    }
    if (neco) {
      // Docasne poznamky nahradi skutecne ze serveru.
      const znovu = await fetch(sKlicem(zaklad)).catch(() => null);
      const novy = znovu && znovu.ok ? await znovu.json().catch(() => null) : null;
      if (novy) setStav(novy as Stav);
    }
  }, [nastavFrontu, sKlicem, zaklad]);

  useEffect(() => {
    const naSignalu = () => {
      setOnline(true);
      void odesliFrontu();
    };
    const bezSignalu = () => setOnline(false);
    window.addEventListener('online', naSignalu);
    window.addEventListener('offline', bezSignalu);
    // Udalost „online" nekdy neprijde (usnuly notebook) - proto i hodiny.
    const tik = window.setInterval(() => {
      if (frontaRef.current.length > 0 && navigator.onLine) void odesliFrontu();
    }, 30_000);
    if (navigator.onLine) void odesliFrontu();
    return () => {
      window.removeEventListener('online', naSignalu);
      window.removeEventListener('offline', bezSignalu);
      window.clearInterval(tik);
    };
  }, [odesliFrontu]);

  /**
   * DOPOSLECHNUTÁ STOPA SE ZAPÍŠE SAMA (zadání 12. 9. 2026: „Přeposlechnuto —
   * tam bude počet tracků a kolik je z nich přeposlechnuto, třeba 3 z 24").
   *
   * Odškrtávátko u každé stopy by byla práce navíc a lidé na ni zapomínají;
   * číslo, které nikdo neudržuje, je horší než žádné. Proto se počítá to, co
   * se dá poznat samo: přehrávání dojelo na konec.
   *
   * Jednou za život stopy stačí — ref hlídá, aby se to neposílalo při každém
   * dalším dohrání.
   */
  const poslaneStopy = useRef<Set<number>>(new Set());

  /**
   * KAM AŽ JE KTERÁ STOPA POSLECHNUTÁ (zadání 21. 9. 2026: „když poslouchám
   * stopu v AudioTaggeru, tak by stopa měla zůstat probarvená na místě, kde to
   * přeruším nebo zastavím, když to znova otevřu, ať jasně vidím, kde jsem
   * skončil, nebo že je přeposlechnutá").
   *
   * Pořadí stopy (od 1) → podíl 0-1, kam až došlo PŘEHRÁVÁNÍ. Drží se
   * nejdál dosažené místo: kdo se vrátí o kus zpátky, o probarvení nepřijde.
   * Posouvá se jen při souvislém přehrávání - pouhé kliknutí do křivky nic
   * „neposlechne". Ukládá se se záložkou (pozice) zvlášť pro každého
   * posluchače.
   */
  const [dosazeno, setDosazeno] = useState<Record<number, number>>({});
  const dosazenoRef = useRef<Record<number, number>>({});
  dosazenoRef.current = dosazeno;
  const minulaPoziceRef = useRef<{ index: number | null; cas: number }>({ index: null, cas: 0 });

  /**
   * HOTOVÉ STOPY (zadání 14. 9. 2026: „přeposlouchávač zaškrtne, že má hotový
   * track... takto zaškrtnutý by mohl třeba změnit barvu").
   *
   * Je to něco jiného než doposlechnutí, které se zapisuje samo na konci
   * stopy. Člověk si stopu pustí celou, něco si k ní poznamená a vrátí se
   * k ní — hotová je až ve chvíli, kdy to sám řekne.
   */
  const [hotoveStopy, setHotoveStopy] = useState<Set<number>>(
    () => new Set(pocatecniStav.hotoveStopy ?? []),
  );

  /**
   * DÉLKY JEDNOTLIVÝCH STOP (25. 9. 2026), klíč je pořadí stopy od 1.
   * Zjišťují se jedna po druhé z hlavičky souboru - najednou by dvanáct
   * požadavků na Disk zbytečně ucpalo přehrávání.
   */
  const [delkyStop, setDelkyStop] = useState<Record<number, number>>({});
  const zjistujiDelky = useRef<Set<string>>(new Set());

  useEffect(() => {
    let zrusit = false;
    const nactiPostupne = async () => {
      for (let i = 0; i < stopy.length; i += 1) {
        if (zrusit) return;
        const stopa = stopy[i];
        const klic = `${i + 1}:${stopa.url}`;
        if (zjistujiDelky.current.has(klic)) continue;
        zjistujiDelky.current.add(klic);
        const delkaStopy = await delkaZvuku(stopa.url);
        if (zrusit) return;
        if (delkaStopy) setDelkyStop((p) => ({ ...p, [i + 1]: delkaStopy }));
      }
    };
    void nactiPostupne();
    return () => {
      zrusit = true;
    };
  }, [stopy]);

  /**
   * KOLIK ZBÝVÁ DOPOSLECHNOUT (zadání 25. 9. 2026: „a pak někam nahoru dát
   * celkový čas toho, kolik toho chybí doposlechnout").
   *
   * Odškrtnutá stopa se nepočítá vůbec; u rozposlouchané se bere jen ten
   * kus, který ještě nezazněl. Dokud nejsou známé délky všech stop, je číslo
   * neúplné - a je to u něj napsané, ať nikoho nepřekvapí, že povyskočí.
   */
  const zbyva = useMemo(() => {
    let sekundy = 0;
    let zname = 0;
    for (let i = 0; i < stopy.length; i += 1) {
      const delkaStopy = delkyStop[i + 1];
      if (!delkaStopy) continue;
      zname += 1;
      if (hotoveStopy.has(i + 1)) continue;
      sekundy += delkaStopy * (1 - Math.min(1, Math.max(0, dosazeno[i + 1] ?? 0)));
    }
    return { sekundy, uplne: stopy.length > 0 && zname === stopy.length };
  }, [stopy, delkyStop, hotoveStopy, dosazeno]);

  const prepniHotovo = useCallback(
    (index: number) => {
      const stopa = stopyRef.current[index];
      if (!stopa) return;
      const poradi = index + 1;
      const nove = !hotoveStopy.has(poradi);
      // Zaškrtnutí se projeví hned; kdyby zápis selhal, vrátí se zpátky.
      setHotoveStopy((s) => {
        const kopie = new Set(s);
        if (nove) kopie.add(poradi);
        else kopie.delete(poradi);
        return kopie;
      });
      // Bez signalu pocka ve fronte a zaskrtnuti zustane (21. 9. 2026).
      void odesliNeboZarad(
        sKlicem(`${zaklad}/stopa`),
        'POST',
        { trackIndex: poradi, trackName: stopa.name, hotovo: nove },
        `hotovo:${poradi}`,
      )
        .then((res) => {
          if (res === null || res.ok) return;
          throw new Error('nepovedlo se');
        })
        .catch((err) => {
          console.error('Zapis hotove stopy selhal:', err);
          setHotoveStopy((s) => {
            const kopie = new Set(s);
            if (nove) kopie.delete(poradi);
            else kopie.add(poradi);
            return kopie;
          });
        });
    },
    [hotoveStopy, odesliNeboZarad, sKlicem, zaklad],
  );

  const nahlasDoposlechnuto = useCallback(
    (index: number) => {
      const stopa = stopyRef.current[index];
      if (!stopa || poslaneStopy.current.has(index)) return;
      poslaneStopy.current.add(index);
      void odesliNeboZarad(
        sKlicem(`${zaklad}/stopa`),
        'POST',
        { trackIndex: index + 1, trackName: stopa.name },
        `doposlechnuto:${index + 1}`,
      ).catch((err) => {
        // Nepovedlo se - zkusi se zase pri pristim dohrani.
        poslaneStopy.current.delete(index);
        console.error('Zapis doposlechnute stopy selhal:', err);
      });
    },
    [odesliNeboZarad, sKlicem, zaklad],
  );

  /**
   * Posun probarvení při přehrávání. Počítá se jen souvislé přehrávání -
   * rozdíl proti minulé pozici je malý (i při dvojnásobné rychlosti).
   * Skok kliknutím do křivky tedy nic nepřidá, až teprve další vteřiny
   * poslechu od toho místa.
   */
  useEffect(() => {
    const minula = minulaPoziceRef.current;
    minulaPoziceRef.current = { index: aktivni, cas: pozice };
    if (aktivni === null || !hraje || delka <= 0 || minula.index !== aktivni) return;
    const krok = pozice - minula.cas;
    if (krok <= 0 || krok > 4) return;
    const podil = Math.min(1, pozice / delka);
    const poradi = aktivni + 1;
    if (podil > (dosazenoRef.current[poradi] ?? 0) + 0.002) {
      setDosazeno((d) => ({ ...d, [poradi]: Math.max(d[poradi] ?? 0, podil) }));
    }
  }, [aktivni, delka, hraje, pozice]);

  /* ---------- křivka ---------- */

  const kresliStopu = useCallback(
    (index: number) => {
      const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-stopa="${index}"]`);
      const stopa = stopyRef.current[index];
      if (!canvas || !stopa) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 56;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const c = canvas.getContext('2d');
      if (!c) return;
      c.save();
      c.scale(dpr, dpr);
      c.clearRect(0, 0, w, h);

      const stred = h / 2;
      const jeAktivni = index === aktivniRef.current;
      const trvani = jeAktivni && delka > 0 ? delka : 0;
      const kurzor = jeAktivni && trvani ? (pozice / trvani) * w : -1;
      /**
       * PROBARVENÍ ZŮSTÁVÁ (21. 9. 2026): fialově až kam stopa došla při
       * poslechu - i u stopy, která zrovna nehraje, a i po novém otevření.
       * Stopa poslechnutá do konce je celá zelená.
       */
      const hranice = Math.max(jeAktivni ? kurzor : -1, (dosazeno[index + 1] ?? 0) * w);
      const cela = (dosazeno[index + 1] ?? 0) >= 0.995;
      const barvaPoslechnuto = cela ? '#1FB85A' : '#7B55FF';

      if (stopa.peaks) {
        const sirkaSloupce = w / stopa.peaks.length;
        for (let i = 0; i < stopa.peaks.length; i += 1) {
          const [mn, mx] = stopa.peaks[i];
          const x = i * sirkaSloupce;
          c.fillStyle = x < hranice ? barvaPoslechnuto : '#a29c8f';
          c.fillRect(x, stred - mx * stred, Math.max(1, sirkaSloupce - 0.4), Math.max(1, (mx - mn) * stred));
        }
      } else {
        // Bez krivky aspon casova osa, at je kam klikat a kam kreslit znacky.
        c.fillStyle = '#d8d4cc';
        c.fillRect(0, stred - 1, w, 2);
        if (hranice > 0) {
          c.fillStyle = barvaPoslechnuto;
          c.fillRect(0, stred - 1, hranice, 2);
        }
      }

      // Znacky chyb - podle poradi stopy, ne podle nejakeho ID.
      c.fillStyle = '#c0432f';
      stav.chyby
        .filter((ch) => ch.trackIndex === index + 1)
        .forEach((ch) => {
          if (!trvani) return;
          c.fillRect(Math.max(0, (ch.localTime / trvani) * w - 1.5), 0, 3, h);
        });

      // Zalozka - tenka oranzova carka tam, kde se skoncilo.
      const zal = zalozkaRef.current;
      if (zal && zal.trackIndex === index + 1 && trvani) {
        c.fillStyle = '#E08A00';
        c.fillRect(Math.max(0, (zal.localTime / trvani) * w - 1), 0, 2, h);
      }

      // KURZOR JE ZELENY, ZNACKY CHYB ZUSTAVAJI CERVENE (zadani 12. 9. 2026:
      // „ten kurzor, kde jsem v nahravce, by mohl mit treba tu nasi zelenou
      // barvu a ty markery chyb by mohly zustat cervene, at se to odlisi").
      //
      // Dosud se kreslil BEZ nastaveni barvy, takze zdedil tu posledni - a to
      // byla zrovna cervena od znacek chyb. Splyval s nimi presne v miste,
      // kde na tom zalezi.
      if (jeAktivni && kurzor >= 0) {
        c.fillStyle = '#1FDF67';
        c.fillRect(Math.max(0, kurzor - 1), 0, 2, h);
      }
      c.restore();
    },
    [delka, dosazeno, pozice, stav.chyby],
  );

  /** Běží zrovna výpočet křivky? Víc než jeden naráz nechceme. */
  const kresliciRef = useRef(false);
  /** Je komponenta ještě na stránce? Po odchodu už nic nepřepisujeme. */
  const zivyRef = useRef(true);
  useEffect(() => () => {
    zivyRef.current = false;
  }, []);

  const kresliVse = useCallback(() => {
    stopyRef.current.forEach((_, i) => kresliStopu(i));
  }, [kresliStopu]);

  useEffect(() => {
    kresliVse();
  }, [kresliVse, stopy, pozice, delka, stav.chyby, zalozka, dosazeno]);

  useEffect(() => {
    window.addEventListener('resize', kresliVse);
    return () => window.removeEventListener('resize', kresliVse);
  }, [kresliVse]);

  /**
   * Křivky se dopočítávají POSTUPNĚ, jedna po druhé (zadání 11. 9. 2026:
   * „ty stopy se moc nenačítají").
   *
   * Do té doby se křivka počítala jen pro vybranou stopu, takže ostatní
   * zůstávaly prázdné - vypadalo to jako rozbité, i když to tak bylo
   * schválně. Teď se po vybrané stopě dopočítají i zbylé, ale vždycky
   * jenom JEDNA NARÁZ: každá křivka znamená stáhnout celou stopu a všechny
   * najednou by ucpaly linku i paměť.
   *
   * Hlídá to `kreslici` ref, ne cleanup efektu. Efekt se totiž spustí znovu
   * hned, jak se stopě nastaví „pocita" - a cleanup by tím zrušil výpočet,
   * který právě odstartoval.
   */
  useEffect(() => {
    if (kresliciRef.current) return;

    // Vybraná stopa má přednost - na tu se člověk dívá teď.
    const naRade =
      aktivni !== null && stopy[aktivni]?.krivkaStav === 'ceka'
        ? aktivni
        : stopy.findIndex((x) => x.krivkaStav === 'ceka');
    if (naRade < 0) return;

    const stopa = stopy[naRade];
    if (stopa.velikost !== null && stopa.velikost > STROP_PRO_KRIVKU) {
      setStopy((s) => s.map((x, i) => (i === naRade ? { ...x, krivkaStav: 'nejde' } : x)));
      return;
    }

    kresliciRef.current = true;
    setStopy((s) => s.map((x, i) => (i === naRade ? { ...x, krivkaStav: 'pocita' } : x)));
    // Stazena stopa se kresli z pocitace - bez signalu by to jinak neslo.
    const zdrojKrivky: Promise<{ url: string; uvolnit: boolean }> = stazeneRef.current.has(stopa.url)
      ? blobZCesty(stopa.url).then((b) => (b ? { url: URL.createObjectURL(b), uvolnit: true } : { url: stopa.url, uvolnit: false }))
      : Promise.resolve({ url: stopa.url, uvolnit: false });
    zdrojKrivky
      .then((z) =>
        spocitejKrivku(z.url).finally(() => {
          if (z.uvolnit) URL.revokeObjectURL(z.url);
        }),
      )
      .then((peaks) => {
        if (!zivyRef.current) return;
        setStopy((s) => s.map((x, i) => (i === naRade ? { ...x, peaks, krivkaStav: 'hotovo' } : x)));
      })
      .catch(() => {
        if (!zivyRef.current) return;
        setStopy((s) => s.map((x, i) => (i === naRade ? { ...x, krivkaStav: 'nejde' } : x)));
      })
      .finally(() => {
        kresliciRef.current = false;
      });
  }, [aktivni, stopy]);

  /* ---------- přehrávání ---------- */

  /** Která stopa je v přehrávači (adresa z Disku) a blob, když hraje z počítače. */
  const zdrojStopyRef = useRef<string | null>(null);
  const blobStopyRef = useRef<string | null>(null);

  const vyberStopu = useCallback((index: number, skocNa?: number) => {
    const stopa = stopyRef.current[index];
    const audio = audioRef.current;
    if (!stopa || !audio) return;
    setAktivni(index);
    aktivniRef.current = index;

    const dokonci = () => {
      // Novy soubor = rychlost zpatky na 1, tak ji hned vratime na vybranou.
      audio.playbackRate = rychlostRef.current;
      setDelka(Number.isFinite(audio.duration) ? audio.duration : 0);
      if (typeof skocNa === 'number') {
        const nastav = () => {
          audio.currentTime = skocNa;
          setPozice(skocNa);
        };
        if (audio.readyState >= 1) nastav();
        else audio.addEventListener('loadedmetadata', nastav, { once: true });
      } else {
        audio.currentTime = 0;
        setPozice(0);
      }
    };

    if (zdrojStopyRef.current === stopa.url) {
      dokonci();
      return;
    }
    zdrojStopyRef.current = stopa.url;

    /**
     * STAŽENÁ STOPA HRAJE Z POČÍTAČE (offline, 21. 9. 2026). Přes blob, ne
     * přes cache v service workeru: přehrávač si říká o kousky souboru
     * (Range) a to z cache neumí každý prohlížeč.
     */
    if (stazeneRef.current.has(stopa.url)) {
      void blobZCesty(stopa.url).then((blob) => {
        if (zdrojStopyRef.current !== stopa.url) return;
        if (blobStopyRef.current) URL.revokeObjectURL(blobStopyRef.current);
        blobStopyRef.current = blob ? URL.createObjectURL(blob) : null;
        audio.src = blobStopyRef.current ?? stopa.url;
        audio.load();
        dokonci();
      });
      return;
    }
    if (blobStopyRef.current) {
      URL.revokeObjectURL(blobStopyRef.current);
      blobStopyRef.current = null;
    }
    audio.src = stopa.url;
    audio.load();
    dokonci();
  }, []);

  function prehrajNeboPauzni() {
    const audio = audioRef.current;
    if (!audio || aktivni === null) return;
    if (audio.paused) void audio.play().catch(() => setChybaHlaska(t('preposlech.chybaPrehrani')));
    else audio.pause();
  }

  const skoc = useCallback((kam: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const cil = Math.max(0, Math.min(kam, audio.duration));
    audio.currentTime = cil;
    setPozice(cil);
  }, []);

  /* ---------- načtení ze složky projektu ---------- */

  const nactiZDisku = useCallback(async () => {
    setZDisku('nacitam');
    setChybaHlaska(null);
    try {
      const res = await fetch(sKlicem(`${zaklad}/stopy`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZDisku('nejde');
        setPoznamka(data?.error || t('preposlech.chybaSlozka'));
        return;
      }

      const nove: Stopa[] = (data.stopy ?? []).map((s: { id: string; name: string; velikost: number | null }) => ({
        name: s.name,
        url: sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(s.id)}`),
        velikost: s.velikost,
        peaks: null,
        krivkaStav: 'ceka' as const,
      }));

      setStopy(nove);
      stopyRef.current = nove;
      setSlozkaUrl(data.slozkaUrl ?? null);
      setPoznamka(data.poznamkaKTextu ?? null);
      setZDisku('hotovo');
      const pdfUrl = data.text?.id ? sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(data.text.id)}`) : null;
      setTextUrl(pdfUrl);
      // Co uz je stazene na cestu (21. 9. 2026) - pred prvni stopou, at hraje
      // rovnou z pocitace.
      const uzStazene = await stazeneAdresy([...nove.map((x) => x.url), ...(pdfUrl ? [pdfUrl] : [])]);
      stazeneRef.current = uzStazene;
      setStazene(uzStazene);
      if (nove.length > 0) setTimeout(() => vyberStopu(0), 0);
      if (pdfUrl) void nactiPdfZUrl(pdfUrl, data.text.name);
    } catch {
      setZDisku('nejde');
      setPoznamka(t('preposlech.chybaSlozka'));
    }
  }, [zaklad, sKlicem, vyberStopu, t]);

  useEffect(() => {
    void nactiZDisku();
    // Schvalne jen pri otevreni - dalsi nacteni si clovek vyzada tlacitkem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- PDF ---------- */

  /**
   * Stránky PDF kreslí pdf.js do DOM sám, takže `pdfObalRef` je div, do
   * kterého React NIKDY nic nevykresluje.
   *
   * Kdyby si ho s Reactem dělili, skončí to pádem celé stránky:
   * `NotFoundError: Failed to execute 'removeChild'`. React si pamatuje, co
   * v tom místě vykreslil (hlášku „ve složce zatím není text"), my mu to pod
   * rukama smažeme `innerHTML = ''` a při dalším překreslení chce odebrat
   * uzel, který už není. Přesně tohle položilo Přeposlech 11. 9. 2026.
   */
  async function vykresliPdf(doc: any) {
    const obal = pdfObalRef.current;
    if (!obal) return;
    // Util.transform prepocita souradnice textu na pixely stranky.
    const pdfjs = await nactiPdfJs();

    // Dve nacteni za sebou (z Disku a rucne) by si jinak kreslila pres sebe.
    const moje = pdfVerzeRef.current + 1;
    pdfVerzeRef.current = moje;
    pozorovatelRef.current?.disconnect();
    nakresleneRef.current = new Set();
    obal.replaceChildren();

    const prvni = await doc.getPage(1);
    const sirka = Math.max(200, obal.clientWidth || 600);
    const zvetseni = Math.max(0.3, Math.min(4, sirka / prvni.getViewport({ scale: 1 }).width));
    const rozmer = prvni.getViewport({ scale: zvetseni });

    /**
     * Stránka se vykreslí, AŽ KDYŽ SE K NÍ ČLOVĚK PŘIBLÍŽÍ (zadání
     * 11. 9. 2026: „kolegovi nenačetl text").
     *
     * Do té doby se kreslilo všech 330 stran naráz, každá do vlastního
     * plátna a s vlastní textovou vrstvou. Na silném stroji to jen chvíli
     * trvalo, na slabším prohlížeč vzdal a text nenaskočil vůbec. Teď se
     * rovnou vyrobí jen prázdné rámečky správné velikosti (aby rolování
     * i čísla stran seděly) a plátno s textem do nich přibude, až jsou
     * na dohled.
     */
    async function vykresliStranku(n: number) {
      if (nakresleneRef.current.has(n) || pdfVerzeRef.current !== moje) return;
      nakresleneRef.current.add(n);
      const ramecek = obal!.querySelector<HTMLElement>(`[data-strana="${n}"]`);
      if (!ramecek) return;

      const stranka = await doc.getPage(n);
      if (pdfVerzeRef.current !== moje) return;
      const viewport = stranka.getViewport({ scale: zvetseni });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'block';
      ramecek.prepend(canvas);
      ramecek.style.height = '';

      await stranka.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (pdfVerzeRef.current !== moje) return;

      /**
       * Textová vrstva: průhledná slova přesně nad vykresleným textem, aby
       * šla myší označit jako v každé PDF čtečce. Kreslí ji ručně z
       * getTextContent(), protože hotová TextLayer z pdf.js chce vlastní
       * stylopis a proměnnou --scale-factor — a ta se mezi verzemi mění.
       */
      const textovaVrstva = ramecek.querySelector<HTMLElement>('[data-text]');
      if (!textovaVrstva) return;
      try {
        const obsah = await stranka.getTextContent();
        if (pdfVerzeRef.current !== moje) return;
        for (const polozka of obsah.items as any[]) {
          if (!polozka.str) continue;
          const t = pdfjs.Util.transform(viewport.transform, polozka.transform);
          const vyskaPisma = Math.hypot(t[2], t[3]);
          if (!vyskaPisma) continue;
          const slovo = document.createElement('span');
          slovo.textContent = polozka.str;
          slovo.style.cssText =
            `position:absolute;white-space:pre;transform-origin:0 0;color:transparent;` +
            `left:${t[4]}px;top:${t[5] - vyskaPisma}px;font-size:${vyskaPisma}px;font-family:sans-serif;`;
          textovaVrstva.appendChild(slovo);
          // Roztazeni na spravnou sirku - nase pismo neni to z PDF, takze
          // by jinak vyber koncil jinde, nez text opravdu je.
          const sirkaNaseho = slovo.getBoundingClientRect().width;
          const sirkaVPdf = polozka.width * zvetseni;
          if (sirkaNaseho > 0 && sirkaVPdf > 0) {
            slovo.style.transform = `scaleX(${sirkaVPdf / sirkaNaseho})`;
          }
        }
      } catch {
        // Sken bez textu - zvyraznovac tam proste nebude.
      }
    }

    for (let n = 1; n <= doc.numPages; n += 1) {
      const ramecek = document.createElement('div');
      ramecek.className = 'relative shadow-md bg-white shrink-0';
      ramecek.dataset.strana = String(n);
      // Prazdny ramecek drzi misto, nez se stranka vykresli - bez toho by
      // rolovani skakalo a cislo strany ukazovalo nesmysly.
      ramecek.style.width = `${rozmer.width}px`;
      ramecek.style.height = `${rozmer.height}px`;

      const cislo = document.createElement('span');
      cislo.textContent = String(n);
      cislo.className = 'absolute top-1.5 left-1.5 bg-ink/60 text-white text-[10px] font-heading rounded px-1.5 py-0.5';
      ramecek.appendChild(cislo);

      /**
       * Vrstva se zvýrazněními (žluté obdélníky) leží NAD plátnem, ale pod
       * textem — kliká se skrz ni.
       */
      const znacky = document.createElement('div');
      znacky.dataset.znacky = '1';
      znacky.className = 'absolute inset-0 pointer-events-none';
      ramecek.appendChild(znacky);

      // Podbarveni nalezu z hledani (21. 9. 2026) - viz HledaniVPdf.
      const hledani = document.createElement('div');
      hledani.dataset.hledani = '1';
      hledani.className = 'absolute inset-0 pointer-events-none';
      ramecek.appendChild(hledani);

      const textovaVrstva = document.createElement('div');
      textovaVrstva.dataset.text = '1';
      textovaVrstva.className = 'absolute inset-0 select-text cursor-text';
      ramecek.appendChild(textovaVrstva);

      obal.appendChild(ramecek);
    }

    // Predstih 1500 px: nez clovek doroluje, je stranka hotova.
    const pozorovatel = new IntersectionObserver(
      (zaznamy) => {
        for (const z of zaznamy) {
          if (!z.isIntersecting) continue;
          const n = Number((z.target as HTMLElement).dataset.strana);
          if (n) void vykresliStranku(n);
        }
      },
      { root: pdfRolovaniRef.current, rootMargin: '1500px 0px' },
    );
    obal.querySelectorAll<HTMLElement>('[data-strana]').forEach((el) => pozorovatel.observe(el));
    pozorovatelRef.current = pozorovatel;

    // Prvni strany hned, at je po nacteni co cist i bez rolovani.
    for (let n = 1; n <= Math.min(3, doc.numPages); n += 1) await vykresliStranku(n);

    vykresliZnacky();
  }

  /**
   * Žluté obdélníky uložených zvýraznění. Kreslí se do vrstvy, kterou
   * React nikdy nesahá — stejně jako samotné stránky PDF.
   */
  const vykresliZnacky = useCallback(() => {
    const obal = pdfObalRef.current;
    if (!obal) return;
    obal.querySelectorAll<HTMLElement>('[data-znacky]').forEach((v) => v.replaceChildren());

    for (const ch of stavRef.current.chyby) {
      const z = ch.zvyrazneni;
      if (!z?.ramecky?.length) continue;
      const vrstva = obal.querySelector<HTMLElement>(`[data-strana="${z.strana}"] [data-znacky]`);
      if (!vrstva) continue;
      for (const [x, y, w, h] of z.ramecky) {
        const znacka = document.createElement('div');
        znacka.style.cssText =
          `position:absolute;left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;` +
          `background:rgba(255,214,0,0.45);border-bottom:2px solid rgba(224,138,0,0.9);border-radius:2px;`;
        znacka.title = ch.description;
        vrstva.appendChild(znacka);
      }
    }
  }, []);

  /**
   * Zvýraznění z toho, co má člověk zrovna označené myší. Souřadnice se
   * přepočítají na zlomky strany, viz typ Zvyrazneni.
   */
  function zvyrazneniZVyberu(): Zvyrazneni | null {
    const vyber = window.getSelection();
    if (!vyber || vyber.isCollapsed || vyber.rangeCount === 0) return null;
    const text = vyber.toString().trim();
    if (!text) return null;

    const rozsah = vyber.getRangeAt(0);
    const uzel = rozsah.startContainer;
    const prvek = (uzel.nodeType === 1 ? (uzel as HTMLElement) : uzel.parentElement) ?? null;
    const strankaEl = prvek?.closest<HTMLElement>('[data-strana]');
    if (!strankaEl) return null;

    const okraj = strankaEl.getBoundingClientRect();
    if (!okraj.width || !okraj.height) return null;

    const ramecky: [number, number, number, number][] = [];
    for (const r of Array.from(rozsah.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const x = (r.left - okraj.left) / okraj.width;
      const y = (r.top - okraj.top) / okraj.height;
      const w = r.width / okraj.width;
      const h = r.height / okraj.height;
      if (x < -0.05 || y < -0.05 || x > 1 || y > 1) continue;
      ramecky.push([
        Math.max(0, Math.min(1, x)),
        Math.max(0, Math.min(1, y)),
        Math.max(0, Math.min(1, w)),
        Math.max(0, Math.min(1, h)),
      ]);
      if (ramecky.length >= 200) break;
    }
    if (!ramecky.length) return null;

    return { strana: Number(strankaEl.dataset.strana), ramecky, text: text.slice(0, 2000) };
  }

  async function nactiPdfZUrl(url: string, nazev: string) {
    try {
      const pdfjs = await nactiPdfJs();
      await nastavPdfWorker(pdfjs);
      // Text stazeny na cestu se otevre z pocitace (21. 9. 2026) - PDF.js si
      // ho jinak taha po kouscich ze site.
      const ulozeny = url.startsWith('blob:') ? null : await blobZCesty(url);
      const doc = await pdfjs
        .getDocument(ulozeny ? { data: new Uint8Array(await ulozeny.arrayBuffer()) } : { url })
        .promise;
      pdfDocRef.current = doc;
      setPdfDoc(doc);
      setPdfjsLib(pdfjs);
      setPdfNazev(nazev);
      setPdfStran(doc.numPages);
      setPdfStrana(1);
      await vykresliPdf(doc);
    } catch {
      setPoznamka(t('preposlech.chybaText', { nazev }));
    }
  }

  async function nactiPdfZeSouboru(file: File) {
    const url = URL.createObjectURL(file);
    vytvoreneUrl.current.push(url);
    await nactiPdfZUrl(url, file.name);
  }

  /**
   * SKOK NA STRANU ZE ZÁLOŽKY (24. 9. 2026).
   *
   * Nejde skočit rovnou: text se stahuje a vykresluje déle, než doletí
   * záložka ze serveru, a `nactiPdfZUrl` navíc po otevření sám přepne na
   * první stranu. Číslo si proto počká tady a skočí se, teprve až je ta
   * strana opravdu v DOM.
   */
  const [cekajiciStrana, setCekajiciStrana] = useState<number | null>(null);
  useEffect(() => {
    if (!cekajiciStrana || !pdfDoc) return;
    let pokusu = 0;
    const tik = window.setInterval(() => {
      const el = pdfObalRef.current?.querySelector<HTMLElement>(`[data-strana="${cekajiciStrana}"]`);
      if (el) {
        window.clearInterval(tik);
        setPdfStrana(cekajiciStrana);
        el.scrollIntoView({ block: 'start' });
        setCekajiciStrana(null);
      } else if (++pokusu > 40) {
        // Deset vteřin a dost — ten text se nejspíš neotevřel vůbec.
        window.clearInterval(tik);
        setCekajiciStrana(null);
      }
    }, 250);
    return () => window.clearInterval(tik);
  }, [cekajiciStrana, pdfDoc]);

  function naStranu(n: number) {
    if (!pdfDocRef.current) return;
    const cil = Math.min(Math.max(1, n), pdfStran);
    setPdfStrana(cil);
    pdfObalRef.current?.querySelector(`[data-strana="${cil}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Ruční záloha, když složka projektu není po ruce. */
  function pridejStopyZeSouboru(seznam: FileList) {
    const soubory = Array.from(seznam).sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }));
    const nove: Stopa[] = soubory.map((file) => {
      const url = URL.createObjectURL(file);
      vytvoreneUrl.current.push(url);
      return { name: file.name, url, velikost: file.size, peaks: null, krivkaStav: 'ceka' as const };
    });
    setStopy((s) => {
      const dalsi = [...s, ...nove];
      stopyRef.current = dalsi;
      return dalsi;
    });
    if (aktivniRef.current === null && nove.length > 0) setTimeout(() => vyberStopu(0), 0);
  }

  /**
   * Číslo strany se musí měnit i při obyčejném rolování (zadání 11. 9. 2026:
   * „u PDF se nepřepínají strany, je pořád na straně 1, i když roluju").
   *
   * Bere se ta strana, jejíž začátek je nejníž nad horní trvetinou okna —
   * tedy ta, kterou má člověk zrovna před sebou. Počítá se v rytmu
   * překreslování, aby rolování zůstalo plynulé.
   */
  useEffect(() => {
    const box = pdfRolovaniRef.current;
    if (!box || pdfStran === 0) return;

    let tik = 0;
    const prepocti = () => {
      const stranky = pdfObalRef.current?.querySelectorAll<HTMLElement>('[data-strana]');
      if (!stranky || stranky.length === 0) return;
      const horni = box.getBoundingClientRect().top;
      const prah = box.clientHeight * 0.35;
      let nalezena = 1;
      for (let i = 0; i < stranky.length; i += 1) {
        const el = stranky[i];
        if (el.getBoundingClientRect().top - horni > prah) break;
        nalezena = Number(el.dataset.strana) || nalezena;
      }
      // Kdyz clovek zrovna pise, rolovani mu do policka nesaha.
      if (psanaStranaRef.current !== null) return;
      setPdfStrana((stara) => (stara === nalezena ? stara : nalezena));
    };

    const priRolovani = () => {
      if (tik) return;
      tik = window.requestAnimationFrame(() => {
        tik = 0;
        prepocti();
      });
    };

    box.addEventListener('scroll', priRolovani, { passive: true });
    prepocti();
    return () => {
      box.removeEventListener('scroll', priRolovani);
      if (tik) window.cancelAnimationFrame(tik);
    };
  }, [pdfStran]);

  /* ---------- záznamy chyb ---------- */

  /**
   * Zápis poznámky / úpravy / přeposlechnuto. BEZ SIGNÁLU (21. 9. 2026) se
   * zápis zařadí do fronty a změna se hned ukáže (`lokalne`) - odejde sama,
   * až se signál vrátí. `docasneId` = nová poznámka, kterou zatím ukazujeme
   * pod dočasným ID.
   */
  async function posli(
    cesta: string,
    init: RequestInit,
    offline?: { lokalne: (s: Stav) => Stav; docasneId?: string },
  ): Promise<boolean> {
    setChybaHlaska(null);
    try {
      const res = await fetch(cesta, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Offline stranka ze service workeru odpovi 503 - taky fronta.
        if (res.status === 503 && offline && !navigator.onLine) throw new TypeError('offline');
        setChybaHlaska(data?.error || t('preposlech.chybaUlozit'));
        return false;
      }
      setStav(data as Stav);
      return true;
    } catch (err) {
      if (offline && jeChybaSite(err)) {
        zarad({
          url: cesta,
          method: (init.method as ZapisVeFronte['method']) ?? 'POST',
          body: typeof init.body === 'string' ? init.body : undefined,
          docasneId: offline.docasneId,
        });
        setStav((s) => offline.lokalne(s));
        return true;
      }
      setChybaHlaska(t('preposlech.chybaUlozit'));
      return false;
    }
  }

  /**
   * Tabulka chyb ke stažení (zadání 11. 9. 2026: „udělej tlačítko, že to
   * vygeneruje ještě i tabulku s chybama pro backup").
   *
   * CSV, ne XLSX: otevře se v Excelu i v Numbers, poradí si s ním kdokoliv
   * a nepotřebuje to žádnou knihovnu navíc. Oddělovač je STŘEDNÍK a na
   * začátku je BOM — bez toho si český Excel nacpe celý řádek do jednoho
   * sloupce a zmrší diakritiku.
   *
   * Záznamy v portálu zůstávají; tohle je kopie stranou, ne přesun.
   */
  function stahniTabulku() {
    const hlavicka = [
      t('preposlech.csv.stopa'),
      t('preposlech.csv.nazevStopy'),
      t('preposlech.csv.casVeStope'),
      t('preposlech.csv.stranaTextu'),
      t('preposlech.csv.popisChyby'),
      t('preposlech.csv.zapsal'),
      t('preposlech.csv.kdy'),
    ];
    if (!jenPoslech) hlavicka.splice(3, 0, t('preposlech.csv.casVCubase'));

    const radky = stav.chyby.map((ch) => {
      const bunky = [
        pad2(ch.trackIndex),
        ch.trackName,
        cas(ch.localTime),
        ch.pdfPage != null ? String(ch.pdfPage) : '',
        ch.description,
        ch.createdByName ?? '',
        new Date(ch.createdAt).toLocaleString(kodJazyka(jazyk)),
      ];
      if (!jenPoslech) {
        bunky.splice(3, 0, hms((ch.trackIndex - 1) * DELKA_STOPY_V_CUBASE + ch.localTime));
      }
      return bunky;
    });

    // Bunku vzdycky do uvozovek - popis chyby muze obsahovat strednik
    // i konec radku a rozsypal by tabulku.
    const csv = [hlavicka, ...radky]
      .map((r) => r.map((b) => `"${String(b).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const nazev = `${projectName} - chyby ${new Date().toISOString().slice(0, 10)}.csv`
      .replace(/[\\/:*?"<>|]/g, '-');
    const odkaz = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    odkaz.href = url;
    odkaz.download = nazev;
    document.body.appendChild(odkaz);
    odkaz.click();
    odkaz.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * MARKERY DO CUBASE (zadání 18. 9. 2026: „potřebuju, abychom si v kartě
   * přeposlech mohli stáhnout jedny markery hromadně, abychom si je nasadili
   * do projektu v Cubase").
   *
   * Jeden soubor za celý projekt, ne za stopu - přesně o to šlo. Čas se počítá
   * stejně jako v tabulce: stopa 01 od nuly, každá další o hodinu dál.
   *
   * V Cubase pak: Soubor ▸ Předvolby ▸ MIDI ▸ MIDI soubor ▸ zapnout
   * „Importovat markery", a tenhle .mid naimportovat. Markery sednou na
   * vteřiny, když má projekt tempo 120 (v souboru je zapsané).
   */
  function stahniMarkery() {
    const markery = stav.chyby.map((ch) => ({
      cas: (ch.trackIndex - 1) * DELKA_STOPY_V_CUBASE + ch.localTime,
      // Cislo stopy a cas v ni - v Cubase je pak marker dohledatelny i zpetne
      // v tabulce chyb; za tim zacatek popisu, at je poznat, o co slo.
      nazev: `${pad2(ch.trackIndex)} ${cas(ch.localTime)} ${ch.description}`,
    }));
    if (markery.length === 0) return;

    const nazev = `${projectName} - markery ${new Date().toISOString().slice(0, 10)}.mid`.replace(
      /[\\/:*?"<>|]/g,
      '-',
    );
    const odkaz = document.createElement('a');
    const url = URL.createObjectURL(
      // `buffer` a ne rovnou Uint8Array - typy DOM chteji ArrayBuffer.
      new Blob([souborMarkeru(markery).buffer as ArrayBuffer], { type: 'audio/midi' }),
    );
    odkaz.href = url;
    odkaz.download = nazev;
    document.body.appendChild(odkaz);
    odkaz.click();
    odkaz.remove();
    URL.revokeObjectURL(url);
  }

  function otevriForm(zvyrazneni: Zvyrazneni | null = null, cas?: number) {
    if (aktivni === null) return;
    audioRef.current?.pause();
    const stopa = stopyRef.current[aktivni];
    setZachyt({
      trackIndex: aktivni + 1,
      trackName: stopa.name,
      localTime: cas ?? audioRef.current?.currentTime ?? 0,
      // Strana ze zvyrazneni ma prednost pred tou, na kterou je zrovna
      // odrolovane - clovek mohl oznacit text o stranu vys.
      pdfPage: zvyrazneni ? zvyrazneni.strana : pdfDocRef.current ? pdfStrana : null,
      zvyrazneni,
    });
    // Oznaceny text rovnou do popisu - nejcasteji se stejne opisuje to,
    // co herec precetl spatne.
    setPopis(zvyrazneni ? `„${zvyrazneni.text}" — ` : '');
    setFormOtevreny(true);
    setTimeout(() => {
      popisRef.current?.focus();
      const delka = popisRef.current?.value.length ?? 0;
      popisRef.current?.setSelectionRange(delka, delka);
    }, 0);
  }

  /**
   * Tažení myší po textu = označení místa chyby (zadání 11. 9. 2026).
   *
   * Čas se bere z okamžiku, kdy člověk ZAČAL táhnout — viz casVyberuRef.
   * Nahrávka se přitom zastaví, aby při psaní popisu neutíkala dál.
   */
  function vyberZacal() {
    casVyberuRef.current = audioRef.current?.currentTime ?? null;
  }

  function vyberSkoncil() {
    if (formOtevreny || aktivni === null) return;
    const zvyrazneni = zvyrazneniZVyberu();
    if (!zvyrazneni) return;
    otevriForm(zvyrazneni, casVyberuRef.current ?? undefined);
    casVyberuRef.current = null;
  }

  async function ulozChybu() {
    if (!zachyt || !popis.trim() || uklada) return;
    setUklada(true);
    const docasneId = `offline-${Date.now().toString(36)}`;
    const nova: ChybaZeServeru = {
      id: docasneId,
      ...zachyt,
      description: popis.trim(),
      createdByName: t('preposlech.cekaNaSignal'),
      createdAt: new Date().toISOString(),
      muzuUpravit: true,
    };
    const ok = await posli(
      sKlicem(zaklad),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...zachyt, description: popis.trim() }),
      },
      { docasneId, lokalne: (st) => ({ ...st, chyby: [...st.chyby, nova] }) },
    );
    setUklada(false);
    if (ok) {
      setFormOtevreny(false);
      setZachyt(null);
      setPopis('');
    }
  }

  async function smazChybu(id: string) {
    // Poznamka napsana bez signalu jeste na serveru neni - staci ji vyndat
    // z fronty.
    if (id.startsWith('offline-')) {
      nastavFrontu(frontaRef.current.filter((z) => z.docasneId !== id));
      setStav((st) => ({ ...st, chyby: st.chyby.filter((ch) => ch.id !== id) }));
      return;
    }
    await posli(
      sKlicem(`${zaklad}?chyba=${encodeURIComponent(id)}`),
      { method: 'DELETE' },
      { lokalne: (st) => ({ ...st, chyby: st.chyby.filter((ch) => ch.id !== id) }) },
    );
  }

  /**
   * Uprava zneni zaznamu (zadani 12. 9. 2026: „potrebuju, at maji jeste
   * klienti moznost upravit nebo smazat chyby").
   *
   * Meni se jen text poznamky. Stopa, cas a zvyraznene misto zustavaji -
   * to je zaznam O TOM MISTE a prepsat ho na jine by z nej udelalo jiny
   * zaznam; k tomu slouzi novy.
   */
  async function ulozUpravu(id: string) {
    const text = upravaText.trim();
    if (!text) return;
    const zmenLokalne = (st: Stav): Stav => ({
      ...st,
      chyby: st.chyby.map((ch) => (ch.id === id ? { ...ch, description: text } : ch)),
    });
    // Poznamka z fronty se opravi primo ve fronte.
    if (id.startsWith('offline-')) {
      nastavFrontu(
        frontaRef.current.map((z) => {
          if (z.docasneId !== id || !z.body) return z;
          try {
            return { ...z, body: JSON.stringify({ ...JSON.parse(z.body), description: text }) };
          } catch {
            return z;
          }
        }),
      );
      setStav(zmenLokalne);
      setUpravovana(null);
      setUpravaText('');
      return;
    }
    const ok = await posli(
      sKlicem(zaklad),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chyba: id, description: text }),
      },
      { lokalne: zmenLokalne },
    );
    if (ok) {
      setUpravovana(null);
      setUpravaText('');
    }
  }

  /**
   * Vrácení jednoho kroku v historii (zadání 12. 9. 2026: „když to bude nějaký
   * krok v editaci, tak bude možnost se do toho bodu vrátit").
   *
   * Vrací se JEDEN krok, ne stav k danému okamžiku: každý krok si nese, jak
   * poznámka vypadala před ním, a tenhle ho podle toho odčiní. Kdyby se vracel
   * „celý stav", zmizely by i poznámky, které mezitím napsal někdo jiný.
   */
  async function vratKrok(udalostId: string) {
    setChybaHlaska(null);
    try {
      const res = await fetch(sKlicem(`${zaklad}/vraceni`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ udalost: udalostId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChybaHlaska(data?.error || t('preposlech.chybaVratit'));
        return;
      }
      // Vraceni meni i seznam poznamek, takze se stav nacte cely znovu.
      const znovu = await fetch(sKlicem(zaklad));
      const novy = await znovu.json().catch(() => null);
      if (znovu.ok && novy) setStav(novy as Stav);
    } catch {
      setChybaHlaska(t('preposlech.chybaVratit'));
    }
  }

  async function prepniPreposlechnuto() {
    const reviewed = !stav.reviewed;
    await posli(
      sKlicem(zaklad),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed }),
      },
      {
        lokalne: (st) => ({
          ...st,
          reviewed,
          reviewedAt: reviewed ? new Date().toISOString() : null,
          reviewedByName: reviewed ? t('preposlech.odejdeSeSignalem') : null,
        }),
      },
    );
  }

  function skocNaChybu(ch: ChybaZeServeru) {
    const index = ch.trackIndex - 1;
    if (stopyRef.current[index]) {
      if (index !== aktivniRef.current) vyberStopu(index, ch.localTime);
      else skoc(ch.localTime);
    }
    if (ch.pdfPage) naStranu(ch.pdfPage);
  }

  // Nova nebo smazana chyba => prekreslit zlute znacky v textu.
  useEffect(() => {
    vykresliZnacky();
  }, [stav.chyby, vykresliZnacky]);

  // Prepnuti rychlosti se projevi hned, i kdyz uz stopa hraje.
  useEffect(() => {
    rychlostRef.current = rychlost;
    if (audioRef.current) audioRef.current.playbackRate = rychlost;
  }, [rychlost]);

  // Nacteni zalozky. Jen jednou pri otevreni - pozdeji uz ji prepisujeme my.
  useEffect(() => {
    let zruseno = false;
    fetch(sKlicem(`${zaklad}/pozice`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (zruseno) return;
        if (d?.postup) setPostup(d.postup);
        if (!d?.pozice) return;
        // Probarveni stop - kam az dosel minule (21. 9. 2026).
        const ulozene = d.pozice.stopyDoKam as Record<string, number> | null | undefined;
        if (ulozene && typeof ulozene === 'object') {
          const nacteno: Record<number, number> = {};
          for (const [k, v] of Object.entries(ulozene)) {
            const n = Number(k);
            if (Number.isInteger(n) && n > 0 && typeof v === 'number') nacteno[n] = Math.min(1, Math.max(0, v));
          }
          setDosazeno((dos) => {
            const spojeno = { ...nacteno };
            for (const [k, v] of Object.entries(dos)) spojeno[Number(k)] = Math.max(spojeno[Number(k)] ?? 0, v);
            return spojeno;
          });
        }
        // Prvnich par vterin neni pauza, je to zacatek - tam netreba nic
        // nabizet.
        if (d.pozice.localTime > 10 || d.pozice.trackIndex > 1) {
          setZalozka(d.pozice);
          // Kniha se otevira tam, kde je zalozka zastrcena.
          otevriZalozku();
        }
      })
      .catch(() => {});
    return () => {
      zruseno = true;
    };
  }, [sKlicem, zaklad]);

  /**
   * Zápis záložky: jednou za deset vteřin při přehrávání a při každé pauze.
   * Častěji to nemá smysl (deset vteřin nikdo nehledá) a při zavření okna
   * se stejně nic poslat nestihne — proto se píše průběžně, ne až na konci.
   */
  useEffect(() => {
    function uloz() {
      const audio = audioRef.current;
      const index = aktivniRef.current;
      if (!audio || index === null || !Number.isFinite(audio.currentTime)) return;
      // Strana PDF, na ktere clovek je - z ni se pocita procento
      // preposlechu (21. 9. 2026). Bez nacteneho textu se neposila.
      // Bez signalu pocka zapis ve fronte (klic = stopa, drzi se posledni).
      void odesliNeboZarad(
        sKlicem(`${zaklad}/pozice`),
        'PUT',
        {
          trackIndex: index + 1,
          localTime: audio.currentTime,
          // Ve fronte uz nehraje - az dojde, nikdo u toho nesedi.
          hraje: !audio.paused && navigator.onLine,
          ...(pdfStranRef.current > 0 ? { strana: pdfStranaRef.current, stran: pdfStranRef.current } : {}),
          // Kam az je stopa poslechnuta - server drzi maximum (21. 9. 2026).
          ...(dosazenoRef.current[index + 1] ? { podil: dosazenoRef.current[index + 1] } : {}),
        },
        `pozice:${index + 1}`,
      )
        .then((r) => (r && r.ok ? r.json() : null))
        .then((d) => {
          if (d?.postup) setPostup(d.postup);
        })
        .catch(() => {});
    }

    const audio = audioRef.current;
    audio?.addEventListener('pause', uloz);
    audio?.addEventListener('play', uloz);
    const tik = window.setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) uloz();
    }, 10_000);

    return () => {
      audio?.removeEventListener('pause', uloz);
      audio?.removeEventListener('play', uloz);
      window.clearInterval(tik);
    };
  }, [odesliNeboZarad, sKlicem, zaklad]);

  /** Pauza se záložkou: nahrávka stojí, obrazovka je zamčená. */
  function zaloz() {
    const audio = audioRef.current;
    const index = aktivniRef.current;
    audio?.pause();
    if (audio && index !== null && Number.isFinite(audio.currentTime)) {
      // Se stopou a časem se zapisuje i STRANA TEXTU (24. 9. 2026) — jinak
      // se člověk vrátí do správné vteřiny, ale na první stranu knihy.
      const misto = {
        trackIndex: index + 1,
        localTime: audio.currentTime,
        ...(pdfStranRef.current > 0 ? { strana: pdfStranaRef.current } : {}),
      };
      setZalozka(misto);
      void odesliNeboZarad(sKlicem(`${zaklad}/pozice`), 'PUT', misto, `pozice:${misto.trackIndex}`);
    }
    otevriZalozku();
  }

  function otevriZalozku() {
    setZalozkaZasunuta(true);
    // Dva snimky: prvni vykresli zalozku nad obrazovkou, druhy ji pusti
    // dolu. Bez toho by se objevila rovnou dole a nic by nesjelo.
    requestAnimationFrame(() => requestAnimationFrame(() => setZalozkaVysunuta(true)));
  }

  /** Vytáhnout záložku z knihy — a pokračovat přesně tam, kde vězela. */
  function pokracuj() {
    setZalozkaVysunuta(false);
    window.setTimeout(() => setZalozkaZasunuta(false), 450);
    const misto = zalozkaRef.current;
    if (misto && stopyRef.current[misto.trackIndex - 1]) {
      vyberStopu(misto.trackIndex - 1, misto.localTime);
    }
    // A text zpátky tam, kde se četlo (24. 9. 2026).
    if (misto?.strana) setCekajiciStrana(misto.strana);
  }

  function prepniCelouObrazovku() {
    const obal = celaObrazovkaRef.current;
    if (!obal) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void obal.requestFullscreen?.().catch(() => {});
  }

  // Z cele obrazovky se da odejit i Escapem, o tom nam prohlizec rekne sam.
  useEffect(() => {
    function zmena() {
      setCelaObrazovka(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', zmena);
    return () => document.removeEventListener('fullscreenchange', zmena);
  }, []);

  // Zmereni vysky sekce - viz komentar u vyskaSekce.
  //
  // MERI SE ZNOVU PRI KAZDE ZMENE ROZVRZENI (oprava 12. 9. 2026: „nejak se to
  // pokazilo v interni sekci. Nejde to vyrolovat dal dolu a je to useknute").
  // Prvni mereni probehlo drive, nez se nad mrizku vlozil odkaz pro klienta a
  // lista AudioTaggeru - sekce pak zacinala niz, nez se pocitalo, a spodek
  // zustal pod hranou okna. ResizeObserver na body chytne kazdou takovou
  // zmenu, i tu, o ktere dopredu nevime.
  useEffect(() => {
    let posledni = -1;

    function zmer() {
      const mrizka = mrizkaRef.current;
      // Na pozadi ma zalozka nulove okno - z toho by vyslo nesmyslne cislo.
      if (!mrizka || window.innerHeight < 200) return;
      if (window.innerWidth < 1280) {
        posledni = -1;
        setVyskaSekce(null);
        return;
      }
      const ramecek = mrizka.getBoundingClientRect();
      // Mimo fullscreen pocitame pozici v DOKUMENTU, ne v okne. Kdyby se
      // bralo ramecek.top, sekce by pri rolovani stranky rostla a smrskavala
      // se pod rukama.
      const horni = document.fullscreenElement ? ramecek.top : ramecek.top + window.scrollY;
      const rezerva = document.fullscreenElement ? 12 : 24;
      const vyska = Math.round(window.innerHeight - horni - rezerva);

      // Kdyz by na sekci zbyl prouzek, je poctivejsi nechat stranku rolovat
      // po starem, nez ji nacpat do vysky, ve ktere neni nic videt.
      if (vyska < 360) {
        posledni = -1;
        setVyskaSekce(null);
        return;
      }
      // Prah 2 px: vlastni zmena vysky prekresli body a spustila by tohle
      // znovu. Bez nej by se to honilo dokola.
      if (Math.abs(vyska - posledni) <= 2) return;
      posledni = vyska;
      setVyskaSekce(vyska);
    }

    zmer();
    const sledovac = new ResizeObserver(zmer);
    sledovac.observe(document.body);
    window.addEventListener('resize', zmer);
    return () => {
      sledovac.disconnect();
      window.removeEventListener('resize', zmer);
    };
  }, [celaObrazovka]);

  useEffect(() => {
    if (jenPoslech) return;
    let zruseno = false;
    async function zjisti() {
      try {
        const d = await fetch(sKlicem(`${zaklad}/pozice`)).then((r) => (r.ok ? r.json() : null));
        if (zruseno) return;
        setPosluchaci(d?.posluchaci ?? []);
        if (d?.postup) setPostup(d.postup);
      } catch {
        // Vypadek site neni duvod nic hlasit - kontrolka proste nesviti.
      }
    }
    void zjisti();
    const tik = window.setInterval(zjisti, 20_000);
    return () => {
      zruseno = true;
      window.clearInterval(tik);
    };
  }, [jenPoslech, sKlicem, zaklad]);

  /* ---------- klávesy ---------- */

  useEffect(() => {
    function stisk(e: KeyboardEvent) {
      const cil = e.target as HTMLElement | null;
      if (cil && (cil.tagName === 'INPUT' || cil.tagName === 'TEXTAREA')) return;
      // Vysunuta zalozka prehravac zamyka - klavesy delaji jen jedno.
      if (zalozkaZasunuta) {
        if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          pokracuj();
        }
        return;
      }
      if (formOtevreny) return;
      if (e.code === 'Space') {
        e.preventDefault();
        prehrajNeboPauzni();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skoc((audioRef.current?.currentTime ?? 0) + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skoc((audioRef.current?.currentTime ?? 0) - 5);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        otevriForm();
      }
    }
    window.addEventListener('keydown', stisk);
    return () => window.removeEventListener('keydown', stisk);
  });

  const chybejiciStopy = useMemo(() => {
    const nactene = new Set(stopy.map((_, i) => i + 1));
    return stav.chyby.some((ch) => !nactene.has(ch.trackIndex));
  }, [stav.chyby, stopy]);

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

  return (
    <div ref={celaObrazovkaRef} className="relative flex flex-col gap-4 bg-paper">
      {/**
       * ZÁLOŽKA PŘES OBRAZOVKU (zadání 11. 9. 2026).
       *
       * Sjede shora jako pruh papíru zastrčený do knihy, pod sebou zamkne
       * celý přeposlech (přes ni se na nic nedá kliknout) a napíše, kde se
       * skončilo. Je `fixed`, ne `absolute`: musí viset od horní hrany
       * OBRAZOVKY, ne od horní hrany odrolované karty — jinak jí špička
       * i hlavička zůstanou nad viditelnou částí stránky. Ve fullscreenu
       * se `fixed` vztahuje k té zvětšené ploše, takže to sedí i tam. Vytáhne se tlačítkem, Enterem nebo
       * Escapem — a nahrávka se rovnou nastaví na to místo.
       *
       * Špička dole je `clip-path`, ne obrázek: drží se při každé velikosti
       * okna a nemá co se rozostřit.
       */}
      {zalozkaZasunuta && (
        <div className="fixed inset-0 z-[60] flex justify-center bg-bar/80 backdrop-blur-[2px]">
          <div
            className={`w-[min(340px,80vw)] h-[70%] bg-gradient-to-b from-brand-purple to-brand-purpleDeep text-white shadow-2xl transition-transform duration-500 ease-out flex flex-col items-center px-6 pt-7 ${
              zalozkaVysunuta ? 'translate-y-0' : '-translate-y-full'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 88%, 0 100%)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mediaspace-logo-still.png" alt="Mediaspace" className="h-8 w-auto opacity-90" />
            <span className="mt-5 text-[10px] font-heading uppercase tracking-[0.28em] text-white/60">{t('preposlech.zalozka')}</span>
            <p className="mt-1 text-sm font-body text-white/80 text-center m-0 truncate max-w-full">{projectName}</p>

            <div className="mt-7 text-center">
              <span className="block text-[10px] font-heading uppercase tracking-[0.22em] text-white/50">{t('preposlech.stopa')}</span>
              <span className="block font-heading font-bold text-4xl leading-none tabular-nums mt-1">
                {zalozka ? pad2(zalozka.trackIndex) : '—'}
                <span className="text-base text-white/50">/{pad2(stopy.length)}</span>
              </span>
              <span className="block font-heading font-bold text-3xl leading-none tabular-nums mt-4">
                {zalozka ? cas(zalozka.localTime) : '—'}
              </span>
              {zalozka?.strana ? (
                <span className="block text-[11px] font-heading uppercase tracking-[0.22em] text-white/60 mt-3">
                  {t('preposlech.strana')} <b className="text-white tabular-nums">{zalozka.strana}</b>
                </span>
              ) : null}
              {zalozka && stopy[zalozka.trackIndex - 1] && (
                <span className="block text-[11px] font-body text-white/60 mt-3 truncate max-w-[240px]">
                  {stopy[zalozka.trackIndex - 1].name}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={pokracuj}
              className="mt-8 bg-brand-green text-onAccent font-heading font-bold text-sm rounded-lg px-5 py-2.5"
            >
              {t('preposlech.pokracovatOdtud')}
            </button>
            <span className="mt-2 text-[11px] font-body text-white/50">
              {t('preposlech.neboEnterEsc')}
            </span>
          </div>
        </div>
      )}

      {/* Prehravac sam o sobe nic nekresli - zvuk tece proudem z Disku. */}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration || 0;
          setDelka(d);
          // Délku hrané stopy máme z první ruky - ať se nezjišťuje podruhé
          // (25. 9. 2026).
          if (aktivni !== null && d > 0) setDelkyStop((p) => ({ ...p, [aktivni + 1]: d }));
        }}
        onTimeUpdate={(e) => setPozice(e.currentTarget.currentTime)}
        onPlay={() => setHraje(true)}
        onPause={() => setHraje(false)}
        onEnded={() => {
          setHraje(false);
          // Dojelo to na konec - stopa je poslechnuta (zadani 12. 9. 2026).
          if (aktivniRef.current !== null) {
            const poradi = aktivniRef.current + 1;
            // Cela zelena (21. 9. 2026) - i kdyby posledni vterina
            // proklouzla mezi dvema timeupdate.
            setDosazeno((d) => ({ ...d, [poradi]: 1 }));
            dosazenoRef.current = { ...dosazenoRef.current, [poradi]: 1 };
            nahlasDoposlechnuto(aktivniRef.current);
            const audio = audioRef.current;
            void odesliNeboZarad(
              sKlicem(`${zaklad}/pozice`),
              'PUT',
              {
                trackIndex: poradi,
                localTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
                hraje: false,
                podil: 1,
              },
              `pozice:${poradi}`,
            );
          }
        }}
        onError={() => setChybaHlaska(t('preposlech.chybaStopa'))}
        className="hidden"
      />

      <div className="bg-brand-purple text-white rounded-card px-4 py-1.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {/**
           * Logo Mediaspace (zadání 11. 9. 2026). Klient se sem dostane
           * z mailu na celou obrazovku, takže tahle lišta je jediné místo,
           * kde pozná, čí nástroj to vlastně je.
           *
           * A HÝBE SE, JEN KDYŽ SE HRAJE (zadání 11. 9. 2026: „když nebude
           * nic hrát, tak bude to logo statické a s play se pak začne
           * hýbat"). Animovaný GIF se zastavit nedá, tak se prohodí za
           * obrázek jednoho snímku — a při návratu k GIFu animace naskočí
           * od začátku, což se k rozjezdu hodí.
           */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hraje ? '/mediaspace-logo.gif' : '/mediaspace-logo-still.png'}
            alt="Mediaspace"
            className="h-7 w-auto shrink-0"
          />
          <span className="w-px h-6 bg-white/30 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex items-baseline gap-2">
            <h2 className="font-heading font-semibold text-xs uppercase tracking-wide m-0">AudioTagger</h2>
            <p className="text-[11px] font-body text-white/70 m-0 truncate">{projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[11px] font-heading text-white/80">
            {t('preposlech.popisekStop')} <b className="text-white">{stopy.length}</b> ·{' '}
            {t('preposlech.popisekChyb')} <b className="text-white">{stav.chyby.length}</b> ·{' '}
            {t('preposlech.popisekText')} <b className="text-white">{pdfNazev || '—'}</b>
          </span>
          {/* PROCENTO PŘEPOSLECHU (zadání 21. 9. 2026: „potřeboval bych, aby
              se mu ukazovala procenta, kolik má přeposlechnuto ... celkový
              počet stran / kde zrovna je"). Podle stran PDF, ne podle stop -
              ty chodí po kouscích. Vidí to klient i my. */}
          {pdfStran > 0 && (
            <span
              className="flex items-center gap-2 text-[11px] font-heading text-white/80"
              title={
                postup
                  ? t(jenPoslech ? 'preposlech.postupJa' : 'preposlech.postupKlient', {
                      slyseno: postup.slyseno,
                      stran: postup.stran,
                    })
                  : t('preposlech.postupBezDat')
              }
            >
              <span className="w-16 h-1.5 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
                <span className="block h-full bg-brand-green" style={{ width: `${postup?.procent ?? 0}%` }} />
              </span>
              <span>
                {jenPoslech ? t('preposlech.stitekPreposlechnuto') : t('preposlech.stitekKlient')}{' '}
                <b className="text-white tabular-nums">{postup?.procent ?? 0} %</b>
                {' · '}
                {t('preposlech.strana')} <b className="text-white tabular-nums">{pdfStrana}</b>{' '}
                {t('obecne.z')} {pdfStran}
              </span>
            </span>
          )}
          <span className="text-[11px] font-heading text-white/60 hidden xl:inline">
            {t('preposlech.klavesy')}
          </span>
          {/* Kontrolka „nekdo posloucha" - jen pro nas, klient ji nevidi. */}
          {posluchaci.length > 0 && (
            <span
              title={posluchaci
                .map((p) =>
                  t('preposlech.posluchacNapoveda', {
                    jmeno: p.jmeno,
                    stopa: pad2(p.trackIndex),
                    cas: cas(p.localTime),
                  }),
                )
                .join('\n')}
              className="flex items-center gap-1.5 text-[11px] font-heading font-semibold bg-brand-green/20 text-white rounded-pill px-2.5 py-1"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-brand-green opacity-70 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-green" />
              </span>
              {posluchaci.length === 1
                ? t('preposlech.jedenPoslouchaJmeno', {
                    jmeno: posluchaci[0].jmeno,
                    stopa: pad2(posluchaci[0].trackIndex),
                  })
                : t('preposlech.viceLidi', { pocet: posluchaci.length })}
            </span>
          )}

          {/* Kdo posloucha a komu chodi zpravy o novych stopach (zadani
              21. 9. 2026). Klientovi z odkazu pri prvnim otevreni vyskoci
              okno na e-mail. */}
          {/* Na cestu / offline (21. 9. 2026). */}
          <NaCestu
            soubory={[
              ...stopy
                .filter((st) => !st.url.startsWith('blob:'))
                .map((st) => ({ url: st.url, velikost: st.velikost, nazev: st.name })),
              ...(textUrl ? [{ url: textUrl, velikost: null, nazev: pdfNazev || t('preposlech.textPdf') }] : []),
            ]}
            stazene={stazene}
            onStazene={(nove) => {
              stazeneRef.current = nove;
              setStazene(nove);
            }}
            online={online}
            cekaZapisu={fronta.length}
            onOdeslat={() => void odesliFrontu()}
          />
          <PosluchaciPreposlechu
            zaklad={zaklad}
            sKlicem={sKlicem}
            jenPoslech={jenPoslech}
            onZmena={() => {
              // Historie - pridani a predani se do ni zapisuje.
              void fetch(sKlicem(zaklad))
                .then((r) => (r.ok ? r.json() : null))
                .then((novy) => {
                  if (novy) setStav(novy as Stav);
                })
                .catch(() => {});
            }}
          />
          {/* Na celou obrazovku (zadani 11. 9. 2026). U 330stranneho textu
              a dvanacti stop je kazdy pixel k uzitku. */}
          <button
            type="button"
            onClick={prepniCelouObrazovku}
            title={
              celaObrazovka
                ? t('preposlech.zpetDoOknaNapoveda')
                : t('preposlech.naCelouObrazovkuNapoveda')
            }
            className="font-heading font-semibold text-[11px] rounded-lg border border-white/40 px-2.5 py-1 hover:border-white transition-colors"
          >
            {celaObrazovka ? t('preposlech.zpetDoOkna') : t('preposlech.naCelouObrazovku')}
          </button>
          {/* PŘEPOSLECHNUTO je velká akce - tímhle se za nahrávku někdo
              postaví (zadání 11. 9. 2026: „to tlačítko přeposlechnuto by
              mělo asi být výraznější, je to velká akce"). Proto plné
              tlačítko, ne obtažený proužek, a odškrtnutí se ptá.

              VIDÍ HO I KLIENT (zadání 12. 9. 2026: „na straně klienta není
              možnost označit jako přeposlechnuté, mělo by to být asi vy").
              Je to jeho slovo, že nahrávku poslechl; u záznamu zůstane jméno,
              takže je pořád vidět, kdo to odškrtl. */}
          {(stav.reviewed ? (
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-2 bg-brand-green text-onAccent font-heading font-bold text-sm rounded-lg px-4 py-2.5">
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-onAccent/15">✓</span>
                  {t('preposlech.stitekPreposlechnuto')}
                </span>
                <span className="text-[11px] font-body text-white/70 leading-tight">
                  {stav.reviewedByName ?? 'Mediaspace'}
                  {stav.reviewedAt && (
                    <>
                      <br />
                      {new Date(stav.reviewedAt).toLocaleDateString(kodJazyka(jazyk))}
                    </>
                  )}
                </span>
                {rusiPreposlech ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRusiPreposlech(false);
                        void prepniPreposlechnuto();
                      }}
                      className="font-heading font-semibold text-xs rounded-lg bg-white text-brand-purpleDeep px-3 py-1.5"
                    >
                      {t('preposlech.opravduZrusit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRusiPreposlech(false)}
                      className="font-heading text-xs text-white/70 hover:text-white"
                    >
                      {t('obecne.ne')}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRusiPreposlech(true)}
                    title={t('preposlech.zrusitOznaceni')}
                    className="font-heading text-xs text-white/60 hover:text-white underline"
                  >
                    {t('preposlech.zrusitMale')}
                  </button>
                )}
              </span>
            ) : potvrzujePreposlech ? (
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-body text-white/85">
                  {t('preposlech.opravduOznacit')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPotvrzujePreposlech(false);
                    void prepniPreposlechnuto();
                  }}
                  className="flex items-center gap-2 bg-brand-green text-onAccent font-heading font-bold text-sm rounded-lg px-4 py-2 shadow-sm"
                >
                  {t('preposlech.anoPreposlechnuto')}
                </button>
                <button
                  type="button"
                  onClick={() => setPotvrzujePreposlech(false)}
                  className="font-heading text-xs text-white/70 hover:text-white"
                >
                  {t('obecne.ne')}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPotvrzujePreposlech(true)}
                className="flex items-center gap-2 bg-white text-brand-purpleDeep font-heading font-bold text-sm rounded-lg px-5 py-2.5 shadow-sm hover:bg-brand-green hover:text-onAccent transition-colors"
              >
                <span className="grid place-items-center w-5 h-5 rounded border-2 border-current" aria-hidden="true" />
                {t('preposlech.oznacitPreposlechnute')}
              </button>
            ))}
        </div>
      </div>

      {chybaHlaska && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{chybaHlaska}</p>
      )}
      {poznamka && (
        <p className="text-xs font-body text-status-progress bg-warnTint border border-line rounded-lg px-4 py-2.5 m-0">
          {poznamka}
        </p>
      )}

      <div
        ref={mrizkaRef}
        className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4 items-stretch"
        style={vyskaSekce ? { height: vyskaSekce } : undefined}
      >
        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-line">
            <span className="text-sm font-heading text-ink truncate">
              {pdfNazev || t('preposlech.textNahravky')}
            </span>
            {!jenPoslech && (
              <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                {t('preposlech.nacistJinePdf')}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void nactiPdfZeSouboru(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {/* Hledani v textu (21. 9. 2026: „v PDF bych chtel
                sofistikovanejsi vyhledavani slov"). */}
            <HledaniVPdf doc={pdfDoc} pdfjs={pdfjsLib} obalRef={pdfObalRef} />
            {pdfStran > 0 && (
              <span className="flex items-center gap-1.5 ml-auto">
                <button type="button" onClick={() => naStranu(pdfStrana - 1)} className="text-muted hover:text-brand-purple px-1.5">
                  ◂
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t('preposlech.cisloStrany')}
                  value={psanaStrana ?? String(pdfStrana)}
                  onFocus={(e) => {
                    setPsanaStrana(String(pdfStrana));
                    e.currentTarget.select();
                  }}
                  onChange={(e) => setPsanaStrana(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setPsanaStrana(null);
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={() => {
                    const cislo = Number(psanaStrana);
                    setPsanaStrana(null);
                    if (psanaStrana && Number.isFinite(cislo) && cislo > 0) naStranu(cislo);
                  }}
                  className={`${inputClass} w-16 text-center tabular-nums py-1`}
                />
                <span className="text-xs font-heading text-muted tabular-nums">/ {pdfStran}</span>
                <button type="button" onClick={() => naStranu(pdfStrana + 1)} className="text-muted hover:text-brand-purple px-1.5">
                  ▸
                </button>
              </span>
            )}
          </div>
          <div
            ref={pdfRolovaniRef}
            className={`bg-field overflow-y-auto p-4 flex flex-col items-center gap-4 ${vyskaSekce ? 'flex-1 min-h-0' : ''}`}
            style={vyskaSekce ? undefined : { height: '72vh' }}
          >
            {pdfStran === 0 && (
              <p className="text-sm font-body text-muted m-auto text-center max-w-[300px]">
                {zDisku === 'nacitam' ? t('preposlech.nacitamText') : t('preposlech.bezTextu')}
              </p>
            )}
            {/* Stranky PDF kresli pdf.js primo do DOM, ne React. Musi proto mit
                vlastni div, do ktereho React nikdy zadne dite nevlozi - viz
                komentar u vykresliPdf(). */}
            <div
              ref={pdfObalRef}
              onMouseDown={vyberZacal}
              onMouseUp={vyberSkoncil}
              onTouchStart={vyberZacal}
              onTouchEnd={vyberSkoncil}
              className="w-full flex flex-col items-center gap-4"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          {/* V pravem sloupci zustava UZ JEN PREHRAVAC A STOPY (zadani
              12. 9. 2026: „vlevo bude pdf s textem a v te cele prave casti
              bude jen prehravac s displejem a pod tim tracky"). Seznam
              poznamek a historie se vysouvaji z prave hrany. */}
          <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            {/* Displej je zámerně na JEDEN ŘÁDEK (zadání 11. 9. 2026: „ten
                display už zabírá dost místa, celé bych to hodně zmenšil").
                Číslo stopy a čas zůstávají to největší na něm — na ně se
                člověk dívá od stolu; název stopy je drobným písmem vedle. */}
            <div className="rounded-card bg-brand-purpleDark text-white px-3 py-2 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={prehrajNeboPauzni}
                disabled={aktivni === null}
                title={t('preposlech.prehratPauza')}
                className="shrink-0 w-9 h-9 rounded-full bg-brand-green text-onAccent font-heading font-bold disabled:opacity-40"
              >
                {hraje ? '❚❚' : '▶'}
              </button>

              <span className="font-heading font-bold text-xl leading-none tabular-nums">
                {aktivni === null ? '—' : pad2(aktivni + 1)}
                <span className="text-xs font-semibold text-white/60">/{pad2(stopy.length)}</span>
              </span>

              <span className="font-heading font-bold text-xl leading-none tabular-nums">
                {cas(pozice)}
                <span className="text-xs font-semibold text-white/60">
                  {' '}
                  {t('obecne.z')} {cas(delka)}
                </span>
              </span>

              {aktivni !== null && stopy[aktivni] && (
                <span className="text-[11px] font-body text-white/60 truncate max-w-[160px] hidden sm:inline">
                  {stopy[aktivni].name}
                </span>
              )}

              <span className="flex items-center gap-1">
                {RYCHLOSTI.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRychlost(r)}
                    title={t('preposlech.rychlost', { r })}
                    className={`font-heading font-semibold text-[11px] tabular-nums rounded px-1.5 py-0.5 transition-colors ${
                      r === rychlost ? 'bg-brand-green text-onAccent' : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </span>

              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={zaloz}
                  disabled={aktivni === null}
                  title={t('preposlech.pauzaNapoveda')}
                  className="font-heading font-semibold text-xs rounded-lg border border-white/40 px-2.5 py-1.5 hover:border-white transition-colors disabled:opacity-40"
                >
                  {t('preposlech.pauza')}
                </button>
                <button
                  type="button"
                  onClick={() => otevriForm()}
                  disabled={aktivni === null || formOtevreny}
                  className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  {t('preposlech.pridatChybu')}
                </button>
              </span>
            </div>
            {aktivni !== null && !jenPoslech && (
              <p className="text-[11px] font-heading text-muted m-0 tabular-nums">
                {t('preposlech.offsetCubase', { cas: hms(aktivni * DELKA_STOPY_V_CUBASE) })}
              </p>
            )}

            {formOtevreny && zachyt && (
              <div className="border border-brand-purple bg-tint rounded-lg p-3 flex flex-col gap-2">
                <p className="text-xs font-heading text-muted m-0">
                  {t('preposlech.stopa')} <b className="text-ink">{pad2(zachyt.trackIndex)}</b> ·{' '}
                  {t('preposlech.f.cas')}{' '}
                  <b className="text-ink tabular-nums">{cas(zachyt.localTime)}</b> ·{' '}
                  {t('preposlech.strana')}{' '}
                  <b className="text-ink">{zachyt.pdfPage ?? t('preposlech.textNenacteny')}</b>
                  {zachyt.zvyrazneni && (
                    <>
                      {' '}
                      ·{' '}
                      <span className="bg-warnTint text-ink rounded px-1">
                        {t('preposlech.zvyraznenoVTextu')}
                      </span>
                    </>
                  )}
                </p>
                <textarea
                  ref={popisRef}
                  value={popis}
                  onChange={(e) => setPopis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void ulozChybu();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setFormOtevreny(false);
                    }
                  }}
                  rows={2}
                  placeholder={t('preposlech.popisPlaceholder')}
                  className={`${inputClass} w-full resize-none`}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setFormOtevreny(false)} className="text-sm font-heading text-muted hover:text-ink">
                    {t('obecne.zrusit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void ulozChybu()}
                    disabled={uklada || !popis.trim()}
                    className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    {uklada ? t('obecne.ukladam') : t('preposlech.ulozitChybu')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`bg-surface rounded-card border border-line shadow-sm overflow-hidden ${vyskaSekce ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3 flex-wrap shrink-0">
              <span className="flex items-center gap-2.5 flex-wrap min-w-0">
                <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">{t('preposlech.zvukoveStopy')}</h3>
                {/* Kolik toho zbývá doposlechnout (25. 9. 2026). */}
                {stopy.length > 0 && (
                  <span
                    title={
                      zbyva.uplne
                        ? t('preposlech.zbyvaDoposlechnout')
                        : t('preposlech.zbyvaPocitam')
                    }
                    className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-heading font-semibold ${
                      zbyva.sekundy < 1 && zbyva.uplne
                        ? 'bg-okTint text-status-done'
                        : 'bg-tint text-brand-purple'
                    }`}
                  >
                    {zbyva.sekundy < 1 && zbyva.uplne ? (
                      t('preposlech.zbyvaVse')
                    ) : (
                      <>
                        <span className="font-normal text-muted">{t('preposlech.zbyvaDoposlechnout')}</span>
                        <span className="tabular-nums">{hms(zbyva.sekundy)}</span>
                        {!zbyva.uplne && <span className="text-muted">…</span>}
                      </>
                    )}
                  </span>
                )}
              </span>
              {!jenPoslech && (
                <span className="flex items-center gap-3">
                  {slozkaUrl && (
                    <a href={slozkaUrl} target="_blank" rel="noreferrer" className="text-xs font-heading text-brand-purple no-underline hover:underline">
                      {t('preposlech.slozkaNaDisku')}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void nactiZDisku()}
                    disabled={zDisku === 'nacitam'}
                    className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-50"
                  >
                    {zDisku === 'nacitam' ? t('obecne.nacitam') : t('preposlech.nacistZDiskuZnovu')}
                  </button>
                  <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                    {t('preposlech.zeSouboru')}
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) pridejStopyZeSouboru(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </span>
              )}
            </div>
            <div
              className={`p-3 flex flex-col gap-2 overflow-y-auto ${vyskaSekce ? 'flex-1 min-h-0' : ''}`}
              style={vyskaSekce ? undefined : { maxHeight: '34vh' }}
            >
              {stopy.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-1 py-5 text-center">
                  {zDisku === 'nacitam' ? t('preposlech.nacitamStopy') : t('preposlech.bezStop')}
                </p>
              ) : (
                stopy.map((stopa, index) => {
                  // Odskrtnuta stopa je zelena (zadani 14. 9. 2026: „takto
                  // zaskrtnuty by mohl treba zmenit barvu"). Zelena vyhrava
                  // i nad fialovou u prave hrane stopy - jinak by hotova
                  // stopa pri kliknuti zdanlive zase zezelenala zpatky.
                  const jeHotova = hotoveStopy.has(index + 1);
                  return (
                  <div
                    key={`${index}-${stopa.name}`}
                    // shrink-0 je tu povinne: seznam je flex sloupec s pevnou
                    // maximalni vyskou, takze bez nej flexbox radky SMRSKNE misto
                    // toho, aby je nechal prescnout a rolovat. Pri dvanacti
                    // stopach z nich byly 12px prouzky (11. 9. 2026).
                    className={`shrink-0 rounded-lg border overflow-hidden ${
                      jeHotova
                        ? index === aktivni
                          ? 'border-status-done bg-okTint'
                          : 'border-status-done/50 bg-okTint'
                        : index === aktivni
                          ? 'border-brand-purple bg-tint'
                          : 'border-line bg-surface'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 pl-2.5">
                      {/* Zaskrtavatko stoji VEDLE tlacitka, ne v nem - odskrtnuti
                          stopy nesmi zaroven prepnout prehravani. */}
                      <input
                        type="checkbox"
                        checked={jeHotova}
                        onChange={() => prepniHotovo(index)}
                        title={
                          jeHotova
                            ? t('preposlech.stopaHotovaNapoveda')
                            : t('preposlech.oznacitHotovou')
                        }
                        aria-label={t('preposlech.stopaHotovaPopis', { cislo: pad2(index + 1) })}
                        className="w-3.5 h-3.5 shrink-0 accent-status-done cursor-pointer"
                      />
                    <button
                      type="button"
                      onClick={() =>
                        // Stopa se zalozkou se otevre rovnou tam, kde se
                        // skoncilo - presne jako kdyz se kniha otevre na
                        // zalozce.
                        vyberStopu(index, zalozka?.trackIndex === index + 1 ? zalozka.localTime : undefined)
                      }
                      className="flex-1 min-w-0 flex items-center gap-2 pr-3 py-1.5 text-left"
                    >
                      <span className="text-[11px] font-heading font-bold tabular-nums bg-field rounded px-1.5 py-0.5">{pad2(index + 1)}</span>
                      <span className="flex-1 min-w-0 text-xs font-body text-ink truncate">{stopa.name}</span>
                      {/* Celkový čas stopy (25. 9. 2026). */}
                      {delkyStop[index + 1] ? (
                        <span
                          title={t('preposlech.delkaStopy')}
                          className="shrink-0 text-[10px] font-heading text-muted tabular-nums"
                        >
                          {hms(delkyStop[index + 1])}
                        </span>
                      ) : null}
                      {/**
                       * Záložka jako v knize (zadání 11. 9. 2026: „pracoval
                       * bych s tím jako s fyzickou záložkou v knize").
                       *
                       * Předtím to byl proužek přes celou šířku nad
                       * přehrávačem — velký a pořád na očích, i když ho
                       * člověk nepotřeboval. Teď je to stužka u té jedné
                       * stopy, ve které se skončilo, plus tenká čárka na
                       * křivce přesně v tom místě. Kdo si pauzu nedal, ani
                       * si jí nevšimne.
                       */}
                      {zalozka?.trackIndex === index + 1 && (
                        <span
                          title={t('preposlech.zalozkaNapoveda', { cas: cas(zalozka.localTime) })}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-heading font-semibold text-status-progress"
                        >
                          <span aria-hidden="true">🔖</span>
                          <span className="tabular-nums">{cas(zalozka.localTime)}</span>
                        </span>
                      )}
                      {/* Kolik ze stopy uz slysel (21. 9. 2026). */}
                      {(dosazeno[index + 1] ?? 0) >= 0.995 ? (
                        <span className="shrink-0 text-[10px] font-heading font-semibold text-status-done" title={t('preposlech.poslechnutaCela')}>
                          {t('preposlech.poslechnutoStitek')}
                        </span>
                      ) : (dosazeno[index + 1] ?? 0) > 0.01 ? (
                        <span className="shrink-0 text-[10px] font-heading text-muted tabular-nums" title={t('preposlech.kolikPoslechnuto')}>
                          {Math.floor((dosazeno[index + 1] ?? 0) * 100)} %
                        </span>
                      ) : null}
                      {stopa.krivkaStav === 'pocita' && <span className="text-[10px] font-heading text-muted">{t('preposlech.kreslimKrivku')}</span>}
                      {!jenPoslech && (
                        <span className="text-[10px] font-heading text-muted tabular-nums">+{hms(index * DELKA_STOPY_V_CUBASE)}</span>
                      )}
                    </button>
                    </div>
                    <canvas
                      data-stopa={index}
                      className="w-full h-[56px] block bg-field cursor-pointer"
                      onClick={(e) => {
                        const ramecek = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - ramecek.left;
                        if (index !== aktivni) {
                          vyberStopu(index);
                          return;
                        }
                        const trvani = audioRef.current?.duration;
                        if (!trvani || !Number.isFinite(trvani)) return;
                        const trefa = stav.chyby.find(
                          (ch) => ch.trackIndex === index + 1 && Math.abs((ch.localTime / trvani) * ramecek.width - x) < 6,
                        );
                        if (trefa) {
                          skocNaChybu(trefa);
                          return;
                        }
                        skoc((x / ramecek.width) * trvani);
                      }}
                    />
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ZAZNAMY A HISTORIE SE VYSOUVAJI Z PRAVE HRANY - PRESNE JAKO CHAT
            A UKOLY (zadani 12. 9. 2026: „to zatahovani zaznamu chyb delal
            uplne stejne, jako mame ten chat a ukoly. A jeste bych to vice
            roztahl doleva cele a klidne at to zabere celou tu pravou cast
            obrazovky, az na hranu okna pdf").

            Dok proto sedi UVNITR mrizky: pravou hranu ma spolecnou s pravym
            sloupcem a leva hrana - siroky pruh na zavreni, do male sipky se
            spatne trefuje - dosedne presne na hranu okna s textem. Prekryje
            tedy prehravac i stopy, ne text. A protoze je uvnitr sekce, jede
            i na celou obrazovku, kde by okenni panel nebyl videt. */}
        {!zaznamyOtevrene ? (
          <button
            type="button"
            onClick={() => setZaznamyOtevrene(true)}
            title={t('preposlech.zobrazitZaznamy')}
            aria-label={t('preposlech.zobrazitZaznamy')}
            className="absolute top-6 right-0 z-30 flex flex-col items-center gap-2.5 rounded-l-card bg-brand-purple hover:bg-brand-purpleDeep text-brand-green shadow-lg px-2.5 py-3 transition-colors"
          >
            <SipkaDoku smer="left" />
            {stav.chyby.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
                {stav.chyby.length}
              </span>
            )}
            <span className="text-[10px] font-heading font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
              {t('preposlech.zaznamy')}
            </span>
          </button>
        ) : (
          <aside className="absolute top-0 right-0 bottom-0 z-30 w-[min(552px,100%)] flex items-stretch">
            {/* Stejne siroky pruh na zavreni jako u chatu a ukolu. */}
            <button
              type="button"
              onClick={() => setZaznamyOtevrene(false)}
              title={t('preposlech.skrytZaznamy')}
              aria-label={t('preposlech.skrytZaznamy')}
              className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
            >
              <SipkaDoku smer="right" />
              <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
                {t('obecne.skryt')}
              </span>
              <SipkaDoku smer="right" />
            </button>
              <div className="flex-1 min-w-0 bg-surface border border-line rounded-r-card shadow-xl flex flex-col overflow-hidden">
                {/* Zalozky jako u Ukolu a chatu (zadani 12. 9. 2026). Chyby
                    a historie sdileji jedno misto, takze na prehravac a stopy
                    zbyde vic. */}
                <div className="px-2 pt-2 border-b border-line flex items-end gap-1">
                  {([
                    {
                      klic: 'chyby' as const,
                      popisek: t('preposlech.zalozkaChyby', { pocet: stav.chyby.length }),
                    },
                    { klic: 'historie' as const, popisek: t('preposlech.zalozkaHistorie') },
                  ]).map((z) => (
                    <button
                      key={z.klic}
                      type="button"
                      onClick={() => setPanel(z.klic)}
                      aria-pressed={panel === z.klic}
                      className={`rounded-t-lg px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
                        panel === z.klic
                          ? 'bg-tint text-brand-purpleDark'
                          : 'text-muted hover:text-ink hover:bg-field'
                      }`}
                    >
                      {z.popisek}
                    </button>
                  ))}
                  <span className="ml-auto flex items-center gap-3 pb-1.5 pr-2">
                    {panel === 'chyby' && chybejiciStopy && (
                      <span className="text-[11px] font-body text-status-progress">
                        {t('preposlech.chybejiciStopy')}
                      </span>
                    )}
                    {panel === 'chyby' && !jenPoslech && (
                      <button
                        type="button"
                        onClick={stahniMarkery}
                        disabled={stav.chyby.length === 0}
                        title={t('preposlech.markeryNapoveda')}
                        className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {t('preposlech.markery')}
                      </button>
                    )}
                    {panel === 'chyby' && (
                      <button
                        type="button"
                        onClick={stahniTabulku}
                        disabled={stav.chyby.length === 0}
                        title={t('preposlech.tabulkaNapoveda')}
                        className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {t('preposlech.stahnoutTabulku')}
                      </button>
                    )}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {panel === 'historie' ? (
                    <Historie zaznamy={stav.historie ?? []} onVratit={(id) => void vratKrok(id)} />
                  ) : stav.chyby.length === 0 ? (
                    <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
                      {t('preposlech.zadneChyby')}
                    </p>
                  ) : (
                    <ul className="list-none m-0 p-0 divide-y divide-line">
                      {stav.chyby.map((ch) => (
                        <li key={ch.id} className="px-4 py-2.5 hover:bg-surfaceSoft">
                          {upravovana === ch.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={upravaText}
                                onChange={(e) => setUpravaText(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full rounded-lg border border-brand-purple bg-field px-3 py-2 text-sm font-body text-ink outline-none resize-y"
                              />
                              <span className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => void ulozUpravu(ch.id)}
                                  disabled={!upravaText.trim()}
                                  className="rounded-lg bg-brand-purple text-white text-xs font-heading font-semibold px-3 py-1.5 disabled:opacity-40"
                                >
                                  {t('obecne.ulozit')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUpravovana(null)}
                                  className="text-xs font-heading text-muted hover:text-ink"
                                >
                                  {t('obecne.zrusit')}
                                </button>
                              </span>
                            </div>
                          ) : (
                          <div className="flex items-start gap-3">
                          <button type="button" onClick={() => skocNaChybu(ch)} className="flex-1 min-w-0 text-left" title={t('preposlech.skocit')}>
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-heading font-semibold tabular-nums bg-field border border-line rounded px-1.5">
                                {pad2(ch.trackIndex)}
                              </span>
                              <span className="text-xs font-heading text-muted tabular-nums">{cas(ch.localTime)}</span>
                              {ch.pdfPage && (
                                <span className="text-xs font-heading text-muted tabular-nums">
                                  {t('preposlech.stranaZkratka', { strana: ch.pdfPage })}
                                </span>
                              )}
                              {ch.zvyrazneni && (
                                <span className="text-[11px] font-heading bg-warnTint text-ink rounded px-1.5" title={ch.zvyrazneni.text}>
                                  {t('preposlech.vTextu')}
                                </span>
                              )}
                              {!jenPoslech && (
                                <span className="text-[11px] font-heading text-muted/70 tabular-nums">
                                  Cubase {hms((ch.trackIndex - 1) * DELKA_STOPY_V_CUBASE + ch.localTime)}
                                </span>
                              )}
                            </span>
                            <span className="block text-sm font-body text-ink mt-0.5 break-words">{ch.description}</span>
                            {ch.createdByName && <span className="block text-[11px] font-body text-muted mt-0.5">{ch.createdByName}</span>}
                          </button>
                          {/* Upravit a smazat jen tam, kde to server dovoli
                              (zadani 12. 9. 2026) - klient svoje, tym vsechno.
                              U cizich zaznamu tlacitka radeji nejsou, nez aby
                              po kliknuti hlasila, ze to nejde. */}
                          {ch.muzuUpravit && (
                            <span className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setUpravovana(ch.id);
                                  setUpravaText(ch.description);
                                }}
                                title={t('preposlech.upravitZneni')}
                                aria-label={t('preposlech.upravitZneni')}
                                className="text-muted hover:text-brand-purple text-sm"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => void smazChybu(ch.id)}
                                title={t('preposlech.smazatZaznam')}
                                aria-label={t('preposlech.smazatZaznam')}
                                className="text-muted hover:text-danger text-sm"
                              >
                                ✕
                              </button>
                            </span>
                          )}
                          </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Sipka doku - stejna jako u chatu a ukolu, at se to chova jako jeden dum. */
function SipkaDoku({ smer }: { smer: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d={smer === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  );
}

/**
 * Historie přeposlechu (zadání 12. 9. 2026: „možná mohlo být dobré mít nějakou
 * historii").
 *
 * Je to stopa toho, co se s nahrávkou dělo — kdo odkaz otevřel, kdo přidal
 * nebo opravil poznámku, kdo odškrtl přeposlechnuto. Zůstává, i když se
 * poznámka mezitím smaže; právě proto to není spočítané ze záznamů chyb.
 */
function Historie({ zaznamy, onVratit }: { zaznamy: Udalost[]; onVratit: (id: string) => void }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  if (zaznamy.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
        {t('preposlech.historiePrazdna')}
      </p>
    );
  }

  return (
    <ul className="list-none m-0 p-0 divide-y divide-line">
      {zaznamy.map((u) => (
        <li key={u.id} className="px-4 py-2 flex items-start gap-3">
          <span
            className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
              u.typ === 'PREPOSLECHNUTO'
                ? 'bg-brand-green'
                : u.typ === 'SMAZANA'
                  ? 'bg-danger'
                  : u.typ === 'OTEVRENO' || u.typ === 'POSLUCHAC' || u.typ === 'NOVE_STOPY'
                    ? 'bg-brand-purple'
                    : 'bg-line'
            }`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-body text-ink break-words">{u.popis}</span>
            {/* Vratit jde jen krok nad poznamkou, na kterou dotycny smi -
                a jen jednou (zadani 12. 9. 2026). */}
            {u.muzuVratit && (
              <button
                type="button"
                onClick={() => onVratit(u.id)}
                title={t('preposlech.vratitKrokNapoveda')}
                className="mt-1 text-[11px] font-heading font-semibold text-brand-purple hover:underline"
              >
                {t('preposlech.vratitDoBodu')}
              </button>
            )}
            <span className="block text-[11px] font-body text-muted mt-0.5">
              {u.kdo ? `${u.kdo} · ` : ''}
              {new Date(u.kdy).toLocaleString(kodJazyka(jazyk), {
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
