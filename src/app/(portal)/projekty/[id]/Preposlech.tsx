'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';

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
};

type Stav = {
  reviewed: boolean;
  reviewedByName: string | null;
  reviewedAt: string | null;
  chyby: ChybaZeServeru[];
  historie?: Udalost[];
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

/** Nad tuhle velikost se křivka nekreslí - dekódování by sežralo paměť. */
const STROP_PRO_KRIVKU = 150 * 1024 * 1024;

/** Vzorkování pro křivku. Na obrázek široký pár set bodů to bohatě stačí. */
const KRIVKA_HZ = 8000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function cas(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${pad2(m)}:${s.toFixed(1).padStart(4, '0')}`;
}

function hms(sec: number): string {
  const cele = Math.max(0, Math.round(sec));
  return `${pad2(Math.floor(cele / 3600))}:${pad2(Math.floor((cele % 3600) / 60))}:${pad2(cele % 60)}`;
}

/**
 * Stáhne stopu a spočítá z ní křivku. Dekóduje se do 8 kHz mono, takže
 * z hodinové nahrávky vznikne pár desítek MB místo gigabajtu.
 */
async function spocitejKrivku(url: string, pocet = 640): Promise<[number, number][]> {
  const odpoved = await fetch(url);
  if (!odpoved.ok) throw new Error('nelze stáhnout');
  const data = await odpoved.arrayBuffer();

  const Offline =
    (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Offline(1, KRIVKA_HZ, KRIVKA_HZ);
  const buffer = await ctx.decodeAudioData(data);

  const vzorky = buffer.getChannelData(0);
  const velikost = vzorky.length / pocet;
  const strop = 64;
  const peaks: [number, number][] = new Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    const od = Math.floor(i * velikost);
    const do_ = Math.max(od + 1, Math.floor((i + 1) * velikost));
    const krok = Math.max(1, Math.floor((do_ - od) / strop));
    let min = 0;
    let max = 0;
    for (let j = od; j < do_; j += krok) {
      const v = vzorky[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[i] = [min, max];
  }
  return peaks;
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
  /** Ktery zaznam se prave upravuje a co je v policku (zadani 12. 9. 2026). */
  const [upravovana, setUpravovana] = useState<string | null>(null);
  const [upravaText, setUpravaText] = useState('');
  const [poznamka, setPoznamka] = useState<string | null>(null);
  const [slozkaUrl, setSlozkaUrl] = useState<string | null>(null);

  const [pdfNazev, setPdfNazev] = useState('');
  const [pdfStran, setPdfStran] = useState(0);
  const [pdfStrana, setPdfStrana] = useState(1);
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
  const [zalozka, setZalozka] = useState<{ trackIndex: number; localTime: number } | null>(null);
  // Kresli se do canvasu mimo React render, proto i ref.
  const zalozkaRef = useRef<{ trackIndex: number; localTime: number } | null>(null);
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

      if (stopa.peaks) {
        const sirkaSloupce = w / stopa.peaks.length;
        for (let i = 0; i < stopa.peaks.length; i += 1) {
          const [mn, mx] = stopa.peaks[i];
          const x = i * sirkaSloupce;
          c.fillStyle = jeAktivni && x < kurzor ? '#7B55FF' : '#a29c8f';
          c.fillRect(x, stred - mx * stred, Math.max(1, sirkaSloupce - 0.4), Math.max(1, (mx - mn) * stred));
        }
      } else {
        // Bez krivky aspon casova osa, at je kam klikat a kam kreslit znacky.
        c.fillStyle = '#d8d4cc';
        c.fillRect(0, stred - 1, w, 2);
        if (jeAktivni && kurzor > 0) {
          c.fillStyle = '#7B55FF';
          c.fillRect(0, stred - 1, kurzor, 2);
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

      if (jeAktivni && kurzor >= 0) c.fillRect(Math.max(0, kurzor - 0.5), 0, 1, h);
      c.restore();
    },
    [delka, pozice, stav.chyby],
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
  }, [kresliVse, stopy, pozice, delka, stav.chyby, zalozka]);

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
    spocitejKrivku(stopa.url)
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

  const vyberStopu = useCallback((index: number, skocNa?: number) => {
    const stopa = stopyRef.current[index];
    const audio = audioRef.current;
    if (!stopa || !audio) return;
    setAktivni(index);
    aktivniRef.current = index;
    if (audio.src !== stopa.url) {
      audio.src = stopa.url;
      audio.load();
    }
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
  }, []);

  function prehrajNeboPauzni() {
    const audio = audioRef.current;
    if (!audio || aktivni === null) return;
    if (audio.paused) void audio.play().catch(() => setChybaHlaska('Nahrávku se nepodařilo přehrát.'));
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
        setPoznamka(data?.error || 'Složku projektu se nepodařilo načíst.');
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

      if (nove.length > 0) setTimeout(() => vyberStopu(0), 0);
      if (data.text?.id) {
        void nactiPdfZUrl(sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(data.text.id)}`), data.text.name);
      }
    } catch {
      setZDisku('nejde');
      setPoznamka('Složku projektu se nepodařilo načíst.');
    }
  }, [zaklad, sKlicem, vyberStopu]);

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
      const doc = await pdfjs.getDocument({ url }).promise;
      pdfDocRef.current = doc;
      setPdfNazev(nazev);
      setPdfStran(doc.numPages);
      setPdfStrana(1);
      await vykresliPdf(doc);
    } catch {
      setPoznamka(`Text „${nazev}" se nepodařilo otevřít.`);
    }
  }

  async function nactiPdfZeSouboru(file: File) {
    const url = URL.createObjectURL(file);
    vytvoreneUrl.current.push(url);
    await nactiPdfZUrl(url, file.name);
  }

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

  async function posli(cesta: string, init: RequestInit): Promise<boolean> {
    setChybaHlaska(null);
    try {
      const res = await fetch(cesta, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChybaHlaska(data?.error || 'Nepodařilo se uložit.');
        return false;
      }
      setStav(data as Stav);
      return true;
    } catch {
      setChybaHlaska('Nepodařilo se uložit.');
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
    const hlavicka = ['Stopa', 'Název stopy', 'Čas ve stopě', 'Strana textu', 'Popis chyby', 'Zapsal', 'Kdy'];
    if (!jenPoslech) hlavicka.splice(3, 0, 'Čas v Cubase');

    const radky = stav.chyby.map((ch) => {
      const bunky = [
        pad2(ch.trackIndex),
        ch.trackName,
        cas(ch.localTime),
        ch.pdfPage != null ? String(ch.pdfPage) : '',
        ch.description,
        ch.createdByName ?? '',
        new Date(ch.createdAt).toLocaleString('cs-CZ'),
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
    const ok = await posli(sKlicem(zaklad), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...zachyt, description: popis.trim() }),
    });
    setUklada(false);
    if (ok) {
      setFormOtevreny(false);
      setZachyt(null);
      setPopis('');
    }
  }

  async function smazChybu(id: string) {
    await posli(sKlicem(`${zaklad}?chyba=${encodeURIComponent(id)}`), { method: 'DELETE' });
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
    const ok = await posli(sKlicem(zaklad), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chyba: id, description: text }),
    });
    if (ok) {
      setUpravovana(null);
      setUpravaText('');
    }
  }

  async function prepniPreposlechnuto() {
    await posli(sKlicem(zaklad), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: !stav.reviewed }),
    });
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
        if (zruseno || !d?.pozice) return;
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
      void fetch(sKlicem(`${zaklad}/pozice`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // `hraje` je to, z ceho se u nas interne pozna, ze u nahravky
        // nekdo zrovna sedi - viz signalizace v hlavicce.
        body: JSON.stringify({ trackIndex: index + 1, localTime: audio.currentTime, hraje: !audio.paused }),
        keepalive: true,
      }).catch(() => {});
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
  }, [sKlicem, zaklad]);

  /** Pauza se záložkou: nahrávka stojí, obrazovka je zamčená. */
  function zaloz() {
    const audio = audioRef.current;
    const index = aktivniRef.current;
    audio?.pause();
    if (audio && index !== null && Number.isFinite(audio.currentTime)) {
      const misto = { trackIndex: index + 1, localTime: audio.currentTime };
      setZalozka(misto);
      void fetch(sKlicem(`${zaklad}/pozice`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(misto),
        keepalive: true,
      }).catch(() => {});
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

  useEffect(() => {
    if (jenPoslech) return;
    let zruseno = false;
    async function zjisti() {
      try {
        const d = await fetch(sKlicem(`${zaklad}/pozice`)).then((r) => (r.ok ? r.json() : null));
        if (!zruseno) setPosluchaci(d?.posluchaci ?? []);
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
            <span className="mt-5 text-[10px] font-heading uppercase tracking-[0.28em] text-white/60">Záložka</span>
            <p className="mt-1 text-sm font-body text-white/80 text-center m-0 truncate max-w-full">{projectName}</p>

            <div className="mt-7 text-center">
              <span className="block text-[10px] font-heading uppercase tracking-[0.22em] text-white/50">Stopa</span>
              <span className="block font-heading font-bold text-4xl leading-none tabular-nums mt-1">
                {zalozka ? pad2(zalozka.trackIndex) : '—'}
                <span className="text-base text-white/50">/{pad2(stopy.length)}</span>
              </span>
              <span className="block font-heading font-bold text-3xl leading-none tabular-nums mt-4">
                {zalozka ? cas(zalozka.localTime) : '—'}
              </span>
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
              Pokračovat odtud
            </button>
            <span className="mt-2 text-[11px] font-body text-white/50">nebo Enter · Esc</span>
          </div>
        </div>
      )}

      {/* Prehravac sam o sobe nic nekresli - zvuk tece proudem z Disku. */}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => setDelka(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPozice(e.currentTarget.currentTime)}
        onPlay={() => setHraje(true)}
        onPause={() => setHraje(false)}
        onEnded={() => setHraje(false)}
        onError={() => setChybaHlaska('Stopu se nepodařilo načíst z Disku.')}
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
            Stop: <b className="text-white">{stopy.length}</b> · Chyb:{' '}
            <b className="text-white">{stav.chyby.length}</b> · Text:{' '}
            <b className="text-white">{pdfNazev || '—'}</b>
          </span>
          <span className="text-[11px] font-heading text-white/60 hidden xl:inline">
            Mezerník · ←/→ ±5 s · E = chyba · označ text myší
          </span>
          {/* Kontrolka „nekdo posloucha" - jen pro nas, klient ji nevidi. */}
          {posluchaci.length > 0 && (
            <span
              title={posluchaci.map((p) => `${p.jmeno} — stopa ${pad2(p.trackIndex)}, ${cas(p.localTime)}`).join('\n')}
              className="flex items-center gap-1.5 text-[11px] font-heading font-semibold bg-brand-green/20 text-white rounded-pill px-2.5 py-1"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-brand-green opacity-70 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-green" />
              </span>
              {posluchaci.length === 1
                ? `${posluchaci[0].jmeno} poslouchá · ${pad2(posluchaci[0].trackIndex)}`
                : `Poslouchá ${posluchaci.length} lidí`}
            </span>
          )}

          {/* Na celou obrazovku (zadani 11. 9. 2026). U 330stranneho textu
              a dvanacti stop je kazdy pixel k uzitku. */}
          <button
            type="button"
            onClick={prepniCelouObrazovku}
            title={celaObrazovka ? 'Zpět do okna (Esc)' : 'Na celou obrazovku'}
            className="font-heading font-semibold text-[11px] rounded-lg border border-white/40 px-2.5 py-1 hover:border-white transition-colors"
          >
            {celaObrazovka ? '⤡ Zpět do okna' : '⤢ Na celou obrazovku'}
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
                  Přeposlechnuto
                </span>
                <span className="text-[11px] font-body text-white/70 leading-tight">
                  {stav.reviewedByName ?? 'Mediaspace'}
                  {stav.reviewedAt && (
                    <>
                      <br />
                      {new Date(stav.reviewedAt).toLocaleDateString('cs-CZ')}
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
                      Opravdu zrušit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRusiPreposlech(false)}
                      className="font-heading text-xs text-white/70 hover:text-white"
                    >
                      Ne
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRusiPreposlech(true)}
                    title="Zrušit označení"
                    className="font-heading text-xs text-white/60 hover:text-white underline"
                  >
                    zrušit
                  </button>
                )}
              </span>
            ) : potvrzujePreposlech ? (
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-body text-white/85">Opravdu označit jako přeposlechnuté?</span>
                <button
                  type="button"
                  onClick={() => {
                    setPotvrzujePreposlech(false);
                    void prepniPreposlechnuto();
                  }}
                  className="flex items-center gap-2 bg-brand-green text-onAccent font-heading font-bold text-sm rounded-lg px-4 py-2 shadow-sm"
                >
                  Ano, přeposlechnuto
                </button>
                <button
                  type="button"
                  onClick={() => setPotvrzujePreposlech(false)}
                  className="font-heading text-xs text-white/70 hover:text-white"
                >
                  Ne
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPotvrzujePreposlech(true)}
                className="flex items-center gap-2 bg-white text-brand-purpleDeep font-heading font-bold text-sm rounded-lg px-5 py-2.5 shadow-sm hover:bg-brand-green hover:text-onAccent transition-colors"
              >
                <span className="grid place-items-center w-5 h-5 rounded border-2 border-current" aria-hidden="true" />
                Označit jako přeposlechnuté
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4 items-start">
        <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-line">
            <span className="text-sm font-heading text-ink truncate">{pdfNazev || 'Text nahrávky'}</span>
            {!jenPoslech && (
              <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                Načíst jiné PDF
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
            {pdfStran > 0 && (
              <span className="flex items-center gap-1.5 ml-auto">
                <button type="button" onClick={() => naStranu(pdfStrana - 1)} className="text-muted hover:text-brand-purple px-1.5">
                  ◂
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Číslo strany"
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
          <div ref={pdfRolovaniRef} className="bg-field overflow-y-auto p-4 flex flex-col items-center gap-4" style={{ height: '72vh' }}>
            {pdfStran === 0 && (
              <p className="text-sm font-body text-muted m-auto text-center max-w-[300px]">
                {zDisku === 'nacitam'
                  ? 'Načítám text ze složky projektu…'
                  : 'Ve složce projektu zatím není text. Hledá se PDF, jehož název končí _RE.'}
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

        <div className="flex flex-col gap-4">
          {/* PREHRAVAC JE NAHORE (zadani 12. 9. 2026: „tim padem tam na prave
              strane vznikne vice mista na tracky a prehravac bude vice
              nahore"). Poradi resi `order`, ne prohozeni bloku - kod tim
              zustava ctenym shora dolu podle vyznamu, ne podle mista na
              obrazovce. */}
          <div className="order-2 bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            {/* Zalozky jako u Ukolu a chatu (zadani 12. 9. 2026). Chyby
                a historie sdileji jedno misto, takze na prehravac a stopy
                zbyde vic. */}
            <div className="px-2 pt-2 border-b border-line flex items-end gap-1">
              {([
                { klic: 'chyby' as const, popisek: `Chyby (${stav.chyby.length})` },
                { klic: 'historie' as const, popisek: 'Historie' },
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
                    Některé záznamy patří stopám, které tu teď nejsou.
                  </span>
                )}
                {panel === 'chyby' && (
                  <button
                    type="button"
                    onClick={stahniTabulku}
                    disabled={stav.chyby.length === 0}
                    title="Stáhnout všechny záznamy jako tabulku (CSV pro Excel)"
                    className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    Stáhnout tabulku
                  </button>
                )}
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '30vh' }}>
              {panel === 'historie' ? (
                <Historie zaznamy={stav.historie ?? []} />
              ) : stav.chyby.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
                  Zatím žádné chyby. Pusťte stopu a v místě problému dejte „Přidat chybu".
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
                              Uložit
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpravovana(null)}
                              className="text-xs font-heading text-muted hover:text-ink"
                            >
                              Zrušit
                            </button>
                          </span>
                        </div>
                      ) : (
                      <div className="flex items-start gap-3">
                      <button type="button" onClick={() => skocNaChybu(ch)} className="flex-1 min-w-0 text-left" title="Skočit na místo v nahrávce">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-heading font-semibold tabular-nums bg-field border border-line rounded px-1.5">
                            {pad2(ch.trackIndex)}
                          </span>
                          <span className="text-xs font-heading text-muted tabular-nums">{cas(ch.localTime)}</span>
                          {ch.pdfPage && <span className="text-xs font-heading text-muted tabular-nums">s. {ch.pdfPage}</span>}
                          {ch.zvyrazneni && (
                            <span className="text-[11px] font-heading bg-warnTint text-ink rounded px-1.5" title={ch.zvyrazneni.text}>
                              ✎ v textu
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
                            title="Upravit znění"
                            aria-label="Upravit znění"
                            className="text-muted hover:text-brand-purple text-sm"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => void smazChybu(ch.id)}
                            title="Smazat záznam"
                            aria-label="Smazat záznam"
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

          <div className="order-1 bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
            {/* Displej je zámerně na JEDEN ŘÁDEK (zadání 11. 9. 2026: „ten
                display už zabírá dost místa, celé bych to hodně zmenšil").
                Číslo stopy a čas zůstávají to největší na něm — na ně se
                člověk dívá od stolu; název stopy je drobným písmem vedle. */}
            <div className="rounded-card bg-brand-purpleDark text-white px-3 py-2 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={prehrajNeboPauzni}
                disabled={aktivni === null}
                title="Přehrát / pozastavit (mezerník)"
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
                <span className="text-xs font-semibold text-white/60"> z {cas(delka)}</span>
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
                    title={`Přehrávat ${r}× rychle`}
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
                  title="Dát si pauzu — přeposlech se zamkne a založí se místo"
                  className="font-heading font-semibold text-xs rounded-lg border border-white/40 px-2.5 py-1.5 hover:border-white transition-colors disabled:opacity-40"
                >
                  🔖 Pauza
                </button>
                <button
                  type="button"
                  onClick={() => otevriForm()}
                  disabled={aktivni === null || formOtevreny}
                  className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  + Přidat chybu
                </button>
              </span>
            </div>
            {aktivni !== null && !jenPoslech && (
              <p className="text-[11px] font-heading text-muted m-0 tabular-nums">
                Offset této stopy v Cubase: +{hms(aktivni * DELKA_STOPY_V_CUBASE)}
              </p>
            )}

            {formOtevreny && zachyt && (
              <div className="border border-brand-purple bg-tint rounded-lg p-3 flex flex-col gap-2">
                <p className="text-xs font-heading text-muted m-0">
                  Stopa <b className="text-ink">{pad2(zachyt.trackIndex)}</b> · čas{' '}
                  <b className="text-ink tabular-nums">{cas(zachyt.localTime)}</b> · strana{' '}
                  <b className="text-ink">{zachyt.pdfPage ?? '— (text nenačtený)'}</b>
                  {zachyt.zvyrazneni && (
                    <>
                      {' '}
                      · <span className="bg-warnTint text-ink rounded px-1">zvýrazněno v textu</span>
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
                  placeholder="Co je špatně — přeřek, chybějící věta, jiné znění než v textu…"
                  className={`${inputClass} w-full resize-none`}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setFormOtevreny(false)} className="text-sm font-heading text-muted hover:text-ink">
                    Zrušit
                  </button>
                  <button
                    type="button"
                    onClick={() => void ulozChybu()}
                    disabled={uklada || !popis.trim()}
                    className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    {uklada ? 'Ukládám…' : 'Uložit chybu'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Zvukové stopy</h3>
              {!jenPoslech && (
                <span className="flex items-center gap-3">
                  {slozkaUrl && (
                    <a href={slozkaUrl} target="_blank" rel="noreferrer" className="text-xs font-heading text-brand-purple no-underline hover:underline">
                      Složka na Disku ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void nactiZDisku()}
                    disabled={zDisku === 'nacitam'}
                    className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-50"
                  >
                    {zDisku === 'nacitam' ? 'Načítám…' : 'Načíst z Disku znovu'}
                  </button>
                  <label className="text-xs font-heading text-muted border border-dashed border-line rounded-lg px-3 py-1 cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors">
                    + Ze souborů
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
            <div className="p-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '34vh' }}>
              {stopy.length === 0 ? (
                <p className="text-sm font-body text-muted m-0 px-1 py-5 text-center">
                  {zDisku === 'nacitam'
                    ? 'Načítám stopy ze složky projektu…'
                    : 'Ve složce projektu zatím nejsou žádné nahrávky. Stopy se řadí podle čísla na začátku názvu — 01_, 02_, 03_.'}
                </p>
              ) : (
                stopy.map((stopa, index) => (
                  <div
                    key={`${index}-${stopa.name}`}
                    // shrink-0 je tu povinne: seznam je flex sloupec s pevnou
                    // maximalni vyskou, takze bez nej flexbox radky SMRSKNE misto
                    // toho, aby je nechal prescnout a rolovat. Pri dvanacti
                    // stopach z nich byly 12px prouzky (11. 9. 2026).
                    className={`shrink-0 rounded-lg border overflow-hidden ${
                      index === aktivni ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        // Stopa se zalozkou se otevre rovnou tam, kde se
                        // skoncilo - presne jako kdyz se kniha otevre na
                        // zalozce.
                        vyberStopu(index, zalozka?.trackIndex === index + 1 ? zalozka.localTime : undefined)
                      }
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
                    >
                      <span className="text-[11px] font-heading font-bold tabular-nums bg-field rounded px-1.5 py-0.5">{pad2(index + 1)}</span>
                      <span className="flex-1 min-w-0 text-xs font-body text-ink truncate">{stopa.name}</span>
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
                          title={`Tady jste skončili (${cas(zalozka.localTime)}) — kliknutím pokračujete`}
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-heading font-semibold text-status-progress"
                        >
                          <span aria-hidden="true">🔖</span>
                          <span className="tabular-nums">{cas(zalozka.localTime)}</span>
                        </span>
                      )}
                      {stopa.krivkaStav === 'pocita' && <span className="text-[10px] font-heading text-muted">kreslím křivku…</span>}
                      {!jenPoslech && (
                        <span className="text-[10px] font-heading text-muted tabular-nums">+{hms(index * DELKA_STOPY_V_CUBASE)}</span>
                      )}
                    </button>
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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
function Historie({ zaznamy }: { zaznamy: Udalost[] }) {
  if (zaznamy.length === 0) {
    return (
      <p className="text-sm font-body text-muted m-0 px-4 py-6 text-center">
        Zatím se nic nestalo. Jakmile někdo otevře odkaz nebo napíše poznámku, objeví se to tady.
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
                  : u.typ === 'OTEVRENO'
                    ? 'bg-brand-purple'
                    : 'bg-line'
            }`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-body text-ink break-words">{u.popis}</span>
            <span className="block text-[11px] font-body text-muted mt-0.5">
              {u.kdo ? `${u.kdo} · ` : ''}
              {new Date(u.kdy).toLocaleString('cs-CZ', {
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
