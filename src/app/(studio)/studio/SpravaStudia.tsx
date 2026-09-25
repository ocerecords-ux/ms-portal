'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * SPRÁVA REZERVACÍ PŘÍMO U KALENDÁŘE (zadání 25. 9. 2026: „k té editaci by
 * měl mít přístup i Matěj Černý").
 *
 * PROČ TADY A NE JEN V ADMINISTRACI: administrace je vyhrazená Žůžo-labůžo,
 * ale o rezervacích pobočky rozhoduje i její vedoucí. Tenhle panel proto sedí
 * pod kalendářem studia, kam vedoucí dosáhne - a ukáže se jen tomu, kdo dané
 * studio spravuje. V administraci zůstává tentýž panel pro přehled všech
 * studií najednou; obojí volá stejné API.
 *
 * SAMOTNÉ REZERVACE SE TU NEUPRAVUJÍ. Jsou to události kalendáře studia,
 * takže se posouvají, ruší a doplňují v Kalendáři jako všechno ostatní -
 * druhá cesta k témuž záznamu by jen kalila vodu.
 */

export type KlientStudia = {
  id: string;
  jmeno: string | null;
  email: string;
  hesloNastaveno: boolean;
};

export function SpravaStudia({
  studioId,
  minMinut,
  dniDopredu,
  klienti,
}: {
  studioId: string;
  minMinut: number;
  dniDopredu: number;
  klienti: KlientStudia[];
}) {
  const router = useRouter();
  const [otevreno, setOtevreno] = useState(false);
  const [bezi, setBezi] = useState(false);
  const [email, setEmail] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [min, setMin] = useState(minMinut);
  const [dni, setDni] = useState(dniDopredu);

  async function uloz(data: Record<string, unknown>) {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/studio/sprava', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, ...data }),
      });
      if (!res.ok) {
        const o = await res.json().catch(() => ({}));
        setChyba(o?.error || 'Nastavení se nepodařilo uložit.');
        return;
      }
      router.refresh();
    } finally {
      setBezi(false);
    }
  }

  async function pozvi(e: React.FormEvent) {
    e.preventDefault();
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    setZprava(null);
    setOdkaz(null);
    try {
      const res = await fetch('/api/studio/sprava', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, email, jmeno: jmeno || undefined }),
      });
      const o = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(o?.error || 'Pozvánku se nepodařilo odeslat.');
        if (o?.odkaz) setOdkaz(o.odkaz);
        return;
      }
      setZprava(`Pozvánka odešla na ${o.email}.`);
      setEmail('');
      setJmeno('');
      router.refresh();
    } finally {
      setBezi(false);
    }
  }

  async function odeber(id: string) {
    setBezi(true);
    try {
      await fetch(`/api/studio/sprava?userId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBezi(false);
    }
  }

  return (
    <section className="bg-surface border border-line rounded-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOtevreno((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer text-left"
      >
        <span>
          <span className="block font-heading font-semibold text-sm text-ink">
            Správa rezervací
          </span>
          <span className="block text-xs font-body text-muted">
            {klienti.length === 0
              ? 'Zatím sem nemá přístup nikdo — pozvěte prvního klienta.'
              : `${klienti.length} ${klienti.length === 1 ? 'pozvaný klient' : 'pozvaných klientů'}`}
          </span>
        </span>
        <span className="text-muted text-sm shrink-0">{otevreno ? '▾' : '▸'}</span>
      </button>

      {otevreno && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">Nejkratší rezervace (min)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                onBlur={() => min !== minMinut && uloz({ minMinut: min })}
                className="w-28 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">Dní dopředu (0 = bez limitu)</span>
              <input
                type="number"
                min={0}
                value={dni}
                onChange={(e) => setDni(Number(e.target.value))}
                onBlur={() => dni !== dniDopredu && uloz({ dniDopredu: dni })}
                className="w-28 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
          </div>

          <form onSubmit={pozvi} className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jméno@kapela.co.uk"
                className="w-60 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">Jméno (nepovinné)</span>
              <input
                value={jmeno}
                onChange={(e) => setJmeno(e.target.value)}
                className="w-44 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <button
              type="submit"
              disabled={bezi}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-2 disabled:opacity-50 border-0 cursor-pointer"
            >
              Poslat pozvánku
            </button>
          </form>

          {zprava && <p className="m-0 text-xs font-body text-status-done">{zprava}</p>}
          {chyba && <p className="m-0 text-xs font-body text-status-error">{chyba}</p>}
          {odkaz && (
            <p className="m-0 text-xs font-body text-muted break-all">
              Odkaz k předání ručně: <span className="text-ink">{odkaz}</span>
            </p>
          )}

          {klienti.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {klienti.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-heading text-ink truncate">
                      {k.jmeno || k.email}
                    </span>
                    <span className="block text-[11px] font-body text-muted truncate">
                      {k.jmeno ? `${k.email} · ` : ''}
                      {k.hesloNastaveno ? 'aktivní' : 'čeká na nastavení hesla'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => odeber(k.id)}
                    disabled={bezi}
                    className="shrink-0 bg-surface border border-line text-muted hover:text-status-error font-heading text-[11px] rounded-lg px-2.5 py-1 cursor-pointer"
                  >
                    Odebrat přístup
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="m-0 text-[11px] font-body text-muted">
            Samotné rezervace se posouvají a ruší v Kalendáři — jsou to běžné události studia.{' '}
            <a
              href="/navody/studio-booking-install.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-purple no-underline hover:underline"
            >
              Kartička s QR kódem k vytištění ↗
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
