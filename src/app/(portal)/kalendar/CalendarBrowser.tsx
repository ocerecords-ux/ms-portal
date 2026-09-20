'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { OdberKalendare } from './OdberKalendare';
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
export type Volba = { id: string; label: string; dokonceny?: boolean; nazev?: string };

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
  /** MIMO = kalendář Mimo studio na pár hodin (19. 9. 2026). */
  kind: 'SLOT' | 'BLOCK' | 'MIMO';
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
  studios,
  selectedStudioIds,
  timezone,
  view,
  anchorIso,
  days,
  events,
  canManage,
  projekty,
  herci,
  zvukari,
  nepritomnosti,
  ukazNepritomnost,
  ja,
  lidiTymu,
}: {
  studios: Studio[];
  selectedStudioIds: string[];
  timezone: string;
  view: CalendarView;
  anchorIso: string;
  days: CalendarDay[];
  events: CalendarEvent[];
  canManage: boolean;
  /** Nabídka do ručně zapsané události (zadání 14. 9. 2026). */
  projekty: Volba[];
  herci: Volba[];
  zvukari: Volba[];
  /** Kalendář dovolených a nepřítomnosti (zadání 19. 9. 2026). */
  nepritomnosti: NepritomnostVKalendari[];
  ukazNepritomnost: boolean;
  ja: Osoba;
  /** Lidé z týmu - výběr osoby v okně Mimo studio. */
  lidiTymu: Osoba[];
}) {
  const router = useRouter();
  /** Otevřené okno Mimo studio: nová událost, nebo úprava. */
  const [oknoNepritomnosti, setOknoNepritomnosti] = useState<{
    upravovana: NepritomnostVKalendari | null;
    den: string;
    celyDen?: boolean;
    casOd?: string;
    casDo?: string;
  } | null>(null);
  const [filtrStavu, setFiltrStavu] = useState<string>('');
  const [hledani, setHledani] = useState('');
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
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
  const lzeUpravit = (e: CalendarEvent) => canManage && (e.kind === 'BLOCK' || jeUpravitelnaFrekvence(e));

  function klikNaUdalost(e: CalendarEvent) {
    // Mimo studio nemá detail s tlačítky - klik rovnou otevře úpravu, stejně
    // jako u celodenního štítku. Cizí záznam ukáže jen detail ke čtení.
    if (e.kind === 'MIMO' && e.mimo) {
      if (e.mimo.muzeUpravit) setOknoNepritomnosti({ upravovana: e.mimo, den: e.start });
      else setDetail(e);
      return;
    }
    if (!lzeUpravit(e)) {
      setDetail(e);
      return;
    }
    if (casovacDetailu.current) clearTimeout(casovacDetailu.current);
    casovacDetailu.current = setTimeout(() => {
      casovacDetailu.current = null;
      setDetail(e);
    }, 230);
  }

  function dvojklikNaUdalost(e: CalendarEvent) {
    if (e.kind === 'MIMO') return; // uz ji otevrel prvni klik
    if (!lzeUpravit(e)) return;
    if (casovacDetailu.current) {
      clearTimeout(casovacDetailu.current);
      casovacDetailu.current = null;
    }
    setDetail(null);
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

  const viditelne = useMemo(() => {
    const dotaz = hledani.trim().toLowerCase();
    return [...events, ...udalostiMimo].filter((e) => {
      if (filtrStavu && e.state !== filtrStavu) return false;
      if (dotaz && !e.title.toLowerCase().includes(dotaz)) return false;
      return true;
    });
  }, [events, udalostiMimo, filtrStavu, hledani]);

  /**
   * Otevřené okno zavře Escape a stránka pod ním se nesmí rolovat - jinak
   * se při kolečku myši posouvá kalendář za oknem místo obsahu okna.
   */
  const oknoOtevrene = Boolean(novaBlokace || upravovana || oknoNepritomnosti);
  useEffect(() => {
    if (!oknoOtevrene) return;
    function naKlavesu(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setNovaBlokace(null);
      setUpravovana(null);
      setOknoNepritomnosti(null);
    }
    const puvodni = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', naKlavesu);
    return () => {
      document.body.style.overflow = puvodni;
      document.removeEventListener('keydown', naKlavesu);
    };
  }, [oknoOtevrene]);

  /** Události rozdělené po dnech — klíčem je den v pásmu studia. */
  const podleDnu = useMemo(() => {
    const mapa = new Map<string, CalendarEvent[]>();
    for (const den of days) mapa.set(den.key, []);
    for (const e of viditelne) {
      const start = new Date(e.start);
      for (const den of days) {
        if (start >= new Date(den.startIso) && start < new Date(den.endIso)) {
          mapa.get(den.key)!.push(e);
          break;
        }
      }
    }
    return mapa;
  }, [days, viditelne]);

  /** Dovolené rozdělené po dnech - vícedenní se ukáže v každém dni. */
  const nepritomnostPodleDnu = useMemo(() => rozdelPoDnech(days, nepritomnosti), [days, nepritomnosti]);
  /** Do pruhu nad mřížkou jen celodenní - ty na čas jsou v mřížce. */
  const celodenniPodleDnu = useMemo(
    () => rozdelPoDnech(days, nepritomnosti, true),
    [days, nepritomnosti],
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
    if (canManage) {
      setNovaBlokace({ studioId: selectedStudioIds[0], start, end });
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
    if (canManage) {
      novaVMrizce(denKey, 9 * 60);
      return;
    }
    setOknoNepritomnosti({ upravovana: null, den: denKey, celyDen: true });
  }

  function prejdi(zmeny: Record<string, string>) {
    const params = new URLSearchParams({
      studia: selectedStudioIds.join(','),
      pohled: view,
      datum: anchorIso,
      nepritomnost: ukazNepritomnost ? '1' : '0',
      ...zmeny,
    });
    router.push(`/kalendar?${params.toString()}`);
  }

  /** Zapnutí a vypnutí studia. Poslední zapnuté se vypnout nedá. */
  function prepniStudio(id: string) {
    const dalsi = selectedStudioIds.includes(id)
      ? selectedStudioIds.filter((x) => x !== id)
      : [...selectedStudioIds, id];
    if (dalsi.length === 0) return;
    prejdi({ studia: dalsi.join(',') });
  }

  function posun(smer: -1 | 1) {
    const d = new Date(`${anchorIso}T12:00:00.000Z`);
    if (view === 'den') d.setUTCDate(d.getUTCDate() + smer);
    else if (view === 'tyden') d.setUTCDate(d.getUTCDate() + 7 * smer);
    else d.setUTCMonth(d.getUTCMonth() + smer);
    prejdi({ datum: d.toISOString().slice(0, 10) });
  }

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
    <section className="flex flex-col gap-5">
      {/* Hlavicka: pohled a posun v case */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink m-0">Kalendář</h1>
          <p className="text-sm font-body text-muted m-0 mt-1 capitalize">{nadpis}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => posun(-1)}
            aria-label="Předchozí"
            className="w-9 h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => prejdi({ datum: new Date().toISOString().slice(0, 10) })}
            className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors"
          >
            Dnes
          </button>
          <button
            type="button"
            onClick={() => posun(1)}
            aria-label="Další"
            className="w-9 h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
          >
            ›
          </button>
          <span className="inline-flex rounded-lg border border-line overflow-hidden ml-2">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => prejdi({ pohled: v.key })}
                className={`px-4 py-2 text-sm font-heading font-semibold transition-colors ${
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
        </div>
      </div>

      {/* Studia - dají se prolnout, každé má svou barvu */}
      <div className="flex items-center gap-2 flex-wrap">
        {studios.map((s) => {
          const zapnute = selectedStudioIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => prepniStudio(s.id)}
              title={s.name}
              aria-pressed={zapnute}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-heading font-semibold rounded-pill border transition-colors ${
                zapnute ? 'border-transparent text-ink' : 'border-line text-muted hover:text-ink'
              }`}
              style={zapnute ? { backgroundColor: `${s.color}26` } : undefined}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: zapnute ? s.color : '#C9C3DC' }}
              />
              {s.shortName}
            </button>
          );
        })}
        {/* MIMO STUDIO (zadání 19. 9. 2026) - vlastní kalendář, zapíná se
            stejně jako studio. Tečkovaný okraj ho odliší: není to místnost,
            je to přehled lidí. Přidává se dvojklikem jako všude jinde. */}
        <button
          type="button"
          onClick={() => prejdi({ nepritomnost: ukazNepritomnost ? '0' : '1' })}
          aria-pressed={ukazNepritomnost}
          title="Kdo je mimo studio"
          className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-heading font-semibold rounded-pill border border-dashed transition-colors ${
            ukazNepritomnost ? 'text-ink' : 'border-line text-muted hover:text-ink'
          }`}
          style={
            ukazNepritomnost
              ? { backgroundColor: `${BARVA_NEPRITOMNOSTI}26`, borderColor: BARVA_NEPRITOMNOSTI }
              : undefined
          }
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
          {NAZEV_KALENDARE_MIMO}
        </button>
        {studios.length > 1 && (
          <span className="text-xs font-body text-muted ml-1">Klikáním zapnete a vypnete jednotlivé kalendáře.</span>
        )}
      </div>

      {/* Filtry */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={hledani}
          onChange={(e) => setHledani(e.target.value)}
          placeholder="Hledat projekt nebo herce…"
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple w-full sm:w-64"
        />
        <VyberPole
          value={filtrStavu}
          onChange={(e) => setFiltrStavu(e.target.value)}
          className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
        >
          <option value="">Všechny stavy</option>
          {Object.entries(SLOT_STATE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </VyberPole>
        <span className="text-xs font-body text-muted ml-auto">
          {canManage
            ? 'Dvojklikem do volného místa zapíšete událost, dvojklikem na událost ji upravíte.'
            : 'Dvojklikem do volného místa zapíšete, kdy jste mimo studio.'}
        </span>
      </div>

      {view === 'mesic' ? (
        <MesicniPohled
          days={days}
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
          days={days}
          podleDnu={podleDnu}
          timezone={timezone}
          onDetail={klikNaUdalost}
          onUpravit={dvojklikNaUdalost}
          nepritomnostPodleDnu={ukazNepritomnost ? celodenniPodleDnu : null}
          onOtevriNepritomnost={(n) => setOknoNepritomnosti({ upravovana: n, den: n.start })}
          onNovaNepritomnost={(den) => setOknoNepritomnosti({ upravovana: null, den, celyDen: true })}
          onNovaBlokace={novaVMrizce}
        />
      )}

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
          studios={studios}
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
            />
          </div>
        </div>
      )}

      {detail && (
        <DetailUdalosti
          event={detail}
          timezone={timezone}
          canManage={canManage}
          onUpravit={() => {
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
}: {
  days: CalendarDay[];
  podleDnu: Map<string, CalendarEvent[]>;
  timezone: string;
  onDetail: (e: CalendarEvent) => void;
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

  // Po otevreni se nascrolluje na rano - noc nikoho nezajima, ale je videt.
  useEffect(() => {
    if (rolovatko.current) {
      rolovatko.current.scrollTop = (GRID_SCROLL_TO_HOUR - GRID_START_HOUR) * HOUR_PX;
    }
  }, []);

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      {/* Hlavicka dnu zustava nad rolovanim */}
      <div className="overflow-x-auto">
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
                  className={`px-2 py-2 text-center border-l border-line ${den.key === dnesKey ? 'bg-tint' : ''}`}
                >
                  <span className="block text-[11px] font-heading text-muted uppercase tracking-wide">
                    {WEEKDAY_SHORT[dow]}
                    {den.byArrangement && <span title="Jen po domluvě se zvukařem"> ·</span>}
                  </span>
                  <span className="block text-sm font-heading font-semibold text-ink tabular-nums">{cislo}</span>
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

          <div ref={rolovatko} className="max-h-[62vh] overflow-y-auto">
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
                  className="relative border-l border-line"
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
                    const misto = rozvrh.get(e.id) ?? { posun: 0, podil: 1 };
                    // U blokace je ve `state` jeji DRUH - natáčení a střih z něj poznaji
                    // svou barvu (14. 9. 2026: „je to strasne, kdyz jsou ty pole
                    // v kalendari po ulozeni bile"). Driv se sem posilalo natvrdo
                    // 'BLOCK', takze kazdy zapsany den zesedivel.
                    const barvy = eventColors(e.color, e.state);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onDetail(e)}
                        // Dvojklik na udalost ji upravi; do dne pod ni nesmi
                        // propadnout, jinak by se zakladala nova.
                        onDoubleClick={(ev) => {
                          ev.stopPropagation();
                          onUpravit?.(e);
                        }}
                        style={{
                          top: `${pozice.top}px`,
                          height: `${pozice.height}px`,
                          // Vedle sebe misto pres sebe. 2px mezera, at jsou
                          // dve sousedni udalosti od sebe rozeznatelne.
                          left: `calc(${misto.posun * 100}% + 2px)`,
                          width: `calc(${misto.podil * 100}% - 4px)`,
                          backgroundColor: barvy.background,
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
                        {e.title.split('\n').map((radek, i) =>
                          i === 0 ? (
                            <span
                              key={i}
                              className="block text-[10px] font-heading font-semibold leading-tight truncate"
                            >
                              {radek}
                            </span>
                          ) : (
                            pozice.height > 30 && (
                              <span key={i} className="block text-[9px] font-heading opacity-90 leading-tight truncate">
                                {radek}
                              </span>
                            )
                          ),
                        )}
                        {pozice.height > 44 && (
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
  onDetail: (e: CalendarEvent) => void;
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
              } ${den.key === dnesKey ? 'bg-tint' : ''}`}
            >
              <span className={`text-xs font-heading tabular-nums ${den.inMonth ? 'text-ink' : 'text-muted'}`}>
                {cislo}
              </span>
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
                    onClick={() => onDetail(e)}
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
                  >
                    {/* V měsíci je na řádek místo jen na to podstatné. */}
                    {e.title.split('\n')[0]}
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
  onClose,
  onHotovo,
}: {
  studios: Studio[];
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
  const [herecId, setHerecId] = useState(upravovana?.udalost?.actorUserId ?? '');
  const [zvukarId, setZvukarId] = useState(upravovana?.udalost?.zvukarUserId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jePrace = jePraceVeStudiu(druh);
  const jeNataceni = druh === 'NATACENI';

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

  const projekt = projekty.find((p) => p.id === projektId);
  const herec = herci.find((h) => h.id === herecId);
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
        ? !projekt || !zvukar || (jeNataceni && !herec)
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
                caflouProjectId: projekt?.id ?? upravovana?.udalost?.caflouProjectId ?? '',
                // Bez firmy (zadání 14. 9. 2026: „firma je tady zbytečná").
                projectName: projekt?.nazev ?? projekt?.label ?? upravovana?.udalost?.projectName ?? '',
                actorUserId: jeNataceni ? (herec?.id ?? '') : '',
                actorName: jeNataceni ? (herec?.label ?? '') : '',
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
          <label className="flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-sm font-body text-ink">
              Projekt <span className="text-danger">*</span>
            </span>
            {/* Stejné hledání psaním jako u výkazů - projektů jsou stovky. */}
            <VyberProjektu projekty={projekty} hodnota={projektId} onZmena={setProjektId} />
          </label>

          {/* Herec jen u natáčení. U střihu žádný není a prázdné pole by tam
              jen strašilo (zadání 14. 9. 2026). */}
          {jeNataceni && jeFrekvence && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Herec</span>
              {/* Herec patri k nabidce - jiny herec = jina nabidka. */}
              <span className="rounded-lg border border-line bg-field px-3 py-2 text-muted font-heading text-sm">
                {upravovana?.udalost?.actorName ?? '—'}
              </span>
            </div>
          )}
          {jeNataceni && !jeFrekvence && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">
                Herec <span className="text-danger">*</span>
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
              Zvukař {!(jeFrekvence && jeNataceni) && <span className="text-danger">*</span>}
            </span>
            <VyberProjektu
              projekty={zvukari}
              hodnota={zvukarId}
              onZmena={setZvukarId}
              placeholder="Začněte psát jméno zvukaře…"
              prazdnyText="Takového zvukaře jsme nenašli. Zkuste jen příjmení."
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
          Frekvence se zruší a na jejím místě vznikne {jePrace ? 'střih' : 'událost'} v kalendáři. Herec dostane
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

function DetailUdalosti({
  event,
  timezone,
  canManage,
  onUpravit,
  onClose,
  onSmazano,
}: {
  event: CalendarEvent;
  timezone: string;
  canManage: boolean;
  /** Otevře formulář s vyplněnou událostí (zadání 14. 9. 2026). */
  onUpravit: () => void;
  onClose: () => void;
  onSmazano: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const stav =
    event.kind === 'BLOCK'
      ? BLOCK_KIND_LABELS[event.state] ?? 'Blokace'
      : SLOT_STATE_LABELS[event.state] ?? event.state;

  async function smaz() {
    if (!window.confirm('Opravdu smazat tuhle událost z kalendáře?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kalendar/blokace?id=${event.id}`, { method: 'DELETE' });
      if (res.ok) onSmazano();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: event.color }} />
          <div>
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {stav} · {event.studioName}
            </span>
            <h2 className="font-display text-xl text-ink m-0 mt-0.5">{event.title.split('\n')[0]}</h2>
            {event.title
              .split('\n')
              .slice(1)
              .map((radek, i) => (
                <p key={i} className="text-sm font-heading text-muted m-0 mt-0.5">
                  {radek}
                </p>
              ))}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>
      <p className="text-sm font-body text-muted m-0">
        {formatDateTime(event.start, timezone)} – {formatDateTime(event.end, timezone)}
      </p>
      {event.subtitle && <p className="text-sm font-body text-muted m-0">{event.subtitle}</p>}
      {event.poznamka && (
        <p className="text-sm font-body text-ink bg-field border border-line rounded-lg px-3 py-2 m-0 whitespace-pre-line">
          {event.poznamka}
        </p>
      )}
      <div className="flex items-center gap-4">
        {event.href && canManage && (
          <Link href={event.href} className="text-sm font-heading font-semibold text-brand-purple no-underline">
            Otevřít nabídku termínů →
          </Link>
        )}
        {/* Upravit jde rucne zapsana udalost i vybrana/potvrzena frekvence
            (od 19. 9. 2026) - herec o zmene frekvence dostane oznameni. */}
        {(event.kind === 'BLOCK' || jeUpravitelnaFrekvence(event)) && canManage && (
          <button
            type="button"
            onClick={onUpravit}
            className="text-sm font-heading font-semibold text-brand-purple"
          >
            Upravit
          </button>
        )}
        {event.kind === 'BLOCK' && canManage && (
          <button
            type="button"
            onClick={smaz}
            disabled={busy}
            className="text-sm font-heading font-semibold text-danger disabled:opacity-60"
          >
            Smazat událost
          </button>
        )}
      </div>
    </div>
  );
}
