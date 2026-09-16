'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { odpovidaHledani, uryvek } from '@/lib/navody';

/**
 * Seznam návodů s hledáním (zadání 16. 9. 2026).
 *
 * HLEDÁ SE PŘI PSANÍ, bez odesílání — návody jsou v paměti stránky a odpověď
 * je okamžitá. Hledá se v celém textu, ne jen v názvu: člověk si pamatuje
 * slovo z prostředka („normostrany"), ne jak se návod jmenuje.
 *
 * Nezáleží na diakritice ani na velikosti písmen (viz lib/navody.ts), takže
 * „poznamka" najde „Poznámka". Víc slov hledání zužuje.
 */
export type PolozkaNavodu = {
  id: string;
  slug: string;
  nazev: string;
  perex: string | null;
  kategorie: string;
  hledaci: string;
  obsah: string;
  zverejneno: boolean;
  upraveno: string;
};

export function SeznamNavodu({
  navody,
  jeAdmin,
}: {
  navody: PolozkaNavodu[];
  jeAdmin: boolean;
}) {
  const [dotaz, setDotaz] = useState('');

  const nalezene = useMemo(
    () => navody.filter((n) => odpovidaHledani(n.hledaci, dotaz)),
    [navody, dotaz],
  );

  // Pořadí kategorií drží server; tady se jen seskupí, ať se nepřehází.
  const kategorie = useMemo(() => {
    const mapa = new Map<string, PolozkaNavodu[]>();
    for (const n of nalezene) {
      const seznam = mapa.get(n.kategorie) ?? [];
      seznam.push(n);
      mapa.set(n.kategorie, seznam);
    }
    return [...mapa.entries()];
  }, [nalezene]);

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Nápověda</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Návody k portálu. Hledá se v celém textu — stačí slovo, které si pamatujete.
          </p>
        </div>
        {jeAdmin && (
          <Link
            href="/admin/navody"
            className="text-sm font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 no-underline hover:border-brand-purple"
          >
            Spravovat návody
          </Link>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M13.5 13.5L18 18" />
        </svg>
        <input
          value={dotaz}
          onChange={(e) => setDotaz(e.target.value)}
          placeholder="Hledat v návodech…"
          autoComplete="off"
          className="w-full rounded-pill border border-line bg-surface pl-10 pr-4 py-3 text-sm font-body text-ink outline-none focus:border-brand-purple"
        />
      </div>

      {navody.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          Zatím tu žádný návod není.
          {jeAdmin ? ' První přidáte přes „Spravovat návody".' : ''}
        </p>
      ) : nalezene.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          Nic neodpovídá. Zkuste jedno slovo místo celé věty.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {kategorie.map(([nazevKategorie, polozky]) => (
            <div key={nazevKategorie} className="flex flex-col gap-2">
              <h2 className="text-xs font-heading text-muted uppercase tracking-wide m-0">
                {nazevKategorie}
              </h2>
              <ul className="m-0 p-0 list-none bg-surface rounded-card border border-line shadow-sm overflow-hidden">
                {polozky.map((n) => {
                  const nahled = dotaz.trim() ? uryvek(n.obsah, dotaz) : null;
                  return (
                    <li key={n.id} className="border-b border-line last:border-0">
                      <Link
                        href={`/napoveda/${n.slug}`}
                        className="block px-5 py-4 no-underline hover:bg-field"
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-semibold text-ink">{n.nazev}</span>
                          {!n.zverejneno && (
                            <span className="text-xs font-heading rounded-pill border border-line text-muted px-2 py-0.5">
                              rozepsané
                            </span>
                          )}
                        </span>
                        {n.perex && (
                          <span className="block text-sm font-body text-muted mt-0.5">{n.perex}</span>
                        )}
                        {nahled && (
                          <span className="block text-xs font-body text-muted mt-1 italic">{nahled}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
