'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { PribehRadek } from '@/lib/pribehyServer';
import {
  MAX_POPISEK,
  PRIJIMANE_PRIPONY,
  POVOLENE_TYPY,
  maxProTyp,
  velikostVMB,
} from '@/lib/pribehy';
import {
  BARVY_TEXTU,
  MAX_VELIKOST,
  MIN_VELIKOST,
  PODKLADY,
  SIRKA_BLOKU,
  VYCHOZI_STYL,
  orezStyl,
  slozPribeh,
  type StylTextu,
  type ZarovnaniTextu,
} from '@/lib/pribehText';
import {
  DELKY_PRIBEHU_S,
  DELKA_PRIBEHU_S,
  casMinSek,
  type SkladbaRadek,
} from '@/lib/hudba';
import { nactiSkladbuDoPameti, slozVideoSHudbou, umiSlozitVideo } from '@/lib/pribehVideo';
import { KROUZEK, KROUZEK_KLID, Znacka, nahrajDoUloziste, typSouboru } from './spolecne';

/**
 * EDITOR PŘÍBĚHU (zadání 6. 10. 2026: „pojďme to udělat tak, že pole textu
 * bude nalevo a ten náhled napravo… a možnost uložit koncept nebo rovnou
 * smazat nebo vyměnit fotku nebo začít znovu").
 *
 * NESCHVALUJE SE. Od tohohle zadání jde příběh ven rovnou („nemusíme to
 * nechávat schvalovat, všichni z týmu by měli mít možnost to tam dát").
 * Fronta zůstala jen jako místo, kde skončí to, co Instagram odmítl.
 *
 * TEXT SE U FOTKY VYPALUJE DO OBRÁZKU, až při odeslání - viz lib/pribehText.ts.
 * Koncept proto drží PŮVODNÍ fotku a podobu textu zvlášť, aby se dal otevřít
 * a dál upravovat; hotový příběh má text už v sobě.
 */

type Rozdelano = {
  id: string;
  popisek: string;
  styl: StylTextu;
};

/** O kolik bodů se musí prst pohnout, než se text začne stěhovat. */
const PRAH_TAHU = 8;

