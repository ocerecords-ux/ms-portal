'use client';

import { koruny, korunyKratce, nazevMesicePalubovky } from '@/lib/palubovka';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * BONUS PO MĚSÍCÍCH (zadání 6. 10. 2026: „obrat se musí počítat za každý
 * měsíc… a získat nějaké grafy a přehledy za minulé měsíce").
 *
 * Sloupce jsou jen jedna řada čísel, takže si vystačí s výškou - žádná osa
 * ani mřížka navíc. Hodnota je napsaná NAD každým sloupcem, ne jen v bublině
 * po najetí: graf se čte i z telefonu a i tomu, kdo barvy nerozezná.
 * Rozjetý měsíc je vyšrafovaný, protože ještě poroste.
 */
export function GrafBonusu({
  mesice,
  rozjetyMesic,
}: {
  mesice: { mesic: number; bonus: number }[];
  rozjetyMesic: number | null;
}) {
  const jazyk = useJazyk();
  const t = usePreklad();
  const nejvic = Math.max(...mesice.map((m) => m.bonus), 1);

  if (mesice.every((m) => m.bonus === 0)) {
    return <p className="text-sm font-body text-muted m-0">{t('bonusObratu.zatimNic')}</p>;
  }

  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-48 pt-6">
      {mesice.map((m) => {
        const vyska = Math.max((m.bonus / nejvic) * 100, m.bonus > 0 ? 2 : 0);
        const bezi = m.mesic === rozjetyMesic;
        return (
          <div key={m.mesic} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-heading text-muted tabular-nums whitespace-nowrap">
              {m.bonus > 0 ? korunyKratce(m.bonus, jazyk) : ''}
            </span>
            <div
              title={`${nazevMesicePalubovky(m.mesic - 1, jazyk)}: ${koruny(m.bonus, jazyk)}`}
              style={{
                height: `${vyska}%`,
                background: bezi
                  ? 'repeating-linear-gradient(45deg, var(--viz-obrat), var(--viz-obrat) 4px, transparent 4px, transparent 8px)'
                  : 'var(--viz-obrat)',
                border: bezi ? '1px solid var(--viz-obrat)' : undefined,
              }}
              className="w-full rounded-t-md min-h-[2px]"
            />
            <span className="text-[10px] font-heading text-muted capitalize truncate w-full text-center">
              {nazevMesicePalubovky(m.mesic - 1, jazyk).slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
