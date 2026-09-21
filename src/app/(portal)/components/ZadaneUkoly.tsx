'use client';

import Link from 'next/link';
import { useState } from 'react';
import { jePoTerminu, popisTerminu } from '@/lib/terminUkolu';

/**
 * „ZADAL JSEM" (zadání 21. 9. 2026: „když vytvořím někomu dalšímu úkol
 * z chatu, potřebuji vidět někde, že jsem ho vytvořil a že ho pak ten člověk
 * splnil").
 *
 * Úkoly, které jsem přes @úkol v chatu dal někomu jinému. Odškrtnout je
 * nejde - to je věc toho, komu patří. Zadavatel je ale smí UPRAVIT (název,
 * datum, čas) a ZRUŠIT (zadání tentýž den: „a když někomu zadám úkol, chci ho
 * editovat"); příjemci o tom přijde zpráva pod zvonek.
 *
 * Stejný seznam je v panelu Úkoly na pravé hraně i v záložce Úkoly v chatu.
 */
export type ZadanyUkolVSeznamu = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  dueTime: string | null;
  splnenoAt: string | null;
  komu: string;
  zdrojKonverzaceId: string | null;
};

const datum = (iso: string) =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(new Date(iso));

const pole =
  'rounded-lg border border-line bg-field px-2 py-1.5 text-xs font-body text-ink outline-none focus:border-brand-purple';

