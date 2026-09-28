'use client';

import { useState } from 'react';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { CURRENCIES, CURRENCY_NAMES, minorToInput, parseMoneyToMinor } from '@/lib/doklady';
import { cena, platnost, type Cenik, type RadekCeniku } from '@/lib/studioCenik';
import type { Currency } from '@prisma/client';

/**
 * EDITOR CENÍKU STUDIA (zadání 28. 9. 2026: „aby se daly upravovat ceny
 * v systému a aby se pak dalo poslat někomu PDF nebo stáhnout").
 *
 * Vlevo se píše, vpravo je hned vidět, jak bude ceník vypadat. Náhled je
 * schválně HTML, ne vložené PDF: PDF by se muselo po každém písmenku vyrábět
 * znovu na serveru. Sazba je stejná (stejná data, stejné pořadí sloupců),
 * takže se z náhledu pozná všechno podstatné - a kdo chce vidět doopravdy
 * hotový dokument, otevře si ho tlačítkem Náhled PDF.
 *
 * ODESLAT JDE JEN ULOŽENÝ CENÍK. PDF do přílohy vyrábí server z databáze, ne
 * z toho, co je zrovna na obrazovce - proto se před odesláním nejdřív uloží.
 */

type Radek = Omit<RadekCeniku, 'id'> & { klic: string };

const VYCHOZI_ZPRAVA = (nadpis: string) =>
  `Hello,\n\nplease find attached our current price list for ${nadpis}.\n\n` +
  `If you would like to book a session or have any questions, just reply to this email.\n\n` +
  `Kind regards,\nMediaspace`;

