'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { zmenNahled } from './NahledMailu';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

type Nastaveni = {
  den: number;
  castky: boolean;
  druhy: boolean;
  projekty: boolean;
  bonusy: boolean;
  poznamka: string;
  zapnuto: boolean;
};

/**
 * Kdy a co zvukařům chodí (zadání 21. 9. 2026). Den je 1-28, aby existoval
 * v každém měsíci. Pod nastavením jde přehled za vybraný měsíc rozeslat hned -
 * dostanou ho jen ti, komu ještě neodešel.
 */
export function NastaveniPrehledu({
  nastaveni,
  zmena,
  mesic,
  nazevMesice,
  cekaNaOdeslani,
}: {
  nastaveni: Nastaveni;
  zmena: string | null;
  mesic: string;
  nazevMesice: string;
  cekaNaOdeslani: number;
}) {
  const t = usePreklad();
  const router = useRouter();
  const [n, setN] = useState(nastaveni);
  const [uklada, setUklada] = useState(false);
  const [zprava, setZprava] = useState<{ ok: boolean; text: string } | null>(null);
  const [rozesila, setRozesila] = useState(false);

  const zmeneno = JSON.stringify(n) !== JSON.stringify(nastaveni);

  // Náhled vpravo sleduje formulář hned, i před uložením.
  const prvniBeh = useRef(true);
  useEffect(() => {
    if (prvniBeh.current) {
      prvniBeh.current = false;
      return;
    }
    zmenNahled({
      nastaveni: {
        den: n.den,
        castky: n.castky,
        druhy: n.druhy,
        projekty: n.projekty,
        bonusy: n.bonusy,
        poznamka: n.poznamka,
      },
      neulozene: zmeneno,
    });
  }, [n, zmeneno]);
  const set = <K extends keyof Nastaveni>(k: K, v: Nastaveni[K]) => {
    setN((x) => ({ ...x, [k]: v }));
    setZprava(null);
  };

  async function uloz() {
    setUklada(true);
    setZprava(null);
    try {
      const res = await fetch('/api/admin/prehled-zvukaru', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...n, poznamka: n.poznamka.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('zvukari.nastaveniNeulozeno'));
      setZprava({ ok: true, text: t('zvukari.ulozeno') });
      router.refresh();
    } catch (e) {
      setZprava({ ok: false, text: e instanceof Error ? e.message : t('zvukari.nastaveniNeulozeno') });
    } finally {
      setUklada(false);
    }
  }

  async function rozesli() {
    if (
      !window.confirm(
        t('zvukari.potvrzeniRozeslani', { mesic: nazevMesice.toLowerCase(), pocet: cekaNaOdeslani }),
      )
    )
      return;
    setRozesila(true);
    setZprava(null);
    try {
      const res = await fetch(`/api/cron/mesicni-prehled?mesic=${mesic}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('zvukari.rozeslaniNepodarilo'));
      setZprava({
        ok: !data.chyby,
        text: data.vypnuto
          ? t('zvukari.rozesilaniVypnutoNic')
          : t('zvukari.odeslanoPocet', {
              pocet: data.odeslano,
              chyby: data.chyby ? t('zvukari.nepodariloSePocet', { pocet: data.chyby }) : '',
            }),
      });
      router.refresh();
    } catch (e) {
      setZprava({ ok: false, text: e instanceof Error ? e.message : t('zvukari.rozeslaniNepodarilo') });
    } finally {
      setRozesila(false);
    }
  }

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple';

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {t('zvukari.nastaveniNadpis')}
        </h2>
        {zmena && <span className="text-xs text-muted font-body">{zmena}</span>}
      </div>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={n.zapnuto} onChange={(e) => set('zapnuto', e.target.checked)} />
        {t('zvukari.posilatPrehled')}
      </label>

      <div className="flex items-center gap-2 flex-wrap text-sm font-body text-ink">
        <span>{t('zvukari.chodi')}</span>
        <VyberPole aria-label={t('zvukari.denRozeslani')} value={n.den} onChange={(e) => set('den', Number(e.target.value))} className={`${pole} w-[90px]`}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}.
            </option>
          ))}
        </VyberPole>
        <span>{t('zvukari.denVMesici')}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
          {t('zvukari.coVMailuJe')}
        </span>
        <p className="text-sm text-muted m-0">{t('zvukari.hodinyVzdy')}</p>
        <Volba checked={n.castky} onChange={(v) => set('castky', v)} popis={t('zvukari.volbaCastky')} />
        <Volba checked={n.druhy} onChange={(v) => set('druhy', v)} popis={t('zvukari.volbaDruhy')} />
        <Volba checked={n.projekty} onChange={(v) => set('projekty', v)} popis={t('zvukari.volbaProjekty')} />
        <Volba
          checked={n.bonusy}
          onChange={(v) => set('bonusy', v)}
          popis={t('zvukari.volbaBonusy')}
          disabled={!n.castky}
          pozn={!n.castky ? t('zvukari.bezCastekBonusy') : undefined}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">
          {t('zvukari.vlastniVzkaz')}
        </span>
        <textarea
          value={n.poznamka}
          onChange={(e) => set('poznamka', e.target.value)}
          rows={3}
          placeholder={t('zvukari.vzkazPlaceholder')}
          className={`${pole} font-body`}
        />
      </label>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={uloz}
          disabled={uklada || !zmeneno}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
        >
          {t(uklada ? 'zvukari.ukladam' : 'zvukari.ulozitNastaveni')}
        </button>
        {cekaNaOdeslani > 0 && (
          <button
            type="button"
            onClick={rozesli}
            disabled={rozesila || zmeneno}
            title={zmeneno ? t('zvukari.nejdrivUlozte') : undefined}
            className="ml-auto text-sm font-heading font-semibold rounded-lg px-4 py-2 border border-line text-ink hover:border-brand-purple disabled:opacity-50"
          >
            {rozesila
              ? t('zvukari.rozesilam')
              : t('zvukari.rozeslatTed', {
                  mesic: nazevMesice.toLowerCase(),
                  pocet: cekaNaOdeslani,
                })}
          </button>
        )}
        {zprava && <span className={`text-sm font-heading ${zprava.ok ? 'text-status-done' : 'text-danger'}`}>{zprava.text}</span>}
      </div>
    </section>
  );
}

function Volba({
  checked,
  onChange,
  popis,
  disabled,
  pozn,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  popis: string;
  disabled?: boolean;
  pozn?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm font-body text-ink ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {popis}
      {pozn && <span className="text-xs text-muted">({pozn})</span>}
    </label>
  );
}
