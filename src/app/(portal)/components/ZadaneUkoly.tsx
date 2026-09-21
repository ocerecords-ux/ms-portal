'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * „ZADAL JSEM" (zadání 21. 9. 2026: „když vytvořím někomu dalšímu úkol
 * z chatu, potřebuji vidět někde, že jsem ho vytvořil a že ho pak ten člověk
 * splnil").
 *
 * Úkoly, které jsem přes @úkol v chatu dal někomu jinému. Odškrtnout je
 * nejde - to je věc toho, komu patří. Tady se jen sleduje: pro koho, do kdy
 * a jestli už je hotovo. Když ho příjemce odškrtne, přijde zadavateli
 * i zpráva pod zvonek.
 *
 * Stejný seznam je v panelu Úkoly na pravé hraně i v záložce Úkoly v chatu.
 */
export type ZadanyUkolVSeznamu = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  splnenoAt: string | null;
  komu: string;
  zdrojKonverzaceId: string | null;
};

const datum = (iso: string) =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00` : iso),
  );

export function ZadaneUkoly({ ukoly }: { ukoly: ZadanyUkolVSeznamu[] }) {
  const [splneneVidet, setSplneneVidet] = useState(false);
  if (ukoly.length === 0) return null;

  const cekaji = ukoly.filter((u) => !u.done);
  const splnene = ukoly.filter((u) => u.done);
  const dnes = new Date().toISOString().slice(0, 10);

  const radek = (u: ZadanyUkolVSeznamu) => {
    const poTerminu = !u.done && u.dueDate !== null && u.dueDate < dnes;
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
                {u.dueDate ? `${poTerminu ? 'po termínu, ' : ''}do ${datum(u.dueDate)}` : 'čeká'}
              </span>
            )}
          </span>
        </span>
      </>
    );
    return (
      <li key={u.id}>
        {u.zdrojKonverzaceId ? (
          <Link
            href={`/chat?konverzace=${u.zdrojKonverzaceId}`}
            title="Otevřít konverzaci, ze které úkol vznikl"
            className="flex items-start gap-2.5 py-2 px-1 rounded-lg no-underline hover:bg-field"
          >
            {obsah}
          </Link>
        ) : (
          <div className="flex items-start gap-2.5 py-2 px-1">{obsah}</div>
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
