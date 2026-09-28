'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import type { TemaVRezii } from '@/lib/poradaServer';

/**
 * REŽIE TECHNICKÉ PORADY (zadání 28. 9. 2026: „Peter měl ještě někde u sebe
 * podrobné poznámky, které nikdo nevidí").
 *
 * Tohle je ta „někde u sebe" stránka. Otevírá se na telefonu nebo na druhé
 * obrazovce, zatímco na plátně běží přehled v režimu porady. Vedoucí tady vidí
 * u každého tématu své poznámky a odškrtává - na plátně se odškrtnutí objeví
 * samo, protože se přehled každých pár vteřin obnovuje.
 *
 * NA PLÁTNO SE POZNÁMKY NEPOSÍLAJÍ VŮBEC, ani skryté v HTML - viz
 * lib/poradaServer.ts.
 *
 * POZNÁMKA SE UKLÁDÁ PŘI ODCHODU Z POLÍČKA, ne po každém písmenu: uprostřed
 * porady se do ní píše narychlo a dotaz na server po každé klávese by jen
 * překážel.
 */
export function Rezie({ temata: pocatecni }: { temata: TemaVRezii[] }) {
  const [temata, setTemata] = useState(pocatecni);
  const [novy, setNovy] = useState('');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [otevrene, setOtevrene] = useState<string | null>(null);

  async function volej(nastaveni: RequestInit & { adresa?: string }) {
    setBezi(true);
    setChyba(null);
    try {
      const { adresa, ...zbytek } = nastaveni;
      const res = await fetch(adresa ?? '/api/porada/temata', {
        headers: { 'Content-Type': 'application/json' },
        ...zbytek,
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(telo?.error || 'Nepodařilo se to uložit.');
        return false;
      }
      if (Array.isArray(telo?.temata)) setTemata(telo.temata as TemaVRezii[]);
      return true;
    } catch {
      setChyba('Nepodařilo se to uložit.');
      return false;
    } finally {
      setBezi(false);
    }
  }

  const uprav = (id: string, zmena: Record<string, unknown>) =>
    volej({ method: 'PATCH', body: JSON.stringify({ id, ...zmena }) });

  const hotovych = temata.filter((t) => t.hotovo).length;

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-display text-3xl text-ink m-0">Režie porady</h1>
        <span className="text-sm font-body text-muted">
          {hotovych} z {temata.length} probráno · poznámky vidíš jen ty
        </span>
        <Link
          href="/prehledy/knihy?porada=1"
          target="_blank"
          rel="noopener"
          className="ml-auto text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
        >
          Otevřít plátno →
        </Link>
      </div>

      <p className="text-sm font-body text-muted m-0">
        Na plátno pusť <strong className="text-ink">Přehledy → Knihy a rozpočty → Pro poradu</strong>{' '}
        a přepni na celou obrazovku. Tuhle stránku si nech na telefonu nebo na druhé obrazovce -
        odškrtnutí se na plátně objeví samo do pár vteřin.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void volej({ method: 'POST', body: JSON.stringify({ akce: 'novaPorada' }) })}
          disabled={bezi || hotovych === 0}
          className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-sm px-4 py-1.5 hover:text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-40"
        >
          Začít novou poradu
        </button>
        <span className="text-xs font-body text-muted">Odškrtne všechna témata, seznam nechá.</span>
      </div>

      <ul className="list-none m-0 p-0 flex flex-col gap-2">
        {temata.map((t, i) => (
          <li
            key={t.id}
            className={`bg-surface border rounded-card shadow-sm p-4 flex flex-col gap-3 ${
              t.hotovo ? 'border-line opacity-60' : 'border-line'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => void uprav(t.id, { hotovo: !t.hotovo })}
                aria-pressed={t.hotovo}
                title={t.hotovo ? 'Vrátit mezi neprobraná' : 'Odškrtnout jako probrané'}
                className={`shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                  t.hotovo
                    ? 'bg-status-done border-status-done text-white'
                    : 'border-line text-muted hover:border-brand-purple hover:text-brand-purple'
                }`}
              >
                {t.hotovo ? '✓' : ''}
              </button>

              <input
                defaultValue={t.nadpis}
                onBlur={(e) => {
                  const nove = e.target.value.trim();
                  if (nove && nove !== t.nadpis) void uprav(t.id, { nadpis: nove });
                }}
                className={`${pole} font-heading font-semibold ${t.hotovo ? 'line-through' : ''}`}
              />

              <span className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void uprav(t.id, { presun: 'nahoru' })}
                  disabled={i === 0 || bezi}
                  title="Posunout nahoru"
                  aria-label="Posunout nahoru"
                  className="w-8 h-8 rounded-lg border border-line bg-field text-muted hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void uprav(t.id, { presun: 'dolu' })}
                  disabled={i === temata.length - 1 || bezi}
                  title="Posunout dolů"
                  aria-label="Posunout dolů"
                  className="w-8 h-8 rounded-lg border border-line bg-field text-muted hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <TlacitkoSmazat
                  onSmazat={() =>
                    void volej({
                      method: 'DELETE',
                      adresa: `/api/porada/temata?id=${encodeURIComponent(t.id)}`,
                    })
                  }
                  otazka="Opravdu smazat?"
                  popisek="Smazat téma"
                />
              </span>
            </div>

            <div className="pl-10 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setOtevrene((o) => (o === t.id ? null : t.id))}
                className="self-start text-xs font-heading font-semibold text-brand-purple bg-transparent border-0 px-0"
              >
                {otevrene === t.id
                  ? 'Skrýt poznámky'
                  : t.poznamka
                    ? 'Poznámky'
                    : 'Přidat poznámky'}
              </button>
              {otevrene === t.id ? (
                <textarea
                  defaultValue={t.poznamka ?? ''}
                  rows={6}
                  placeholder="Co k tomuhle tématu říct. Nikdo jiný to neuvidí."
                  onBlur={(e) => {
                    const nove = e.target.value;
                    if (nove !== (t.poznamka ?? '')) void uprav(t.id, { poznamka: nove });
                  }}
                  className={pole}
                />
              ) : (
                t.poznamka && (
                  <p className="text-sm font-body text-muted m-0 whitespace-pre-line line-clamp-2">
                    {t.poznamka}
                  </p>
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const nadpis = novy.trim();
          if (!nadpis) return;
          if (await volej({ method: 'POST', body: JSON.stringify({ nadpis }) })) setNovy('');
        }}
        className="flex items-center gap-2"
      >
        <input
          value={novy}
          onChange={(e) => setNovy(e.target.value)}
          placeholder="Nové téma…"
          className={pole}
        />
        <button
          type="submit"
          disabled={bezi || !novy.trim()}
          className="shrink-0 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
        >
          Přidat
        </button>
      </form>

      {chyba && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
          {chyba}
        </p>
      )}
    </div>
  );
}
