'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { utcParts, zonedToUtc } from '@/lib/calendar';
import { kodJazyka } from '@/lib/jazyk';
import {
  casZMinut,
  hodinyDne,
  rozsahMrizky,
  zkontrolujOkno,
  type BookingStudio,
  type BookingUdalost,
} from '@/lib/booking';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * MŘÍŽKA REZERVACÍ (zadání 25. 9. 2026: „ten člověk tam uvidí své pojmenované
 * události a zbytek uvidí jen zabraná né časy - ne názvy událostí").
 *
 * CIZÍ ČAS JE JEN ŠEDÝ PRUH SE SLOVEM „Busy". Není to schované až tady -
 * odpověď serveru jméno vůbec neobsahuje (viz api/studio/rezervace).
 *
 * VŠECHNO SE POČÍTÁ V PÁSMU STUDIA. Kdo se dívá z Prahy na londýnský
 * kalendář, vidí londýnské hodiny; jinak by si zarezervoval devátou
 * a přijel v osm.
 *
 * KLIKÁ SE, NETÁHNE. Tažení myší je na počítači hezké, na telefonu
 * nepoužitelné - a tenhle kalendář si lidi dávají do mobilu. Klepnutí na
 * volné místo otevře formulář s předvyplněným časem, který se dá doladit
 * dvěma výběry.
 */

const HODINA_PX = 46;

type Den = {
  klic: string;
  rok: number;
  mesic: number;
  den: number;
  denVTydnu: number;
  zacatekMs: number;
  konecMs: number;
};

const dvojcifra = (n: number) => String(n).padStart(2, '0');

function sestavDny(zacatekMs: number, pasmo: string, pocet: number): Den[] {
  const z = utcParts(new Date(zacatekMs), pasmo);
  const dny: Den[] = [];
  for (let i = 0; i < pocet; i += 1) {
    // Přes poledne, ať se den nezlomí v noc, kdy se mění čas.
    const poledne = zonedToUtc(z.year, z.month, z.day + i, 12 * 60, pasmo);
    const p = utcParts(poledne, pasmo);
    dny.push({
      klic: `${p.year}-${dvojcifra(p.month)}-${dvojcifra(p.day)}`,
      rok: p.year,
      mesic: p.month,
      den: p.day,
      denVTydnu: p.weekday,
      zacatekMs: zonedToUtc(p.year, p.month, p.day, 0, pasmo).getTime(),
      konecMs: zonedToUtc(p.year, p.month, p.day + 1, 0, pasmo).getTime(),
    });
  }
  return dny;
}

/** Část události, která spadá do jednoho sloupce; minuty od půlnoci. */
function vyrez(u: BookingUdalost, den: Den): { od: number; do: number } | null {
  const s = Date.parse(u.start);
  const e = Date.parse(u.end);
  const od = Math.max(s, den.zacatekMs);
  const doKdy = Math.min(e, den.konecMs);
  if (doKdy <= od) return null;
  return { od: (od - den.zacatekMs) / 60000, do: (doKdy - den.zacatekMs) / 60000 };
}

export function BookingKalendar({
  studio,
  jenNahled,
  zacatek,
  prvniUdalosti,
}: {
  studio: BookingStudio;
  jenNahled: boolean;
  zacatek: string;
  prvniUdalosti: BookingUdalost[];
}) {
  const t = usePreklad();
  const jazyk = useJazyk();

  /**
   * DEN / TÝDEN / MĚSÍC (zadání 25. 9. 2026: „ten bookovací kalendář by měl
   * jít přepínat i na týden a měsíc"). Měsíc je přehled, ne mřížka: v buňce
   * dne se vejde jen to, co je zabrané a co je vaše - kdo chce rezervovat,
   * klepne na den a je v denním pohledu.
   */
  const [pohled, setPohled] = useState<'DEN' | 'TYDEN' | 'MESIC'>('TYDEN');
  const [zacatekMs, setZacatekMs] = useState(() => Date.parse(zacatek));
  /**
   * JEN MOJE UDÁLOSTI (zadání 25. 9. 2026: „a možnost si pak zobrazit
   * panáčkem jen mé události"). Stejné tlačítko i stejná ikona jako
   * v kalendáři portálu, ať to nikdo nehledá dvakrát.
   */
  const [jenMoje, setJenMoje] = useState(false);
  const [udalosti, setUdalosti] = useState<BookingUdalost[]>(prvniUdalosti);
  const [nacitam, setNacitam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingUdalost | null>(null);

  // Na telefonu jeden den - sedm sloupců na čtyřech palcích nepřečte nikdo.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 700) setPohled('DEN');
  }, []);

  /** Kolik dní pohled ukazuje; u měsíce jeho skutečná délka. */
  const pocetDnu = useMemo(() => {
    if (pohled === 'DEN') return 1;
    if (pohled === 'TYDEN') return 7;
    const p = utcParts(new Date(zacatekMs), studio.casovePasmo);
    const prvniDalsiho = zonedToUtc(p.year, p.month + 1, 1, 12 * 60, studio.casovePasmo);
    const prvni = zonedToUtc(p.year, p.month, 1, 12 * 60, studio.casovePasmo);
    return Math.round((prvniDalsiho.getTime() - prvni.getTime()) / 86400000);
  }, [pohled, zacatekMs, studio.casovePasmo]);

  const dny = useMemo(
    () => sestavDny(zacatekMs, studio.casovePasmo, pocetDnu),
    [zacatekMs, studio.casovePasmo, pocetDnu],
  );
  /** Co se kreslí do mřížky - buď všechno, nebo jen moje rezervace. */
  const zobrazene = useMemo(
    () => (jenMoje ? udalosti.filter((u) => u.moje) : udalosti),
    [udalosti, jenMoje],
  );
  const mrizka = useMemo(() => rozsahMrizky(studio.hodiny), [studio.hodiny]);
  const hodin = mrizka.do - mrizka.od;

  const nacti = useCallback(
    async (dnyKNacteni: Den[]) => {
      if (dnyKNacteni.length === 0) return;
      setNacitam(true);
      try {
        const od = new Date(dnyKNacteni[0].zacatekMs).toISOString();
        const doKdy = new Date(dnyKNacteni[dnyKNacteni.length - 1].konecMs).toISOString();
        const res = await fetch(
          `/api/studio/rezervace?studio=${encodeURIComponent(studio.id)}&od=${encodeURIComponent(od)}&do=${encodeURIComponent(doKdy)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUdalosti(data.udalosti ?? []);
      } finally {
        setNacitam(false);
      }
    },
    [studio.id],
  );

  // Po každé změně rozsahu (jiný týden, přepnutí den/týden) se data dotáhnou.
  const [prvni, setPrvni] = useState(true);
  useEffect(() => {
    if (prvni) {
      setPrvni(false);
      return;
    }
    void nacti(dny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dny]);

  function posun(o: number) {
    const p = utcParts(new Date(zacatekMs), studio.casovePasmo);
    if (pohled === 'MESIC') {
      setZacatekMs(zonedToUtc(p.year, p.month + o, 1, 0, studio.casovePasmo).getTime());
      return;
    }
    setZacatekMs(
      zonedToUtc(p.year, p.month, p.day + o * pocetDnu, 0, studio.casovePasmo).getTime(),
    );
  }

  /** Začátek pohledu pro daný den - týden se srovná na pondělí, měsíc na prvního. */
  function zacatekPohledu(
    novy: 'DEN' | 'TYDEN' | 'MESIC',
    p: { year: number; month: number; day: number; weekday: number },
  ): number {
    if (novy === 'MESIC') return zonedToUtc(p.year, p.month, 1, 0, studio.casovePasmo).getTime();
    const posunNaPondeli = novy === 'TYDEN' ? (p.weekday + 6) % 7 : 0;
    return zonedToUtc(p.year, p.month, p.day - posunNaPondeli, 0, studio.casovePasmo).getTime();
  }

  function naDnesek() {
    setZacatekMs(zacatekPohledu(pohled, utcParts(new Date(), studio.casovePasmo)));
  }

  /** Přepnutí pohledu drží den, na který se člověk zrovna dívá. */
  function prepniPohled(novy: 'DEN' | 'TYDEN' | 'MESIC') {
    const p = utcParts(new Date(zacatekMs), studio.casovePasmo);
    setPohled(novy);
    setZacatekMs(zacatekPohledu(novy, p));
  }

  /** Klepnutí na den v měsíci otevře jeho denní mřížku - tam se rezervuje. */
  function otevriDen(d: Den) {
    setPohled('DEN');
    setZacatekMs(d.zacatekMs);
  }

  const nazevDne = (d: Den) =>
    new Intl.DateTimeFormat(kodJazyka(jazyk), {
      timeZone: studio.casovePasmo,
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    }).format(new Date(d.zacatekMs + 12 * 60 * 60 * 1000));

  const rozsahPopis =
    pohled === 'MESIC'
      ? new Intl.DateTimeFormat(kodJazyka(jazyk), {
          timeZone: studio.casovePasmo,
          month: 'long',
          year: 'numeric',
        }).format(new Date(dny[0].zacatekMs + 12 * 60 * 60 * 1000))
      : `${nazevDne(dny[0])}${dny.length > 1 ? ` – ${nazevDne(dny[dny.length - 1])}` : ''}`;

  // --- formulář -------------------------------------------------------------
  const [formular, setFormular] = useState<
    | { rezim: 'HODINY'; den: Den; od: number; do: number }
    | { rezim: 'DNY'; den: Den; doDne: string }
    | null
  >(null);
  const [nazev, setNazev] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [uklada, setUklada] = useState(false);

  function otevriFormular(den: Den, minuty: number) {
    if (jenNahled) return;
    const pravidlo = hodinyDne(studio.hodiny, den.denVTydnu);
    if (!pravidlo) return;
    const krok = 30;
    const od = Math.min(
      Math.max(pravidlo.od, Math.floor(minuty / krok) * krok),
      pravidlo.do - studio.minMinut,
    );
    setChyba(null);
    setFormular({ rezim: 'HODINY', den, od, do: Math.min(od + studio.minMinut, pravidlo.do) });
    setNazev('');
    setPoznamka('');
  }

  async function uloz() {
    if (!formular || uklada) return;
    if (!nazev.trim()) return;
    setUklada(true);
    setChyba(null);
    try {
      const telo: Record<string, unknown>[] = [];
      if (formular.rezim === 'HODINY') {
        const d = formular.den;
        telo.push({
          studioId: studio.id,
          start: zonedToUtc(d.rok, d.mesic, d.den, formular.od, studio.casovePasmo).toISOString(),
          end: zonedToUtc(d.rok, d.mesic, d.den, formular.do, studio.casovePasmo).toISOString(),
          nazev: nazev.trim(),
          poznamka: poznamka.trim() || undefined,
        });
      } else {
        // Dlouhodobá rezervace: jeden záznam na každý otevřený den v rozsahu.
        const zacatekDne = new Date(formular.den.zacatekMs);
        const konecDne = new Date(`${formular.doDne}T12:00:00Z`);
        const p = utcParts(zacatekDne, studio.casovePasmo);
        for (let i = 0; i < 120; i += 1) {
          const poledne = zonedToUtc(p.year, p.month, p.day + i, 12 * 60, studio.casovePasmo);
          if (poledne.getTime() > konecDne.getTime() + 12 * 60 * 60 * 1000) break;
          const den = utcParts(poledne, studio.casovePasmo);
          const klic = `${den.year}-${dvojcifra(den.month)}-${dvojcifra(den.day)}`;
          if (klic > formular.doDne) break;
          if (!hodinyDne(studio.hodiny, den.weekday)) continue;
          telo.push({
            studioId: studio.id,
            den: klic,
            nazev: nazev.trim(),
            poznamka: poznamka.trim() || undefined,
          });
        }
      }

      let neuspech: string | null = null;
      let ulozeno = 0;
      for (const data of telo) {
        const res = await fetch('/api/studio/rezervace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) ulozeno += 1;
        else {
          const odpoved = await res.json().catch(() => ({}));
          neuspech = odpoved?.klic ? t(String(odpoved.error)) : odpoved?.error || t('booking.chybaUlozeni');
        }
      }

      await nacti(dny);
      if (neuspech && ulozeno === 0) {
        setChyba(neuspech);
        return;
      }
      if (neuspech) setChyba(t('booking.castNeulozena'));
      setFormular(null);
    } catch {
      setChyba(t('booking.chybaUlozeni'));
    } finally {
      setUklada(false);
    }
  }

  async function zrus(u: BookingUdalost) {
    setUklada(true);
    try {
      const res = await fetch(`/api/studio/rezervace?id=${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || t('booking.chybaUlozeni'));
        return;
      }
      setDetail(null);
      await nacti(dny);
    } finally {
      setUklada(false);
    }
  }

  const mojeNadchazejici = useMemo(
    () =>
      udalosti
        .filter((u) => u.moje && Date.parse(u.end) > Date.now())
        .sort((a, b) => a.start.localeCompare(b.start)),
    [udalosti],
  );

  const casUdalosti = (u: BookingUdalost) =>
    new Intl.DateTimeFormat(kodJazyka(jazyk), {
      timeZone: studio.casovePasmo,
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(u.start));

  return (
    <div className="flex flex-col gap-4">
      {/* --- hlavička ------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl text-ink m-0">{studio.nazev}</h1>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {t('booking.pasmo', { mesto: studio.mesto || studio.kratce })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => posun(-1)} aria-label={t('booking.predchozi')} className={tlacitko}>
            ‹
          </button>
          <button type="button" onClick={naDnesek} className={tlacitko}>
            {t('booking.dnes')}
          </button>
          <button type="button" onClick={() => posun(1)} aria-label={t('booking.dalsi')} className={tlacitko}>
            ›
          </button>
          <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setJenMoje((v) => !v)}
            aria-pressed={jenMoje}
            aria-label={t('booking.jenMoje')}
            title={t('booking.jenMoje')}
            className={`${jenMoje ? tlacitkoAktivni : tlacitko} inline-grid place-items-center`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0 1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
            </svg>
          </button>
          {(['DEN', 'TYDEN', 'MESIC'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => prepniPohled(v)}
              className={pohled === v ? tlacitkoAktivni : tlacitko}
            >
              {t(v === 'DEN' ? 'booking.den' : v === 'TYDEN' ? 'booking.tyden' : 'booking.mesic')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-heading font-semibold text-sm text-ink">{rozsahPopis}</span>
        <span className="flex items-center gap-3 text-[11px] font-heading text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-brand-purple" aria-hidden="true" />
            {t('booking.mojeRezervace')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px] bg-line" aria-hidden="true" />
            {t('booking.obsazeno')}
          </span>
          {nacitam && <span>{t('obecne.nacitam')}</span>}
        </span>
      </div>

      {chyba && (
        <p className="m-0 text-sm font-body text-status-error bg-errTint border border-status-error/30 rounded-lg px-3 py-2">
          {chyba}
        </p>
      )}
      {jenNahled && (
        <p className="m-0 text-xs font-body text-muted bg-field border border-line rounded-lg px-3 py-2">
          {t('booking.jenNahled')}
        </p>
      )}

      {/* --- měsíc: přehled, ne mřížka ------------------------------------- */}
      {pohled === 'MESIC' && (
        <MesicniPrehled
          dny={dny}
          udalosti={zobrazene}
          studio={studio}
          jazyk={jazyk}
          popisObsazeno={t('booking.obsazeno')}
          popisZavreno={t('booking.zavreno')}
          naDen={otevriDen}
        />
      )}

      {/* --- mřížka -------------------------------------------------------- */}
      {pohled !== 'MESIC' && (
      <div className="bg-surface border border-line rounded-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: pocetDnu === 7 ? 700 : 280 }}>
            {/* záhlaví dnů */}
            <div className="flex border-b border-line bg-field">
              <div className="w-12 shrink-0" />
              {dny.map((d) => {
                const otevreno = Boolean(hodinyDne(studio.hodiny, d.denVTydnu));
                return (
                  <div
                    key={d.klic}
                    className={`flex-1 px-2 py-2 text-center border-l border-line ${otevreno ? '' : 'opacity-50'}`}
                  >
                    <span className="block font-heading font-semibold text-xs text-ink">{nazevDne(d)}</span>
                    <span className="block text-[10px] font-body text-muted">
                      {otevreno
                        ? `${casZMinut(hodinyDne(studio.hodiny, d.denVTydnu)!.od)}–${casZMinut(hodinyDne(studio.hodiny, d.denVTydnu)!.do)}`
                        : t('booking.zavreno')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* hodiny a sloupce */}
            <div className="flex" style={{ height: hodin * HODINA_PX }}>
              <div className="w-12 shrink-0 relative">
                {Array.from({ length: hodin }, (_, i) => (
                  <span
                    key={i}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] font-heading text-muted tabular-nums"
                    style={{ top: i * HODINA_PX }}
                  >
                    {mrizka.od + i}:00
                  </span>
                ))}
              </div>

              {dny.map((d) => {
                const pravidlo = hodinyDne(studio.hodiny, d.denVTydnu);
                const vyrezy = zobrazene
                  .map((u) => ({ u, v: vyrez(u, d) }))
                  .filter((x): x is { u: BookingUdalost; v: { od: number; do: number } } => Boolean(x.v));
                return (
                  <div key={d.klic} className="flex-1 relative border-l border-line">
                    {/* hodinové linky */}
                    {Array.from({ length: hodin }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-line/60"
                        style={{ top: i * HODINA_PX }}
                      />
                    ))}

                    {/* otevírací doba - jen v ní se dá klikat */}
                    {pravidlo && !jenNahled && (
                      <button
                        type="button"
                        aria-label={t('booking.novaRezervace')}
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const minuty = pravidlo.od + ((e.clientY - r.top) / HODINA_PX) * 60;
                          otevriFormular(d, minuty);
                        }}
                        className="absolute left-0 right-0 bg-tint/40 hover:bg-tint cursor-pointer border-0 p-0 transition-colors"
                        style={{
                          top: ((pravidlo.od - mrizka.od * 60) / 60) * HODINA_PX,
                          height: ((pravidlo.do - pravidlo.od) / 60) * HODINA_PX,
                        }}
                      />
                    )}

                    {vyrezy.map(({ u, v }) => (
                      <button
                        key={`${u.id}-${d.klic}`}
                        type="button"
                        onClick={() => u.moje && setDetail(u)}
                        title={u.moje ? u.nazev ?? '' : t('booking.obsazeno')}
                        className={`absolute left-0.5 right-0.5 rounded-[5px] px-1.5 py-0.5 text-left overflow-hidden border ${
                          u.moje
                            ? 'bg-brand-purple border-brand-purpleDeep text-white cursor-pointer'
                            : 'bg-line/70 border-line text-muted cursor-default'
                        }`}
                        style={{
                          top: ((v.od - mrizka.od * 60) / 60) * HODINA_PX,
                          height: Math.max(16, ((v.do - v.od) / 60) * HODINA_PX - 2),
                        }}
                      >
                        <span className="block text-[10px] font-heading font-semibold truncate">
                          {u.moje ? u.nazev : t('booking.obsazeno')}
                        </span>
                        <span className="block text-[9px] font-body opacity-80 truncate">
                          {casZMinut(Math.round(v.od))}–{casZMinut(Math.round(v.do))}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {!jenNahled && (
        <p className="m-0 text-xs font-body text-muted">
          {pohled === 'MESIC'
            ? t('booking.napovedaMesic')
            : t('booking.napoveda', { minut: studio.minMinut })}
        </p>
      )}

      {/* --- moje nadcházející rezervace ----------------------------------- */}
      <div className="bg-surface border border-line rounded-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-heading font-semibold text-sm text-ink m-0">{t('booking.nadchazejici')}</h2>
        </div>
        {mojeNadchazejici.length === 0 ? (
          <p className="text-sm font-body text-muted m-0 px-4 py-5">{t('booking.zadneRezervace')}</p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {mojeNadchazejici.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line first:border-t-0"
              >
                <span className="min-w-0">
                  <span className="block font-heading text-sm text-ink truncate">{u.nazev}</span>
                  <span className="block text-xs font-body text-muted tabular-nums">{casUdalosti(u)}</span>
                </span>
                <button type="button" onClick={() => setDetail(u)} className={tlacitko}>
                  {t('obecne.otevrit')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- formulář nové rezervace --------------------------------------- */}
      {formular && (
        <Okno onZavrit={() => setFormular(null)} nadpis={t('booking.novaRezervace')}>
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setFormular((f) =>
                    f && f.rezim === 'DNY'
                      ? {
                          rezim: 'HODINY',
                          den: f.den,
                          od: hodinyDne(studio.hodiny, f.den.denVTydnu)?.od ?? 9 * 60,
                          do:
                            (hodinyDne(studio.hodiny, f.den.denVTydnu)?.od ?? 9 * 60) + studio.minMinut,
                        }
                      : f,
                  )
                }
                className={formular.rezim === 'HODINY' ? tlacitkoAktivni : tlacitko}
              >
                {t('booking.hodiny')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormular((f) => (f ? { rezim: 'DNY', den: f.den, doDne: f.den.klic } : f))
                }
                className={formular.rezim === 'DNY' ? tlacitkoAktivni : tlacitko}
              >
                {t('booking.celeDny')}
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">{t('booking.datum')}</span>
              <input
                type="date"
                value={formular.den.klic}
                onChange={(e) => {
                  const [r, m, d] = e.target.value.split('-').map(Number);
                  if (!r || !m || !d) return;
                  const poledne = zonedToUtc(r, m, d, 12 * 60, studio.casovePasmo);
                  const p = utcParts(poledne, studio.casovePasmo);
                  const novy: Den = {
                    klic: e.target.value,
                    rok: p.year,
                    mesic: p.month,
                    den: p.day,
                    denVTydnu: p.weekday,
                    zacatekMs: zonedToUtc(p.year, p.month, p.day, 0, studio.casovePasmo).getTime(),
                    konecMs: zonedToUtc(p.year, p.month, p.day + 1, 0, studio.casovePasmo).getTime(),
                  };
                  setFormular((f) =>
                    f ? (f.rezim === 'DNY' ? { ...f, den: novy } : { ...f, den: novy }) : f,
                  );
                }}
                className={pole}
              />
            </label>

            {formular.rezim === 'HODINY' ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-heading text-muted">{t('booking.od')}</span>
                  <select
                    value={formular.od}
                    onChange={(e) =>
                      setFormular((f) =>
                        f && f.rezim === 'HODINY'
                          ? {
                              ...f,
                              od: Number(e.target.value),
                              do: Math.max(f.do, Number(e.target.value) + studio.minMinut),
                            }
                          : f,
                      )
                    }
                    className={pole}
                  >
                    {krokyDne(studio, formular.den.denVTydnu, false).map((m) => (
                      <option key={m} value={m}>
                        {casZMinut(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-heading text-muted">{t('booking.do')}</span>
                  <select
                    value={formular.do}
                    onChange={(e) =>
                      setFormular((f) =>
                        f && f.rezim === 'HODINY' ? { ...f, do: Number(e.target.value) } : f,
                      )
                    }
                    className={pole}
                  >
                    {krokyDne(studio, formular.den.denVTydnu, true)
                      .filter((m) => m >= formular.od + studio.minMinut)
                      .map((m) => (
                        <option key={m} value={m}>
                          {casZMinut(m)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-heading text-muted">{t('booking.doData')}</span>
                <input
                  type="date"
                  value={formular.doDne}
                  min={formular.den.klic}
                  onChange={(e) =>
                    setFormular((f) => (f && f.rezim === 'DNY' ? { ...f, doDne: e.target.value } : f))
                  }
                  className={pole}
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">{t('booking.nazev')}</span>
              <input
                value={nazev}
                onChange={(e) => setNazev(e.target.value)}
                maxLength={160}
                placeholder={t('booking.nazevPriklad')}
                className={pole}
              />
              <span className="text-[11px] font-body text-muted">{t('booking.nazevNapoveda')}</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-heading text-muted">{t('booking.poznamka')}</span>
              <textarea
                value={poznamka}
                onChange={(e) => setPoznamka(e.target.value)}
                rows={2}
                maxLength={1000}
                className={pole}
              />
            </label>

            {formular.rezim === 'HODINY' &&
              zkontrolujOkno(studio, formular.den.denVTydnu, formular.od, formular.do) && (
                <p className="m-0 text-xs font-body text-status-error">
                  {t(String(zkontrolujOkno(studio, formular.den.denVTydnu, formular.od, formular.do)))}
                </p>
              )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setFormular(null)} className={tlacitko}>
                {t('obecne.zrusit')}
              </button>
              <button
                type="button"
                onClick={uloz}
                disabled={uklada || !nazev.trim()}
                className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 disabled:opacity-50 border-0 cursor-pointer"
              >
                {uklada ? t('obecne.ukladam') : t('booking.rezervovat')}
              </button>
            </div>
          </div>
        </Okno>
      )}

      {/* --- detail vlastní rezervace -------------------------------------- */}
      {detail && (
        <Okno onZavrit={() => setDetail(null)} nadpis={detail.nazev ?? t('booking.mojeRezervace')}>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm font-body text-ink tabular-nums">{casUdalosti(detail)}</p>
            {detail.poznamka && (
              <p className="m-0 text-sm font-body text-muted whitespace-pre-wrap">{detail.poznamka}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDetail(null)} className={tlacitko}>
                {t('obecne.zavrit')}
              </button>
              {Date.parse(detail.start) > Date.now() && (
                <button
                  type="button"
                  onClick={() => zrus(detail)}
                  disabled={uklada}
                  className="rounded-pill bg-status-error text-white font-heading font-semibold text-sm px-5 py-2 disabled:opacity-50 border-0 cursor-pointer"
                >
                  {t('booking.zrusitRezervaci')}
                </button>
              )}
            </div>
          </div>
        </Okno>
      )}
    </div>
  );
}

/**
 * MĚSÍČNÍ PŘEHLED (zadání 25. 9. 2026). Schválně NE hodinová mřížka: třicet
 * dní po dvanácti hodinách vedle sebe je na obrazovce nečitelná změť. V buňce
 * dne je proto jen to podstatné - kdy je zabráno a co z toho je vaše -
 * a klepnutí otevře ten den, kde se rezervuje.
 */
function MesicniPrehled({
  dny,
  udalosti,
  studio,
  jazyk,
  popisObsazeno,
  popisZavreno,
  naDen,
}: {
  dny: Den[];
  udalosti: BookingUdalost[];
  studio: BookingStudio;
  jazyk: ReturnType<typeof useJazyk>;
  popisObsazeno: string;
  popisZavreno: string;
  naDen: (d: Den) => void;
}) {
  // Týden začíná pondělím, takže první den měsíce se odsadí.
  const odsazeni = (dny[0].denVTydnu + 6) % 7;
  const dnesKlic = (() => {
    const p = utcParts(new Date(), studio.casovePasmo);
    return `${p.year}-${dvojcifra(p.month)}-${dvojcifra(p.day)}`;
  })();

  const nazvyDnu = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(kodJazyka(jazyk), { weekday: 'short', timeZone: 'UTC' }).format(
      // 5. 1. 1970 bylo pondělí.
      new Date(Date.UTC(1970, 0, 5 + i, 12)),
    ),
  );

  return (
    <div className="bg-surface border border-line rounded-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 bg-field border-b border-line">
        {nazvyDnu.map((n) => (
          <span
            key={n}
            className="px-2 py-2 text-center font-heading font-semibold text-[11px] text-muted"
          >
            {n}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: odsazeni }, (_, i) => (
          <span key={`prazdno-${i}`} className="border-t border-l border-line first:border-l-0" />
        ))}
        {dny.map((d) => {
          const otevreno = Boolean(hodinyDne(studio.hodiny, d.denVTydnu));
          const vyrezy = udalosti
            .map((u) => ({ u, v: vyrez(u, d) }))
            .filter((x): x is { u: BookingUdalost; v: { od: number; do: number } } => Boolean(x.v))
            .sort((a, b) => a.v.od - b.v.od);
          const dnes = d.klic === dnesKlic;
          return (
            <button
              key={d.klic}
              type="button"
              onClick={() => naDen(d)}
              className={`text-left border-t border-l border-line p-1.5 min-h-[86px] flex flex-col gap-1 cursor-pointer transition-colors ${
                otevreno ? 'bg-transparent hover:bg-field' : 'bg-field/60'
              }`}
            >
              <span
                className={`font-heading text-[11px] ${
                  dnes
                    ? 'inline-grid place-items-center w-5 h-5 rounded-full bg-brand-purple text-white'
                    : 'text-ink'
                } ${otevreno ? '' : 'opacity-50'}`}
              >
                {d.den}
              </span>
              {!otevreno && <span className="text-[10px] font-body text-muted">{popisZavreno}</span>}
              {vyrezy.slice(0, 3).map(({ u, v }) => (
                <span
                  key={`${u.id}-${d.klic}`}
                  className={`block rounded-[4px] px-1 py-0.5 text-[9px] font-heading truncate ${
                    u.moje
                      ? 'bg-brand-purple text-white'
                      : 'bg-line/70 text-muted'
                  }`}
                >
                  {casZMinut(Math.round(v.od))} {u.moje ? u.nazev : popisObsazeno}
                </span>
              ))}
              {vyrezy.length > 3 && (
                <span className="text-[9px] font-heading text-muted">+{vyrezy.length - 3}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Nabídka časů po půlhodinách uvnitř otevírací doby. */
function krokyDne(studio: BookingStudio, denVTydnu: number, konec: boolean): number[] {
  const pravidlo = hodinyDne(studio.hodiny, denVTydnu);
  if (!pravidlo) return [];
  const kroky: number[] = [];
  const od = konec ? pravidlo.od + studio.minMinut : pravidlo.od;
  const doKdy = konec ? pravidlo.do : pravidlo.do - studio.minMinut;
  for (let m = od; m <= doKdy; m += 30) kroky.push(m);
  return kroky;
}

function Okno({
  nadpis,
  onZavrit,
  children,
}: {
  nadpis: string;
  onZavrit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onZavrit}
      role="presentation"
    >
      <div
        className="bg-surface border border-line rounded-t-card sm:rounded-card shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line sticky top-0 bg-surface">
          <span className="font-heading font-semibold text-sm text-ink truncate">{nadpis}</span>
          <button
            type="button"
            onClick={onZavrit}
            aria-label="×"
            className="text-muted hover:text-ink text-xl leading-none bg-transparent border-0 cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const tlacitko =
  'bg-surface border border-line text-ink font-heading font-semibold text-xs rounded-lg px-3 py-1.5 hover:bg-field transition-colors cursor-pointer';
const tlacitkoAktivni =
  'bg-brand-purple border border-brand-purpleDeep text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 cursor-pointer';
const pole =
  'w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';