export function Editor({
  onZavri,
  ucet,
  koncept,
  onHotovo,
}: {
  ucet: string | null;
  /** Otevřený koncept, nebo nic - pak se zakládá nový. */
  koncept: PribehRadek | null;
  onHotovo: () => void;
  /**
   * Zavří celoobrazovkové skládání na telefonu (7. 10. 2026). Na počítači
   * není co zavírat - editor tam stojí na stránce - a křížek se nevykreslí.
   */
  onZavri?: () => void;
}) {
  const t = usePreklad();
  const router = useRouter();

  const vstupSouboru = useRef<HTMLInputElement | null>(null);
  const poleTextu = useRef<HTMLTextAreaElement | null>(null);
  /** Psaní přímo do fotky - na telefonu je to jediné pole na text. */
  const poleNaFotce = useRef<HTMLTextAreaElement | null>(null);
  /** Sloupec, do kterého se náhled vejde - z něj se počítá velikost rámu. */
  const sloupecRef = useRef<HTMLDivElement | null>(null);
  const ramRef = useRef<HTMLSpanElement | null>(null);
  const taham = useRef(false);
  /** Kde prst začal a jestli už překročil práh - viz chytText. */
  const zacatekTahu = useRef<{ x: number; y: number; tahne: boolean } | null>(null);

  const [soubor, setSoubor] = useState<File | null>(null);
  const [nahled, setNahled] = useState<string | null>(null);
  const [zKonceptu, setZKonceptu] = useState<Rozdelano | null>(null);
  const [popisek, setPopisek] = useState('');
  const [styl, setStyl] = useState<StylTextu>(VYCHOZI_STYL);
  const [ramVyska, setRamVyska] = useState(0);
  const [vyskaMrizky, setVyskaMrizky] = useState(0);
  const [procenta, setProcenta] = useState<number | null>(null);
  const [pracuji, setPracuji] = useState<'odeslat' | 'koncept' | 'smazat' | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  /** Rozbalene „dalsi volby" pod tremi teckami - jen na telefonu. */
  const [dalsi, setDalsi] = useState(false);
  /** Právě se píše do fotky? Pak se textem netáhne, jinak by se psaní přerušilo. */
  const [pisuNaFotce, setPisuNaFotce] = useState(false);
  /** Kolik místa na náhled zbývá - používá se jen na telefonu, viz níže. */
  const [misto, setMisto] = useState({ sirka: 0, vyska: 0 });
  const [naTelefonu, setNaTelefonu] = useState(false);

  /**
   * HUDBA DO PŘÍBĚHU (zadání 8. 10. 2026). Knihovna je naše vlastní -
   * instagramovou nalápku přes API nalepit nejde, takže se skladba VYPÁLÍ
   * do souboru ještě před nahráním (viz lib/pribehVideo.ts). Z fotky se tím
   * stane krátké video, což Instagram bere stejně dobře.
   */
  const [skladby, setSkladby] = useState<SkladbaRadek[]>([]);
  const [skladbaId, setSkladbaId] = useState('');
  const [zacatekHudby, setZacatekHudby] = useState(0);
  const [delkaPribehu, setDelkaPribehu] = useState(DELKA_PRIBEHU_S);
  /** U videa: poslat ho bez vlastního zvuku. */
  const [bezZvuku, setBezZvuku] = useState(false);
  /** Skládání běží v reálném čase, takže se hlásí, jak daleko je. */
  const [sklada, setSklada] = useState<number | null>(null);
  /**
   * Umí to tenhle prohlížeč? Zjišťuje se až v prohlížeči (MediaRecorder na
   * serveru neexistuje), jinak by se server a klient nešikovně rozcházely.
   */
  const [umiHudbu, setUmiHudbu] = useState(false);
  const poslechRef = useRef<HTMLAudioElement | null>(null);
  const [hraje, setHraje] = useState(false);

  useEffect(() => {
    setUmiHudbu(umiSlozitVideo());
  }, []);

  /** Knihovna skladeb. Když se nenačte, hudba se prostě nenabídne. */
  useEffect(() => {
    let platne = true;
    void (async () => {
      try {
        const res = await fetch('/api/site/hudba');
        if (!res.ok) return;
        const telo = await res.json();
        if (platne) setSkladby((telo.skladby ?? []).filter((sk: SkladbaRadek) => sk.aktivni));
      } catch {
        // Ticho záměrně - bez knihovny jde příběh ven jako dřív.
      }
    })();
    return () => {
      platne = false;
    };
  }, []);

  /** Otevření konceptu: stáhne jeho soubor zpátky do prohlížeče a naváže se na něj. */
  useEffect(() => {
    if (!koncept) return;
    let zruseno = false;
    setChyba(null);
    setPopisek(koncept.popisek);
    setStyl(orezStyl({ ...VYCHOZI_STYL, ...((koncept.textStyl as Partial<StylTextu>) ?? {}) }));
    setZKonceptu({ id: koncept.id, popisek: koncept.popisek, styl: VYCHOZI_STYL });
    (async () => {
      try {
        const res = await fetch(`/api/site/pribehy/${koncept.id}/soubor`);
        if (!res.ok) throw new Error('soubor');
        const blob = await res.blob();
        if (zruseno) return;
        setSoubor(new File([blob], koncept.nazevSouboru, { type: koncept.typSouboru }));
      } catch {
        if (!zruseno) setChyba(t('pribehy.konceptNeotevren'));
      }
    })();
    return () => {
      zruseno = true;
    };
  }, [koncept, t]);

  // Nahled zije jen v prohlizeci; po vymene souboru se adresa musi uvolnit.
  useEffect(() => {
    if (!soubor) {
      setNahled(null);
      return;
    }
    const adresa = URL.createObjectURL(soubor);
    setNahled(adresa);
    return () => URL.revokeObjectURL(adresa);
  }, [soubor]);

  /**
   * ŠÍŘKA RÁMU SE POČÍTÁ Z VÝŠKY MŘÍŽKY VEDLE NĚJ (6. 10. 2026:
   * „udělal bych to na výšku toho rastru, co je vlevo, a tím i zvětšil
   * náhled").
   *
   * Záměrně ŠÍŘKA, ne výška: `aspect-ratio` s výškou na 100 % si sice
   * šířku dopočítá, ale sloupec mřížky už je mezitím změřený podle užšího
   * obsahu - rám pak přeteče přes sousední sloupec. Když se šířka zadá
   * rovnou, výška z ní vyjde a nic se nekryje.
   */
  useEffect(() => {
    const mrizka = document.querySelector('[data-mrizka]');
    if (!mrizka || typeof ResizeObserver === 'undefined') return;
    const zmer = () => setVyskaMrizky(mrizka.getBoundingClientRect().height);
    const hlidac = new ResizeObserver(zmer);
    hlidac.observe(mrizka);
    zmer();
    return () => hlidac.disconnect();
  }, []);

  /** Výška rámu v bodech - velikost písma je v procentech výšky. */
  useEffect(() => {
    const prvek = ramRef.current;
    if (!prvek || typeof ResizeObserver === 'undefined') return;
    const hlidac = new ResizeObserver(() => setRamVyska(prvek.clientHeight));
    hlidac.observe(prvek);
    setRamVyska(prvek.clientHeight);
    return () => hlidac.disconnect();
  }, [nahled]);

  const jeVideo = soubor !== null && typSouboru(soubor).startsWith('video/');

  // Pod rámem ještě sedí popísek, proto se pár bodů ubere; meze drží rám
  // rozumný i na úzkém okně, kde mřížka zabere celou šířku.
  /**
   * VELIKOST RÁMU NA TELEFONU SE MĚŘÍ, NEPOČÍTÁ V CSS (oprava 7. 10. 2026).
   *
   * Pokus držet poměr 9:16 třídami skončil dvakrát špatně: jednou se rám smrskl
   * na čárku, podruhé se roztáhl přes celý sloupec a obsah přetekl z obrazovky -
   * a přeteklou stránku pak prohlížeč v apce překresloval přes sebe.
   * `height: 100%` je totiž pevná výška a `max-width` už ji nedokáže zmenšit,
   * takže se poměr zlomí.
   *
   * Tady se změří volné místo a rozměr se dopočítá — stejně jako to už dělá
   * počítač podle mřížky vedle. Sloupec má `overflow-hidden`, takže rám nikdy
   * nemůže sloupec zvětšit a měření se točit dokola.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const dotaz = window.matchMedia('(max-width: 767px)');
    const zmer = () => setNaTelefonu(dotaz.matches);
    zmer();
    dotaz.addEventListener('change', zmer);
    return () => dotaz.removeEventListener('change', zmer);
  }, []);

  useEffect(() => {
    const sloupec = sloupecRef.current;
    if (!sloupec || typeof ResizeObserver === 'undefined') return;
    const zmer = () => {
      const r = sloupec.getBoundingClientRect();
      setMisto({ sirka: r.width, vyska: r.height });
    };
    const hlidac = new ResizeObserver(zmer);
    hlidac.observe(sloupec);
    zmer();
    return () => hlidac.disconnect();
  }, []);

  /** Rozměr rámu i s dvoubodovým proužkem kolem něj. */
  const ramNaTelefonu =
    naTelefonu && misto.vyska > 0 && misto.sirka > 0
      ? (() => {
          const s = Math.max(0, Math.min(misto.sirka, (misto.vyska * 9) / 16) - 4);
          return { width: Math.round(s) + 4, height: Math.round((s * 16) / 9) + 4 };
        })()
      : null;

  const sirkaRamu = vyskaMrizky > 0 ? Math.min(340, Math.max(200, Math.round(((vyskaMrizky - 26) * 9) / 16))) : 230;

  function vyber(e: React.ChangeEvent<HTMLInputElement>) {
    const vybrany = e.target.files?.[0] ?? null;
    setChyba(null);
    if (!vybrany) return;
    const typ = typSouboru(vybrany);
    if (!POVOLENE_TYPY.includes(typ)) {
      setChyba(t('pribehy.spatnyTyp'));
      return;
    }
    if (vybrany.size > maxProTyp(typ)) {
      setChyba(t('pribehy.mocVelky', { kolik: velikostVMB(maxProTyp(typ)) }));
      return;
    }
    setSoubor(vybrany);
  }

  function zacniZnovu() {
    setSoubor(null);
    setPopisek('');
    setStyl(VYCHOZI_STYL);
    setChyba(null);
    if (vstupSouboru.current) vstupSouboru.current.value = '';
  }

  /**
   * TÁHNUTÍ TEXTU, NEBO PSANÍ? (7. 10. 2026: „na mobilu musím ten text psát
   * pod obrázkem a ne přímo do něj")
   *
   * Jedno gesto, dva úmysly: kdo prstem POSUNE, ten text stěhuje; kdo jen
   * KLEPNE, ten chce psát. Rozhoduje o tom vzdálenost - dokud se prst
   * nepohne o {@link PRAH_TAHU} bodů, nic se nestěhuje. Bez toho prahu by
   * každé klepnutí textem o kousek cuklo.
   *
   * Procenta, ne body - viz lib/pribehText.ts.
   */
  function chytText(e: React.PointerEvent<HTMLDivElement>) {
    if (!ramRef.current || pisuNaFotce) return;
    taham.current = true;
    zacatekTahu.current = { x: e.clientX, y: e.clientY, tahne: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function tahniText(e: React.PointerEvent<HTMLDivElement>) {
    const ram = ramRef.current;
    const zacatek = zacatekTahu.current;
    if (!taham.current || !ram || !zacatek) return;
    if (!zacatek.tahne) {
      const dx = e.clientX - zacatek.x;
      const dy = e.clientY - zacatek.y;
      if (Math.hypot(dx, dy) < PRAH_TAHU) return;
      zacatek.tahne = true;
    }
    e.preventDefault();
    const r = ram.getBoundingClientRect();
    setStyl((st) =>
      orezStyl({ ...st, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }),
    );
  }
  function pustText(e: React.PointerEvent<HTMLDivElement>) {
    const jenKlepnuti = taham.current && zacatekTahu.current?.tahne === false;
    taham.current = false;
    zacatekTahu.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Klepnutí = „chci sem psát". Na počítači je pole schované, takže se nic
    // nestane a text se dál píše vlevo.
    if (jenKlepnuti && poleNaFotce.current?.offsetParent) {
      setPisuNaFotce(true);
      poleNaFotce.current.focus();
    }
  }

  /** Vybraná skladba - kvůli délce, od které se počítá posuvník začátku. */
  const vybrana = skladby.find((sk) => sk.id === skladbaId) ?? null;
  /** Dokud skladba není delší než příběh, není čím posouvat. */
  const nejpozdeji = vybrana ? Math.max(0, vybrana.delka - delkaPribehu) : 0;

  /**
   * Poslech kousku, který pojede do příběhu. Hraje se z téhož souboru, který
   * se pak vypálí, takže co si člověk poslechne, to tam opravdu bude.
   */
  function zastavPoslech() {
    poslechRef.current?.pause();
    setHraje(false);
  }

  function prepniPoslech() {
    const zvuk = poslechRef.current;
    if (!zvuk || !skladbaId) return;
    if (hraje) {
      zastavPoslech();
      return;
    }
    zvuk.currentTime = zacatekHudby;
    void zvuk.play().then(() => setHraje(true)).catch(() => setHraje(false));
  }

  function vyberSkladbu(id: string) {
    zastavPoslech();
    setSkladbaId(id);
    setZacatekHudby(0);
  }

  /** Nahraje soubor do úložiště a vrátí klíč; vrací null, když není co měnit. */
  async function nahraj(): Promise<{ klic: string; nazev: string } | null> {
    if (!soubor) return null;
    let data: Blob = soubor;
    let typ = typSouboru(soubor);
    let nazev = soubor.name;
    const jeVid = typ.startsWith('video/');
    if (!jeVid) {
      // Fotka se ořízne na 9:16 a text se do ní vypálí - viz lib/pribehText.ts.
      data = await slozPribeh(soubor, popisek, styl);
      typ = 'image/jpeg';
      nazev = `${soubor.name.replace(/\.[^.]+$/, '')}.jpg`;
    }

    /**
     * HUDBA SE VYPÁLÍ AŽ TADY (8. 10. 2026), tedy po vypálení textu do fotky -
     * to, co se nahrává, už je hotový obrázek i s textem.
     *
     * Bez skladby a bez ztlumení se nepřekódovává nic: video jde ven přesně
     * takové, jaké přišlo z telefonu, ať zbytečně neztrácí kvalitu.
     */
    if (skladbaId || (jeVid && bezZvuku)) {
      const hudba = skladbaId ? await nactiSkladbuDoPameti(skladbaId) : null;
      if (skladbaId && !hudba) throw new Error(t('pribehy.hudbaNesla'));
      setProcenta(null);
      setSklada(0);
      try {
        data = await slozVideoSHudbou({
          zdroj: data,
          jeVideo: jeVid,
          hudba,
          zacatekHudbyS: zacatekHudby,
          delkaS: delkaPribehu,
          // Vlastní zvuk videa si necháme jen tehdy, když nehraje skladba.
          puvodniZvuk: jeVid && !bezZvuku && !skladbaId,
          prubeh: setSklada,
        });
      } finally {
        setSklada(null);
      }
      typ = 'video/mp4';
      nazev = `${soubor.name.replace(/\.[^.]+$/, '')}.mp4`;
    }
    const res = await fetch('/api/site/pribehy/podpis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev, typ, velikost: data.size }),
    });
    const podpis = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));
    await nahrajDoUloziste(podpis.uploadUrl, data, typ, setProcenta);
    setProcenta(null);
    return { klic: podpis.key, nazev };
  }

  /** Původní (nevypálená) fotka do konceptu - text se do ní vypálí až nakonec. */
  async function nahrajPuvodni(): Promise<{ klic: string; nazev: string } | null> {
    if (!soubor) return null;
    const typ = typSouboru(soubor);
    const res = await fetch('/api/site/pribehy/podpis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: soubor.name, typ, velikost: soubor.size }),
    });
    const podpis = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(podpis.error || t('pribehy.neodeslano'));
    await nahrajDoUloziste(podpis.uploadUrl, soubor, typ, setProcenta);
    setProcenta(null);
    return { klic: podpis.key, nazev: soubor.name };
  }

  async function daj() {
    if (!soubor) return;
    setPracuji('odeslat');
    setChyba(null);
    setProcenta(0);
    try {
      const nahrane = await nahraj();
      if (!nahrane) throw new Error(t('pribehy.neodeslano'));
      const res = await fetch('/api/site/pribehy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic: nahrane.klic, nazevSouboru: nahrane.nazev, popisek }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 207) throw new Error(telo.error || t('pribehy.neodeslano'));
      // 207: pribeh je ulozeny, jen ho Instagram nevzal - duvod se ukaze ve fronte.
      if (telo.chyba) setChyba(telo.chyba);
      if (zKonceptu) await fetch(`/api/site/pribehy/${zKonceptu.id}`, { method: 'DELETE' });
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setPracuji(null);
      setProcenta(null);
    }
  }

  async function ulozKoncept() {
    if (!soubor) return;
    setPracuji('koncept');
    setChyba(null);
    setProcenta(0);
    try {
      if (zKonceptu) {
        const nahrane = await nahrajPuvodni();
        const res = await fetch(`/api/site/pribehy/${zKonceptu.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stav: 'KONCEPT',
            popisek,
            textStyl: styl,
            klic: nahrane?.klic,
            nazevSouboru: nahrane?.nazev,
          }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));
      } else {
        const nahrane = await nahrajPuvodni();
        if (!nahrane) throw new Error(t('pribehy.neodeslano'));
        const res = await fetch('/api/site/pribehy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            klic: nahrane.klic,
            nazevSouboru: nahrane.nazev,
            popisek,
            textStyl: styl,
            stav: 'KONCEPT',
          }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(telo.error || t('pribehy.neodeslano'));
      }
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error && err.message !== 'upload' ? err.message : t('pribehy.neodeslano'));
    } finally {
      setPracuji(null);
      setProcenta(null);
    }
  }

  async function smazKoncept() {
    if (!zKonceptu) {
      zacniZnovu();
      return;
    }
    setPracuji('smazat');
    try {
      await fetch(`/api/site/pribehy/${zKonceptu.id}`, { method: 'DELETE' });
      zacniZnovu();
      setZKonceptu(null);
      onHotovo();
      router.refresh();
    } finally {
      setPracuji(null);
    }
  }

  /** Vloží zmínku na místo kurzoru - viz Zminky. */
  function vlozZminku(znacka: string) {
    // Na telefonu se píše do fotky, na počítači do pole vlevo.
    const naFotce = poleNaFotce.current;
    const pole = naFotce?.offsetParent ? naFotce : poleTextu.current;
    const kde = pole ? pole.selectionStart : popisek.length;
    const pred = popisek.slice(0, kde).replace(/@[A-Za-z0-9._]*$/, '');
    const za = popisek.slice(kde);
    const mezera = pred && !pred.endsWith(' ') && !pred.endsWith('\n') ? ' ' : '';
    const novy = `${pred}${mezera}${znacka} ${za}`.slice(0, MAX_POPISEK);
    setPopisek(novy);
    requestAnimationFrame(() => {
      pole?.focus();
      const pozice = (pred + mezera + znacka + ' ').length;
      pole?.setSelectionRange(pozice, pozice);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:grid md:gap-6 md:rounded-card md:border md:border-line md:bg-surface md:p-5 md:grid-cols-[minmax(0,1fr)_auto]">
      {/* --- NA TELEFONU HORNÍ LIŠTA (zadání 7. 10. 2026: „v mobilu to musíme
          udělat jinak, roztáhnout na celou obrazovku s možností se vrátit,
          jako bych byl na Instagramu"). Křížek vlevo, Zveřejnit vpravo -
          přesně tam, kde to má Instagram, ať se to nemusí hledat. Na počítači
          se lišta nevykreslí, tam zůstává tlačítko dole v řadě. */}
      <div className="order-1 flex shrink-0 items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          onClick={onZavri}
          aria-label={t('pribehy.zavrit')}
          title={t('pribehy.zavrit')}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-pill text-xl leading-none text-muted transition-colors hover:text-ink"
        >
          ✕
        </button>
        <span className="truncate font-heading text-sm font-semibold text-ink">
          {zKonceptu ? t('pribehy.upravujeteKoncept') : t('pribehy.novy')}
        </span>
        <button
          type="button"
          disabled={!soubor || pracuji !== null}
          onClick={() => void daj()}
          className="shrink-0 cursor-pointer rounded-pill bg-brand-purple px-4 py-1.5 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50"
        >
          {t(pracuji === 'odeslat' ? 'pribehy.vyvesuji' : 'pribehy.datNaInstagram')}
        </button>
      </div>

      {/* --- VLEVO (na telefonu DOLE): text a jeho podoba ------------------ */}
      <div className="order-3 flex min-w-0 shrink-0 flex-col gap-3 md:order-none">
        {/* Nadpis a odznak konceptu říká na telefonu už horní lišta. */}
        <div className="hidden flex-wrap items-center justify-between gap-2 md:flex">
          <label className="font-heading text-sm font-semibold text-ink" htmlFor="pribeh-popisek">
            {t('pribehy.popisek')}
          </label>
          {zKonceptu && (
            <span className="rounded-pill border border-line bg-field px-2.5 py-0.5 font-heading text-[11px] text-muted">
              {t('pribehy.upravujeteKoncept')}
            </span>
          )}
        </div>
        <textarea
          id="pribeh-popisek"
          ref={poleTextu}
          value={popisek}
          onChange={(e) => setPopisek(e.target.value.slice(0, MAX_POPISEK))}
          rows={5}
          placeholder={t('pribehy.popisekPlaceholder')}
          /* Na telefonu se píše rovnou do fotky (7. 10. 2026), tohle pole
             by bylo druhé a jen by ujedálo místo náhledu. */
          className="hidden w-full rounded-card border border-line bg-field/40 px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand-purple md:block"
        />

        <Zminky text={popisek} naVlozeni={vlozZminku} />

        {popisek.trim() && !jeVideo && (
          <div className="flex flex-col gap-3 rounded-card border border-line bg-field/30 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                {t('pribehy.velikost')}
              </span>
              <span className="flex items-center gap-1">
                <Knoflik
                  popisek="−"
                  nazev={t('pribehy.zmensit')}
                  onClick={() => setStyl((st) => orezStyl({ ...st, velikost: st.velikost - 0.5 }))}
                  vypnuto={styl.velikost <= MIN_VELIKOST}
                />
                <span className="w-10 text-center font-heading text-xs tabular-nums text-ink">
                  {styl.velikost.toFixed(1)}
                </span>
                <Knoflik
                  popisek="+"
                  nazev={t('pribehy.zvetsit')}
                  onClick={() => setStyl((st) => orezStyl({ ...st, velikost: st.velikost + 0.5 }))}
                  vypnuto={styl.velikost >= MAX_VELIKOST}
                />
              </span>

              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                {t('pribehy.zarovnani')}
              </span>
              <span className="flex items-center gap-1">
                {(['left', 'center', 'right'] as ZarovnaniTextu[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setStyl((st) => ({ ...st, zarovnani: z }))}
                    aria-pressed={styl.zarovnani === z}
                    className={`h-7 w-8 cursor-pointer rounded-lg border font-heading text-xs transition-colors ${
                      styl.zarovnani === z
                        ? 'border-brand-purple bg-brand-purple/15 text-ink'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {z === 'left' ? '◧' : z === 'center' ? '▣' : '◨'}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                {t('pribehy.barvaPisma')}
              </span>
              <span className="flex items-center gap-1.5">
                {BARVY_TEXTU.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setStyl((st) => ({ ...st, barva: b }))}
                    aria-pressed={styl.barva === b}
                    aria-label={b}
                    style={{ background: b }}
                    className={`h-6 w-6 cursor-pointer rounded-full border-2 transition-transform ${
                      styl.barva === b ? 'scale-110 border-brand-purple' : 'border-line'
                    }`}
                  />
                ))}
              </span>

              <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
                {t('pribehy.podklad')}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {Object.keys(PODKLADY).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStyl((st) => ({ ...st, podklad: k }))}
                    aria-pressed={styl.podklad === k}
                    className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] transition-colors ${
                      styl.podklad === k
                        ? 'border-brand-purple bg-brand-purple/15 text-ink'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {t(`pribehy.podklad.${k}`)}
                  </button>
                ))}
              </span>
            </div>
          </div>
        )}

        {/* HUDBA DO PŘÍBĚHU (zadání 8. 10. 2026). Skladby jsou naše vlastní;
            instagramová knihovna přes API dostupná není. */}
        {soubor && (skladby.length > 0 || jeVideo) && (
          <div className="flex flex-col gap-2 rounded-card border border-line p-3">
            <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
              {t('pribehy.hudba')}
            </span>

            {!umiHudbu ? (
              <span className="font-body text-xs text-muted">{t('pribehy.hudbaNeumi')}</span>
            ) : (
              <>
                {skladby.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => vyberSkladbu('')}
                      aria-pressed={!skladbaId}
                      className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] transition-colors ${
                        !skladbaId
                          ? 'border-brand-purple bg-brand-purple/15 text-ink'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      {t('pribehy.bezHudby')}
                    </button>
                    {skladby.map((sk) => (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => vyberSkladbu(sk.id)}
                        aria-pressed={skladbaId === sk.id}
                        title={sk.autor || undefined}
                        className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] transition-colors ${
                          skladbaId === sk.id
                            ? 'border-brand-purple bg-brand-purple/15 text-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        {sk.nazev}
                        {sk.delka > 0 && <span className="ml-1 tabular-nums opacity-70">{casMinSek(sk.delka)}</span>}
                      </button>
                    ))}
                  </span>
                )}

                {skladbaId && (
                  <>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 font-body text-xs text-muted">{t('pribehy.hudbaDelka')}</span>
                      {DELKY_PRIBEHU_S.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            zastavPoslech();
                            setDelkaPribehu(d);
                          }}
                          aria-pressed={delkaPribehu === d}
                          className={`cursor-pointer rounded-pill border px-2.5 py-1 font-heading text-[11px] tabular-nums transition-colors ${
                            delkaPribehu === d
                              ? 'border-brand-purple bg-brand-purple/15 text-ink'
                              : 'border-line text-muted hover:text-ink'
                          }`}
                        >
                          {t('pribehy.sekund', { s: String(d) })}
                        </button>
                      ))}
                    </span>

                    {nejpozdeji > 0 && (
                      <label className="flex items-center gap-2">
                        <span className="shrink-0 font-body text-xs text-muted">{t('pribehy.hudbaOdKdy')}</span>
                        <input
                          type="range"
                          min={0}
                          max={nejpozdeji}
                          step={1}
                          value={Math.min(zacatekHudby, nejpozdeji)}
                          onChange={(e) => {
                            zastavPoslech();
                            setZacatekHudby(Number(e.target.value));
                          }}
                          className="w-full accent-brand-purple"
                        />
                        <span className="shrink-0 font-heading text-[11px] tabular-nums text-ink">
                          {casMinSek(zacatekHudby)}
                        </span>
                      </label>
                    )}

                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={prepniPoslech}
                        className="cursor-pointer rounded-pill border border-line px-3 py-1 font-heading text-[11px] text-ink transition-colors hover:border-brand-purple"
                      >
                        {t(hraje ? 'pribehy.hudbaStop' : 'pribehy.hudbaPoslech')}
                      </button>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio
                        ref={poslechRef}
                        src={`/api/site/hudba/${encodeURIComponent(skladbaId)}/soubor`}
                        onEnded={() => setHraje(false)}
                        onPause={() => setHraje(false)}
                        preload="none"
                        className="hidden"
                      />
                    </span>
                  </>
                )}

                {jeVideo && (
                  <label className="flex items-center gap-2 font-body text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={bezZvuku || Boolean(skladbaId)}
                      disabled={Boolean(skladbaId)}
                      onChange={(e) => setBezZvuku(e.target.checked)}
                      className="accent-brand-purple"
                    />
                    {t('pribehy.bezPuvodnihoZvuku')}
                  </label>
                )}

                {(skladbaId || (jeVideo && bezZvuku)) && (
                  <span className="font-body text-[11px] text-muted">{t('pribehy.hudbaPozor')}</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Na telefonu by věta o formátech ujedla místo náhledu. */}
        <span className="hidden font-body text-xs text-muted md:inline">{t('pribehy.souborPopis')}</span>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {/* Na telefonu je Zveřejnit nahoře v liště, tady by bylo dvakrát. */}
          <button
            type="button"
            disabled={!soubor || pracuji !== null}
            onClick={() => void daj()}
            className="hidden cursor-pointer rounded-pill bg-brand-purple px-5 py-2 font-heading text-sm font-semibold text-white transition-colors hover:bg-brand-purpleDeep disabled:opacity-50 md:inline-flex"
          >
            {t(pracuji === 'odeslat' ? 'pribehy.vyvesuji' : 'pribehy.datNaInstagram')}
          </button>

          {/* TŘI TEČKY JEN NA TELEFONU (7. 10. 2026). Zbylé volby by na
              šířku telefonu zabraly dva řádky a ujedly místo náhledu; na
              počítači jsou pořád všechny vedle sebe. */}
          <button
            type="button"
            onClick={() => setDalsi((o) => !o)}
            aria-expanded={dalsi}
            aria-label={t('pribehy.dalsiVolby')}
            title={t('pribehy.dalsiVolby')}
            className={`cursor-pointer rounded-pill border px-4 py-2 font-heading text-sm leading-none transition-colors md:hidden ${
              dalsi ? 'border-brand-purple bg-brand-purple/15 text-ink' : 'border-line text-muted'
            }`}
          >
            ⋯
          </button>

          <div
            className={`${dalsi ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 md:flex md:w-auto`}
          >
            <button
              type="button"
              disabled={!soubor || pracuji !== null}
              onClick={() => void ulozKoncept()}
              className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-ink transition-colors hover:border-brand-purple disabled:opacity-50"
            >
              {t(pracuji === 'koncept' ? 'obecne.ukladam' : 'pribehy.ulozitKoncept')}
            </button>
            {soubor && (
              <>
                <label
                  htmlFor="pribeh-soubor"
                  className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-muted transition-colors hover:text-ink"
                >
                  {t('pribehy.vymenitFotku')}
                </label>
                <button
                  type="button"
                  disabled={pracuji !== null}
                  onClick={zacniZnovu}
                  className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  {t('pribehy.zacitZnovu')}
                </button>
                <button
                  type="button"
                  disabled={pracuji !== null}
                  onClick={() => void smazKoncept()}
                  className="cursor-pointer rounded-pill border border-line px-4 py-2 font-heading text-sm text-danger transition-colors hover:border-danger disabled:opacity-50"
                >
                  {t('pribehy.smazat')}
                </button>
              </>
            )}
          </div>

          {sklada !== null && (
            <span className="font-body text-xs tabular-nums text-muted">
              {t('pribehy.skladam', { procenta: String(Math.round(sklada * 100)) })}
            </span>
          )}
          {procenta !== null && (
            <span className="font-body text-xs tabular-nums text-muted">
              {t('pribehy.nahravam', { procenta: String(procenta) })}
            </span>
          )}
        </div>

        {chyba && (
          <p className="m-0 font-body text-sm text-danger" role="alert">
            {chyba}
          </p>
        )}
      </div>

      {/* --- VPRAVO: náhled ----------------------------------------------- */}
      {/**
         * Náhled se natáhne na výšku celé karty (6. 10. 2026: „udělal bych to
         * na výšku toho rastru, co je vlevo, a tím i zvětšil náhled").
         * Šířku si dopočítá poměr 9:16 sám, takže se rám nikdy nerozjede.
         */}
      <div
        ref={sloupecRef}
        className="order-2 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-hidden md:order-last md:block md:flex-none md:overflow-visible"
      >
        <label
          htmlFor="pribeh-soubor"
          onClick={(e) => {
            // S náhledem se do rámu klikat nedá - tahalo by se tím textem.
            if (nahled) e.preventDefault();
          }}
          className={`grid min-h-0 w-full flex-1 place-items-center md:block md:w-auto md:flex-none md:shrink-0 ${
            nahled ? '' : 'cursor-pointer'
          }`}
        >
{/* BAREVNÝ PROUŽEK OBLÉPÁ RÁM, NE CELOU PLOCHU (oprava 7. 10. 2026:
              „ještě dejme pryč to pozadí za fotkou, vypadá to hrozně").
              Předtím ho nesl `label`, který se na telefonu roztahuje na celou
              šířku - z tenkého kolečka kolem fotky se tak stal velký barevný
              podklad za náhledem.

              POMĚR DRŽÍ TENHLE OBAL, ne rám pod ním. První pokus měl obal
              `w-fit` a poměr na rámu - jenže šířka odvozená z procentní
              výšky se do `fit-content` nepočítá a celý náhled se smrskl na
              svislou čárku. Teď si výšku bere obal (na telefonu zbytek
              obrazovky, na počítači ze změřené mřížky vedle) a šířku z ní
              dopočítá poměr 9:16. Šířka jde přes proměnnou, ne přímo do
              `width`: hodnota ve `style` by přebila třídu a na telefonu by
              rám zůstal úzký. */}
          <span
            style={
              ramNaTelefonu
                ? { width: ramNaTelefonu.width, height: ramNaTelefonu.height }
                : ({ '--ram': `${sirkaRamu}px` } as React.CSSProperties)
            }
            className={`block shrink-0 rounded-[26px] p-[2px] ${
              ramNaTelefonu ? '' : 'aspect-[9/16] md:w-[calc(var(--ram)+4px)]'
            } ${nahled ? KROUZEK : KROUZEK_KLID}`}
          >
          {/* Rám už jen vyplňuje obal — poměr 9:16 i šířku drží obal nad ním. */}
          <span
            ref={ramRef}
            className="relative block h-full w-full overflow-hidden rounded-[24px] bg-field"
          >
            {nahled ? (
              <>
                {jeVideo ? (
                  <video src={nahled} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={nahled} alt="" className="h-full w-full object-cover" />
                )}
                <span className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-2">
                  <span className="h-[3px] rounded-pill bg-white/90" />
                  <span className="flex items-center gap-2">
                    <Znacka velikost={22} />
                    <span className="truncate font-heading text-[11px] text-white drop-shadow">
                      {ucet ? `@${ucet}` : t('pribehy.nadpis')}
                    </span>
                  </span>
                </span>
                {/* TEXT SE PÍŠE PŘÍMO DO FOTKY (zadání 7. 10. 2026: „na mobilu
                    musím ten text psát pod obrázkem a ne přímo do něj").

                    Vidět je pořád jen `span` níže - ten umí podklad po řádcích
                    a vypadá přesně jako výsledek. Přes něj leží PRŮHLEDNÉ pole:
                    stejné písmo, stejná šířka, stejné zarovnání, takže se řádky
                    lámou stejně a kurzor stojí tam, kde má. Vlastní písmo má
                    průhledné - barvu nese `span` pod ním.

                    Pole propouští doteky (`pointer-events-none`), dokud se do
                    něj neklepne; jinak by se textem nedalo táhnout.

                    Na počítači se bez textu blok nekreslí vůbec (`md:hidden`) -
                    tam se píše do pole vlevo a prázdný rám má zůstat prázdný. */}
                {!jeVideo && (
                  <div
                    onPointerDown={chytText}
                    onPointerMove={tahniText}
                    onPointerUp={pustText}
                    onPointerCancel={pustText}
                    role="presentation"
                    className={`absolute touch-none font-heading font-semibold leading-tight ${
                      pisuNaFotce ? '' : 'cursor-grab select-none active:cursor-grabbing'
                    } ${popisek.trim() ? '' : 'md:hidden'}`}
                    style={{
                      left: `${styl.x}%`,
                      top: `${styl.y}%`,
                      width: `${SIRKA_BLOKU}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: ramVyska ? (ramVyska * styl.velikost) / 100 : 14,
                      textAlign: styl.zarovnani,
                      color: styl.barva,
                    }}
                  >
                    <span
                      className="whitespace-pre-wrap"
                      style={{
                        background: PODKLADY[styl.podklad] ?? 'transparent',
                        padding: '0.12em 0.3em',
                        borderRadius: '0.22em',
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                      }}
                    >
                      {popisek || (
                        <span className="opacity-60">{t('pribehy.klepniAPis')}</span>
                      )}
                    </span>
                    <textarea
                      ref={poleNaFotce}
                      value={popisek}
                      onChange={(e) => setPopisek(e.target.value.slice(0, MAX_POPISEK))}
                      onBlur={() => setPisuNaFotce(false)}
                      rows={1}
                      aria-label={t('pribehy.popisek')}
                      className={`absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none md:hidden ${
                        pisuNaFotce ? 'pointer-events-auto' : 'pointer-events-none'
                      }`}
                      style={{
                        color: 'transparent',
                        caretColor: styl.barva,
                        font: 'inherit',
                        textAlign: styl.zarovnani,
                        padding: '0.12em 0.3em',
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <span className="absolute inset-0 grid place-items-center text-center">
                <span className="flex flex-col items-center gap-2 px-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-purple font-display text-3xl leading-none text-white">
                    +
                  </span>
                  <span className="font-heading text-xs text-muted">{t('pribehy.vybratSoubor')}</span>
                </span>
              </span>
            )}
          </span>
          </span>
        </label>
        <input
          id="pribeh-soubor"
          ref={vstupSouboru}
          type="file"
          accept={PRIJIMANE_PRIPONY}
          onChange={vyber}
          className="sr-only"
        />
        {/* Bez vybraného souboru se pod rámem nic nepíše - prázdný rám řekne
            o formátu víc než věta pod ním (6. 10. 2026). */}
        {nahled && (
          <span className="hidden max-w-[260px] shrink-0 text-center font-body text-[11px] text-muted md:block">
            {t(jeVideo ? 'pribehy.uVideaBezTextu' : 'pribehy.tahniText')}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ZMÍNKY (zadání 6. 10. 2026: „kdyby tam šli označit lidi přes zavináč,
 * zmínky a spolupráce").
 *
 * POZOR, CO INSTAGRAM UMÍ: oficiální API u příběhů NEUMÍ nalepit zmínkovou
 * nálepku ani přidat spolupracovníka - vyvěsí jen samotný obrázek. Zavináč
 * se tedy propíše do textu a je na příběhu vidět, ale není to klikací odkaz.
 * Kdo chce opravdovou nálepku, musí příběh vyvěsit z telefonu.
 *
 * Nabídka se staví z toho, co už kdo použil dřív (viz /api/site/pribehy/
 * zminky) - vlastní tabulka účtů by se stejně nikdy neudržovala.
 */
function Zminky({ text, naVlozeni }: { text: string; naVlozeni: (znacka: string) => void }) {
  const t = usePreklad();
  const [znamé, setZname] = useState<string[]>([]);

  useEffect(() => {
    let zruseno = false;
    fetch('/api/site/pribehy/zminky')
      .then((r) => (r.ok ? r.json() : { zminky: [] }))
      .then((d) => {
        if (!zruseno) setZname(Array.isArray(d.zminky) ? d.zminky : []);
      })
      .catch(() => undefined);
    return () => {
      zruseno = true;
    };
  }, []);

  const rozepsana = text.match(/@([A-Za-z0-9._]*)$/)?.[1]?.toLowerCase() ?? null;
  const nabidka =
    rozepsana === null
      ? znamé.slice(0, 6)
      : znamé.filter((z) => z.slice(1).startsWith(rozepsana)).slice(0, 6);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted">
          {t('pribehy.zminky')}
        </span>
        {nabidka.length === 0 ? (
          <span className="font-body text-xs text-muted">{t('pribehy.zminkyZatimZadne')}</span>
        ) : (
          nabidka.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => naVlozeni(z)}
              className="cursor-pointer rounded-pill border border-line px-2.5 py-1 font-heading text-[11px] text-ink transition-colors hover:border-brand-purple"
            >
              {z}
            </button>
          ))
        )}
      </div>
      <span className="font-body text-[11px] text-muted">{t('pribehy.zminkyPopis')}</span>
    </div>
  );
}

function Knoflik({
  popisek,
  nazev,
  onClick,
  vypnuto,
}: {
  popisek: string;
  nazev: string;
  onClick: () => void;
  vypnuto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={vypnuto}
      aria-label={nazev}
      title={nazev}
      className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line font-heading text-sm text-ink transition-colors hover:border-brand-purple disabled:opacity-40"
    >
      {popisek}
    </button>
  );
}

