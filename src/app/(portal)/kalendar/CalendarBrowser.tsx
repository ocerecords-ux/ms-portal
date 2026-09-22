'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VyskytyHledani } from './VyskytyHledani';
import { PoradaForm } from './Porady';
import {
  BARVA_PORAD,
  NAZEV_KALENDARE_PORADY,
  SOLO_PORADY,
  platnyOdkaz,
  popisOpakovani,
  type PoradaVKalendari,
} from '@/lib/porady';
import { OdberKalendare } from './OdberKalendare';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BLOCK_KIND_LABELS,
  CALENDAR_VIEWS,
  GRID_END_HOUR,
  GRID_SCROLL_TO_HOUR,
  GRID_START_HOUR,
  HOUR_PX,
  SLOT_STATE_LABELS,
  WEEKDAY_SHORT,
  eventColors,
  formatDateTime,
  gridPosition,
  minutesInZone,
  minutesToTime,
  rozvrhniPrekryvy,
  utcParts,
  zonedToUtc,
  jePraceVeStudiu,
  maHerce,
  ZADNE_STUDIO,
  SOLO_MIMO,
  SOLO_MOJE,
  type CalendarView,
} from '@/lib/calendar';
import { VyberProjektu } from '@/app/(portal)/components/VyberProjektu';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import {
  BARVA_NEPRITOMNOSTI,
  NAZEV_KALENDARE_MIMO,
  PASMO_NEPRITOMNOSTI,
  type NepritomnostVKalendari,
} from '@/lib/nepritomnost';
import {
  CipNepritomnosti,
  NepritomnostForm,
  PruhNepritomnosti,
  rozdelPoDnech,
  type Osoba,
} from './Nepritomnost';

/** Položka rozbalovacího seznamu lidí a projektů. */
/**
 * STŘIH BEZ PROJEKTU (21. 9. 2026: „u střihu nevidíme název projektu").
 *
 * Střihy převzaté z Google kalendáře tam byly zapsané jen jako „Střih (TI)" -
 * projekt v nich nikdy nebyl, takže ho portál nemá odkud vzít a hádat ho
 * nebudeme. Bublina to aspoň řekne nahlas, ať to nevypadá jako chyba
 * zobrazení; dvojklik projekt doplní a seed ho už nepřepíše.
 */
function strihBezProjektu(e: CalendarEvent): boolean {
  return e.kind === 'BLOCK' && e.state === 'STRIH' && !e.udalost?.projectName;
}

export type Volba = {
  id: string;
  label: string;
  dokonceny?: boolean;
  nazev?: string;
  /** U zvukaře id studií, ve kterých točí (zadání 20. 9. 2026). */
  studia?: string[];
};

export type CalendarDay = {
  key: string;
  startIso: string;
  endIso: string;
  inMonth: boolean;
  byArrangement: boolean;
  openFrom: number | null;
  openTo: number | null;
};

export type CalendarEvent = {
  id: string;
  /** MIMO = kalendář Mimo studio na pár hodin (19. 9. 2026), PORADA = porada (21. 9. 2026). */
  kind: 'SLOT' | 'BLOCK' | 'MIMO' | 'PORADA';
  studioId: string;
  studioName: string;
  color: string;
  start: string;
  end: string;
  state: string;
  title: string;
  subtitle?: string;
  href?: string;
  /**
   * Rozepsané údaje ručně zapsané události - z nich se plní formulář při
   * úpravě (zadání 14. 9. 2026: „chybí mi možnost upravit událost").
   */
  udalost?: {
    caflouProjectId: string | null;
    projectName: string | null;
    actorUserId: string | null;
    actorName: string | null;
    zvukarUserId: string | null;
    zvukarName: string | null;
  };
  /** Záznam z kalendáře Mimo studio - z něj se plní jeho okno. */
  mimo?: NepritomnostVKalendari;
  /** Výskyt porady (21. 9. 2026) - z něj se plní její okno a detail. */
  porada?: PoradaVKalendari;
  /** Poznámka / vzkaz k události (19. 9. 2026). */
  poznamka?: string | null;
};

/**
 * Termín z nabídky, který jde v kalendáři upravit - vybraný nebo potvrzený
 * (zadání 19. 9. 2026: „aby pak šly dvojklikem editovat… prostě všechno").
 */
function jeUpravitelnaFrekvence(e: CalendarEvent): boolean {
  return e.kind === 'SLOT' && (e.state === 'CONFIRMED' || e.state === 'SELECTED');
}

