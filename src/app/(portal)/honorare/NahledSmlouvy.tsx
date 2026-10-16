'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * NÁHLED SMLOUVY V HONORÁŘÍCH (zadání 16. 10. 2026: „po kliknutí na smlouvu
 * by se měla otevřít v tom samém okně v náhledu a měla by se dát stáhnout
 * v pdf").
 *
 * Do teď tlačítko „Smlouva" odskočilo na další záložku a herec se k souboru
 * nedostal vůbec. Teď se smlouva otevře PŘÍMO TADY v okně nad seznamem -
 * člověk si ji přečte a zavře, aniž by Honoráře opustil - a z téhož okna si
 * ji stáhne jako PDF.
 *
 * NÁHLED JE SAMO PDF, ne druhé vykreslení smlouvy do HTML: co herec vidí, je
 * přesně ten soubor, který si stáhne a který chodí v příloze mailu. Dvě různá
 * vykreslení téhož dokumentu jsou past - jednou by se rozešla a nikdo by
 * nevěděl, které z nich platí.
 */
export function NahledSmlouvy({
  token,
  cislo,
  projekt,
}: {
  token: string;
  cislo: string;
  projekt: string;
}) {
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);
  const zaklad = `/api/smlouva/${encodeURIComponent(token)}/pdf`;

  // Zavře se Escapem a dokud je okno otevřené, stránka pod ním neroluje -
  // jinak člověk zavře náhled a je úplně jinde, než kde byl.
  useEffect(() => {
    if (!otevreno) return;
    function klavesa(e: KeyboardEvent) {
      if (e.key === 'Escape') setOtevreno(false);
    }
    document.addEventListener('keydown', klavesa);
    const puvodni = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', klavesa);
      document.body.style.overflow = puvodni;
    };
  }, [otevreno]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="inline-block text-xs font-heading font-semibold rounded-pill border border-line text-ink px-4 py-2 bg-transparent cursor-pointer hover:bg-surfaceSoft"
      >
        {t('honorare.smlouvaOdkaz')}
      </button>

      {otevreno && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('honorare.nahledSmlouvy')}
          onClick={() => setOtevreno(false)}
          className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-line rounded-card shadow-lg w-full max-w-4xl max-h-full flex flex-col overflow-hidden text-left"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
              <span className="min-w-0">
                <span className="block font-heading font-semibold text-sm text-ink truncate">{projekt}</span>
                <span className="block text-xs font-body text-muted truncate">{cislo}</span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <a
                  href={`${zaklad}?stahnout=1`}
                  className="text-xs font-heading font-semibold rounded-pill bg-brand-purple text-onAccent px-4 py-2 no-underline"
                >
                  {t('honorare.stahnoutPdf')}
                </a>
                {/* Stránka smlouvy zůstává po ruce - je na ní doložka
                    o podpisech a dá se odtud poslat dál. */}
                <Link
                  href={`/smlouva/${token}`}
                  className="text-xs font-heading text-muted hover:text-ink no-underline"
                >
                  {t('honorare.otevritStranku')}
                </Link>
                <button
                  type="button"
                  onClick={() => setOtevreno(false)}
                  aria-label={t('obecne.zavrit')}
                  title={t('obecne.zavrit')}
                  className="border-0 bg-transparent text-muted hover:text-ink cursor-pointer text-lg leading-none px-1"
                >
                  ✕
                </button>
              </span>
            </div>

            {/* Bílý podklad schválně i v tmavém režimu - smlouva je bílý papír
                a na tmavém pozadí by kolem ní svítil ostrý rám. */}
            <div className="bg-white flex-1 min-h-0">
              <iframe
                src={`${zaklad}#view=FitH`}
                title={`${projekt} · ${cislo}`}
                className="w-full h-[78vh] border-0 block"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
