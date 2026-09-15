import { formatMoney } from '@/lib/doklady';
import { ibanZTuzemskehoUctu, jeIbanPlatny, qrModuly, spdRetezec } from '@/lib/pdf/qrPlatba';
import type { Currency } from '@prisma/client';

/**
 * QR PLATBA U DOKLADU (zadání 15. 9. 2026: „u těch dokladů, smluv s herci,
 * kde máme číslo účtu, QR kód pro platbu, že by se objevil někde u toho
 * výdaje").
 *
 * Kreslí se stejný standard jako na našich fakturách (SPD 1.0, lib/pdf/
 * qrPlatba) - jen místo do PDF se sází jako SVG na stránku. Celá logika kolem
 * IBANu a řetězce je proto společná; tady přibylo jen vykreslení.
 *
 * Když nemáme účet nebo částku, nevrací se NIC. Špatný nebo poloprázdný QR
 * kód je horší než žádný - člověk ho naskenuje a pošle peníze bůhvíkam.
 */
export function QrPlatba({
  ucet,
  castkaMinor,
  mena,
  variabilniSymbol,
  zprava,
  splatnost,
  prijemce,
}: {
  ucet: string | null | undefined;
  castkaMinor: number;
  mena: Currency;
  variabilniSymbol?: string | null;
  zprava?: string | null;
  splatnost?: Date | null;
  prijemce?: string | null;
}) {
  const ocisteny = (ucet ?? '').trim();
  if (!ocisteny || castkaMinor <= 0) return null;

  // Účet se u herců píše tuzemsky („19-2000145399/0800"), u cizinců rovnou
  // IBANem - poznají se od sebe podle tvaru.
  const iban = jeIbanPlatny(ocisteny) ? ocisteny.replace(/\s/g, '').toUpperCase() : ibanZTuzemskehoUctu(ocisteny);
  if (!iban) return null;

  const retezec = spdRetezec({
    iban,
    castkaMinor,
    mena,
    variabilniSymbol,
    zprava,
    splatnost,
  });
  if (!retezec) return null;

  const { velikost, body } = qrModuly(retezec);
  const okraj = 2;
  const strana = velikost + okraj * 2;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex items-center gap-5 flex-wrap">
      <svg
        viewBox={`0 0 ${strana} ${strana}`}
        role="img"
        aria-label="QR kód pro platbu"
        className="w-[150px] h-[150px] shrink-0 rounded-lg bg-white p-1"
      >
        {body.map((plny, i) =>
          plny ? (
            <rect
              key={i}
              x={okraj + (i % velikost)}
              y={okraj + Math.floor(i / velikost)}
              width={1.02}
              height={1.02}
              fill="#201A33"
            />
          ) : null,
        )}
      </svg>

      <div className="flex flex-col gap-1 min-w-[180px]">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">QR platba</span>
        <span className="font-display text-xl text-ink tabular-nums">{formatMoney(castkaMinor, mena)}</span>
        {prijemce && <span className="text-sm font-heading text-ink">{prijemce}</span>}
        <span className="text-xs font-body text-muted tabular-nums break-all">{ocisteny}</span>
        {variabilniSymbol && (
          <span className="text-xs font-body text-muted tabular-nums">VS {variabilniSymbol}</span>
        )}
        <span className="text-xs font-body text-muted">Naskenujte v bankovní aplikaci.</span>
      </div>
    </div>
  );
}
