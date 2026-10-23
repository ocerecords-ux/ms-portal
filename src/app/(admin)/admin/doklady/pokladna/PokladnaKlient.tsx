'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Currency } from '@prisma/client';
import { parseMoneyToMinor } from '@/lib/doklady';
import { SAZBY_DPH } from '@/lib/pokladna';

/**
 * POKLADNÍ KNIHA NA OBRAZOVCE (zadání 23. 10. 2026).
 *
 * Nahoře zůstatek - to je jediné číslo, kvůli kterému se sem většinou chodí.
 * Pod ním dvě tlačítka, protože do pokladny se jen přijímá a vydává; všechno
 * ostatní (nastavení řad, počáteční stav) je schválně schované, ať se na to
 * nesahá omylem.
 *
 * ŘÁDKY Z VÝDAJŮ JSOU ZAMČENÉ. Hotově zaplacený výdaj se zadává ve Výdajích
 * a sem spadne sám; odsud na něj vede odkaz, ale mazat ani přepisovat se tu
 * nedá - jinak by jedna stokoruna měla dvě pravdy.
 *
 * Popisky jsou psané rovnou tady, ne přes `lib/jazyk.ts`: ten má rozdělanou
 * práci překladová dávka. Až bude volný, klíče se přesunou.
 */

export type RadekProKlienta = {
  id: string;
  cislo: string;
  prijem: boolean;
  datum: string;
  datumIso: string;
  castka: string;
  castkaMinor: number;
  vatRate: number;
  dph: string | null;
  ucel: string;
  protistrana: string | null;
  poznamka: string | null;
  kdo: string | null;
  zustatek: string;
  zaporny: boolean;
  /** Vyplněné = doklad patří k výdaji a tady se needituje. */
  expenseId: string | null;
};

