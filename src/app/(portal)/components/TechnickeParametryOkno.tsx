'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { VypisParametru } from './VypisParametru';
import type { SekceTech } from '@/lib/technickeParametry';
import { useJazyk, usePreklad } from './JazykProvider';

/**
 * TECHNICKÉ PARAMETRY V KANÁLU PROJEKTU (zadání 27. 9. 2026: „v kanálu
 * projektu v chatu pod nějakou ikonkou, na kterou když kliknou, tak to bude
 * jak proklik na přeposlech. Vyskakovací okno s možností zavřít klikem
 * a proklik na detail").
 *
 * Okno je ukotvené u ikony, jako doklady v přehledu projektů: zavírá se klikem
 * mimo, Escapem i odrolováním stránky - ale NE rolováním uvnitř sebe, jinak by
 * delší sada zmizela dřív, než by si ji člověk přečetl.
 *
 * Parametry se tahají až při otevření. Do doku, který drží desítky kanálů, se
 * nemá smysl posílat sada ke každému projektu dopředu.
 */

const SIRKA = 320;

type Nactene = {
  profil: { id: string; nazev: string; perex: string | null };
  sekce: SekceTech[];
  vychoziSada: boolean;
  firmaName: string | null;
};

export function TechnickeParametryOkno({ caflouProjectId }: { caflouProjectId: string }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [kotva, setKotva] = useState<{ left: number; top: number } | null>(null);
  const [data, setData] = useState<Nactene | null>(null);
  const [nacita, setNacita] = useState(false);
  const [prazdne, setPrazdne] = useState(false);
  const oknoRef = useRef<HTMLDivElement>(null);

  // Když se přepne kanál, staré parametry se zahodí - jinak by v okně chvíli
  // svítila sada minulého projektu.
  useEffect(() => {
    setData(null);
    setPrazdne(false);
    setKotva(null);
  }, [caflouProjectId]);

  useLayoutEffect(() => {
    if (!kotva || !oknoRef.current) return;
    const r = oknoRef.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const novyVrsek = Math.max(8, window.innerHeight - r.height - 8);
      if (Math.abs(novyVrsek - kotva.top) > 1) setKotva({ ...kotva, top: novyVrsek });
    }
  }, [kotva, data]);

  useEffect(() => {
    if (!kotva) return;
    const zavri = (e?: Event) => {
      const cil = e?.target;
      if (cil instanceof Node && oknoRef.current?.contains(cil)) return;
      setKotva(null);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKotva(null);
    };
    // Bez odkladu by okno zavřel tentýž klik, který ho právě otevřel.
    const id = setTimeout(() => document.addEventListener('mousedown', zavri), 0);
    window.addEventListener('keydown', klavesa);
    window.addEventListener('scroll', zavri, true);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', zavri);
      window.removeEventListener('keydown', klavesa);
      window.removeEventListener('scroll', zavri, true);
    };
  }, [kotva]);

  async function otevri(e: React.MouseEvent<HTMLButtonElement>) {
    if (kotva) {
      setKotva(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setKotva({ left: Math.max(8, Math.min(r.right - SIRKA, window.innerWidth - SIRKA - 8)), top: r.bottom + 6 });

    if (data || nacita) return;
    setNacita(true);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/technicke-parametry`, {
        cache: 'no-store',
      });
      const telo = await res.json().catch(() => ({}));
      if (telo?.parametry) setData(telo.parametry as Nactene);
      else setPrazdne(true);
    } catch {
      setPrazdne(true);
    } finally {
      setNacita(false);
    }
  }

  return (
    <>
      {/* POPSANÉ TLAČÍTKO, NE JEN IKONA (27. 9. 2026: „v tom chatu to taky
          není" - samotný šedý symbol mezi připínáčkem a zvonkem nikdo
          nenajde). Text je krátký, takže se vejde i do úzkého doku. */}
      <button
        type="button"
        onClick={(e) => void otevri(e)}
        title={t('parametry.tlacitkoPopis')}
        aria-expanded={Boolean(kotva)}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-heading font-semibold transition-colors ${
          kotva
            ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
            : 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
        }`}
      >
        <IkonaParametru />
        {t('parametry.tlacitko')}
      </button>

      {kotva && (
        <div
          ref={oknoRef}
          role="dialog"
          aria-label={t('parametry.nadpis')}
          style={{ position: 'fixed', left: kotva.left, top: kotva.top, width: SIRKA }}
          className="z-[120] rounded-card border border-line bg-surface shadow-lg p-4 flex flex-col gap-3 max-h-[min(70vh,520px)] overflow-y-auto"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-semibold text-sm text-ink">{t('parametry.nadpis')}</span>
            <button
              type="button"
              onClick={() => setKotva(null)}
              aria-label={t('obecne.zavrit')}
              className="ml-auto text-muted hover:text-ink bg-transparent border-0 cursor-pointer text-sm leading-none"
            >
              ✕
            </button>
          </div>

          {nacita && <p className="text-sm font-body text-muted m-0">{t('obecne.nacitam')}</p>}

          {!nacita && (prazdne || !data) && (
            <p className="text-sm font-body text-muted m-0">
              {t('parametry.zadnaSada')}
            </p>
          )}

          {!nacita && data && (
            <>
              <span className="text-xs font-body text-muted -mt-1">
                {data.profil.nazev}
                {data.vychoziSada && ` — ${t('parametry.obecnaSada')}`}
              </span>
              <VypisParametru sekce={data.sekce} husty jazyk={jazyk} />
            </>
          )}

          <Link
            href={`/projekty/${encodeURIComponent(caflouProjectId)}`}
            onClick={() => setKotva(null)}
            className="text-xs font-heading text-brand-purple no-underline hover:underline mt-1"
          >
            {t('parametry.otevritDetail')}
          </Link>
        </div>
      )}
    </>
  );
}

/** Posuvníky mixu - zkratka pro „jak se to má vyrobit". */
function IkonaParametru() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <path d="M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3" />
      <path d="M2.5 14h5M9.5 8h5M16.5 16h5" />
    </svg>
  );
}
