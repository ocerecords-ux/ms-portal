'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OZNAMENI, popisekOznameni, zneniOznameni, type KlicOznameni } from '@/lib/oznameni';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * ADMINISTRACE AUTOMATICKÝCH ZPRÁV (zadání 15. 9. 2026: „udělejme pro tyhle
 * maily a notifikace pak někde administraci").
 *
 * U každé zprávy stojí, KDY odchází a KOMU — to je otázka, se kterou sem
 * člověk přijde. Náhled otevře skutečný mail v novém okně; vypínač ho umlčí.
 *
 * Měsíční přehled jde navíc rozeslat ručně, i za starší měsíc: když úloha
 * jednou nedoběhne, musí být jak to dohnat, a bez toho by se čekalo měsíc.
 */

export type Odeslany = { mesic: string; komu: string; kdy: string; prijemce: string | null };

export type UlozeneZneni = { predmet: string | null; nadpis: string | null; text: string | null };

export function ZpravyPanel({
  zapnuti,
  zneni,
  odeslane,
  minulyMesic,
}: {
  zapnuti: Record<string, boolean>;
  /** Vlastní znění zpráv (18. 11. 2026) - prázdno znamená výchozí text. */
  zneni: Record<string, UlozeneZneni>;
  odeslane: Odeslany[];
  minulyMesic: string;
}) {
  const router = useRouter();
  const jazyk = useJazyk();
  const t = usePreklad();
  const [stav, setStav] = useState(zapnuti);
  const [busy, setBusy] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [mesic, setMesic] = useState(minulyMesic);

  /**
   * ZNĚNÍ SE UPRAVUJE ROVNOU TADY (zadání 18. 11. 2026: „vždy, když něco
   * takového přidáme, tak to udělej tak, ať to můžeme upravovat a individuálně
   * zapínat a vypínat"). Prázdné pole vrátí výchozí text - druhé tlačítko na
   * to není potřeba a nejde se tak zaseknout u textu, který nejde smazat.
   */
  const [texty, setTexty] = useState<Record<string, { predmet: string; nadpis: string; text: string }>>(
    () =>
      Object.fromEntries(
        OZNAMENI.filter((o) => o.vychozi).map((o) => [o.klic, zneniOznameni(o, zneni[o.klic])]),
      ),
  );
  const [otevrene, setOtevrene] = useState<string | null>(null);

  function uprav(klic: KlicOznameni, cast: 'predmet' | 'nadpis' | 'text', hodnota: string) {
    setTexty((p) => ({ ...p, [klic]: { ...p[klic], [cast]: hodnota } }));
  }

  async function ulozZneni(klic: KlicOznameni) {
    setBusy(klic);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/oznameni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic, ...texty[klic] }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setChyba(data?.error || t('zpravyPortalu.nejdeUlozit'));
        return;
      }
      setHlaska(t('zpravyPortalu.zneniUlozeno'));
      router.refresh();
    } catch {
      setChyba(t('zpravyPortalu.bezSpojeni'));
    } finally {
      setBusy(null);
    }
  }

  async function prepni(klic: KlicOznameni, zapnuto: boolean) {
    setBusy(klic);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/oznameni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klic, zapnuto }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        zapnuti?: Record<string, boolean>;
      };
      if (!res.ok) {
        setChyba(data?.error || t('zpravyPortalu.nejdeUlozit'));
        return;
      }
      if (data.zapnuti) setStav(data.zapnuti);
    } catch {
      setChyba(t('zpravyPortalu.bezSpojeni'));
    } finally {
      setBusy(null);
    }
  }

  async function rozesli() {
    setBusy('rozeslani');
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(`/api/cron/mesicni-prehled?mesic=${encodeURIComponent(mesic)}`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        odeslano?: number;
        preskoceno?: number;
        chyby?: number;
        vypnuto?: boolean;
      };
      if (!res.ok) {
        setChyba(data?.error || t('zpravyPortalu.rozeslaniNejde'));
        return;
      }
      setHlaska(
        data.vypnuto
          ? t('zpravyPortalu.vypnutaZprava')
          : t(data.chyby ? 'zpravyPortalu.odeslanoSChybami' : 'zpravyPortalu.odeslano', {
              odeslano: data.odeslano ?? 0,
              preskoceno: data.preskoceno ?? 0,
              chyby: data.chyby ?? 0,
            }),
      );
      router.refresh();
    } catch {
      setChyba(t('zpravyPortalu.bezSpojeni'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {chyba && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
      )}
      {hlaska && (
        <p className="text-sm text-ink bg-tint border border-line rounded-lg px-3 py-2 m-0">{hlaska}</p>
      )}

      {OZNAMENI.map((o) => {
        const zapnuto = stav[o.klic] !== false;
        return (
          <div key={o.klic} className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h2 className="font-heading font-semibold text-base text-ink m-0">
                  {popisekOznameni(o, 'nazev', jazyk)}
                </h2>
                <p className="text-sm font-body text-muted m-0 mt-1 max-w-[70ch]">
                  {popisekOznameni(o, 'popis', jazyk)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-heading text-ink whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={zapnuto}
                  disabled={busy === o.klic}
                  onChange={(e) => void prepni(o.klic, e.target.checked)}
                />
                {zapnuto ? t('zpravyPortalu.zapnuto') : t('zpravyPortalu.vypnuto')}
              </label>
            </div>

            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-t border-line">
                  <td className="py-2 pr-4 text-xs font-heading text-muted uppercase tracking-wide align-top w-32">
                    {t('zpravyPortalu.kdy')}
                  </td>
                  <td className="py-2 text-sm font-body text-ink">
                    {popisekOznameni(o, 'kdy', jazyk)}
                  </td>
                </tr>
                <tr className="border-t border-line">
                  <td className="py-2 pr-4 text-xs font-heading text-muted uppercase tracking-wide align-top">
                    {t('zpravyPortalu.komu')}
                  </td>
                  <td className="py-2 text-sm font-body text-ink">
                    {popisekOznameni(o, 'komu', jazyk)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-center gap-3 flex-wrap border-t border-line pt-3">
              <a
                href={o.nahled}
                target="_blank"
                rel="noreferrer"
                className="font-heading font-semibold text-sm rounded-lg border border-line px-4 py-2 text-ink no-underline hover:border-brand-purple transition-colors"
              >
                {t('zpravyPortalu.nahled')}
              </a>

              {o.vychozi && (
                <button
                  type="button"
                  onClick={() => setOtevrene(otevrene === o.klic ? null : o.klic)}
                  className="font-heading font-semibold text-sm rounded-lg border border-line px-4 py-2 text-ink hover:border-brand-purple transition-colors"
                >
                  {otevrene === o.klic ? t('zpravyPortalu.skrytZneni') : t('zpravyPortalu.upravitZneni')}
                </button>
              )}

              {/* Rucni rozeslani ma smysl jen u te mesicni - bonus odchazi
                  ve chvili, kdy ho nekdo schvali. */}
              {o.klic === 'MESICNI_PREHLED' && (
                <span className="flex items-center gap-2 flex-wrap">
                  <input
                    type="month"
                    value={mesic}
                    onChange={(e) => setMesic(e.target.value)}
                    className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
                  />
                  <button
                    type="button"
                    onClick={() => void rozesli()}
                    disabled={busy === 'rozeslani' || !mesic}
                    className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
                  >
                    {busy === 'rozeslani' ? t('zpravyPortalu.rozesilam') : t('zpravyPortalu.rozeslatTed')}
                  </button>
                  <span className="text-xs font-body text-muted">
                    {t('zpravyPortalu.podruheNe')}
                  </span>
                </span>
              )}
            </div>

            {o.vychozi && otevrene === o.klic && texty[o.klic] && (
              <div className="border-t border-line pt-3 flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-heading text-muted uppercase tracking-wide">
                    {t('zpravyPortalu.polePredmet')}
                  </span>
                  <input
                    value={texty[o.klic].predmet}
                    onChange={(e) => uprav(o.klic, 'predmet', e.target.value)}
                    className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-heading text-muted uppercase tracking-wide">
                    {t('zpravyPortalu.poleNadpis')}
                  </span>
                  <input
                    value={texty[o.klic].nadpis}
                    onChange={(e) => uprav(o.klic, 'nadpis', e.target.value)}
                    className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-heading text-muted uppercase tracking-wide">
                    {t('zpravyPortalu.poleText')}
                  </span>
                  <textarea
                    value={texty[o.klic].text}
                    onChange={(e) => uprav(o.klic, 'text', e.target.value)}
                    rows={7}
                    className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple resize-y"
                  />
                </label>

                {o.znacky && o.znacky.length > 0 && (
                  <div className="text-xs font-body text-muted">
                    {o.znacky.map((z) => (
                      <div key={z.znacka}>
                        <code className="font-heading text-brand-purple">{z.znacka}</code> — {z.popis}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void ulozZneni(o.klic)}
                    disabled={busy === o.klic}
                    className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
                  >
                    {t('zpravyPortalu.ulozitZneni')}
                  </button>
                  <span className="text-xs font-body text-muted">
                    {t('zpravyPortalu.prazdnoVychozi')}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('zpravyPortalu.posledni')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {odeslane.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm font-body text-muted">
                    {t('zpravyPortalu.zadnyNeodesel')}
                  </td>
                </tr>
              )}
              {odeslane.map((o, i) => (
                <tr key={`${o.mesic}-${o.komu}-${i}`} className="border-t border-line first:border-t-0">
                  <td className="px-4 py-2.5 text-sm font-heading text-ink whitespace-nowrap">{o.mesic}</td>
                  <td className="px-4 py-2.5 text-sm font-heading text-muted">{o.komu}</td>
                  <td className="px-4 py-2.5 text-sm font-body text-muted">{o.prijemce ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm font-body text-muted text-right whitespace-nowrap">{o.kdy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