export function ZadaneUkoly({ ukoly, onZmena }: { ukoly: ZadanyUkolVSeznamu[]; onZmena: () => void }) {
  const [splneneVidet, setSplneneVidet] = useState(false);
  const [upravovany, setUpravovany] = useState<string | null>(null);
  if (ukoly.length === 0) return null;

  const cekaji = ukoly.filter((u) => !u.done);
  const splnene = ukoly.filter((u) => u.done);

  const radek = (u: ZadanyUkolVSeznamu) => {
    if (upravovany === u.id) {
      return (
        <li key={u.id}>
          <UpravaUkolu
            ukol={u}
            onKonec={(zmeneno) => {
              setUpravovany(null);
              if (zmeneno) onZmena();
            }}
          />
        </li>
      );
    }
    const poTerminu = !u.done && jePoTerminu(u.dueDate, u.dueTime);
    const obsah = (
      <>
        {/* Stav místo zaškrtávátka: odškrtává ten, komu úkol patří. */}
        <span
          className={`mt-0.5 w-4 h-4 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${
            u.done ? 'bg-brand-green text-onAccent' : 'border-2 border-line'
          }`}
          aria-hidden
        >
          {u.done ? '✓' : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-body break-words ${u.done ? 'text-muted' : 'text-ink'}`}>{u.title}</span>
          <span className="block text-[11px] font-heading mt-0.5">
            <span className="text-brand-purple">pro {u.komu}</span>
            {u.done ? (
              <span className="text-brand-greenDeep dark:text-brand-green">
                {' · '}splněno{u.splnenoAt ? ` ${datum(u.splnenoAt)}` : ''}
              </span>
            ) : (
              <span className={poTerminu ? 'text-danger' : 'text-muted'}>
                {' · '}
                {u.dueDate ? `${poTerminu ? 'po termínu, ' : ''}do ${popisTerminu(u.dueDate, u.dueTime)}` : 'čeká'}
              </span>
            )}
          </span>
        </span>
      </>
    );
    return (
      <li key={u.id} className="flex items-start gap-1 group">
        {u.zdrojKonverzaceId ? (
          <Link
            href={`/chat?konverzace=${u.zdrojKonverzaceId}`}
            title="Otevřít konverzaci, ze které úkol vznikl"
            className="flex-1 min-w-0 flex items-start gap-2.5 py-2 px-1 rounded-lg no-underline hover:bg-field"
          >
            {obsah}
          </Link>
        ) : (
          <div className="flex-1 min-w-0 flex items-start gap-2.5 py-2 px-1">{obsah}</div>
        )}
        {!u.done && (
          <button
            type="button"
            onClick={() => setUpravovany(u.id)}
            title="Upravit úkol"
            aria-label="Upravit úkol"
            className="mt-1.5 shrink-0 rounded-md px-1.5 py-1 text-xs text-muted hover:text-brand-purple hover:bg-field opacity-60 group-hover:opacity-100"
          >
            ✎
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-1 pt-3 border-t border-line">
      <h3 className="m-0 px-1 text-[11px] font-heading font-semibold uppercase tracking-[0.12em] text-muted">
        Zadal jsem{cekaji.length > 0 ? ` · čeká ${cekaji.length}` : ''}
      </h3>
      <ul className="list-none p-0 m-0 flex flex-col">
        {cekaji.map(radek)}
        {cekaji.length === 0 && (
          <li className="text-sm font-body text-muted px-1 py-1">Všechno, co jste zadali, je hotové.</li>
        )}
      </ul>
      {splnene.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setSplneneVidet((v) => !v)}
            className="self-start text-[11px] font-heading font-semibold text-muted hover:text-brand-purple px-1"
          >
            {splneneVidet ? 'Skrýt splněné' : `Splněné (${splnene.length})`}
          </button>
          {splneneVidet && <ul className="list-none p-0 m-0 flex flex-col">{splnene.map(radek)}</ul>}
        </>
      )}
    </section>
  );
}

/** Úprava zadaného úkolu přímo v seznamu - název, datum, čas, nebo zrušení. */
function UpravaUkolu({ ukol, onKonec }: { ukol: ZadanyUkolVSeznamu; onKonec: (zmeneno: boolean) => void }) {
  const [nazev, setNazev] = useState(ukol.title);
  const [den, setDen] = useState(ukol.dueDate ?? '');
  const [cas, setCas] = useState(ukol.dueTime ?? '');
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [potvrditZruseni, setPotvrditZruseni] = useState(false);

  async function posli(metoda: 'PATCH' | 'DELETE') {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/tasks/${ukol.id}`, {
        method: metoda,
        headers: metoda === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
        body:
          metoda === 'PATCH'
            ? JSON.stringify({ title: nazev.trim(), dueDate: den || null, dueTime: den && cas ? cas : null })
            : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Nepodařilo se uložit.');
        return;
      }
      onKonec(true);
    } catch {
      setChyba('Nepodařilo se uložit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nazev.trim()) void posli('PATCH');
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-brand-purple/40 bg-tint/40 p-2 my-1"
    >
      <span className="text-[11px] font-heading text-brand-purple">Úkol pro {ukol.komu}</span>
      <input
        autoFocus
        value={nazev}
        onChange={(e) => setNazev(e.target.value)}
        className={`${pole} text-sm`}
        aria-label="Název úkolu"
      />
      <div className="flex items-center gap-1.5">
        <input type="date" value={den} onChange={(e) => setDen(e.target.value)} className={`${pole} flex-1 min-w-0`} aria-label="Termín" />
        <input
          type="time"
          value={cas}
          onChange={(e) => setCas(e.target.value)}
          disabled={!den}
          title={den ? 'Do kolika hodin (nepovinné)' : 'Nejdřív vyberte datum'}
          className={`${pole} w-[92px] disabled:opacity-40`}
          aria-label="Čas"
        />
      </div>
      {chyba && <span className="text-[11px] font-body text-danger">{chyba}</span>}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="submit"
          disabled={busy || !nazev.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          Uložit
        </button>
        <button
          type="button"
          onClick={() => onKonec(false)}
          className="text-xs font-heading text-muted hover:text-ink px-1"
        >
          Zpět
        </button>
        <span className="flex-1" />
        {/* Zrušení až na druhé klepnutí - úkol zmizí i tomu, komu patří. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => (potvrditZruseni ? void posli('DELETE') : setPotvrditZruseni(true))}
          className="text-xs font-heading font-semibold text-danger hover:underline px-1"
        >
          {potvrditZruseni ? 'Opravdu zrušit?' : 'Zrušit úkol'}
        </button>
      </div>
    </form>
  );
}