export function CenikEditor({
  studioId,
  studia,
  cenik: vychozi,
}: {
  studioId: string;
  studia: { id: string; name: string }[];
  cenik: Cenik;
}) {
  const [nadpis, setNadpis] = useState(vychozi.nadpis);
  const [podnadpis, setPodnadpis] = useState(vychozi.podnadpis ?? '');
  const [platnostDo, setPlatnostDo] = useState(vychozi.platnostDo);
  const [mena, setMena] = useState<Currency>(vychozi.mena);
  const [sloupec1, setSloupec1] = useState(vychozi.sloupec1);
  const [sloupec1Popis, setSloupec1Popis] = useState(vychozi.sloupec1Popis ?? '');
  const [sloupec2, setSloupec2] = useState(vychozi.sloupec2 ?? '');
  const [sloupec2Popis, setSloupec2Popis] = useState(vychozi.sloupec2Popis ?? '');
  const [poznamka, setPoznamka] = useState(vychozi.poznamka ?? '');
  const [radky, setRadky] = useState<Radek[]>(
    vychozi.radky.map((r) => ({ ...r, klic: r.id })),
  );

  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [odesilam, setOdesilam] = useState(false);
  const [komu, setKomu] = useState('');
  const [predmet, setPredmet] = useState(`${vychozi.nadpis} – price list`);
  const [zprava, setZprava] = useState(VYCHOZI_ZPRAVA(vychozi.nadpis));

  const dvaSloupce = Boolean(sloupec2.trim());

  const telo = () => ({
    studioId,
    nadpis: nadpis.trim(),
    podnadpis: podnadpis.trim() || undefined,
    platnostDo: platnostDo || '',
    mena,
    sloupec1: sloupec1.trim() || 'Price',
    sloupec1Popis: sloupec1Popis.trim() || undefined,
    sloupec2: sloupec2.trim() || undefined,
    sloupec2Popis: sloupec2Popis.trim() || undefined,
    poznamka: poznamka.trim() || undefined,
    radky: radky
      .filter((r) => r.popis.trim())
      .map((r) => ({
        popis: r.popis.trim(),
        cena1Minor: r.cena1Minor,
        cena2Minor: dvaSloupce ? r.cena2Minor : null,
        od1: r.od1,
        od2: dvaSloupce ? r.od2 : false,
      })),
  });

  async function uloz(): Promise<boolean> {
    setBusy(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/studio/cenik', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nepovedlo.');
        return false;
      }
      setHlaska('Uloženo.');
      return true;
    } catch {
      setChyba('Uložení se nepovedlo.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function odesli() {
    if (!komu.trim()) {
      setChyba('Napište, komu se má ceník poslat.');
      return;
    }
    // Nejdřív uložit - do přílohy jde to, co je v portálu.
    if (!(await uloz())) return;
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/studio/cenik/odeslat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, komu: komu.trim(), predmet: predmet.trim(), zprava }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Odeslání se nepovedlo.');
        return;
      }
      setHlaska(`Odesláno na ${komu.trim()}.`);
      setOdesilam(false);
      setKomu('');
    } catch {
      setChyba('Odeslání se nepovedlo.');
    } finally {
      setBusy(false);
    }
  }

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full';
  const stitek = 'text-xs font-heading font-semibold uppercase tracking-wide text-muted';

  const zmen = (klic: string, zmena: Partial<Radek>) =>
    setRadky((r) => r.map((x) => (x.klic === klic ? { ...x, ...zmena } : x)));

  const posun = (klic: string, smer: -1 | 1) =>
    setRadky((r) => {
      const i = r.findIndex((x) => x.klic === klic);
      const j = i + smer;
      if (i < 0 || j < 0 || j >= r.length) return r;
      const kopie = [...r];
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
      return kopie;
    });

  return (
    <div className="flex flex-col gap-5">
      {studia.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={stitek}>Studio</span>
          <VyberPole
            aria-label="Studio"
            value={studioId}
            onChange={(e) => {
              window.location.href = `/cenik-studia?studio=${encodeURIComponent(e.target.value)}`;
            }}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple min-w-[200px]"
          >
            {studia.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </VyberPole>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* ---------- Vlevo: co se píše ---------- */}
        <div className="flex flex-col gap-5">
          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Záhlaví
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className={stitek}>Název v hlavičce</span>
              <input value={nadpis} onChange={(e) => setNadpis(e.target.value)} className={pole} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={stitek}>Podnadpis</span>
              <input
                value={podnadpis}
                onChange={(e) => setPodnadpis(e.target.value)}
                placeholder="Introductory Price List"
                className={pole}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={stitek}>Platí do</span>
                <DatumPole
                  value={platnostDo}
                  onChange={(e) => setPlatnostDo(e.target.value)}
                  className={pole}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={stitek}>Měna</span>
                <VyberPole
                  value={mena}
                  onChange={(e) => setMena(e.target.value as Currency)}
                  className={pole}
                >
                  {CURRENCIES.map((m) => (
                    <option key={m} value={m}>
                      {CURRENCY_NAMES[m]}
                    </option>
                  ))}
                </VyberPole>
              </label>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Cenové sloupce
            </h2>
            <p className="text-xs font-body text-muted m-0">
              Druhý sloupec je dobrovolný. Když ho necháte prázdný, bude mít ceník jen jednu cenu
              u každé položky.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={stitek}>První sloupec</span>
                  <input
                    value={sloupec1}
                    onChange={(e) => setSloupec1(e.target.value)}
                    className={pole}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={stitek}>Popis pod ním</span>
                  <textarea
                    value={sloupec1Popis}
                    onChange={(e) => setSloupec1Popis(e.target.value)}
                    rows={3}
                    className={pole}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={stitek}>Druhý sloupec</span>
                  <input
                    value={sloupec2}
                    onChange={(e) => setSloupec2(e.target.value)}
                    className={pole}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={stitek}>Popis pod ním</span>
                  <textarea
                    value={sloupec2Popis}
                    onChange={(e) => setSloupec2Popis(e.target.value)}
                    rows={3}
                    disabled={!dvaSloupce}
                    className={`${pole} disabled:opacity-40`}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Položky
            </h2>
            <ul className="list-none m-0 p-0 flex flex-col gap-3">
              {radky.map((r, i) => (
                <li key={r.klic} className="flex flex-col gap-2 border border-line rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={r.popis}
                      onChange={(e) => zmen(r.klic, { popis: e.target.value })}
                      placeholder="Half day / 4 hours"
                      className={pole}
                    />
                    <button
                      type="button"
                      onClick={() => posun(r.klic, -1)}
                      disabled={i === 0}
                      title="Posunout nahoru"
                      aria-label="Posunout nahoru"
                      className="shrink-0 w-8 h-8 rounded-lg border border-line bg-field text-muted hover:text-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => posun(r.klic, 1)}
                      disabled={i === radky.length - 1}
                      title="Posunout dolů"
                      aria-label="Posunout dolů"
                      className="shrink-0 w-8 h-8 rounded-lg border border-line bg-field text-muted hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <TlacitkoSmazat
                      onSmazat={() => setRadky((x) => x.filter((y) => y.klic !== r.klic))}
                      otazka="Opravdu smazat?"
                      popisek="Smazat položku"
                    />
                  </div>
                  <div className={`grid gap-2 ${dvaSloupce ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <CenaPole
                      stitek={sloupec1 || 'Cena'}
                      minor={r.cena1Minor}
                      od={r.od1}
                      mena={mena}
                      onMinor={(v) => zmen(r.klic, { cena1Minor: v })}
                      onOd={(v) => zmen(r.klic, { od1: v })}
                    />
                    {dvaSloupce && (
                      <CenaPole
                        stitek={sloupec2}
                        minor={r.cena2Minor}
                        od={r.od2}
                        mena={mena}
                        onMinor={(v) => zmen(r.klic, { cena2Minor: v })}
                        onOd={(v) => zmen(r.klic, { od2: v })}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setRadky((r) => [
                  ...r,
                  {
                    klic: `novy-${Date.now()}`,
                    popis: '',
                    cena1Minor: null,
                    cena2Minor: null,
                    od1: false,
                    od2: false,
                  },
                ])
              }
              className="self-start text-sm font-heading font-semibold text-brand-purple bg-transparent border-0 px-0"
            >
              + Přidat položku
            </button>
          </section>

          <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={stitek}>Poznámka pod tabulkou</span>
              <textarea
                value={poznamka}
                onChange={(e) => setPoznamka(e.target.value)}
                rows={3}
                placeholder="All prices exclude VAT. Cancellation up to 48 hours before the session is free of charge."
                className={pole}
              />
            </label>
          </section>
        </div>

        {/* ---------- Vpravo: jak to bude vypadat ---------- */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-28">
          <Nahled
            nadpis={nadpis}
            podnadpis={podnadpis}
            platnostDo={platnostDo}
            mena={mena}
            sloupec1={sloupec1}
            sloupec1Popis={sloupec1Popis}
            sloupec2={sloupec2}
            sloupec2Popis={sloupec2Popis}
            poznamka={poznamka}
            radky={radky}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void uloz()}
              disabled={busy}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
            >
              {busy ? 'Ukládám…' : 'Uložit ceník'}
            </button>
            <a
              href={`/api/studio/cenik/pdf?studio=${encodeURIComponent(studioId)}&nahled=1`}
              target="_blank"
              rel="noopener"
              className="font-heading font-semibold text-sm rounded-lg px-4 py-2.5 border border-line bg-field text-ink no-underline hover:border-brand-purple"
            >
              Náhled PDF
            </a>
            <a
              href={`/api/studio/cenik/pdf?studio=${encodeURIComponent(studioId)}`}
              className="font-heading font-semibold text-sm rounded-lg px-4 py-2.5 border border-line bg-field text-ink no-underline hover:border-brand-purple"
            >
              Stáhnout PDF
            </a>
            <button
              type="button"
              onClick={() => setOdesilam((o) => !o)}
              className="font-heading font-semibold text-sm rounded-lg px-4 py-2.5 border border-line bg-field text-ink hover:border-brand-purple"
            >
              Poslat e-mailem
            </button>
          </div>

          <p className="text-xs text-muted font-body m-0">
            Náhled PDF i příloha e-mailu se dělají z uloženého ceníku - co není uložené, v nich
            nebude.
          </p>

          {odesilam && (
            <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
                Poslat ceník
              </h2>
              <label className="flex flex-col gap-1.5">
                <span className={stitek}>Komu</span>
                <input
                  type="email"
                  value={komu}
                  onChange={(e) => setKomu(e.target.value)}
                  placeholder="jmeno@firma.co.uk"
                  className={pole}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={stitek}>Předmět</span>
                <input value={predmet} onChange={(e) => setPredmet(e.target.value)} className={pole} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={stitek}>Zpráva</span>
                <textarea
                  value={zprava}
                  onChange={(e) => setZprava(e.target.value)}
                  rows={8}
                  className={pole}
                />
              </label>
              <p className="text-xs text-muted font-body m-0">
                Odejde z adresy portálu za Mediaspace; odpověď přijde vám. PDF ceníku je v příloze.
              </p>
              <button
                type="button"
                onClick={() => void odesli()}
                disabled={busy}
                className="self-start bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
              >
                {busy ? 'Odesílám…' : 'Uložit a odeslat'}
              </button>
            </section>
          )}

          {chyba && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
              {chyba}
            </p>
          )}
          {hlaska && !chyba && (
            <p className="text-sm text-status-done bg-okTint border border-line rounded-lg px-3 py-2 m-0">
              {hlaska}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CenaPole({
  stitek,
  minor,
  od,
  mena,
  onMinor,
  onOd,
}: {
  stitek: string;
  minor: number | null;
  od: boolean;
  mena: Currency;
  onMinor: (v: number | null) => void;
  onOd: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-heading text-muted truncate">{stitek}</span>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={minor === null ? '' : minorToInput(minor).replace(/\.00$/, '')}
          onChange={(e) => {
            const t = e.target.value.trim();
            onMinor(t === '' ? null : parseMoneyToMinor(t));
          }}
          placeholder="—"
          className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple tabular-nums"
        />
        <label
          className="flex items-center gap-1.5 text-xs font-body text-muted whitespace-nowrap"
          title="Cena je orientační - v ceníku se napíše „from …"
        >
          <input type="checkbox" checked={od} onChange={(e) => onOd(e.target.checked)} />
          od
        </label>
      </div>
      <span className="text-[11px] text-muted tabular-nums">{cena(minor, mena, od)}</span>
    </div>
  );
}

/** Jak bude ceník vypadat - stejná data i pořadí sloupců jako v PDF. */
function Nahled({
  nadpis,
  podnadpis,
  platnostDo,
  mena,
  sloupec1,
  sloupec1Popis,
  sloupec2,
  sloupec2Popis,
  poznamka,
  radky,
}: {
  nadpis: string;
  podnadpis: string;
  platnostDo: string;
  mena: Currency;
  sloupec1: string;
  sloupec1Popis: string;
  sloupec2: string;
  sloupec2Popis: string;
  poznamka: string;
  radky: Radek[];
}) {
  const dva = Boolean(sloupec2.trim());
  const doKdy = platnost(platnostDo || null);

  return (
    <div className="bg-surface border border-line rounded-card shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-brand-purple to-brand-purpleDeep px-6 pt-5 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-8 w-auto" />
        <span className="block h-[3px] w-10 rounded bg-brand-green mt-3" />
        <p className="font-display text-white text-2xl m-0 mt-3 break-words">{nadpis || '—'}</p>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {podnadpis.trim() && (
          <p className="font-heading font-semibold text-ink text-lg m-0">{podnadpis}</p>
        )}
        {doKdy && <p className="text-xs text-muted font-body m-0 -mt-3">Valid until {doKdy}</p>}

        <div className={`grid gap-3 ${dva ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {[
            { nazev: sloupec1, popis: sloupec1Popis },
            ...(dva ? [{ nazev: sloupec2, popis: sloupec2Popis }] : []),
          ]
            .filter((k) => k.nazev.trim() || k.popis.trim())
            .map((k) => (
              <div key={k.nazev} className="rounded-lg border border-line bg-tint px-3 py-2.5">
                <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-brand-purple m-0">
                  {k.nazev}
                </p>
                {k.popis.trim() && <p className="text-xs font-body text-ink m-0 mt-1">{k.popis}</p>}
              </div>
            ))}
        </div>

        <table className="w-full text-sm font-body border border-line rounded-lg border-collapse overflow-hidden">
          <thead>
            <tr className="bg-tint text-[11px] font-heading text-muted uppercase tracking-wide">
              <th className="text-left px-3 py-2">Session length</th>
              <th className="text-right px-3 py-2 whitespace-nowrap">{sloupec1 || 'Price'}</th>
              {dva && <th className="text-right px-3 py-2 whitespace-nowrap">{sloupec2}</th>}
            </tr>
          </thead>
          <tbody>
            {radky.map((r) => (
              <tr key={r.klic} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{r.popis || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-heading font-semibold">
                  {cena(r.cena1Minor, mena, r.od1)}
                </td>
                {dva && (
                  <td className="px-3 py-2 text-right tabular-nums font-heading font-semibold">
                    {cena(r.cena2Minor, mena, r.od2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {poznamka.trim() && (
          <p className="text-xs font-body text-muted m-0 whitespace-pre-line">{poznamka}</p>
        )}

        <p className="text-[11px] font-body text-muted m-0 text-center border-t border-line pt-3">
          MEDIA SPACE s.r.o. • www.mediaspace.cz • info@mediaspace.cz
        </p>
      </div>
    </div>
  );
}
