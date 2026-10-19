'use client';

import { useEffect, useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * CO PŘESNĚ KLIENTOVI ODEŠLO (zadání 19. 10. 2026: „a tady v historii, když
 * někomu pošle portál zprávu, tak se potřebuju prokliknout ideálně na to, co
 * vidí klient, co přesně na něj šlo a kam se může prokliknout. Pro kontrolu").
 *
 * Do historie se od 19. 10. 2026 ukládá otisk odeslané zprávy - přesně to
 * HTML, které šlo poště. Tohle tlačítko ho otevře v rámu, takže je vidět
 * zpráva tak, jak ji má klient v poště: osloveni, znění ze vzoru i tlačítka
 * s odkazy.
 *
 * ODKAZY SE OTEVÍRAJÍ V NOVÉM PANELU, ne v rámu - jinak by se v okýnku
 * otevřela cílová stránka a nebylo by poznat, kam odkaz vlastně vedl.
 * Kontrola odkazů je přitom půlka důvodu, proč to vzniklo.
 *
 * U STARŠÍCH ZÁZNAMŮ TLAČÍTKO NENÍ. Otisk se zpětně vyrobit nedá a „náhled",
 * který by se poskládal ze vzoru až teď, by ukazoval něco jiného, než co
 * klient dostal - vzor se mezitím mohl přepsat.
 */
export function NahledZpravy({
  caflouProjectId,
  udalostId,
  predmet,
}: {
  caflouProjectId: string;
  udalostId: string;
  predmet: string | null;
}) {
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);

  const odkaz = `/api/projekty/${encodeURIComponent(caflouProjectId)}/zprava/${encodeURIComponent(udalostId)}`;

  // Escape zavírá okno - stejně jako u ostatních náhledů v portálu.
  useEffect(() => {
    if (!otevreno) return;
    function naKlavesu(e: KeyboardEvent) {
      if (e.key === 'Escape') setOtevreno(false);
    }
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
  }, [otevreno]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs font-heading font-semibold text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
        >
          <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        {t('historie.coOdeslo')}
      </button>

      {otevreno && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOtevreno(false)}
        >
          <div
            className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                  {t('historie.nahledZpravy')}
                </p>
                <p className="m-0 truncate text-sm font-heading text-ink">
                  {predmet || t('historie.bezPredmetu')}
                </p>
              </div>
              <a
                href={odkaz}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-heading font-semibold text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
              >
                {t('historie.otevritVPanelu')}
              </a>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-heading font-semibold text-ink hover:bg-field transition-colors"
              >
                {t('obecne.zavrit')}
              </button>
            </div>
            {/*
              Rám je zamčený (sandbox): zpráva je uložené HTML a nemá tu co
              spouštět. Odskok na odkaz se povoluje schválně - právě kvůli
              němu se sem člověk dívá.
            */}
            <iframe
              src={odkaz}
              title={predmet || t('historie.nahledZpravy')}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