/** HH:MM v Praze - předvyplněný čas v okně Mimo studio. */
function casVPraze(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: PASMO_NEPRITOMNOSTI,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

type Studio = { id: string; shortName: string; name: string; timezone: string; color: string };

/**
 * Kalendář studií. Kreslí celý den 0–24 (zprava uzivatele 9. 9. 2026) a umí
 * PROLNOUT víc studií najednou — každé má svou barvu a dá se vypnout.
 * Dvojklik do volného místa založí blokaci.
 */
export function CalendarBrowser({
  panely,
  studios,
  selectedStudioIds,
  timezone,
  view,
  anchorIso,
  days,
  events,
  canManage,
  spravovanaStudia,
  projekty,
  herci,
  zvukari,
  nepritomnosti,
  ukazNepritomnost,
  porady,
  ukazPorady,
  puvodniPorady,
  puvodniStudioIds,
  puvodniNepritomnost,
  solo,
  ja,
  lidiTymu,
}: {
  studios: Studio[];
  selectedStudioIds: string[];
  timezone: string;
  view: CalendarView;
  anchorIso: string;
  days: CalendarDay[];
  /**
   * Tři období vedle sebe (předchozí, zobrazené, následující) - kalendář se
   * roluje jako jeden dlouhý pás (zadání 20. 9. 2026).
   */
  panely: { klic: string; days: CalendarDay[] }[];
  events: CalendarEvent[];
  canManage: boolean;
  /**
   * Vedoucí pobočky (22. 9. 2026) upravuje jen svá studia - tady jejich id.
   * null = všechna (produkce, Žůžo-labůžo).
   */
  spravovanaStudia: string[] | null;
  /** Nabídka do ručně zapsané události (zadání 14. 9. 2026). */
  projekty: Volba[];
  herci: Volba[];
  zvukari: Volba[];
  /** Kalendář dovolených a nepřítomnosti (zadání 19. 9. 2026). */
  nepritomnosti: NepritomnostVKalendari[];
  ukazNepritomnost: boolean;
  /**
   * PORADY (zadání 21. 9. 2026) - jen ty, na které je přihlášený pozvaný.
   * `puvodniPorady` je zaškrtnutí v adrese (jako `puvodniNepritomnost`).
   */
  porady: PoradaVKalendari[];
  ukazPorady: boolean;
  puvodniPorady: boolean;
  /**
   * SOLO REŽIM (zadání 20. 9. 2026: „ať to funguje jako prozatímní sólo
   * funkce. Když kliknu znova, tak se vrátí původní zaškrtnutí kalendářů,
   * tak jak to bylo před kliknutím").
   *
   * Původní zaškrtnutí zůstává v adrese (`studia`, `nepritomnost`), sólo je
   * jen `solo=<studio|mimo>` navíc. Odebráním `solo` se výběr vrátí přesně
   * do stavu před kliknutím - i po obnovení stránky nebo z odkazu.
   */
  puvodniStudioIds: string[];
  puvodniNepritomnost: boolean;
  solo: string;
  ja: Osoba;
  /** Lidé z týmu - výběr osoby v okně Mimo studio. */
  lidiTymu: Osoba[];
}) {
  const router = useRouter();

  /**
   * TELEFON NA ŠÍŘKU = JEN MŘÍŽKA (zadání 21. 9. 2026: „když jsem na stránce
   * kalendář a otočím mobil na šířku, tak se mi zobrazí na fullscreen
   * a zobrazí se jen mřížka kalendáře"). Stránka si tu značku dá na <html>
   * a zbytek obstará CSS v globals.css (media query na šířku a nízkou
   * výšku) - lišta, ovládání a panely zmizí, mřížka dostane celou výšku.
   * Po odchodu z kalendáře se značka zase sundá.
   */
  useEffect(() => {
    document.documentElement.dataset.kalendar = '1';
    return () => {
      delete document.documentElement.dataset.kalendar;
    };
  }, []);

  /**
   * KALENDÁŘ SE AKTUALIZUJE SÁM (zadání 21. 9. 2026: „aby se aktualizoval
   * kalendář sám, když mám otevřený prohlížeč nebo aplikaci, co nejdříve").
   *
   * Každých pár vteřin se zeptá /api/kalendar/zmena na krátký otisk dat. Když
   * se od minula liší (někdo jiný zapsal, přesunul nebo smazal událost), stáhne
   * kalendář znovu - `router.refresh()` vymění jen data, rozepsaný formulář ani
   * posunutý pás se nezavřou. Ve skryté záložce se neptá vůbec; po návratu do
   * okna (nebo do aplikace v telefonu) se zeptá hned.
   */
  useEffect(() => {
    const INTERVAL_MS = 8000;
    let posledni: string | null = null;
    let bezi = false;
    const zkontroluj = async () => {
      if (bezi || document.visibilityState !== 'visible') return;
      bezi = true;
      try {
        const res = await fetch('/api/kalendar/zmena', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        const otisk: string | null = data?.otisk ?? null;
        if (otisk) {
          if (posledni !== null && otisk !== posledni) router.refresh();
          posledni = otisk;
        }
      } catch {
        // Bez sítě se prostě zkusí příště.
      } finally {
        bezi = false;
      }
    };
    void zkontroluj();
    const casovac = window.setInterval(() => void zkontroluj(), INTERVAL_MS);
    const naNavrat = () => {
      if (document.visibilityState === 'visible') void zkontroluj();
    };
    document.addEventListener('visibilitychange', naNavrat);
    window.addEventListener('focus', naNavrat);
    return () => {
      window.clearInterval(casovac);
      document.removeEventListener('visibilitychange', naNavrat);
      window.removeEventListener('focus', naNavrat);
    };
  }, [router]);
  /** Otevřené okno Mimo studio: nová událost, nebo úprava. */
  const [oknoNepritomnosti, setOknoNepritomnosti] = useState<{
    upravovana: NepritomnostVKalendari | null;
    den: string;
    celyDen?: boolean;
    casOd?: string;
    casDo?: string;
  } | null>(null);
  /** Otevřené okno porady: nová, nebo úprava (21. 9. 2026). */
  const [oknoPorady, setOknoPorady] = useState<{
    upravovana: PoradaVKalendari | null;
    den: string;
    casOd?: string;
    casDo?: string;
  } | null>(null);
  const [hledani, setHledani] = useState('');
  /** Seznam výskytů v celém kalendáři (20. 9. 2026) - dá se zavřít křížkem. */
  const [seznamVyskytu, setSeznamVyskytu] = useState(true);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  /** Kde na obrazovce je bublina, ze ktere detail vystoupi (20. 9. 2026). */
  const [kotvaDetailu, setKotvaDetailu] = useState<Kotva | null>(null);
  const [novaBlokace, setNovaBlokace] = useState<{ studioId: string; start: string; end: string } | null>(null);
  /** Událost otevřená k úpravě (zadání 14. 9. 2026). */
  const [upravovana, setUpravovana] = useState<CalendarEvent | null>(null);

  /**
   * DVOJKLIK NA UDÁLOST OTEVŘE ÚPRAVU (zadání 19. 9. 2026: „ať tím dvojklikem
   * se mi otevře okno pro úpravy události stejně, jako když zakládám
   * událost").
   *
   * Je to totéž okno jako u nové události, jen předvyplněné - stejně jako
   * tlačítko Upravit v detailu. Upravit smí jen ten, kdo kalendář spravuje.
   * Od 19. 9. 2026 jde upravit i potvrzená frekvence z nabídky (studio, čas,
   * zvukař, poznámka, případně předělat na střih) - herec o změně dostane
   * oznámení.
   *
   * JEDEN KLIK POČKÁ ČTVRT VTEŘINY. Dvojklik začíná obyčejným klikem, a ten
   * otevírá detail - bez čekání by na okamžik vyskočil detail a hned ho
   * překrylo okno úprav. Čeká se jen u událostí, které jdou upravit; u
   * ostatních se detail otevře hned, protože tam dvojklik nic nedělá.
   */
  const casovacDetailu = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Poradu vidí jen účastníci - a každý účastník ji smí upravit (21. 9. 2026).
  const smiStudio = (studioId: string | null | undefined) =>
    canManage && (spravovanaStudia === null || (Boolean(studioId) && spravovanaStudia.includes(studioId as string)));
  const lzeUpravit = (e: CalendarEvent) =>
    e.kind === 'PORADA' || (smiStudio(e.studioId) && (e.kind === 'BLOCK' || jeUpravitelnaFrekvence(e)));
  /** Studia, do kterých přihlášený smí zapisovat - nabídka ve formuláři. */
  const mojeStudia = spravovanaStudia === null ? studios : studios.filter((s) => spravovanaStudia.includes(s.id));

  function klikNaUdalost(e: CalendarEvent, kotva?: Kotva) {
    const otevri = () => {
      setKotvaDetailu(kotva ?? null);
      setDetail(e);
    };
    // Mimo studio nemá detail s tlačítky - klik rovnou otevře úpravu, stejně
    // jako u celodenního štítku. Cizí záznam ukáže jen detail ke čtení.
    if (e.kind === 'MIMO' && e.mimo) {
      if (e.mimo.muzeUpravit) setOknoNepritomnosti({ upravovana: e.mimo, den: e.start });
      else otevri();
      return;
    }
    if (!lzeUpravit(e)) {
      otevri();
      return;
    }
    if (casovacDetailu.current) clearTimeout(casovacDetailu.current);
    casovacDetailu.current = setTimeout(() => {
      casovacDetailu.current = null;
      otevri();
    }, 230);
  }

  function dvojklikNaUdalost(e: CalendarEvent) {
    if (e.kind === 'MIMO') return; // uz ji otevrel prvni klik
    if (!lzeUpravit(e)) {
      // CIZÍ UDÁLOST NESMÍ ZABLOKOVAT ZÁPIS (22. 9. 2026: „Tomášovi nejde
      // přidávat události do kalendáře mimo studio"). Když je den plný
      // střihů, nebylo kam dvojkliknout - dvojklik na událost, kterou
      // člověk upravit nesmí, proto založí novou ve stejném čase.
      setDetail(null);
      const den = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(e.start));
      novaVMrizce(den, minutesInZone(new Date(e.start), timezone));
      return;
    }
    if (casovacDetailu.current) {
      clearTimeout(casovacDetailu.current);
      casovacDetailu.current = null;
    }
    setDetail(null);
    if (e.kind === 'PORADA' && e.porada) {
      setOknoPorady({ upravovana: e.porada, den: e.porada.den });
      return;
    }
    setNovaBlokace(null);
    setUpravovana(e);
  }

  useEffect(
    () => () => {
      if (casovacDetailu.current) clearTimeout(casovacDetailu.current);
    },
    [],
  );

  /**
   * Mimo studio na pár hodin se kreslí v hodinové mřížce jako každá jiná
   * událost (upřesnění 19. 9. 2026: „chovat by se to mělo stejně jako ostatní
   * kalendáře"). Celodenní jsou v pruhu nad ní.
   */
  const udalostiMimo = useMemo<CalendarEvent[]>(
    () =>
      nepritomnosti
        .filter((n) => !n.celyDen)
        .map((n) => ({
          id: `mimo-${n.id}`,
          kind: 'MIMO' as const,
          studioId: '',
          studioName: NAZEV_KALENDARE_MIMO,
          color: BARVA_NEPRITOMNOSTI,
          start: n.start,
          end: n.end,
          state: 'MIMO',
          title: n.poznamka ? `${n.jmeno}\n${n.poznamka}` : n.jmeno,
          subtitle: NAZEV_KALENDARE_MIMO,
          mimo: n,
        })),
    [nepritomnosti],
  );

  /** Výskyty porad jako události mřížky (21. 9. 2026). */
  const udalostiPorad = useMemo<CalendarEvent[]>(
    () =>
      porady.map((p) => ({
        id: `porada-${p.id}`,
        kind: 'PORADA' as const,
        studioId: '',
        studioName: NAZEV_KALENDARE_PORADY,
        color: BARVA_PORAD,
        start: p.start,
        end: p.end,
        state: 'PORADA',
        // Druhý řádek jsou účastníci - u porady to je to „kdo s kým".
        title: `${p.nazev}\n${p.ucastnici.map((u) => u.label).join(', ')}`,
        subtitle: NAZEV_KALENDARE_PORADY,
        poznamka: p.poznamka,
        porada: p,
      })),
    [porady],
  );

  const viditelne = useMemo(() => {
    const dotaz = hledani.trim().toLowerCase();
    return [...events, ...udalostiMimo, ...udalostiPorad].filter((e) => {
      if (dotaz && !e.title.toLowerCase().includes(dotaz)) return false;
      return true;
    });
  }, [events, udalostiMimo, udalostiPorad, hledani]);

  /**
   * Otevřené okno zavře Escape a stránka pod ním se nesmí rolovat - jinak
   * se při kolečku myši posouvá kalendář za oknem místo obsahu okna.
   */
  const oknoOtevrene = Boolean(novaBlokace || upravovana || oknoNepritomnosti || oknoPorady);
  useEffect(() => {
    if (!oknoOtevrene) return;
    function naKlavesu(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setNovaBlokace(null);
      setUpravovana(null);
      setOknoNepritomnosti(null);
      setOknoPorady(null);
    }
    const puvodni = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', naKlavesu);
    return () => {
      document.body.style.overflow = puvodni;
      document.removeEventListener('keydown', naKlavesu);
    };
  }, [oknoOtevrene]);

  /**
   * Všechny dny pásu (tři období za sebou, bez opakování). Měsíční pásy se
   * na krajích překrývají, tak se stejný den nesmí objevit dvakrát.
   */
  const dnyPasu = useMemo(() => {
    const mapa = new Map<string, CalendarDay>();
    for (const p of panely) for (const d of p.days) if (!mapa.has(d.key)) mapa.set(d.key, d);
    return Array.from(mapa.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [panely]);

  /** Události rozdělené po dnech — klíčem je den v pásmu studia. */
  const podleDnu = useMemo(() => {
    const mapa = new Map<string, CalendarEvent[]>();
    for (const den of dnyPasu) mapa.set(den.key, []);
    // Den události = její začátek v pásmu studia. en-CA píše datum jako
    // 2026-09-20, tedy přesně v podobě klíče dne.
    const naDen = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    for (const e of viditelne) mapa.get(naDen.format(new Date(e.start)))?.push(e);
    return mapa;
  }, [dnyPasu, viditelne, timezone]);

  /** Dovolené rozdělené po dnech - vícedenní se ukáže v každém dni. */
  const nepritomnostPodleDnu = useMemo(() => rozdelPoDnech(dnyPasu, nepritomnosti), [dnyPasu, nepritomnosti]);
  /** Do pruhu nad mřížkou jen celodenní - ty na čas jsou v mřížce. */
  const celodenniPodleDnu = useMemo(
    () => rozdelPoDnech(dnyPasu, nepritomnosti, true),
    [dnyPasu, nepritomnosti],
  );

  /**
   * DVOJKLIK DO KALENDÁŘE (upřesnění 19. 9. 2026: „přidám dvojklikem. Akorát
   * rozdíl je v tom, že přidávat můžou všichni").
   *
   * Kdo spravuje studia, dostane okno události jako dřív - a v něm si místo
   * studia vybere kalendář Mimo studio. Ostatní (zvukař) do studií nepíšou,
   * takže jim dvojklik otevře rovnou Mimo studio.
   */
  function novaVMrizce(denKey: string, minuty: number) {
    const [y, m, d] = denKey.split('-').map(Number);
    // Zaokrouhli na celou hodinu - je to jen návrh, čas od-do se pak dopíše
    // ve formuláři (zadání 14. 9. 2026).
    const od = Math.floor(minuty / 60) * 60;
    const start = zonedToUtc(y, m, d, od, timezone).toISOString();
    const end = zonedToUtc(y, m, d, Math.min(24 * 60, od + 60), timezone).toISOString();
    // Svítí jen Porady - dvojklik zakládá rovnou poradu (21. 9. 2026).
    if (solo === SOLO_PORADY) {
      setOknoPorady({ upravovana: null, den: denKey, casOd: casVPraze(start), casDo: casVPraze(end) });
      return;
    }
    if (canManage && mojeStudia.length > 0) {
      // Kdyz jsou studia zhasnuta (svitilo jen Mimo studio), nova udalost
      // spadne do prvniho studia - v okne se da prepnout. Vedouci pobocky
      // dostane jen sva studia (22. 9. 2026).
      const vybrane = selectedStudioIds.find((id) => mojeStudia.some((s) => s.id === id));
      setNovaBlokace({ studioId: vybrane ?? mojeStudia[0].id, start, end });
      return;
    }
    setOknoNepritomnosti({
      upravovana: null,
      den: denKey,
      celyDen: false,
      casOd: casVPraze(start),
      casDo: casVPraze(end),
    });
  }

  /** Dvojklik na den v měsíci - bez času, takže u Mimo studio celý den. */
  function novaVMesici(denKey: string) {
    if (canManage && mojeStudia.length > 0) {
      novaVMrizce(denKey, 9 * 60);
      return;
    }
    setOknoNepritomnosti({ upravovana: null, den: denKey, celyDen: true });
  }

  /**
   * Adresa kalendáře. `studia` a `nepritomnost` drží PŮVODNÍ zaškrtnutí i
   * během sóla - proto se dá sólo kdykoli sundat a výběr se vrátí.
   */
  function adresa(zmeny: Record<string, string>) {
    const params = new URLSearchParams({
      // Prázdný seznam v adrese znamená „všechna studia", takže vypnutá
      // studia se musí napsat značkou (20. 9. 2026).
      studia: puvodniStudioIds.length > 0 ? puvodniStudioIds.join(',') : ZADNE_STUDIO,
      pohled: view,
      datum: anchorIso,
      nepritomnost: puvodniNepritomnost ? '1' : '0',
      porady: puvodniPorady ? '1' : '0',
      solo,
      ...zmeny,
    });
    if (!params.get('solo')) params.delete('solo');
    return `/kalendar?${params.toString()}`;
  }

  function prejdi(zmeny: Record<string, string>) {
    router.push(adresa(zmeny));
  }

  /** Datum o `smer` dopředu nebo dozadu podle zvoleného pohledu. */
  function datumPosunu(smer: -1 | 1): string {
    const d = new Date(`${anchorIso}T12:00:00.000Z`);
    if (view === 'den') d.setUTCDate(d.getUTCDate() + smer);
    else if (view === 'tyden') d.setUTCDate(d.getUTCDate() + 7 * smer);
    else d.setUTCMonth(d.getUTCMonth() + smer);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Kulička u štítku: zapnutí a vypnutí kalendáře vedle ostatních. Sólo tím
   * končí - kdo sahá na zaškrtnutí, chce zpátky svůj výběr. Poslední zapnutý
   * kalendář se vypnout nedá, prázdná mřížka nikomu nepomůže.
   */
  function prepniStudio(id: string) {
    const dalsi = puvodniStudioIds.includes(id)
      ? puvodniStudioIds.filter((x) => x !== id)
      : [...puvodniStudioIds, id];
    if (dalsi.length === 0 && !puvodniNepritomnost && !puvodniPorady) return;
    prejdi({ studia: dalsi.length > 0 ? dalsi.join(',') : ZADNE_STUDIO, solo: '' });
  }

  /** Kulička u Mimo studio - stejné pravidlo jako u studií. */
  function prepniMimoStudio() {
    if (puvodniNepritomnost && puvodniStudioIds.length === 0 && !puvodniPorady) return;
    prejdi({ nepritomnost: puvodniNepritomnost ? '0' : '1', solo: '' });
  }

  /** Kulička u Porad (21. 9. 2026) - stejné pravidlo jako u ostatních. */
  function prepniPorady() {
    if (puvodniPorady && puvodniStudioIds.length === 0 && !puvodniNepritomnost) return;
    prejdi({ porady: puvodniPorady ? '0' : '1', solo: '' });
  }

  /**
   * Klik na název štítku: prozatímní sólo. Druhý klik na stejný název sólo
   * sundá a vrátí zaškrtnutí, jaké bylo předtím; klik na jiný název sólo
   * přehodí na něj.
   */
  function jenTentoKalendar(id: string) {
    prejdi({ solo: solo === id ? '' : id });
  }

  /** Jméno sólujícího kalendáře do popisku nad mřížkou. */
  const nazevSola = solo
    ? solo === SOLO_MIMO
      ? NAZEV_KALENDARE_MIMO
      : solo === SOLO_PORADY
        ? NAZEV_KALENDARE_PORADY
        : solo === SOLO_MOJE
          ? 'Jen moje události'
          : (studios.find((s) => s.id === solo)?.shortName ?? '')
    : '';

  // Odkud se prislo - po posunu zpet se tyden v mobilu ukaze od konce
  // (nedele), po posunu vpred od zacatku, at gesto navazuje (20. 9. 2026).
  const [smerPosunu, setSmerPosunu] = useState<-1 | 1>(1);

  /**
   * JEDEN DLOUHÝ PÁS (zadání 20. 9. 2026: „chci to posouvat, jako by to byl
   * jeden dlouhý pás").
   *
   * Předchozí pokusy posouvaly stránku: mřížka odjela, vyměnila se a přijela
   * zpátky. Ať to bylo časované jakkoli, byl to pořád přeskok. Tohle je něco
   * jiného - vedle sebe leží TŘI období (minulé, zobrazené, příští) a jedou
   * v obyčejném vodorovném rolování prohlížeče. Prst i dva prsty na touchpadu
   * tak táhnou pás přímo, bez animace a bez čekání na server: obsah sousedů
   * už je načtený (viz `panely` v page.tsx).
   *
   * Jakmile se pás zastaví u souseda, tiše se přepíše adresa a server pošle
   * nové trojče. Pás se pak bez animace vrátí doprostřed - a protože
   * prostřední období je teď to, na které se uživatel dorolovval, na obrazovce
   * se nic nezmění.
   */
  const pas = useRef<HTMLDivElement | null>(null);
  /** Šířka jednoho období = šířka okna pásu. */
  const sirkaPole = () => pas.current?.clientWidth ?? 0;
  /** Běží přepis adresy? Do té doby se další zastavení neřeší. */
  const prepisujeme = useRef(false);

  // Po výměně obsahu pás okamžitě (bez animace) na prostřední období.
  // useLayoutEffect: ještě než prohlížeč vykreslí, aby to nepoposkočilo.
  useLayoutEffect(() => {
    const el = pas.current;
    if (!el) return;
    const naStred = () => {
      const puvodni = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollLeft = sirkaPole();
      el.style.scrollBehavior = puvodni;
    };
    naStred();
    // Šířka se po prvním vykreslení může ještě ustálit (písma, rolovátko).
    const snimek = requestAnimationFrame(naStred);
    prepisujeme.current = false;
    return () => cancelAnimationFrame(snimek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorIso, view, solo, puvodniNepritomnost, puvodniPorady, puvodniStudioIds.join(',')]);

  // Když se okno zvětší nebo zmenší, prostřední období musí zůstat prostřední.
  useEffect(() => {
    const el = pas.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sledovac = new ResizeObserver(() => {
      if (!prepisujeme.current) el.scrollLeft = sirkaPole();
    });
    sledovac.observe(el);
    return () => sledovac.disconnect();
  }, []);

  /** Pás se zastavil - jsme u souseda? Pak přepsat adresu. */
  function dojelo() {
    const el = pas.current;
    if (!el || prepisujeme.current) return;
    const sirka = sirkaPole();
    if (sirka <= 0) return;
    const pole = Math.round(el.scrollLeft / sirka);
    if (pole === 1) return;
    const smer: -1 | 1 = pole < 1 ? -1 : 1;
    prepisujeme.current = true;
    setSmerPosunu(smer);
    // Pojistka: kdyby odpověď nedorazila, ať pás nezůstane hluchý napořád.
    window.setTimeout(() => (prepisujeme.current = false), 2500);
    // `scroll: false` - stránka nesmí odskočit nahoru, jsme uprostřed čtení.
    router.replace(adresa({ datum: datumPosunu(smer) }), { scroll: false });
  }

  // Zastavení pásu. `scrollend` umí novější prohlížeče; jinde se čeká, až se
  // rolování na chvilku utiší.
  useEffect(() => {
    const el = pas.current;
    if (!el) return;
    let casovac: number | undefined;
    const maScrollEnd = 'onscrollend' in window;
    const prirolovani = () => {
      if (maScrollEnd) return;
      window.clearTimeout(casovac);
      casovac = window.setTimeout(dojelo, 120);
    };
    el.addEventListener('scroll', prirolovani, { passive: true });
    if (maScrollEnd) el.addEventListener('scrollend', dojelo);
    return () => {
      el.removeEventListener('scroll', prirolovani);
      if (maScrollEnd) el.removeEventListener('scrollend', dojelo);
      window.clearTimeout(casovac);
    };
    // Závislosti musí obsahovat všechno, z čeho se skládá adresa - jinak by
    // posluchač držel starý výběr studií a švihnutí by ho vrátilo zpátky.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorIso, view, solo, puvodniNepritomnost, puvodniPorady, puvodniStudioIds.join(',')]);

  /** Šipky: stejný pohyb, jen ho rozjede prohlížeč sám a plynule. */
  function posun(smer: -1 | 1) {
    const el = pas.current;
    if (!el || prepisujeme.current) return;
    setSmerPosunu(smer);
    el.scrollTo({ left: sirkaPole() * (1 + smer), behavior: 'smooth' });
  }

  // Sousední období se přednačítají, ať je po zastavení pásu výměna hned.
  useEffect(() => {
    router.prefetch(adresa({ datum: datumPosunu(-1) }));
    router.prefetch(adresa({ datum: datumPosunu(1) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorIso, view, solo, puvodniNepritomnost, puvodniPorady, puvodniStudioIds.join(',')]);

  const nadpis = useMemo(() => {
    const prvni = new Date(days[0].startIso);
    const posledni = new Date(days[days.length - 1].startIso);
    if (view === 'den') {
      return new Intl.DateTimeFormat('cs-CZ', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(prvni);
    }
    if (view === 'mesic') {
      const stred = new Date(`${anchorIso}T12:00:00.000Z`);
      return new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, month: 'long', year: 'numeric' }).format(stred);
    }
    const od = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric', month: 'numeric' }).format(prvni);
    const doo = new Intl.DateTimeFormat('cs-CZ', {
      timeZone: timezone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(posledni);
    return `${od} – ${doo}`;
  }, [days, view, timezone, anchorIso]);

  return (
    <section data-kal-sekce className="flex flex-col gap-3 sm:gap-5">
      {/* Hlavicka: pohled a posun v case.

          NA TELEFONU DVA ŘÁDKY MÍSTO ŠESTI (zadání 21. 9. 2026: „zredukujme
          řádky u kalendáře v mobilu, aby se posunul víc nahoru k horní
          liště"): datum a ‹ Dnes › na jednom, Den/Týden/Měsíc pod tím,
          kalendáře v jednom posuvném pruhu a pod nimi hledání. */}
      <div data-kal-ovladani className="flex items-end justify-between gap-4 flex-wrap">
        <div className="hidden sm:block">
          <h1 className="hidden sm:block font-display text-3xl sm:text-4xl text-ink m-0">Kalendář</h1>
          <p className="text-sm font-body text-muted m-0 mt-1 capitalize">{nadpis}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
          <p className="sm:hidden mr-auto text-sm font-heading text-muted m-0 capitalize">{nadpis}</p>
          <button
            type="button"
            onClick={() => posun(-1)}
            aria-label="Předchozí"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => prejdi({ datum: new Date().toISOString().slice(0, 10) })}
            className="rounded-lg border border-line px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => posun(1)}
            aria-label="Další"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ›
          </button>
          {/* Na telefonu zalomí Den/Týden/Měsíc na další řádek. */}
          <span className="basis-full h-0 sm:hidden" aria-hidden="true" />
          <span className="inline-flex rounded-lg border border-line overflow-hidden sm:ml-2">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => prejdi({ pohled: v.key })}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-heading font-semibold transition-colors ${
                  v.key === view ? 'bg-brand-purple text-white' : 'bg-surface text-muted hover:text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </span>
          {/* MS kalendar do Google/Apple (zadani 20. 9. 2026) - jen ikonka
              na konci, pouziva se jednou. */}
          <OdberKalendare studios={studios.map((s) => ({ id: s.id, name: s.name, color: s.color }))} />
          {/* PŘIDAT BEZ DVOJKLIKU (22. 9. 2026) - na telefonu dvojklik
              nefunguje a v plném dni nebylo kam kliknout. Kdo spravuje studio,
              dostane okno události (v něm jde přepnout i na Mimo studio),
              ostatní rovnou Mimo studio. */}
          <button
            type="button"
            onClick={() => {
              const dnes = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
              const den = days.some((d) => d.key === dnes) ? dnes : (days[0]?.key ?? dnes);
              novaVMrizce(den, 9 * 60);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple text-white px-3 py-1.5 sm:py-2 text-sm font-heading font-semibold hover:bg-brand-purpleDeep transition-colors shrink-0"
            aria-label="Přidat událost"
            title="Přidat událost"
          >
            <span aria-hidden="true">+</span>
            <span className="hidden sm:inline">Přidat</span>
          </button>
          {/* Hledání na telefonu na řádku s Den/Týden/Měsíc (21. 9. 2026:
              „pole hledat by mohlo být na řádku, kde se přepínají den,
              týden, měsíc. Vejde se to tam"). Stejný stav jako políčko
              u kalendářů na počítači. */}
          <input
            value={hledani}
            onChange={(e) => {
              setHledani(e.target.value);
              setSeznamVyskytu(true);
            }}
            placeholder="Hledat…"
            aria-label="Hledat projekt, herce nebo zvukaře"
            className="sm:hidden flex-1 min-w-0 rounded-pill border border-line bg-field px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
          />
        </div>
      </div>

      {/* Studia - dají se prolnout, každé má svou barvu.

          Štítek má dvě poloviny (zadání 20. 9. 2026: „když kliknu na tu
          kuličku u kalendáře, tak se buď zapne nebo vypne, a když kliknu na
          název, tak se naopak zapne jen ten kalendář"):
            - KULIČKA přidá nebo odebere kalendář k těm ostatním,
            - NÁZEV zapne PROZATÍMNÍ SÓLO - svítí jen on, orámovaný, a druhý
              klik na stejný název vrátí zaškrtnutí, jaké bylo předtím. */}
      {/* Na telefonu jeden posuvný pruh (21. 9. 2026), od tabletu se lámou. */}
      <div data-kal-ovladani className="flex items-center gap-2 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 py-1 sm:py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {studios.map((s) => {
          const zapnute = solo ? solo === s.id || solo === SOLO_MOJE : selectedStudioIds.includes(s.id);
          const soluje = solo === s.id;
          return (
            <span
              key={s.id}
              className={`shrink-0 whitespace-nowrap inline-flex items-center rounded-pill border text-xs sm:text-sm font-heading font-semibold transition-colors ${
                zapnute ? 'border-transparent text-ink' : 'border-line text-muted'
              } ${soluje ? 'ring-2 ring-brand-purple ring-offset-2 ring-offset-paper' : ''}`}
              style={zapnute ? { backgroundColor: `${s.color}26` } : undefined}
            >
              <button
                type="button"
                onClick={() => prepniStudio(s.id)}
                title={zapnute ? `Vypnout ${s.name}` : `Zapnout ${s.name}`}
                aria-label={zapnute ? `Vypnout ${s.name}` : `Zapnout ${s.name}`}
                aria-pressed={zapnute}
                className="flex items-center rounded-l-pill pl-2.5 sm:pl-3 pr-1.5 py-1 sm:py-1.5"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: zapnute ? s.color : '#C9C3DC' }}
                />
              </button>
              <button
                type="button"
                onClick={() => jenTentoKalendar(s.id)}
                title={soluje ? 'Zpět na původní výběr kalendářů' : `Dočasně jen ${s.name} (sólo)`}
                className={`rounded-r-pill pl-0.5 pr-3 sm:pr-3.5 py-1 sm:py-1.5 transition-colors ${
                  zapnute ? '' : 'hover:text-ink'
                }`}
              >
                {s.shortName}
              </button>
            </span>
          );
        })}
        {/* MIMO STUDIO (zadání 19. 9. 2026) - vlastní kalendář, zapíná se
            stejně jako studio. Tečkovaný okraj ho odliší: není to místnost,
            je to přehled lidí. Přidává se dvojklikem jako všude jinde. */}
        <span
          className={`shrink-0 whitespace-nowrap inline-flex items-center rounded-pill border border-dashed text-xs sm:text-sm font-heading font-semibold transition-colors ${
            ukazNepritomnost ? 'text-ink' : 'border-line text-muted'
          } ${solo === SOLO_MIMO ? 'ring-2 ring-brand-purple ring-offset-2 ring-offset-paper' : ''}`}
          style={
            ukazNepritomnost
              ? { backgroundColor: `${BARVA_NEPRITOMNOSTI}26`, borderColor: BARVA_NEPRITOMNOSTI }
              : undefined
          }
        >
          <button
            type="button"
            onClick={prepniMimoStudio}
            aria-pressed={ukazNepritomnost}
            title={ukazNepritomnost ? 'Vypnout Mimo studio' : 'Zapnout Mimo studio'}
            aria-label={ukazNepritomnost ? 'Vypnout Mimo studio' : 'Zapnout Mimo studio'}
            className="flex items-center rounded-l-pill pl-2.5 sm:pl-3 pr-1.5 py-1 sm:py-1.5"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              // Šedá je skoro stejná jako „vypnuto" u studií, takže vypnutý
              // stav je tu prázdné kolečko - jinak by nešlo poznat, jestli je
              // kalendář zapnutý.
              style={
                ukazNepritomnost
                  ? { backgroundColor: BARVA_NEPRITOMNOSTI }
                  : { border: '1.5px solid #C9C3DC', backgroundColor: 'transparent' }
              }
            />
          </button>
          <button
            type="button"
            onClick={() => jenTentoKalendar(SOLO_MIMO)}
            title={
              solo === SOLO_MIMO ? 'Zpět na původní výběr kalendářů' : 'Dočasně jen Mimo studio (sólo)'
            }
            className={`rounded-r-pill pl-0.5 pr-3 sm:pr-3.5 py-1 sm:py-1.5 transition-colors ${
              ukazNepritomnost ? '' : 'hover:text-ink'
            }`}
          >
            {NAZEV_KALENDARE_MIMO}
          </button>
        </span>
        {/* PORADY (zadání 21. 9. 2026) - žlutý kalendář schůzek. Každý v něm
            vidí jen porady, na které je pozvaný. Zapíná se a sóluje stejně
            jako ostatní kalendáře. */}
        <span
          className={`shrink-0 whitespace-nowrap inline-flex items-center rounded-pill border text-xs sm:text-sm font-heading font-semibold transition-colors ${
            ukazPorady ? 'text-ink' : 'border-line text-muted'
          } ${solo === SOLO_PORADY ? 'ring-2 ring-brand-purple ring-offset-2 ring-offset-paper' : ''}`}
          style={ukazPorady ? { backgroundColor: `${BARVA_PORAD}26`, borderColor: BARVA_PORAD } : undefined}
        >
          <button
            type="button"
            onClick={prepniPorady}
            aria-pressed={ukazPorady}
            title={ukazPorady ? 'Vypnout Porady' : 'Zapnout Porady'}
            aria-label={ukazPorady ? 'Vypnout Porady' : 'Zapnout Porady'}
            className="flex items-center rounded-l-pill pl-2.5 sm:pl-3 pr-1.5 py-1 sm:py-1.5"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: ukazPorady ? BARVA_PORAD : '#C9C3DC' }}
            />
          </button>
          <button
            type="button"
            onClick={() => jenTentoKalendar(SOLO_PORADY)}
            title={solo === SOLO_PORADY ? 'Zpět na původní výběr kalendářů' : 'Dočasně jen Porady (sólo)'}
            className={`rounded-r-pill pl-0.5 pr-3 sm:pr-3.5 py-1 sm:py-1.5 transition-colors ${ukazPorady ? '' : 'hover:text-ink'}`}
          >
            {NAZEV_KALENDARE_PORADY}
          </button>
        </span>
        {/* JEN MOJE (zadání 22. 9. 2026: „ikona, na kterou když kliknou, tak
            se jim zobrazí jen jejich události v kalendáři. Fungovat by to
            mělo jako sólo") - druhý klik vrátí původní výběr kalendářů. */}
        <button
          type="button"
          onClick={() => jenTentoKalendar(SOLO_MOJE)}
          aria-pressed={solo === SOLO_MOJE}
          title={solo === SOLO_MOJE ? 'Zpět na původní výběr kalendářů' : 'Jen moje události (sólo)'}
          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-pill border pl-2.5 pr-3 sm:pr-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-heading font-semibold transition-colors ${
            solo === SOLO_MOJE
              ? 'border-transparent bg-brand-purple/15 text-ink ring-2 ring-brand-purple ring-offset-2 ring-offset-paper'
              : 'border-line text-muted hover:text-ink'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0 1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
          </svg>
          Moje
        </button>
        {/* Že je kalendář v sólu, musí být vidět i bez porovnávání štítků
            (zadání 20. 9. 2026: „ještě by se mohl v tomhle módu nějak
            orámovat, aby to bylo jasné, že je to v sólo režimu"). */}
        {solo && (
          <button
            type="button"
            onClick={() => prejdi({ solo: '' })}
            title="Vrátit zaškrtnutí kalendářů, jaké bylo před sólem"
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-2 rounded-pill border border-brand-purple bg-brand-purple/10 pl-3 pr-3.5 py-1.5 text-xs sm:text-sm font-heading font-semibold text-brand-purple"
          >
            SÓLO: {nazevSola}
            <span className="font-body font-normal text-muted">zpět na výběr</span>
          </button>
        )}
        {/* Hledani na stejnem radku jako kalendare (zadani 20. 9. 2026:
            „hledání může být na řádku s výběrem kalendářů a stavy dejme úplně
            pryč"). Napovedy k dvojkliku jsou v Napovede, nad kalendarem
            jen zabiraly misto. */}
        <input
          value={hledani}
          onChange={(e) => {
            setHledani(e.target.value);
            setSeznamVyskytu(true);
          }}
          placeholder="Hledat projekt, herce nebo zvukaře…"
          aria-label="Hledat projekt, herce nebo zvukaře"
          className="hidden sm:block ml-auto rounded-pill border border-line bg-field px-4 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple w-72"
        />
      </div>


      {/* SEZNAM VÝSKYTŮ V CELÉM KALENDÁŘI (20. 9. 2026). Mřížka pod ním dál
          ukazuje jen vybraný týden - tohle je přehled napříč časem. */}
      {seznamVyskytu && (
        <VyskytyHledani
          dotaz={hledani}
          onZavri={() => setSeznamVyskytu(false)}
          onSkoc={(den, studioId) => {
            // Skok z hledání sólo ruší - jinak by výskyt v jiném studiu
            // nebyl vidět (20. 9. 2026).
            const studia = puvodniStudioIds.includes(studioId)
              ? puvodniStudioIds
              : [...puvodniStudioIds, studioId];
            prejdi({ datum: den, studia: studia.join(','), solo: '' });
            setSeznamVyskytu(false);
          }}
        />
      )}

      {/* PÁS TŘÍ OBDOBÍ (20. 9. 2026). Vodorovné rolování dělá prohlížeč sám,
          takže prst i touchpad táhnou kalendář přímo a plynule. `snap`
          dorovná pás na celé období, `overscroll-behavior-x: contain`
          zabrání tomu, aby tah za kraj listoval v historii prohlížeče. */}
      <div
        ref={pas}
        className="overflow-x-auto snap-x snap-mandatory [overscroll-behavior-x:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-start">
          {panely.map((pole) => (
            // Klíč podle prvního dne období: po výměně se ten samý pruh
            // jen posune o jedno místo a React ho použije znovu - nic se
            // nepřekresluje a svislé rolování zůstává, kde bylo.
            <div key={pole.klic} className="w-full shrink-0 snap-start">
              {view === 'mesic' ? (
                <MesicniPohled
                  days={pole.days}
                  podleDnu={podleDnu}
                  timezone={timezone}
                  onDetail={klikNaUdalost}
                  onUpravit={dvojklikNaUdalost}
                  nepritomnostPodleDnu={ukazNepritomnost ? nepritomnostPodleDnu : null}
                  onOtevriNepritomnost={(n) => setOknoNepritomnosti({ upravovana: n, den: n.start })}
                  onNovaVeDni={novaVMesici}
                />
              ) : (
                <MrizkaPohled
                  days={pole.days}
                  podleDnu={podleDnu}
                  timezone={timezone}
                  onDetail={klikNaUdalost}
                  onUpravit={dvojklikNaUdalost}
                  nepritomnostPodleDnu={ukazNepritomnost ? celodenniPodleDnu : null}
                  onOtevriNepritomnost={(n) => setOknoNepritomnosti({ upravovana: n, den: n.start })}
                  onNovaNepritomnost={(den) => setOknoNepritomnosti({ upravovana: null, den, celyDen: true })}
                  onNovaBlokace={novaVMrizce}
                  smerPosunu={smerPosunu}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FORMULÁŘ JE UPROSTŘED OBRAZOVKY (zadání 14. 9. 2026: „to editační
          okno bych dal někam doprostřed kalendáře. Dole vůbec nevím, že se
          něco otevřelo, a hlavně tam musím scrollovat").

          Dřív se přidával pod mřížku, takže po dvojkliku do kalendáře se
          navenek nestalo nic - formulář ležel mimo obrazovku. Teď překryje
          stránku a je vidět hned.

          Zavírá se křížkem, tlačítkem Zrušit, klávesou Escape a kliknutím
          mimo kartu. Klik se hlídá na mousedown a jen když padne PŘÍMO na
          podklad - jinak by se okno zavřelo i při tažení myší z políčka ven,
          třeba při označování textu. */}
      {(novaBlokace || upravovana) && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setNovaBlokace(null);
            setUpravovana(null);
          }}
        >
          <div className="w-full max-w-[880px] my-auto">
        <UdalostForm
          // Pri uprave se nastavuje klic - jinak by React nechal ve formulari
          // stav po predchozi udalosti a clovek by upravoval cizi udaje.
          key={upravovana?.id ?? 'nova'}
          studios={mojeStudia}
          vychozi={
            novaBlokace ?? {
              studioId: upravovana!.studioId,
              start: upravovana!.start,
              end: upravovana!.end,
            }
          }
          upravovana={upravovana}
          timezone={timezone}
          projekty={projekty}
          herci={herci}
          zvukari={zvukari}
          // Nová událost jde přepnout i na poradu (21. 9. 2026).
          onPorada={
            upravovana
              ? undefined
              : (den, casOd, casDo) => {
                  setNovaBlokace(null);
                  setOknoPorady({ upravovana: null, den, casOd, casDo });
                }
          }
          // Jen u NOVE udalosti - existujici natáčení se na Mimo studio
          // neprevadi (je to jiny zaznam, ne jina barva).
          onMimoStudio={
            upravovana
              ? undefined
              : (den, casOd, casDo) => {
                  setNovaBlokace(null);
                  setOknoNepritomnosti({ upravovana: null, den, celyDen: false, casOd, casDo });
                }
          }
          onClose={() => {
            setNovaBlokace(null);
            setUpravovana(null);
          }}
          onHotovo={() => {
            setNovaBlokace(null);
            setUpravovana(null);
            router.refresh();
          }}
        />
          </div>
        </div>
      )}

      {oknoNepritomnosti && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setOknoNepritomnosti(null);
          }}
        >
          <div className="w-full max-w-[560px] my-auto">
            <NepritomnostForm
              key={oknoNepritomnosti.upravovana?.id ?? `nova-${oknoNepritomnosti.den}`}
              upravovana={oknoNepritomnosti.upravovana}
              vychoziDen={oknoNepritomnosti.den}
              vychoziCelyDen={oknoNepritomnosti.celyDen}
              vychoziCasOd={oknoNepritomnosti.casOd}
              vychoziCasDo={oknoNepritomnosti.casDo}
              ja={ja}
              lidiTymu={lidiTymu}
              onClose={() => setOknoNepritomnosti(null)}
              // Kdo nespravuje studia, dostane po dvojkliku rovnou Mimo
              // studio - poradu si odsud přepne (21. 9. 2026).
              onPorada={
                oknoNepritomnosti.upravovana
                  ? undefined
                  : (den, casOd, casDo) => {
                      setOknoNepritomnosti(null);
                      setOknoPorady({ upravovana: null, den, casOd, casDo });
                    }
              }
            />
          </div>
        </div>
      )}

      {oknoPorady && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setOknoPorady(null);
          }}
        >
          <div className="w-full max-w-[620px] my-auto">
            <PoradaForm
              key={oknoPorady.upravovana?.id ?? `nova-${oknoPorady.den}`}
              upravovana={oknoPorady.upravovana}
              vychoziDen={oknoPorady.den}
              vychoziCasOd={oknoPorady.casOd}
              vychoziCasDo={oknoPorady.casDo}
              ja={ja}
              lidiTymu={lidiTymu}
              onClose={() => setOknoPorady(null)}
            />
          </div>
        </div>
      )}

      {detail && (
        <DetailUdalosti
          event={detail}
          kotva={kotvaDetailu}
          timezone={timezone}
          canManage={lzeUpravit(detail)}
          onUpravit={() => {
            if (detail.kind === 'PORADA' && detail.porada) {
              setOknoPorady({ upravovana: detail.porada, den: detail.porada.den });
              setDetail(null);
              return;
            }
            setUpravovana(detail);
            setNovaBlokace(null);
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
          onSmazano={() => {
            setDetail(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/**
 * Jméno na porovnání: bez diakritiky, titulů a velkých písmen. „Mgr. Ondřej
 * Černý ml." a „ondrej cerny ml" jsou tak tentýž člověk (20. 9. 2026).
 */
function srovnejJmeno(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(mgr|bc|ing|mga|phdr|mudr|dis)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Denní a týdenní mřížka: sloupce = dny, řádky = hodiny, celých 0–24. */
function MrizkaPohled({
  days,
  podleDnu,
  timezone,
  onDetail,
  onUpravit,
  nepritomnostPodleDnu,
  onOtevriNepritomnost,
  onNovaNepritomnost,
  onNovaBlokace,
  smerPosunu = 1,
}: {
  /** Z které strany se na týden přišlo gestem/šipkou - kam vodorovně narolovat. */
  smerPosunu?: -1 | 1;
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  onDetail: (e: CalendarEvent, kotva?: Kotva) => void;
  /** Dvojklik na událost - otevře úpravu (19. 9. 2026). */
  onUpravit?: (e: CalendarEvent) => void;
  /** Dovolené po dnech; null = kalendář dovolených je vypnutý. */
  nepritomnostPodleDnu: Map<string, NepritomnostVKalendari[]> | null;
  onOtevriNepritomnost: (n: NepritomnostVKalendari) => void;
  onNovaNepritomnost: (denKey: string) => void;
  onNovaBlokace?: (denKey: string, minuty: number) => void;
}) {
  const celkovaVyska = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
  const hodiny = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  const dnesKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  const rolovatko = useRef<HTMLDivElement | null>(null);
  const vodorovne = useRef<HTMLDivElement | null>(null);
  // Novy tyden v mobilu: vpred od pondeli, zpet od nedele.
  // Pri otevreni (a v tydnu s dneskem) se v mobilu ukaze dnesek.
  const prvniDen = days[0]?.key;
  const uzOtevreno = useRef(false);
  useEffect(() => {
    const el = vodorovne.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const dnes = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const iDnes = days.findIndex((d) => d.key === dnes);
    if (!uzOtevreno.current && iDnes >= 0) {
      const sloupec = (el.scrollWidth - 52) / days.length;
      el.scrollLeft = Math.max(0, iDnes * sloupec);
    } else {
      el.scrollLeft = smerPosunu === -1 ? el.scrollWidth : 0;
    }
    uzOtevreno.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prvniDen]);

  /**
   * Po otevreni se nascrolluje tam, kde zacina PRVNI UDALOST zobrazeneho
   * tydne/dne (zadani 20. 9. 2026: „když otevřu kalendář, tak by to mohlo být
   * narolované primárně tam, kde začíná první událost toho týdne"), s pul
   * hodinou rezervy nad ni. Prazdny tyden -> rano jako driv.
   * Jen pri otevreni a pri prechodu na jiny tyden - po uprave udalosti
   * kalendar neposkakuje.
   */
  const naRolovanyTyden = useRef<string | null>(null);
  const prvniMinuta = useMemo(() => {
    let min: number | null = null;
    for (const den of days) {
      for (const e of podleDnu.get(den.key) ?? []) {
        if (e.kind === 'MIMO') continue;
        const od = minutesInZone(new Date(e.start), timezone);
        if (min === null || od < min) min = od;
      }
    }
    return min;
  }, [days, podleDnu, timezone]);
  // Klic = tyden + zacatek prvni udalosti. Udalosti noveho tydne dorazi ze
  // serveru az PO prepnuti dnu - driv se tak rolovalo podle prazdneho tydne
  // (na 7:00) a prvni udalosti byly useknute (20. 9. 2026). Ted se znovu
  // doroluje, jakmile se prvni udalost tydne zmeni.
  const klicTydne = days.length ? `${days[0].key}:${days.length}:${prvniMinuta ?? '-'}` : '';
  useEffect(() => {
    const el = rolovatko.current;
    if (!el || naRolovanyTyden.current === klicTydne) return;
    naRolovanyTyden.current = klicTydne;
    const minuta = prvniMinuta !== null ? Math.max(0, prvniMinuta - 30) : GRID_SCROLL_TO_HOUR * 60;
    const cil = ((minuta - GRID_START_HOUR * 60) * HOUR_PX) / 60;
    el.scrollTop = cil;
    // Pojistka: kdyby prohlizec po vykresleni rolovani vratil (obnova pozice).
    const srovnej = () => {
      if (Math.abs(el.scrollTop - cil) > 2) el.scrollTop = cil;
    };
    const snimek = requestAnimationFrame(srovnej);
    const pozdeji = window.setTimeout(srovnej, 150);
    return () => {
      cancelAnimationFrame(snimek);
      window.clearTimeout(pozdeji);
    };
  }, [klicTydne, prvniMinuta]);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      {/* Hlavicka dnu zustava nad rolovanim. V mobilu je tyden sirsi nez
          displej, takze ma vlastni vodorovne rolovani; pas obdobi je o uroven
          vys a prebira tah, az kdyz je tyden dorolovany ke kraji. */}
      <div ref={vodorovne} data-vodorovne className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((den) => {
              const d = new Date(den.startIso);
              const cislo = new Intl.DateTimeFormat('cs-CZ', {
                timeZone: timezone,
                day: 'numeric',
                month: 'numeric',
              }).format(d);
              const dow = new Date(`${den.key}T12:00:00.000Z`).getUTCDay();
              return (
                <div
                  key={den.key}
                  className={`px-2 py-2 text-center border-l border-line ${
                    den.key === dnesKey ? 'bg-brand-green/15 border-b-2 border-b-brand-green' : ''
                  }`}
                >
                  {/* DNESEK ZELENE A VETSI (zadani 20. 9. 2026: „zvyraznil bych
                      dnesni den, treba zelene, aby to bylo vyrazne, mozna
                      o neco vetsi velikost fontu"). */}
                  <span
                    className={`block text-[11px] font-heading uppercase tracking-wide ${
                      den.key === dnesKey ? 'text-brand-greenDeep dark:text-brand-green font-semibold' : 'text-muted'
                    }`}
                  >
                    {den.key === dnesKey ? `Dnes · ${WEEKDAY_SHORT[dow]}` : WEEKDAY_SHORT[dow]}
                    {den.byArrangement && <span title="Jen po domluvě se zvukařem"> ·</span>}
                  </span>
                  {den.key === dnesKey ? (
                    <span className="inline-block mt-0.5 rounded-pill bg-brand-green text-onAccent px-2.5 text-base font-heading font-bold tabular-nums">
                      {cislo}
                    </span>
                  ) : (
                    <span className="block text-sm font-heading font-semibold text-ink tabular-nums">{cislo}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Celodenní pruh s dovolenými (19. 9. 2026) - nad hodinami, aby
              dovolená nepřikryla natáčení v mřížce. */}
          {nepritomnostPodleDnu && (
            <PruhNepritomnosti
              dny={days}
              podleDnu={nepritomnostPodleDnu}
              onOtevri={onOtevriNepritomnost}
              onNova={onNovaNepritomnost}
            />
          )}

          <div ref={rolovatko} data-kal-mrizka className="max-h-[62vh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
              <div className="relative" style={{ height: `${celkovaVyska}px` }}>
                {hodiny.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-body text-muted tabular-nums"
                    style={{ top: `${(h - GRID_START_HOUR) * HOUR_PX}px` }}
                  >
                    {h}:00
                  </div>
                ))}
              </div>

              {days.map((den) => (
                <div
                  key={den.key}
                  className={`relative isolate border-l border-line ${den.key === dnesKey ? 'bg-brand-green/[0.06]' : ''}`}
                  style={{ height: `${celkovaVyska}px` }}
                  onDoubleClick={(e) => {
                    if (!onNovaBlokace) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const minuty = Math.max(0, Math.min(24 * 60 - 60, (y / HOUR_PX) * 60 + GRID_START_HOUR * 60));
                    onNovaBlokace(den.key, minuty);
                  }}
                >
                  {hodiny.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-line/50"
                      style={{ top: `${(h - GRID_START_HOUR) * HOUR_PX}px` }}
                    />
                  ))}
                  {/* Zelena cara „ted" v dnesnim sloupci (20. 9. 2026). */}
                  {den.key === dnesKey && (
                    <div
                      className="absolute left-0 right-0 z-[500] pointer-events-none border-t-2 border-brand-green"
                      style={{ top: `${((minutesInZone(new Date(), timezone) - GRID_START_HOUR * 60) * HOUR_PX) / 60}px` }}
                    >
                      <span className="absolute -left-1 -top-[5px] w-2 h-2 rounded-full bg-brand-green" />
                    </div>
                  )}
                  {/* Mimo pracovni dobu studia */}
                  {den.openFrom !== null && den.openTo !== null && (
                    <>
                      <div
                        className="absolute left-0 right-0 bg-field/60 pointer-events-none"
                        style={{ top: 0, height: `${(den.openFrom * HOUR_PX) / 60}px` }}
                      />
                      <div
                        className="absolute left-0 right-0 bg-field/60 pointer-events-none"
                        style={{ top: `${(den.openTo * HOUR_PX) / 60}px`, bottom: 0 }}
                      />
                    </>
                  )}

                  {(() => {
                    const vDni = podleDnu.get(den.key) ?? [];
                    const casy = vDni.map((e) => ({
                      id: e.id,
                      od: minutesInZone(new Date(e.start), timezone),
                      do: minutesInZone(new Date(e.end), timezone) || 24 * 60,
                    }));
                    // Kdo s kym se prekryva a jak se o sirku podeli - viz
                    // rozvrhniPrekryvy (zadani 14. 9. 2026).
                    const rozvrh = rozvrhniPrekryvy(casy);
                    return vDni.map((e) => {
                    const od = minutesInZone(new Date(e.start), timezone);
                    const doo = minutesInZone(new Date(e.end), timezone) || 24 * 60;
                    const pozice = gridPosition(od, doo);
                    const misto = rozvrh.get(e.id) ?? { posun: 0, podil: 1, vrstva: 1 };
                    // U blokace je ve `state` jeji DRUH - natáčení a střih z něj poznaji
                    // svou barvu (14. 9. 2026: „je to strasne, kdyz jsou ty pole
                    // v kalendari po ulozeni bile"). Driv se sem posilalo natvrdo
                    // 'BLOCK', takze kazdy zapsany den zesedivel.
                    const barvy = eventColors(e.color, e.state);
                    /** Papír má míň než ~60 % sloupce - leží vedle jiného. */
                    const uzky = misto.podil < 0.6;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => onDetail(e, kotvaZ(ev.currentTarget))}
                        // Dvojklik na udalost ji upravi; do dne pod ni nesmi
                        // propadnout, jinak by se zakladala nova.
                        onDoubleClick={(ev) => {
                          ev.stopPropagation();
                          onUpravit?.(e);
                        }}
                        style={{
                          top: `${pozice.top}px`,
                          height: `${pozice.height}px`,
                          // Papiry na stole (21. 9. 2026) - viz
                          // rozvrhniPrekryvy. 1px mezera mezi sousedy.
                          left: `calc(${misto.posun * 100}% + 1px)`,
                          width: `calc(${misto.podil * 100}% - 2px)`,
                          // Papír zůstává ve své vrstvě i pod myší (21. 9. 2026:
                          // „chci dát pryč z kalendáře tu funkci, že když na
                          // událost najedu myší, tak vystoupí a překryje všechny
                          // ostatní. Detail zobrazíme jen klikem").
                          zIndex: misto.vrstva,
                          // Barva udalosti je pruhledna - pod ni se musi dat
                          // plny podklad, jinak by se prekryte udalosti slily.
                          backgroundColor: 'rgb(var(--c-surface))',
                          backgroundImage: `linear-gradient(${barvy.background}, ${barvy.background})`,
                          // Tenky lem v barve podkladu oddeli bublinu od te pod
                          // ni, jemny stin z ni udela papir lezici na stole
                          // (21. 9. 2026: „jako papiry na stole").
                          boxShadow: '0 0 0 1px rgb(var(--c-surface)), 0 2px 6px rgb(0 0 0 / 0.28)',
                          borderColor: barvy.border,
                          // Silny pruh vlevo nese barvu studia i tam, kde je
                          // podklad skoro pruhledny (14. 9. 2026).
                          borderLeftWidth: '3px',
                          color: barvy.text,
                        }}
                        // flex + justify-start: prohlizec sam sazi obsah
                        // tlacitka na SVISLY STRED, takze u ctyrhodinoveho
                        // bloku visel nazev uprostred prazdna (14. 9. 2026:
                        // „ten nazev udalosti by chtelo dat do leveho
                        // horniho rohu"). Sirku si radky drzi cele (vychozi
                        // items-stretch), jinak by se dlouhy nazev neorezal
                        // teckami, ale jen usekl.
                        className="absolute rounded border px-1.5 py-0.5 text-left overflow-hidden flex flex-col justify-start"
                      >
                        {/* Popisek je dvouřádkový (zadání 14. 9. 2026):
                            projekt - herec, pod tím ZVUKAŘ: jméno. Druhý řádek
                            se ukáže, jen když je na něj v bloku místo. */}
                        {/* Úzký papír (dva a víc vedle sebe) dá názvu dva
                            řádky místo useknutého „Stř…" - zvukař přijde na
                            řadu, až když je papír dost vysoký (21. 9. 2026). */}
                        {e.title.split('\n').map((radek, i) =>
                          i === 0 ? (
                            <span
                              key={i}
                              className={`block text-[10px] font-heading font-semibold leading-tight ${
                                uzky ? 'line-clamp-2 break-words' : 'truncate'
                              }`}
                            >
                              <IkonaDruhu druh={druhPrace(e)} velikost={14} />
                              {radek}
                              {strihBezProjektu(e) && (
                                <span className="font-normal italic opacity-70"> · bez projektu</span>
                              )}
                            </span>
                          ) : (
                            pozice.height > (uzky ? 44 : 30) && (
                              <span key={i} className="block text-[9px] font-heading opacity-90 leading-tight truncate">
                                {radek}
                              </span>
                            )
                          ),
                        )}
                        {pozice.height > (uzky ? 58 : 44) && (
                          <span className="block text-[9px] font-body opacity-70 tabular-nums truncate">
                            {minutesToTime(od)}–{minutesToTime(doo)} · {e.studioName}
                          </span>
                        )}
                      </button>
                    );
                    });
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Měsíc: šest týdnů po sedmi dnech, v buňce jen štítky událostí. */
function MesicniPohled({
  days,
  podleDnu,
  timezone,
  onDetail,
  onUpravit,
  nepritomnostPodleDnu,
  onOtevriNepritomnost,
  onNovaVeDni,
}: {
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  onDetail: (e: CalendarEvent, kotva?: Kotva) => void;
  /** Dvojklik na událost - otevře úpravu (19. 9. 2026). */
  onUpravit?: (e: CalendarEvent) => void;
  nepritomnostPodleDnu: Map<string, NepritomnostVKalendari[]> | null;
  onOtevriNepritomnost: (n: NepritomnostVKalendari) => void;
  /** Dvojklik do dne (19. 9. 2026) - přidává se i v měsíci. */
  onNovaVeDni: (denKey: string) => void;
}) {
  const dnesKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-heading text-muted uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((den) => {
          // Mimo studio je v mesici celé ve štítcích nahoře (i to na čas),
          // tak se tu nesmí ukázat podruhé.
          const udalosti = (podleDnu.get(den.key) ?? []).filter((e) => e.kind !== 'MIMO');
          const cislo = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, day: 'numeric' }).format(
            new Date(den.startIso),
          );
          return (
            <div
              key={den.key}
              onDoubleClick={() => onNovaVeDni(den.key)}
              className={`min-h-[92px] border-t border-l border-line p-1.5 flex flex-col gap-1 ${
                den.inMonth ? '' : 'bg-paper'
              } ${den.key === dnesKey ? 'bg-brand-green/10 ring-2 ring-inset ring-brand-green' : ''}`}
            >
              {den.key === dnesKey ? (
                <span className="self-start rounded-pill bg-brand-green text-onAccent px-2 text-sm font-heading font-bold tabular-nums">
                  {cislo} · dnes
                </span>
              ) : (
                <span className={`text-xs font-heading tabular-nums ${den.inMonth ? 'text-ink' : 'text-muted'}`}>
                  {cislo}
                </span>
              )}
              {/* Dovolené nahoře - stejně jako celodenní pruh v týdnu. */}
              {(nepritomnostPodleDnu?.get(den.key) ?? []).map((n) => (
                <CipNepritomnosti key={n.id} n={n} onOtevri={onOtevriNepritomnost} />
              ))}
              {udalosti.slice(0, 3).map((e) => {
                const barvy = eventColors(e.color, e.state);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => onDetail(e, kotvaZ(ev.currentTarget))}
                    onDoubleClick={(ev) => {
                      // Do dne pod udalosti nesmi propadnout - zalozila by se nova.
                      ev.stopPropagation();
                      onUpravit?.(e);
                    }}
                    style={{
                      backgroundColor: barvy.background,
                      borderColor: barvy.border,
                      borderLeftWidth: '3px',
                      color: barvy.text,
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-heading text-left truncate border"
                    title={e.title}
                  >
                    {/* V měsíci je na řádek místo jen na to podstatné - název
                        a zvukař (20. 9. 2026: „nejsou tam vidět zvukaři"). */}
                    <IkonaDruhu druh={druhPrace(e)} velikost={14} />
                    {e.title.split('\n')[0]}
                    {strihBezProjektu(e) && <span className="italic opacity-70"> · bez projektu</span>}
                    {(() => {
                      const zv = e.title.split('\n').find((r) => r.startsWith('ZVUKAŘ:'));
                      return zv ? <span className="opacity-80"> · {zv.replace('ZVUKAŘ:', '').trim()}</span> : null;
                    })()}
                  </button>
                );
              })}
              {udalosti.length > 3 && (
                <span className="text-[10px] font-body text-muted">+{udalosti.length - 3} další</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Ručně zapsaná událost v kalendáři (zadání 14. 9. 2026: „když otevřu
 * kalendář z hlavního panelu, tak chci přidat ručně událost, která bude
 * obsahovat název projektu, herce (když to bude natáčení) nebo střih
 * a jméno zvukaře").
 *
 * NENÍ TO NABÍDKA TERMÍNŮ. Plánování s hercem - tedy nabídka, ze které si
 * herec vybírá - se pořád zakládá tlačítkem v detailu projektu a chodí o ní
 * e-mail. Tohle je jen zápis do kalendáře: co se kdy ve studiu doopravdy
 * děje. Do obsazenosti se počítá stejně jako blokace, takže se přes to
 * nedá naplánovat nic jiného.
 *
 * Ostatní druhy (svátek, údržba, dovolená) zůstávají obyčejná blokace
 * s popisem - projekt ani lidi u nich nedávají smysl.
 */
function UdalostForm({
  studios,
  vychozi,
  upravovana,
  timezone,
  projekty,
  herci,
  zvukari,
  onMimoStudio,
  onPorada,
  onClose,
  onHotovo,
}: {
  studios: Studio[];
  /** Přepnutí nové události na poradu (21. 9. 2026). */
  onPorada?: (den: string, casOd: string, casDo: string) => void;
  vychozi: { studioId: string; start: string; end: string };
  /**
   * Vybrání kalendáře Mimo studio (19. 9. 2026) - okno se vymění za jeho
   * vlastní, s datem a časem, které už byly vyplněné.
   */
  onMimoStudio?: (den: string, casOd: string, casDo: string) => void;
  /** Když je vyplněná, formulář existující událost UPRAVUJE (14. 9. 2026). */
  upravovana?: CalendarEvent | null;
  timezone: string;
  projekty: Volba[];
  herci: Volba[];
  zvukari: Volba[];
  onClose: () => void;
  onHotovo: () => void;
}) {
  /** Upravuje se frekvence z nabídky, ne ručně zapsaná událost (19. 9. 2026). */
  const jeFrekvence = upravovana?.kind === 'SLOT';
  const [studioId, setStudioId] = useState(upravovana?.studioId ?? vychozi.studioId);
  const [nazev, setNazev] = useState(
    upravovana && !jeFrekvence && !jePraceVeStudiu(upravovana.state) ? upravovana.title : '',
  );
  // Kalendář se otevírá kvůli natáčení, ne kvůli údržbě - proto je předvybrané.
  const [druh, setDruh] = useState(jeFrekvence ? 'NATACENI' : (upravovana?.state ?? 'NATACENI'));
  const [poznamka, setPoznamka] = useState(upravovana?.poznamka ?? '');
  const [projektId, setProjektId] = useState(upravovana?.udalost?.caflouProjectId ?? '');
  /**
   * DOHLEDÁNÍ PODLE JMÉNA (20. 9. 2026: „když dám editovat, tak pole zvukař
   * je prázdné").
   *
   * Události převzaté z Google kalendáře mají jen JMÉNO zvukaře nebo herce,
   * ne odkaz na účet - v úpravě pak políčko zůstávalo prázdné a uložení ho
   * smazalo. Jméno se proto v seznamu dohledá (bez diakritiky, titulů
   * a bez ohledu na velikost písmen).
   */
  const podleJmena = (seznam: Volba[], jmeno: string | null | undefined) => {
    const hledane = srovnejJmeno(jmeno ?? '');
    if (!hledane) return '';
    const shoda =
      seznam.find((v) => srovnejJmeno(v.label) === hledane) ??
      seznam.find((v) => srovnejJmeno(v.label).includes(hledane) || hledane.includes(srovnejJmeno(v.label)));
    return shoda?.id ?? '';
  };

  const [herecId, setHerecId] = useState(
    upravovana?.udalost?.actorUserId ?? podleJmena(herci, upravovana?.udalost?.actorName),
  );
  /**
   * HEREC U CASTINGU JE JEN TEXT (zadání 20. 9. 2026: „u castingu musí být
   * pole Herec čistě jen na psaný text. Nebudeme vybírat z databáze, protože
   * ho tam ještě logicky nemáme"). Na casting chodí lidi, kteří v portálu
   * účet nemají - vybírat je ze seznamu by nešlo.
   */
  const [herecText, setHerecText] = useState(upravovana?.udalost?.actorName ?? '');
  const [zvukarId, setZvukarId] = useState(
    upravovana?.udalost?.zvukarUserId ?? podleJmena(zvukari, upravovana?.udalost?.zvukarName),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jePrace = jePraceVeStudiu(druh);
  const jeNataceni = druh === 'NATACENI';
  // Herce ma natáčení i casting; casting nemusi mit projekt (20. 9. 2026).
  const sHercem = maHerce(druh);
  // U castingu se projekt neřeší vůbec (20. 9. 2026: „to pole Projekt dej
  // úplně pryč ve chvíli, kdy zvolím typ práce Casting") - stačí herec.
  const sProjektem = druh !== 'CASTING';
  const herecPsany = druh === 'CASTING';

  /**
   * DATUM A ČAS OD–DO (zadání 14. 9. 2026: „potřebuji tam zadat i čas - od,
   * do"). Dvojklik do mřížky je jen návrh - do kolika se točí, ví člověk,
   * ne mřížka. Původně se zadávala jen délka v hodinách, takže konec šel
   * nastavit jen na celé hodiny od místa kliknutí.
   *
   * ČAS SE ČTE JAKO STĚNOVÝ ČAS VYBRANÉHO STUDIA, ne jako čas prohlížeče.
   * Když se v Praze zapisuje natáčení v Londýně, „10:00" znamená deset hodin
   * londýnských - jinak by se událost v kalendáři objevila o hodinu vedle.
   */
  const pasmoStudia = studios.find((s) => s.id === studioId)?.timezone ?? timezone;
  const navrh = new Date(upravovana?.start ?? vychozi.start);
  const navrhKonec = upravovana ? new Date(upravovana.end) : null;
  const navrhCasti = utcParts(navrh, pasmoStudia);
  const navrhOd = navrhCasti.hour * 60 + navrhCasti.minute;

  /**
   * `<input type="time">` bere jen dvouciferné hodiny - "5:00" zahodí a pole
   * zůstane prázdné. minutesToTime hodinu nedoplňuje (v mřížce se píše 5:00,
   * ne 05:00), takže se tu doplní zvlášť.
   */
  function proPole(minuty: number): string {
    const h = Math.floor(minuty / 60);
    const m = minuty % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const [datum, setDatum] = useState(
    `${navrhCasti.year}-${String(navrhCasti.month).padStart(2, '0')}-${String(navrhCasti.day).padStart(2, '0')}`,
  );
  const [od, setOd] = useState(proPole(navrhOd));
  const [doKdy, setDoKdy] = useState(
    proPole(
      navrhKonec
        ? (utcParts(navrhKonec, pasmoStudia).hour * 60 + utcParts(navrhKonec, pasmoStudia).minute) || 24 * 60
        : Math.min(24 * 60 - 30, navrhOd + 4 * 60),
    ),
  );

  function naMinuty(hodnota: string): number | null {
    const shoda = /^(\d{1,2}):(\d{2})$/.exec(hodnota.trim());
    if (!shoda) return null;
    const h = Number(shoda[1]);
    const m = Number(shoda[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  const denCasti = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const minutyOd = naMinuty(od);
  const minutyDo = naMinuty(doKdy);
  const casSedi = Boolean(denCasti) && minutyOd !== null && minutyDo !== null && minutyDo > minutyOd;

  const start =
    denCasti && minutyOd !== null
      ? zonedToUtc(Number(denCasti[1]), Number(denCasti[2]), Number(denCasti[3]), minutyOd, pasmoStudia)
      : navrh;
  const konec =
    denCasti && minutyDo !== null
      ? zonedToUtc(Number(denCasti[1]), Number(denCasti[2]), Number(denCasti[3]), minutyDo, pasmoStudia)
      : new Date(start.getTime() + 4 * 60 * 60 * 1000);

  /**
   * ZVUKAŘI JEN Z TOHOHLE STUDIA (zadání 20. 9. 2026: „hlavně by nemělo jít
   * přiřadit zvukaře a mělo by to jen nabízet zvukaře v Brně na brněnské
   * frekvence a pražské na Prahu").
   *
   * Nabídka tedy neřadí, ale FILTRUJE - na brněnskou frekvenci se pražský
   * zvukař vybrat nedá. Dvě pojistky, ať se formulář nezasekne:
   *   1. když v tom studiu zatím nikdo zaškrtnutý není, nabízejí se všichni
   *      (jinak by po nasazení nešla zapsat jediná frekvence),
   *   2. kdo je u události napsaný už teď, v nabídce zůstane - úprava starého
   *      záznamu nemá ticho smazat jméno, které v něm je.
   */
  /** Jméno studia, ke kterému se událost píše - do popisku u pole Zvukař. */
  const nazevStudiaVOkne = studios.find((s) => s.id === studioId)?.shortName ?? 'tohoto studia';

  const zvukariProStudio = useMemo(() => {
    const vStudiu = zvukari.filter((z) => z.studia && z.studia.includes(studioId));
    if (vStudiu.length === 0) return zvukari;
    const uzNapsany = zvukari.find((z) => z.id === zvukarId && !vStudiu.some((v) => v.id === z.id));
    return uzNapsany ? [...vStudiu, uzNapsany] : vStudiu;
  }, [zvukari, studioId, zvukarId]);

  // Přepnutí studia: kdo v novém studiu netočí, se odznačí. Jinak by v poli
  // zůstal někdo, koho tam vybrat nešlo.
  const posledniStudio = useRef(studioId);
  useEffect(() => {
    if (posledniStudio.current === studioId) return;
    posledniStudio.current = studioId;
    if (zvukarId && !zvukari.some((z) => z.id === zvukarId && z.studia && z.studia.includes(studioId))) {
      const vStudiu = zvukari.filter((z) => z.studia && z.studia.includes(studioId));
      if (vStudiu.length > 0) setZvukarId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);

  const projekt = projekty.find((p) => p.id === projektId);
  const herec = herci.find((h) => h.id === herecId);
  /** Jméno herce do uložení: u castingu napsané, jinak vybrané ze seznamu. */
  const herecJmeno = herecPsany ? herecText.trim() : (herec?.label ?? '');
  const zvukar = zvukari.find((z) => z.id === zvukarId);

  // U frekvence je herec dany nabidkou a zvukar se teprve doplnuje -
  // povinny je jen u strihu, na ktery se frekvence predelava.
  const chybi =
    !casSedi ||
    (jeFrekvence
      ? jeNataceni
        ? false
        : jePrace
          ? !zvukar
          : !nazev.trim()
      : jePrace
        ? // Projekt, herec ani zvukař nejsou povinné (21. 9. 2026: „zruš
          // povinné pole zvukař a název projektu a herec, když zakládám
          // novou událost") - často se ví jen, že studio je obsazené, a
          // zbytek se doplní později dvojklikem.
          false
        : !nazev.trim());

  /** Zrušení frekvence z kalendáře (19. 9. 2026). */
  async function zrusFrekvenci() {
    if (!upravovana || !window.confirm('Zrušit tuhle frekvenci? Herec dostane oznámení.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/terminy?id=${encodeURIComponent(upravovana.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Frekvenci se nepodařilo zrušit.');
        return;
      }
      onHotovo();
    } catch {
      setError('Frekvenci se nepodařilo zrušit.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Smazání ručně zapsané události přímo z úpravy (20. 9. 2026: „upravit,
   * smazat se bude řešit v tom editu, když poklepeš dvakrát").
   */
  async function smazUdalost() {
    if (!upravovana || !window.confirm('Opravdu smazat tuhle událost z kalendáře?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kalendar/blokace?id=${encodeURIComponent(upravovana.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Událost se nepodařilo smazat.');
        return;
      }
      onHotovo();
    } catch {
      setError('Událost se nepodařilo smazat.');
    } finally {
      setBusy(false);
    }
  }

  async function uloz() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        jeFrekvence
          ? `/api/kalendar/terminy?id=${encodeURIComponent(upravovana!.id)}`
          : upravovana
            ? `/api/kalendar/blokace?id=${encodeURIComponent(upravovana.id)}`
            : '/api/kalendar/blokace',
        {
        method: upravovana ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId,
          start: start.toISOString(),
          end: konec.toISOString(),
          kind: druh,
          note: poznamka.trim() || undefined,
          ...(jePrace
            ? {
                caflouProjectId: sProjektem ? (projekt?.id ?? upravovana?.udalost?.caflouProjectId ?? '') : '',
                // Bez firmy (zadání 14. 9. 2026: „firma je tady zbytečná").
                projectName: sProjektem
                  ? (projekt?.nazev ?? projekt?.label ?? upravovana?.udalost?.projectName ?? '')
                  : '',
                // U castingu je herec jen jméno - zadny ucet k nemu neni.
                actorUserId: sHercem && !herecPsany ? (herec?.id ?? '') : '',
                actorName: sHercem ? herecJmeno : '',
                zvukarUserId: zvukar?.id ?? '',
                zvukarName: zvukar?.label ?? '',
              }
            : { title: nazev }),
        }),
      },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Událost se nepodařilo uložit.');
        return;
      }
      onHotovo();
    } catch {
      setError('Událost se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border-2 border-brand-purple shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {jeFrekvence ? 'Úprava frekvence' : upravovana ? 'Úprava události' : 'Nová událost'}
          </h2>
          <p className="text-sm font-body text-muted m-0 mt-1 capitalize">
            {new Intl.DateTimeFormat('cs-CZ', {
              timeZone: pasmoStudia,
              weekday: 'long',
              day: 'numeric',
              month: 'numeric',
            }).format(start)}{' '}
            <span className="tabular-nums">
              {minutesToTime(minutesInZone(start, pasmoStudia))}–{minutesToTime(minutesInZone(konec, pasmoStudia))}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Druh</span>
          <VyberPole value={druh} onChange={(e) => setDruh(e.target.value)} className={inputClass}>
            {Object.entries(BLOCK_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </VyberPole>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Kalendář</span>
          <VyberPole
            value={studioId}
            onChange={(e) => {
              if (e.target.value === '__mimo__') {
                onMimoStudio?.(datum, od, doKdy);
                return;
              }
              if (e.target.value === '__porada__') {
                onPorada?.(datum, od, doKdy);
                return;
              }
              setStudioId(e.target.value);
            }}
            className={inputClass}
          >
            {studios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
            {onMimoStudio && <option value="__mimo__">{NAZEV_KALENDARE_MIMO}</option>}
            {onPorada && <option value="__porada__">{NAZEV_KALENDARE_PORADY}</option>}
          </VyberPole>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Datum</span>
          <DatumPole
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
      </div>

      {/* Čas od-do místo délky (zadání 14. 9. 2026). Krok po půlhodinách -
          frekvence se plánují na půlhodiny, ne na minuty. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            Od <span className="text-danger">*</span>
          </span>
          <input
            type="time"
            step={1800}
            value={od}
            onChange={(e) => setOd(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            Do <span className="text-danger">*</span>
          </span>
          <input
            type="time"
            step={1800}
            value={doKdy}
            onChange={(e) => setDoKdy(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <div className="flex flex-col gap-1.5 justify-end pb-2.5">
          {casSedi ? (
            <span className="text-xs font-body text-muted tabular-nums">
              {(((minutyDo ?? 0) - (minutyOd ?? 0)) / 60).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} h
              {pasmoStudia !== timezone ? ` · místní čas studia` : ''}
            </span>
          ) : (
            <span className="text-xs font-body text-danger">Konec musí být po začátku.</span>
          )}
        </div>
      </div>

      {jePrace ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sProjektem && (
            <label className="flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-sm font-body text-ink">
                Projekt
              </span>
              {/* Stejné hledání psaním jako u výkazů - projektů jsou stovky. */}
              <VyberProjektu projekty={projekty} hodnota={projektId} onZmena={setProjektId} />
            </label>
          )}

          {/* Herec jen u natáčení. U střihu žádný není a prázdné pole by tam
              jen strašilo (zadání 14. 9. 2026). */}
          {sHercem && jeFrekvence && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Herec</span>
              {/* Herec patri k nabidce - jiny herec = jina nabidka. */}
              <span className="rounded-lg border border-line bg-field px-3 py-2 text-muted font-heading text-sm">
                {upravovana?.udalost?.actorName ?? '—'}
              </span>
            </div>
          )}
          {sHercem && !jeFrekvence && herecPsany && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Herec
              </span>
              <input
                value={herecText}
                onChange={(e) => setHerecText(e.target.value)}
                placeholder="Napište jméno herce…"
                className={inputClass}
              />
            </label>
          )}
          {sHercem && !jeFrekvence && !herecPsany && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Herec
              </span>
              <VyberProjektu
                projekty={herci}
                hodnota={herecId}
                onZmena={setHerecId}
                placeholder="Začněte psát jméno herce…"
                prazdnyText="Takového herce jsme nenašli. Zkuste jen příjmení."
                popisZruseni="Zrušit výběr herce"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">
              {/* Povinný jen u frekvence předělávané na střih - ta bez
                  zvukaře nedává smysl. Ručně zapsaná událost ho mít nemusí
                  (21. 9. 2026). */}
              Zvukař {jeFrekvence && !jeNataceni && <span className="text-danger">*</span>}
              {/* Ať je jasné, proč v nabídce nejsou všichni (20. 9. 2026). */}
              <span className="text-muted font-normal"> · jen {nazevStudiaVOkne}</span>
            </span>
            <VyberProjektu
              projekty={zvukariProStudio}
              hodnota={zvukarId}
              onZmena={setZvukarId}
              placeholder="Začněte psát jméno zvukaře…"
              prazdnyText={`V tomhle studiu takového zvukaře nemáme. Studia se zaškrtávají na kartě uživatele.`}
              popisZruseni="Zrušit výběr zvukaře"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Popis</span>
          <input
            autoFocus
            value={nazev}
            onChange={(e) => setNazev(e.target.value)}
            placeholder="Servis techniky"
            className={inputClass}
          />
        </label>
      )}

      {/* Poznamka / vzkaz (19. 9. 2026) - u frekvence i u rucni udalosti. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Poznámka</span>
        <textarea
          value={poznamka}
          onChange={(e) => setPoznamka(e.target.value)}
          rows={2}
          placeholder="Vzkaz pro tým - třeba co se bude točit, co připravit…"
          className={inputClass}
        />
      </label>

      {jeFrekvence && !jeNataceni && (
        <p className="text-xs font-body text-ink bg-warnTint border border-line rounded-lg px-3 py-2 m-0">
          Frekvence se zruší a na jejím místě vznikne {jePrace ? (druh === 'CASTING' ? 'casting' : 'střih') : 'událost'} v kalendáři. Herec dostane
          oznámení.
        </p>
      )}

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={uloz}
          disabled={busy || chybi}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {busy ? 'Ukládám…' : upravovana ? 'Uložit změny' : 'Přidat do kalendáře'}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          Zrušit
        </button>
        {upravovana && upravovana.kind === 'BLOCK' && (
          <button
            type="button"
            onClick={smazUdalost}
            disabled={busy}
            className="ml-auto text-sm font-heading font-semibold text-danger disabled:opacity-60"
          >
            Smazat událost
          </button>
        )}
        {jeFrekvence && (
          <button
            type="button"
            onClick={zrusFrekvenci}
            disabled={busy}
            className="text-sm font-heading font-semibold text-danger disabled:opacity-60"
          >
            Zrušit frekvenci
          </button>
        )}
        {jePrace && !jeFrekvence && (
          <span className="text-xs font-body text-muted">
            Zápis do kalendáře. Nabídku termínů herci zakládáte tlačítkem v detailu projektu.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * IKONA DRUHU PRÁCE (zadání 20. 9. 2026: „ohledně natáčení a střihu bychom
 * měli nějak pracovat i s ikonami"). Natáčení = mikrofon, střih = nůžky,
 * údržba = klíč, svátek/dovolená = slunce. Frekvence z nabídky je natáčení.
 * Kreslí se barvou textu, takže sedí ve světlém i tmavém režimu.
 */
export function druhPrace(
  e: Pick<CalendarEvent, 'kind' | 'state'>,
): 'NATACENI' | 'STRIH' | 'CASTING' | 'UDRZBA' | 'VOLNO' | null {
  if (e.kind === 'SLOT') return 'NATACENI';
  if (e.kind !== 'BLOCK') return null;
  if (e.state === 'NATACENI') return 'NATACENI';
  if (e.state === 'STRIH') return 'STRIH';
  if (e.state === 'CASTING') return 'CASTING';
  if (e.state === 'MAINTENANCE') return 'UDRZBA';
  if (e.state === 'HOLIDAY' || e.state === 'VACATION') return 'VOLNO';
  return null;
}

/** Klíč ikony ze sady typů projektu (lib/ikonyTypu.tsx) pro druh práce. */
const IKONA_DRUHU: Record<NonNullable<ReturnType<typeof druhPrace>>, string> = {
  NATACENI: 'mikrofon-studio',
  STRIH: 'strih',
  CASTING: 'casting',
  UDRZBA: 'klic',
  VOLNO: 'slunce',
};

/**
 * Ikona druhu práce ve stylu typů projektů (zadání 20. 9. 2026) - kolečko
 * s tlumeným podkladem a barevnou kresbou, jen menší.
 */
function IkonaDruhu({ druh, velikost = 16 }: { druh: ReturnType<typeof druhPrace>; velikost?: number }) {
  if (!druh) return null;
  const klic = IKONA_DRUHU[druh];
  return (
    <span
      aria-hidden
      className={`shrink-0 inline-grid place-items-center rounded-pill align-middle mr-1 ${tridaBarvyIkony(klic)}`}
      style={{ width: velikost, height: velikost }}
    >
      <KresbaIkony klic={klic} velikost={Math.round(velikost * 0.62)} />
    </span>
  );
}

/** Poloha bubliny na obrazovce - z ní detail „vystoupí". */
type Kotva = { left: number; top: number; width: number; height: number };

function kotvaZ(el: Element): Kotva {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function DetailUdalosti({
  event,
  kotva,
  timezone,
  canManage,
  onUpravit,
  onClose,
  onSmazano,
}: {
  event: CalendarEvent;
  /** Bublina, ze které se kliklo - bez ní se detail ukáže uprostřed. */
  kotva: Kotva | null;
  timezone: string;
  canManage: boolean;
  /** Otevře formulář s vyplněnou událostí (zadání 14. 9. 2026). */
  onUpravit: () => void;
  onClose: () => void;
  onSmazano: () => void;
}) {
  const stav =
    event.kind === 'PORADA'
      ? event.porada && event.porada.opakovani !== 'NE'
        ? `Porada · ${popisOpakovani(event.porada.opakovani).toLowerCase()}`
        : 'Porada'
      : event.kind === 'BLOCK'
        ? BLOCK_KIND_LABELS[event.state] ?? 'Blokace'
        : SLOT_STATE_LABELS[event.state] ?? event.state;
  const odkazVideo = event.kind === 'PORADA' ? platnyOdkaz(event.porada?.odkazVideo) : null;

  // Zavrit klavesou Esc, rolovanim nebo zmenou okna (bublina uz by jinde).
  useEffect(() => {
    const klavesa = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    const pryc = () => onClose();
    window.addEventListener('keydown', klavesa);
    window.addEventListener('resize', pryc);
    window.addEventListener('scroll', pryc, true);
    return () => {
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('resize', pryc);
      window.removeEventListener('scroll', pryc, true);
    };
  }, [onClose]);

  const u = event.udalost;
  const radky = event.title.split('\n');
  // Technicka stopa z prevodu Google kalendare se neukazuje (20. 9. 2026).
  const poznamka = (event.poznamka ?? '')
    .split(' · ')
    .filter((cast) => !cast.startsWith('Z Google kalendáře:'))
    .join(' · ')
    .trim();
  const barvy = eventColors(event.color, event.state);
  const cas = (iso: string) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const den = new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'numeric' }).format(
    new Date(event.start),
  );

  /**
   * BUBLINA „VYSTOUPÍ" (zadání 20. 9. 2026, upřesnění: „náhled je moc velký
   * a složitý. Potřebuju, ať jen vystoupí ta bublina a vše ostatní kolem jde
   * vidět. Jen se to zvětší natolik, aby šlo přečíst všechna data").
   *
   * Žádné ztmavení ani okno uprostřed: stejná bublina (barva, pruh vlevo)
   * se zvětší přímo na svém místě, nic se neořezává a text se zalamuje.
   * Kalendář kolem zůstává vidět; klik jinam, Esc nebo rolování ji zavře.
   */
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const sirka = Math.min(vw - 16, Math.max(260, Math.min(340, (kotva?.width ?? 0) * 1.5)));
  const stred = kotva ? kotva.left + kotva.width / 2 : vw / 2;
  const left = Math.max(8, Math.min(vw - sirka - 8, stred - sirka / 2));
  // Bublina ve spodni casti obrazovky roste nahoru, jinak dolu.
  const dole = kotva ? kotva.top > vh * 0.6 : false;
  const poloha: React.CSSProperties = kotva
    ? dole
      ? { left, bottom: Math.max(8, vh - (kotva.top + Math.min(kotva.height, 120))), maxHeight: vh - 16 }
      : { left, top: Math.max(8, kotva.top - 4), maxHeight: vh - Math.max(8, kotva.top - 4) - 8 }
    : { left, top: vh * 0.2, maxHeight: vh * 0.7 };

  return (
    <>
      {/* Pruhledna vrstva jen chyta klik mimo bublinu - nic neztmavuje. */}
      <div className="fixed inset-0 z-[69]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={radky[0]}
        className="fixed z-[70] ms-vystoupeni rounded-lg bg-surface shadow-2xl overflow-y-auto cursor-pointer"
        title="Klikni pro zavření"
        // Zadny krizek (20. 9. 2026): dalsi klik na bublinu ji zavre. Odkazy funguji dal.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a,button')) return;
          onClose();
        }}
        style={{ ...poloha, width: sirka, transformOrigin: dole ? 'center bottom' : 'center top' }}
      >
        <div
          className="rounded-lg border px-3 py-2.5 flex flex-col gap-1"
          style={{ backgroundColor: barvy.background, borderColor: barvy.border, borderLeftWidth: '4px', color: barvy.text }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-heading font-semibold uppercase tracking-wide opacity-80">
              <IkonaDruhu druh={druhPrace(event)} velikost={22} />
              {stav}
            </span>
          </div>
          {/* Stejne radky jako v bubline, jen vetsi a cele. */}
          {/* Radek, ktery jen opakuje druh prace z hlavicky (napr. „Střih"),
              se v detailu nevypisuje podruhe (20. 9. 2026). */}
          {radky.filter((radek) => radek.trim().toLocaleLowerCase('cs') !== String(stav).trim().toLocaleLowerCase('cs')).map((radek, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'm-0 text-base font-heading font-semibold leading-snug break-words'
                  : 'm-0 text-sm font-heading leading-snug break-words'
              }
            >
              {radek}
            </p>
          ))}
          <p className="m-0 text-sm font-body opacity-80 tabular-nums">
            {den} · {cas(event.start)}–{cas(event.end)} · {event.studioName}
          </p>
          {u?.actorName && !event.title.includes(u.actorName) && (
            <p className="m-0 text-sm font-heading">Herec: {u.actorName}</p>
          )}
          {/* Střih převzatý z Googlu projekt nemá - ať je jasné proč a co s tím
              (21. 9. 2026). */}
          {strihBezProjektu(event) && (
            <p className="m-0 text-xs font-body italic opacity-80">
              Projekt není vyplněný{canManage ? ' — doplníte ho dvojklikem na událost.' : '.'}
            </p>
          )}
          {/* Druh prace je jen nahore (20. 9. 2026) - subtitle ho opakoval.
              Mimo studio si svuj popisek necha, tam nejde o druh prace. */}
          {event.subtitle && event.kind === 'MIMO' && <p className="m-0 text-xs font-body opacity-75">{event.subtitle}</p>}
          {poznamka && (
            <p className="m-0 mt-1 text-xs font-body opacity-90 whitespace-pre-line break-words border-t border-black/10 dark:border-white/15 pt-1.5">
              {poznamka}
            </p>
          )}
          {/* PORADA (21. 9. 2026): připojení na videohovor jedním klepnutím
              a úprava pro každého účastníka. */}
          {event.kind === 'PORADA' && (
            <div className="flex items-center gap-3 flex-wrap mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/15 text-xs font-heading font-semibold">
              {odkazVideo && (
                <a
                  href={odkazVideo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand-purple text-white px-3 py-1.5 no-underline hover:bg-brand-purpleDeep"
                >
                  ▶ Připojit se k hovoru
                </a>
              )}
              <button type="button" onClick={onUpravit} className="underline underline-offset-2" style={{ color: 'inherit' }}>
                Upravit
              </button>
            </div>
          )}
          {/* Upravit a smazat jen v uprave - dvojklik (20. 9. 2026). */}
          {(u?.caflouProjectId || (canManage && event.href)) && (
            <div className="flex items-center gap-3 flex-wrap mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/15 text-xs font-heading font-semibold">
              {u?.caflouProjectId && (
                <Link href={`/projekty/${u.caflouProjectId}`} className="underline underline-offset-2" style={{ color: 'inherit' }}>
                  Projekt
                </Link>
              )}
              {canManage && event.href && (
                <Link href={event.href} className="underline underline-offset-2" style={{ color: 'inherit' }}>
                  Nabídka termínů
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
