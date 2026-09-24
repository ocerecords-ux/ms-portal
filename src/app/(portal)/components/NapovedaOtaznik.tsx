'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * OTAZNÍK S NÁVODEM PŘÍMO V OBRAZOVCE (zadání 24. 9. 2026: „ten návod na
 * AudioTagger by mohl být i přímo někde v něm pod nějakým otazníkem").
 *
 * Kdo si v přeposlechu nebo v taggeru není jistý, klepne na otazník a přečte
 * si návod na místě - nemusí kvůli jedné větě opouštět rozdělanou práci
 * a hledat ho v Nápovědě.
 *
 * NAČÍTÁ SE AŽ PŘI OTEVŘENÍ. Návod je dlouhý text a většina lidí ho
 * nepotřebuje; než někdo klepne, nestojí tahle věc ani jeden dotaz navíc.
 *
 * KTERÝ NÁVOD se rozhoduje na serveru podle role a druhu zakázek - viz
 * /api/napoveda. Klient dostane svůj, my svůj; kdo na návod nemá, otazník
 * nedostane vůbec (odpověď 404 ho schová).
 */
type Navod = { slug: string; nazev: string; perex: string | null; html: string };

export function NapovedaOtaznik({
  tema,
  tmavy = false,
}: {
  /** Klíč tématu - viz TEMATA v /api/napoveda. */
  tema: string;
  /** Otazník sedí ve fialové liště: potřebuje bílé obtažení, ne tmavé. */
  tmavy?: boolean;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [navod, setNavod] = useState<Navod | null>(null);
  const [stav, setStav] = useState<'ceka' | 'nacitam' | 'hotovo' | 'nejde'>('ceka');

  useEffect(() => {
    if (!otevreno || stav !== 'ceka') return;
    let platne = true;
    setStav('nacitam');
    fetch(`/api/napoveda?tema=${encodeURIComponent(tema)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('nejde'))))
      .then((d: Navod) => {
        if (!platne) return;
        setNavod(d);
        setStav('hotovo');
      })
      .catch(() => platne && setStav('nejde'));
    return () => {
      platne = false;
    };
  }, [otevreno, stav, tema]);

  // Escape zavírá - okno je na čtení, ne na vyplňování.
  useEffect(() => {
    if (!otevreno) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOtevreno(false);
      }
    };
    window.addEventListener('keydown', naKlavesu, true);
    return () => window.removeEventListener('keydown', naKlavesu, true);
  }, [otevreno]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        title="Návod k téhle obrazovce"
        aria-label="Návod k téhle obrazovce"
        className={`shrink-0 grid place-items-center w-7 h-7 rounded-full border font-heading font-bold text-sm transition-colors ${
          tmavy
            ? 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
            : 'border-white/40 text-white hover:bg-white hover:text-brand-purpleDeep'
        }`}
      >
        ?
      </button>

      {otevreno && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
          onClick={() => setOtevreno(false)}
        >
          <div
            className="bg-paper border border-line rounded-card shadow-2xl w-full max-w-3xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-line">
              <div className="min-w-0">
                <p className="text-[11px] font-heading uppercase tracking-[0.12em] text-muted m-0">Nápověda</p>
                <h2 className="font-display text-2xl text-ink m-0 mt-0.5">
                  {navod?.nazev ?? 'Návod k téhle obrazovce'}
                </h2>
                {navod?.perex && <p className="text-sm font-body text-muted m-0 mt-1">{navod.perex}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                aria-label="Zavřít"
                className="ml-auto text-muted hover:text-ink text-xl leading-none mt-1"
              >
                ×
              </button>
            </div>

            <div className="px-5 sm:px-6 py-4 max-h-[70vh] overflow-y-auto">
              {stav === 'hotovo' && navod ? (
                <div className="navod-text" dangerouslySetInnerHTML={{ __html: navod.html }} />
              ) : (
                <p className="text-sm font-body text-muted m-0">
                  {stav === 'nejde' ? 'Návod k téhle obrazovce zatím není.' : 'Načítám návod…'}
                </p>
              )}
            </div>

            {navod && (
              <div className="px-5 sm:px-6 py-3 border-t border-line flex items-center gap-3 flex-wrap">
                <Link
                  href={`/napoveda/${navod.slug}`}
                  target="_blank"
                  className="text-sm font-heading font-semibold text-brand-purple no-underline hover:underline"
                >
                  Otevřít v Nápovědě ↗
                </Link>
                <button
                  type="button"
                  onClick={() => setOtevreno(false)}
                  className="ml-auto bg-bar text-white font-heading font-semibold text-sm rounded-lg px-5 py-2"
                >
                  Zavřít
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