const TEXTY = {
  cs: {
    nadpis: 'Pokladna',
    zustatek: 'Zůstatek',
    pocatek: 'Počáteční stav k 1. 1.',
    prijmy: 'Příjmy',
    vydaje: 'Výdaje',
    prijem: '+ Příjem',
    vydej: '− Výdej',
    novyPrijem: 'Příjmový doklad',
    novyVydej: 'Výdajový doklad',
    datum: 'Datum',
    castka: 'Částka',
    dph: 'DPH',
    bezDph: 'bez DPH',
    ucel: 'Účel',
    ucelPrijem: 'Za co peníze přišly',
    ucelVydej: 'Za co se platilo',
    protistrana: 'Protistrana',
    protistranaPrijem: 'Přijato od',
    protistranaVydej: 'Vyplaceno komu',
    poznamka: 'Poznámka',
    ulozit: 'Uložit',
    zrusit: 'Zrušit',
    smazat: 'Smazat',
    smazatPtani: 'Smazat tenhle doklad?',
    upravit: 'Upravit',
    chyba: 'Nepodařilo se to uložit.',
    prazdno: 'V tomhle roce zatím žádný doklad není.',
    hlavickaCislo: 'Číslo',
    hlavickaPopis: 'Účel',
    hlavickaPrijem: 'Příjem',
    hlavickaVydej: 'Výdej',
    hlavickaZustatek: 'Zůstatek',
    zVydaje: 'z výdaje',
    zVydajePopis: 'Vznikl z hotově zaplaceného výdaje — upravit se dá jen tam.',
    otevritVydaj: 'Otevřít výdaj',
    nastaveni: 'Nastavení pokladny',
    zavrit: 'Zavřít nastavení',
    pocatecniStav: 'Počáteční stav',
    pocatecniStavPopis: 'Hotovost, která v pokladně byla, než se začala vést tady.',
    pocatecniDatum: 'Ke dni',
    radaPrijem: 'Řada příjmových',
    radaVydej: 'Řada výdajových',
    dalsiCislo: 'Další číslo',
    radaPopis: '{YYYY} rok, {YY} rok dvojčíslím, {MM} měsíc, {NNN} pořadí.',
    firmaVsechny:
      'V přepínači nahoře jsou vybrané všechny firmy — pokladna je ale vždycky jedné. Ukazuju tuhle.',
    otevrenaVsem:
      'Pokladnu zatím nemá povolenou nikdo, takže ji vidí každý Žůžo-labůžo. Zaškrtněte ji v Adminu ▸ Uživatelé těm, kdo na ni mají vidět.',
    cizimena: 'Hotovostní výdaje v jiné měně než pokladna se sem nepřenášejí — zapište je ručně.',
  },
  en: {
    nadpis: 'Cash box',
    zustatek: 'Balance',
    pocatek: 'Opening balance on 1 Jan',
    prijmy: 'Cash in',
    vydaje: 'Cash out',
    prijem: '+ Cash in',
    vydej: '− Cash out',
    novyPrijem: 'Receipt voucher',
    novyVydej: 'Payment voucher',
    datum: 'Date',
    castka: 'Amount',
    dph: 'VAT',
    bezDph: 'no VAT',
    ucel: 'Purpose',
    ucelPrijem: 'What the money was for',
    ucelVydej: 'What was paid for',
    protistrana: 'Counterparty',
    protistranaPrijem: 'Received from',
    protistranaVydej: 'Paid to',
    poznamka: 'Note',
    ulozit: 'Save',
    zrusit: 'Cancel',
    smazat: 'Delete',
    smazatPtani: 'Delete this voucher?',
    upravit: 'Edit',
    chyba: 'Saving failed.',
    prazdno: 'No vouchers in this year yet.',
    hlavickaCislo: 'No.',
    hlavickaPopis: 'Purpose',
    hlavickaPrijem: 'In',
    hlavickaVydej: 'Out',
    hlavickaZustatek: 'Balance',
    zVydaje: 'from an expense',
    zVydajePopis: 'Created from an expense paid in cash — edit it there.',
    otevritVydaj: 'Open the expense',
    nastaveni: 'Cash box settings',
    zavrit: 'Close settings',
    pocatecniStav: 'Opening balance',
    pocatecniStavPopis: 'The cash that was in the box before the portal started tracking it.',
    pocatecniDatum: 'As of',
    radaPrijem: 'Receipt numbering',
    radaVydej: 'Payment numbering',
    dalsiCislo: 'Next number',
    radaPopis: '{YYYY} year, {YY} short year, {MM} month, {NNN} sequence.',
    firmaVsechny:
      'The switcher above shows all companies, but a cash box always belongs to one. This is the one shown.',
    otevrenaVsem:
      'Nobody is allowed into the cash box yet, so every admin can see it. Tick it in Admin ▸ Users for the people who should.',
    cizimena: 'Cash expenses in another currency are not carried over here — enter them by hand.',
  },
};

type Souhrn = {
  pocatek: string;
  prijmy: string;
  vydaje: string;
  zustatek: string;
  zaporny: boolean;
};

type Nastaveni = {
  pocatecniStav: string;
  pocatecniDatum: string;
  radaPrijem: string;
  dalsiPrijem: number;
  radaVydej: string;
  dalsiVydej: number;
};

