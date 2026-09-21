'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VyberPole } from '@/components/VyberPole';
import { zmenNahled } from './NahledMailu';

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
      if (!res.ok) throw new Error(data?.error || 'Nastavení se nepodařilo uložit.');
      setZprava({ ok: true, text: 'Uloženo.' });
      router.refresh();
    } catch (e) {
      setZprava({ ok: false, text: e instanceof Error ? e.message : 'Nastavení se nepodařilo uložit.' });
    } finally {
      setUklada(false);
    }
  }

  async function rozesli() {
    if (!window.confirm(`Rozeslat přehled za ${nazevMesice.toLowerCase()} hned? Dostane ho ${cekaNaOdeslani} zvukařů, kterým ještě neodešel.`)) return;
    setRozesila(true);
    setZprava(null);
    try {
      const res = await fetch(`/api/cron/mesicni-prehled?mesic=${mesic}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Rozeslání se nepodařilo.');
      setZprava({
        ok: !data.chyby,
        text: data.vypnuto
          ? 'Rozesílání je vypnuté - nic neodešlo.'
          : `Odesláno ${data.odeslano}${data.chyby ? `, nepodařilo se ${data.chyby}` : ''}.`,
      });
      router.refresh();
    } catch (e) {
      setZprava({ ok: false, text: e instanceof Error ? e.message : 'Rozeslání se nepodařilo.' });
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
          Nastavení měsíčního přehledu
        </h2>
        {zmena && <span className="text-xs text-muted font-body">{zmena}</span>}
      </div>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={n.zapnuto} onChange={(e) => set('zapnuto', e.target.checked)} />
        Posílat zvukařům měsíční přehled výkazů
      </label>

      <div className="flex items-center gap-2 flex-wrap text-sm font-body text-ink">
        <span>Chodí</span>
        <VyberPole aria-label="Den rozeslání" value={n.den} onChange={(e) => set('den', Number(e.target.value))} className={`${pole} w-[90px]`}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}.
            </option>
          ))}
        </VyberPole>
        <span>den v měsíci v 8:00, za měsíc minulý.</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Co v mailu je</span>
        <p className="text-sm text-muted m-0">Odpracované hodiny jsou tam vždycky.</p>
        <Volba checked={n.castky} onChange={(v) => set('castky', v)} popis="Částky v korunách (za práci a celkem)" />
        <Volba checked={n.druhy} onChange={(v) => set('druhy', v)} popis="Rozpad podle druhu práce (natáčení, střih…)" />
        <Volba checked={n.projekty} onChange={(v) => set('projekty', v)} popis="Projekty, na kterých dělal" />
        <Volba
          checked={n.bonusy}
          onChange={(v) => set('bonusy', v)}
          popis="Schválené bonusy"
          disabled={!n.castky}
          pozn={!n.castky ? 'bez částek se bonusy neposílají' : undefined}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">Vlastní vzkaz v mailu</span>
        <textarea
          value={n.poznamka}
          onChange={(e) => set('poznamka', e.target.value)}
          rows={3}
          placeholder="Např. Fakturu za tento měsíc prosím pošlete do 10. na uctarna@mediaspace.cz."
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
          {uklada ? 'Ukládám…' : 'Uložit nastavení'}
        </button>
        {cekaNaOdeslani > 0 && (
          <button
            type="button"
            onClick={rozesli}
            disabled={rozesila || zmeneno}
            title={zmeneno ? 'Nejdřív uložte nastavení' : undefined}
            className="ml-auto text-sm font-heading font-semibold rounded-lg px-4 py-2 border border-line text-ink hover:border-brand-purple disabled:opacity-50"
          >
            {rozesila ? 'Rozesílám…' : `Rozeslat teď za ${nazevMesice.toLowerCase()} (${cekaNaOdeslani})`}
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
