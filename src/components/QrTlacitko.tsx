'use client';

import { useEffect, useState } from 'react';

/**
 * QR PLATBA ROVNOU V PŘEHLEDU (zadání 15. 9. 2026: „nemůžem to udělat spíš už
 * v tom přehledu?").
 *
 * Na detail dokladu se kvůli zaplacení nikdo proklikávat nechce - účetní jede
 * seznam shora dolů a platí. V řádku je proto malá ikonka QR; kód se dokreslí
 * až po kliknutí, takže seznam o třech stech řádcích nenese tři sta obrázků.
 *
 * Řetězec (SPD 1.0) skládá server - stejný, jaký jde do PDF faktur. Sem chodí
 * hotový text, tady se z něj jen udělají čtverečky.
 */
export function QrTlacitko({
  text,
  castka,
  prijemce,
  ucet,
  variabilniSymbol,
  splatnost,
}: {
  text: string;
  castka: string;
  prijemce: string;
  ucet: string;
  variabilniSymbol?: string | null;
  splatnost?: string | null;
}) {
  const [otevreno, setOtevreno] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        title={`QR platba: ${castka}`}
        aria-label="Zobrazit QR platbu"
        className="text-muted hover:text-brand-purple transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
          <path
            d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 19h1.5v1H14z" fill="currentColor" />
        </svg>
      </button>

      {otevreno && (
        <QrOkno
          text={text}
          castka={castka}
          prijemce={prijemce}
          ucet={ucet}
          variabilniSymbol={variabilniSymbol}
          splatnost={splatnost}
          zavri={() => setOtevreno(false)}
        />
      )}
    </>
  );
}

function QrOkno({
  text,
  castka,
  prijemce,
  ucet,
  variabilniSymbol,
  splatnost,
  zavri,
}: {
  text: string;
  castka: string;
  prijemce: string;
  ucet: string;
  variabilniSymbol?: string | null;
  splatnost?: string | null;
  zavri: () => void;
}) {
  const [mrizka, setMrizka] = useState<{ velikost: number; body: boolean[] } | null>(null);

  useEffect(() => {
    let platne = true;
    // Knihovna se stahuje až tady - do prvního kliknutí ji stránka nepotřebuje.
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (!platne) return;
        const kod = QRCode.create(text, { errorCorrectionLevel: 'M' });
        const velikost = kod.modules.size;
        const data = kod.modules.data;
        const body: boolean[] = [];
        for (let i = 0; i < velikost * velikost; i += 1) body.push(Boolean(data[i]));
        setMrizka({ velikost, body });
      })
      .catch(() => setMrizka(null));
    return () => {
      platne = false;
    };
  }, [text]);

  useEffect(() => {
    function naKlavesu(e: KeyboardEvent) {
      if (e.key === 'Escape') zavri();
    }
    window.addEventListener('keydown', naKlavesu);
    return () => window.removeEventListener('keydown', naKlavesu);
  }, [zavri]);

  const okraj = 2;
  const strana = mrizka ? mrizka.velikost + okraj * 2 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={zavri}
      role="presentation"
    >
      <div
        className="bg-surface rounded-card border border-line shadow-lg p-6 flex flex-col items-center gap-3 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {mrizka ? (
          <svg
            viewBox={`0 0 ${strana} ${strana}`}
            role="img"
            aria-label="QR kód pro platbu"
            className="w-[220px] h-[220px] rounded-lg bg-white p-2"
          >
            {mrizka.body.map((plny, i) =>
              plny ? (
                <rect
                  key={i}
                  x={okraj + (i % mrizka.velikost)}
                  y={okraj + Math.floor(i / mrizka.velikost)}
                  width={1.02}
                  height={1.02}
                  fill="#201A33"
                />
              ) : null,
            )}
          </svg>
        ) : (
          <div className="w-[220px] h-[220px] rounded-lg bg-field" />
        )}

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="font-display text-xl text-ink tabular-nums">{castka}</span>
          <span className="text-sm font-heading text-ink">{prijemce}</span>
          <span className="text-xs font-body text-muted tabular-nums break-all">{ucet}</span>
          {variabilniSymbol && (
            <span className="text-xs font-body text-muted tabular-nums">VS {variabilniSymbol}</span>
          )}
          {splatnost && <span className="text-xs font-body text-muted">Splatnost {splatnost}</span>}
        </div>

        <button
          type="button"
          onClick={zavri}
          className="text-sm font-heading text-muted hover:text-ink"
        >
          Zavřít
        </button>
      </div>
    </div>
  );
}
