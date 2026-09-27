'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * REZERVACE STUDIA KLIENTY (zadání 25. 9. 2026: „v rámci londýnského studia
 * potřebuji udělat plánovací kalendář, který budou mít k dispozici muzikanti
 * a producenti, kteří si u nás bookujou termíny").
 *
 * Panel sedí u studií schválně: kdo si smí vzít naši kabinu, je věc studia,
 * ne seznamu uživatelů. Na jednom místě je tedy zapnutí, pravidla i lidé.
 *
 * ZAPÍNÁ SE U KAŽDÉHO STUDIA ZVLÁŠŤ. Dnes London; až se to osvědčí, stačí
 * zaškrtnout Brno a nic dalšího se nepřepisuje.
 */

export type StudioRezervace = {
  id: string;
  nazev: string;
  barva: string;
  zapnuto: boolean;
  minMinut: number;
  dniDopredu: number;
  /** Má studio vyplněnou otevírací dobu? Bez ní není co nabídnout. */
  maDobu: boolean;
  klienti: { id: string; jmeno: string | null; email: string; aktivni: boolean; hesloNastaveno: boolean }[];
};

export function RezervaceStudii({ studia, zaklad }: { studia: StudioRezervace[]; zaklad: string }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  // Adresa stojí ve větě jinou barvou, proto se věta dělí přes prelozitKolem
  // (pravidlo 7 v docs/preklad-portalu.md) - v angličtině stojí jinde.
  const [predAdresou, zaAdresou] = prelozitKolem(jazyk, 'studia.rezervacePopis', 'adresa');

  return (
    <section className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-heading font-semibold text-ink m-0">{t('studia.rezervaceNadpis')}</h2>
        <p className="text-xs font-body text-muted m-0 mt-1">
          {predAdresou}
          <span className="font-heading text-ink">{zaklad}/studio</span>
          {zaAdresou}
        </p>
        {/* Kartička s QR kódem k vytištění (25. 9. 2026) - anglicky, na jednu
            A4. Dá se pověsit ve studiu i poslat mailem. */}
        <a
          href="/navody/studio-booking-install.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 text-brand-purple font-heading text-xs no-underline hover:underline"
        >
          {t('studia.qrKarticka')}
        </a>
      </div>

      {studia.length === 0 ? (
        <p className="text-sm font-body text-muted m-0 px-5 py-6">{t('studia.zadneStudio')}</p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {studia.map((s) => (
            <Studio key={s.id} studio={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Studio({ studio }: { studio: StudioRezervace }) {
  const t = usePreklad();
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [email, setEmail] = useState('');
  const [jmeno, setJmeno] = useState('');
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [min, setMin] = useState(studio.minMinut);
  const [dni, setDni] = useState(studio.dniDopredu);

  async function uloz(data: Record<string, unknown>) {
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch('/api/studio/sprava', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId: studio.id, ...data }),
      });
      if (!res.ok) {
        const o = await res.json().catch(() => ({}));
        setChyba(o?.error || t('studia.nastaveniSelhalo'));
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
        body: JSON.stringify({ studioId: studio.id, email, jmeno: jmeno || undefined }),
      });
      const o = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(o?.error || t('studia.pozvankaSelhala'));
        if (o?.odkaz) setOdkaz(o.odkaz);
        return;
      }
      setZprava(t('studia.pozvankaOdeslana', { email: o.email }));
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
    <li className="border-t border-line first:border-t-0 px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            className="w-3 h-3 rounded-[3px] shrink-0"
            style={{ background: studio.barva }}
            aria-hidden="true"
          />
          <span className="font-heading font-semibold text-sm text-ink truncate">{studio.nazev}</span>
          {/* Klik na studio má něco dělat (25. 9. 2026: „neukáže se mi Londýn,
              když kliknu") - otevře kalendář rezervací toho studia. */}
          {studio.zapnuto && (
            <a
              href={`/studio?studio=${studio.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-brand-purple font-heading text-xs no-underline hover:underline"
            >
              {t('studia.otevritKalendar')}
            </a>
          )}
        </span>
        <label className="flex items-center gap-2 text-xs font-heading text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={studio.zapnuto}
            disabled={bezi}
            onChange={(e) => uloz({ zapnuto: e.target.checked })}
          />
          {t('studia.rezervaceZapnute')}
        </label>
      </div>

      {studio.zapnuto && !studio.maDobu && (
        <p className="m-0 text-xs font-body text-status-error">{t('studia.bezPracovniDoby')}</p>
      )}

      {studio.zapnuto && (
        <>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">{t('studia.nejkratsiRezervace')}</span>
              <input
                type="number"
                min={15}
                step={15}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                onBlur={() => min !== studio.minMinut && uloz({ minMinut: min })}
                className="w-28 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">{t('studia.dniDopredu')}</span>
              <input
                type="number"
                min={0}
                value={dni}
                onChange={(e) => setDni(Number(e.target.value))}
                onBlur={() => dni !== studio.dniDopredu && uloz({ dniDopredu: dni })}
                className="w-28 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
          </div>

          <form onSubmit={pozvi} className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">{t('studia.email')}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('studia.emailPlaceholder')}
                className="w-64 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-heading text-muted">{t('studia.jmenoNepovinne')}</span>
              <input
                value={jmeno}
                onChange={(e) => setJmeno(e.target.value)}
                className="w-48 bg-field border border-line rounded-lg px-3 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
              />
            </label>
            <button
              type="submit"
              disabled={bezi}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-2 disabled:opacity-50 border-0 cursor-pointer"
            >
              {t('studia.poslatPozvanku')}
            </button>
          </form>

          {zprava && <p className="m-0 text-xs font-body text-status-done">{zprava}</p>}
          {chyba && <p className="m-0 text-xs font-body text-status-error">{chyba}</p>}
          {odkaz && <OdkazRucne odkaz={odkaz} />}

          {studio.klienti.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {studio.klienti.map((k) => (
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
                      {k.hesloNastaveno ? t('studia.klientAktivni') : t('studia.klientCekaNaHeslo')}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => odeber(k.id)}
                    disabled={bezi}
                    className="shrink-0 bg-surface border border-line text-muted hover:text-status-error font-heading text-[11px] rounded-lg px-2.5 py-1 cursor-pointer"
                  >
                    {t('studia.odebratPristup')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

/**
 * Odkaz k předání ručně. Adresa stojí ve větě jinou barvou, takže se věta dělí
 * až při vykreslení přes prelozitKolem - celá zůstává jedním klíčem
 * (pravidlo 7 v docs/preklad-portalu.md).
 */
function OdkazRucne({ odkaz }: { odkaz: string }) {
  const jazyk = useJazyk();
  const [pred, za] = prelozitKolem(jazyk, 'studia.odkazRucne', 'odkaz');
  return (
    <p className="m-0 text-xs font-body text-muted break-all">
      {pred}
      <span className="text-ink">{odkaz}</span>
      {za}
    </p>
  );
}
