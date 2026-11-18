'use client';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { CasProjektu as CasData } from '@/lib/casProjektuServer';

/**
 * KOLIK ČASU UŽ KNIHA SNĚDLA (zadání 17. 11. 2026: „zásadní to počítat z těch
 * hodin, abychom věděli, jestli nad tím zvukaři netráví zbytečně moc času.
 * V penězích je tam nastavená vždy i nějaká rezerva totiž").
 *
 * ŽÁDNÉ KORUNY. Vidí to i zvukař, a ten do peněz vidět nemá - proto sem
 * nechodí ani sazba, ani částka, ani kdo kolik stojí (viz
 * lib/casProjektuServer.ts, který vybírá jen minuty a druh práce).
 *
 * PROČ TO NENÍ SOUČÁST ROZPOČTU: rozpočet v korunách se liší podle toho, kdo
 * knihu dělá - sazby nejsou stejné a je v nich rezerva. Hodiny jsou pro
 * všechny tytéž, takže jen podle nich jde poznat, jestli se nad knihou
 * nesedí zbytečně dlouho.
 */
export function CasProjektu({ cas }: { cas: CasData }) {
  const t = usePreklad();
  const procenta = cas.plan > 0 ? Math.round((cas.celkem / cas.plan) * 100) : 0;
  const pres = cas.celkem > cas.plan;
  const zbyva = Math.max(0, cas.plan - cas.celkem);

  const h = (hodin: number) => t('cas.hodin', { pocet: hodin.toFixed(1).replace('.', ',') });

  const radek = (klic: string, hodin: number) =>
    hodin > 0 ? (
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-body text-muted">{t(klic)}</span>
        <span className="text-xs font-heading text-ink tabular-nums">{h(hodin)}</span>
      </span>
    ) : null;

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-heading font-semibold text-sm text-ink m-0">{t('cas.nadpis')}</p>
        <p className="text-xs font-body text-muted m-0">{t('cas.popis')}</p>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <span className="font-display text-2xl text-ink leading-none tabular-nums">
          {h(cas.celkem)}
        </span>
        <span className="text-sm font-heading text-muted tabular-nums">
          {t('cas.zPlanu', { plan: h(cas.plan) })}
        </span>
      </div>

      {/* Pruh: zelený, dokud se do plánu vejdeme, červený, když ne. Na zelené
          nikdy bílé písmo - tady na ní žádné není, jen plocha. */}
      <span className="block h-2 rounded-pill bg-field overflow-hidden">
        <span
          className={`block h-full rounded-pill ${pres ? 'bg-danger' : 'bg-status-done'}`}
          style={{ width: `${Math.min(100, procenta)}%` }}
        />
      </span>

      <p className={`text-xs font-heading m-0 ${pres ? 'text-danger' : 'text-muted'}`}>
        {pres
          ? t('cas.prekroceno', { pocet: h(cas.celkem - cas.plan) })
          : t('cas.zbyva', { pocet: h(zbyva), procenta })}
      </p>

      {cas.celkem > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          {radek('cas.nataceni', cas.nataceni)}
          {radek('cas.strih', cas.strih)}
          {radek('cas.opravy', cas.opravy)}
          {radek('cas.ostatni', cas.ostatni)}
        </div>
      )}
    </div>
  );
}