export function PokladnaKlient({
  jazyk,
  otevrenaVsem,
  vsechnyFirmy,
  firma,
  nazev,
  mena,
  rok,
  roky,
  radky,
  souhrn,
  nastaveni,
}: {
  jazyk: string;
  otevrenaVsem: boolean;
  vsechnyFirmy: boolean;
  firma: { id: string; nazev: string };
  nazev: string;
  mena: Currency;
  rok: number;
  roky: number[];
  radky: RadekProKlienta[];
  souhrn: Souhrn;
  nastaveni: Nastaveni;
}) {
  const t = TEXTY[jazyk === 'en' ? 'en' : 'cs'];
  const router = useRouter();

  const [formular, setFormular] = useState<'PRIJEM' | 'VYDEJ' | null>(null);
  const [upravovany, setUpravovany] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [nastaveniOtevreno, setNastaveniOtevreno] = useState(false);

  const dnes = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState(dnes);
  const [castka, setCastka] = useState('');
  const [vatRate, setVatRate] = useState(0);
  const [ucel, setUcel] = useState('');
  const [protistrana, setProtistrana] = useState('');
  const [poznamka, setPoznamka] = useState('');

  const [nast, setNast] = useState(nastaveni);

  function vycisti() {
    setFormular(null);
    setUpravovany(null);
    setChyba(null);
    setDatum(dnes);
    setCastka('');
    setVatRate(0);
    setUcel('');
    setProtistrana('');
    setPoznamka('');
  }

  function otevriNovy(smer: 'PRIJEM' | 'VYDEJ') {
    vycisti();
    setFormular(smer);
  }

  function otevriUpravu(r: RadekProKlienta) {
    setChyba(null);
    setUpravovany(r.id);
    setFormular(r.prijem ? 'PRIJEM' : 'VYDEJ');
    setDatum(r.datumIso);
    setCastka((r.castkaMinor / 100).toFixed(2));
    setVatRate(r.vatRate);
    setUcel(r.ucel);
    setProtistrana(r.protistrana ?? '');
    setPoznamka(r.poznamka ?? '');
  }

  async function uloz() {
    if (pracuje || !formular) return;
    const castkaMinor = parseMoneyToMinor(castka);
    if (castkaMinor <= 0 || !ucel.trim()) {
      setChyba(t.chyba);
      return;
    }
    setPracuje(true);
    setChyba(null);
    try {
      const telo = {
        datum,
        castkaMinor,
        vatRate,
        ucel: ucel.trim(),
        protistrana: protistrana.trim() || null,
        poznamka: poznamka.trim() || null,
      };
      const res = upravovany
        ? await fetch(`/api/admin/pokladna/${encodeURIComponent(upravovany)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telo),
          })
        : await fetch('/api/admin/pokladna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...telo, issuerCompanyId: firma.id, smer: formular }),
          });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      vycisti();
      router.refresh();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  async function smaz(id: string) {
    if (pracuje || !window.confirm(t.smazatPtani)) return;
    setPracuje(true);
    try {
      const res = await fetch(`/api/admin/pokladna/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      router.refresh();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  async function ulozNastaveni() {
    if (pracuje) return;
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/pokladna', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerCompanyId: firma.id,
          pocatecniStavMinor: parseMoneyToMinor(nast.pocatecniStav),
          pocatecniDatum: nast.pocatecniDatum,
          radaPrijem: nast.radaPrijem,
          dalsiPrijem: nast.dalsiPrijem,
          radaVydej: nast.radaVydej,
          dalsiVydej: nast.dalsiVydej,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      setNastaveniOtevreno(false);
      router.refresh();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  const prijem = formular === 'PRIJEM';

  return (
    <div className="flex flex-col gap-4">
      {otevrenaVsem && (
        <p className="m-0 rounded-card border border-dashed border-line bg-field/50 px-4 py-2.5 text-sm font-body text-muted">
          {t.otevrenaVsem}
        </p>
      )}

      {/* ZŮSTATEK - kvůli němu se sem chodí, takže je první a největší. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <span className="block text-xs font-heading font-semibold uppercase tracking-wide text-muted">
              {nazev} · {firma.nazev}
            </span>
            <span
              className={`block font-display text-3xl sm:text-4xl leading-tight ${
                souhrn.zaporny ? 'text-danger' : 'text-ink'
              }`}
            >
              {souhrn.zustatek}
            </span>
            <span className="block text-xs font-body text-muted">
              {t.zustatek} · {mena}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {roky.length > 1 && (
              <select
                value={rok}
                onChange={(e) => router.push(`/admin/doklady/pokladna?rok=${e.target.value}`)}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              >
                {roky.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => otevriNovy('PRIJEM')}
              className="rounded-pill bg-brand-green text-onAccent font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer"
            >
              {t.prijem}
            </button>
            <button
              type="button"
              onClick={() => otevriNovy('VYDEJ')}
              className="rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-sm px-4 py-2 cursor-pointer hover:border-brand-purple"
            >
              {t.vydej}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-line pt-3">
          {[
            { popis: t.pocatek, hodnota: souhrn.pocatek, barva: 'text-ink' },
            { popis: t.prijmy, hodnota: souhrn.prijmy, barva: 'text-brand-green' },
            { popis: t.vydaje, hodnota: souhrn.vydaje, barva: 'text-danger' },
            { popis: `${t.zustatek} ${rok}`, hodnota: souhrn.zustatek, barva: 'text-ink' },
          ].map((s) => (
            <div key={s.popis}>
              <span className="block text-[11px] font-body text-muted">{s.popis}</span>
              <span className={`block font-heading font-semibold text-sm ${s.barva}`}>
                {s.hodnota}
              </span>
            </div>
          ))}
        </div>

        {vsechnyFirmy && <p className="m-0 text-xs font-body text-muted">{t.firmaVsechny}</p>}
      </div>

      {/* FORMULÁŘ. Jeden na příjem i výdej - liší se jen popiskem a barvou,
          takže dva by se jen rozcházely. */}
      {formular && (
        <div
          className={`bg-surface rounded-card border shadow-sm p-4 flex flex-col gap-3 ${
            prijem ? 'border-brand-green' : 'border-line'
          }`}
        >
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
            {prijem ? t.novyPrijem : t.novyVydej}
          </span>

          <div className="flex gap-3 flex-wrap">
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[11px] font-body text-muted">{t.datum}</span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-[11px] font-body text-muted">
                {t.castka} ({mena})
              </span>
              <input
                inputMode="decimal"
                value={castka}
                onChange={(e) => setCastka(e.target.value)}
                placeholder="0,00"
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink text-right tabular-nums outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[110px]">
              <span className="text-[11px] font-body text-muted">{t.dph}</span>
              <select
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              >
                {SAZBY_DPH.map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? t.bezDph : `${s} %`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[11px] font-body text-muted">{t.ucel}</span>
              <input
                value={ucel}
                onChange={(e) => setUcel(e.target.value)}
                placeholder={prijem ? t.ucelPrijem : t.ucelVydej}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[11px] font-body text-muted">
                {prijem ? t.protistranaPrijem : t.protistranaVydej}
              </span>
              <input
                value={protistrana}
                onChange={(e) => setProtistrana(e.target.value)}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <span className="text-[11px] font-body text-muted">{t.poznamka}</span>
              <input
                value={poznamka}
                onChange={(e) => setPoznamka(e.target.value)}
                className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void uloz()}
              disabled={pracuje}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {t.ulozit}
            </button>
            <button
              type="button"
              onClick={vycisti}
              className="text-sm font-heading font-semibold text-muted"
            >
              {t.zrusit}
            </button>
          </div>
        </div>
      )}

      {chyba && (
        <p className="m-0 text-sm font-body text-danger" role="alert">
          {chyba}
        </p>
      )}

      {/* KNIHA. Běžný zůstatek u každého řádku - podle něj se hledá den,
          od kterého to přestalo sedět s krabicí. */}
      <div className="bg-surface rounded-card border border-line shadow-sm overflow-x-auto">
        {radky.length === 0 ? (
          <p className="m-0 p-5 text-sm font-body text-muted italic">{t.prazdno}</p>
        ) : (
          <table className="w-full border-collapse text-sm font-body">
            <thead>
              <tr className="text-left text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold">{t.hlavickaCislo}</th>
                <th className="px-3 py-2 font-semibold">{t.datum}</th>
                <th className="px-3 py-2 font-semibold">{t.hlavickaPopis}</th>
                <th className="px-3 py-2 font-semibold text-right">{t.hlavickaPrijem}</th>
                <th className="px-3 py-2 font-semibold text-right">{t.hlavickaVydej}</th>
                <th className="px-3 py-2 font-semibold text-right">{t.hlavickaZustatek}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {radky.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 whitespace-nowrap font-heading font-semibold text-ink">
                    {r.cislo}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted">{r.datum}</td>
                  <td className="px-3 py-2 min-w-[220px]">
                    <span className="block text-ink">{r.ucel}</span>
                    {(r.protistrana || r.poznamka || r.kdo) && (
                      <span className="block text-xs text-muted">
                        {[r.protistrana, r.poznamka, r.kdo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {r.dph && <span className="block text-[11px] text-muted">{r.dph}</span>}
                    {r.expenseId && (
                      <span
                        title={t.zVydajePopis}
                        className="inline-block mt-1 rounded-full border border-line text-muted text-[9px] font-heading font-bold uppercase tracking-wide px-1.5 py-[1px]"
                      >
                        {t.zVydaje}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-brand-green">
                    {r.prijem ? r.castka : ''}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-danger">
                    {r.prijem ? '' : r.castka}
                  </td>
                  <td
                    className={`px-3 py-2 text-right whitespace-nowrap tabular-nums font-heading font-semibold ${
                      r.zaporny ? 'text-danger' : 'text-ink'
                    }`}
                  >
                    {r.zustatek}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {r.expenseId ? (
                      <Link
                        href={`/admin/doklady/vydaje/${r.expenseId}`}
                        className="text-[11px] font-heading font-semibold text-brand-purple"
                      >
                        {t.otevritVydaj}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2.5 justify-end">
                        <button
                          type="button"
                          onClick={() => otevriUpravu(r)}
                          className="text-[11px] font-heading font-semibold text-brand-purple"
                        >
                          {t.upravit}
                        </button>
                        <button
                          type="button"
                          onClick={() => void smaz(r.id)}
                          className="text-[11px] font-heading font-semibold text-muted hover:text-danger"
                        >
                          {t.smazat}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="m-0 text-xs font-body text-muted">{t.cizimena}</p>

      {/* NASTAVENÍ. Schválně dole a zavřené - počáteční stav a číselné řady
          se po zavedení pokladny už nemění. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setNastaveniOtevreno((o) => !o)}
          className="self-start text-xs font-heading font-semibold uppercase tracking-wide text-muted hover:text-brand-purple"
        >
          {nastaveniOtevreno ? t.zavrit : t.nastaveni}
        </button>

        {nastaveniOtevreno && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap">
              <label className="flex flex-col gap-1 min-w-[140px]">
                <span className="text-[11px] font-body text-muted">{t.pocatecniStav}</span>
                <input
                  inputMode="decimal"
                  value={nast.pocatecniStav}
                  onChange={(e) => setNast({ ...nast, pocatecniStav: e.target.value })}
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink text-right tabular-nums outline-none focus:border-brand-purple"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-[11px] font-body text-muted">{t.pocatecniDatum}</span>
                <input
                  type="date"
                  value={nast.pocatecniDatum}
                  onChange={(e) => setNast({ ...nast, pocatecniDatum: e.target.value })}
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-[11px] font-body text-muted">{t.radaPrijem}</span>
                <input
                  value={nast.radaPrijem}
                  onChange={(e) => setNast({ ...nast, radaPrijem: e.target.value })}
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-[110px]">
                <span className="text-[11px] font-body text-muted">{t.dalsiCislo}</span>
                <input
                  inputMode="numeric"
                  value={String(nast.dalsiPrijem)}
                  onChange={(e) =>
                    setNast({ ...nast, dalsiPrijem: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink text-right tabular-nums outline-none focus:border-brand-purple"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-[11px] font-body text-muted">{t.radaVydej}</span>
                <input
                  value={nast.radaVydej}
                  onChange={(e) => setNast({ ...nast, radaVydej: e.target.value })}
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-[110px]">
                <span className="text-[11px] font-body text-muted">{t.dalsiCislo}</span>
                <input
                  inputMode="numeric"
                  value={String(nast.dalsiVydej)}
                  onChange={(e) =>
                    setNast({ ...nast, dalsiVydej: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink text-right tabular-nums outline-none focus:border-brand-purple"
                />
              </label>
            </div>
            <p className="m-0 text-[11px] font-body text-muted">
              {t.pocatecniStavPopis} {t.radaPopis}
            </p>
            <button
              type="button"
              onClick={() => void ulozNastaveni()}
              disabled={pracuje}
              className="self-start rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {t.ulozit}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
