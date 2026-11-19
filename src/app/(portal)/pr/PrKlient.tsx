'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { prelozit, type Jazyk } from '@/lib/jazyk';

/**
 * Drobné obrazovky v sekci PR (19. 11. 2026): založení kampaně a stálé
 * podklady pro Emu. Obojí stojí vedle seznamu, který se kreslí na serveru,
 * takže si jazyk berou propem (pravidlo 8).
 */

const POLE =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';

export function NovaKampan({ jazyk }: { jazyk: Jazyk }) {
  const t = (k: string) => prelozit(jazyk, k);
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [nazev, setNazev] = useState('');
  const [brief, setBrief] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function zaloz() {
    if (!nazev.trim() || bezi) return;
    setBezi(true);
    setChyba(null);
    const res = await fetch('/api/pr/kampane', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev, brief }),
    }).catch(() => null);
    setBezi(false);
    if (!res?.ok) {
      setChyba(t('pr.zalozeniNeslo'));
      return;
    }
    const data = (await res.json()) as { id: string };
    router.push(`/pr/${data.id}`);
  }

  if (!otevreno) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOtevreno(true)}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer hover:bg-brand-purpleDeep transition-colors"
        >
          {t('pr.novaKampan')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-field p-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t('pr.nazevKampane')}
        </span>
        <input value={nazev} onChange={(e) => setNazev(e.target.value)} className={POLE} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          {t('pr.brief')}
        </span>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          placeholder={t('pr.briefPriklad')}
          className={`${POLE} resize-y`}
        />
      </label>
      <span className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={zaloz}
          disabled={bezi || !nazev.trim()}
          className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer disabled:opacity-50"
        >
          {bezi ? t('obecne.ukladam') : t('pr.zalozit')}
        </button>
        <button
          type="button"
          onClick={() => setOtevreno(false)}
          className="font-heading text-sm text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
        >
          {t('obecne.zrusit')}
        </button>
        {chyba && <span className="text-xs font-body text-danger">{chyba}</span>}
      </span>
    </div>
  );
}

/**
 * STÁLÉ PODKLADY - kdo jsme, tón, hotové tituly. Ema je dostane ke každému
 * úkolu, takže se nemusí opisovat do každé kampaně.
 */
export function PodkladyEmy({ jazyk, pocatecni }: { jazyk: Jazyk; pocatecni: string }) {
  const t = (k: string) => prelozit(jazyk, k);
  const [otevreno, setOtevreno] = useState(false);
  const [text, setText] = useState(pocatecni);
  const [stav, setStav] = useState<string | null>(null);

  async function uloz() {
    setStav(t('obecne.ukladam'));
    const res = await fetch('/api/pr/podklady', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    setStav(res?.ok ? t('obecne.ulozeno') : t('pr.zalozeniNeslo'));
  }

  return (
    <div className="rounded-card border border-line bg-field p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        className="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer text-left"
      >
        <span className="font-heading font-semibold text-sm text-ink">{t('pr.podklady')}</span>
        <span aria-hidden className={`text-[9px] text-muted transition-transform ${otevreno ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <p className="text-xs font-body text-muted m-0">{t('pr.podkladyPopis')}</p>
      {otevreno && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder={t('pr.podkladyPriklad')}
            className={`${POLE} resize-y font-body`}
          />
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={uloz}
              className="font-heading font-semibold text-sm rounded-lg px-4 py-2 bg-brand-purple text-white border-0 cursor-pointer"
            >
              {t('obecne.ulozit')}
            </button>
            {stav && <span className="text-xs font-body text-muted">{stav}</span>}
          </span>
        </>
      )}
    </div>
  );
}
