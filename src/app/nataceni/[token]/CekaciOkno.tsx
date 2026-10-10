'use client';

import { useEffect, useState } from 'react';
import { prelozit, prelozitS, type Jazyk } from '@/lib/jazyk';

/**
 * ODPOČET A SOUHRN. Počítá se v prohlížeči, protože na serveru by zmrzl na
 * čase vykreslení - stránka má u klienta běžet otevřená klidně půl hodiny.
 *
 * VTEŘINY UTÍKAJÍ POŘÁD (10. 10. 2026: „měly by tam utíkat vteřiny, ať je to
 * víc napínavé"). Stojící číslo vypadá jako zamrzlá stránka; běžící vteřiny
 * říkají, že se opravdu čeká na něco, co začne.
 *
 * TLAČÍTKO SE PROBARVÍ AŽ V ČASE, ne dřív (10. 10. 2026) - zelená je signál
 * „teď", ne „za chvíli". Po konci odpočet zmizí a odkaz zůstane, natáčení se
 * běžně protáhne.
 *
 * CO TU NENÍ: adresa, parkování ani mapa (10. 10. 2026). Kdo je na téhle
 * stránce, připojuje se na dálku - cestu a parkování má v pozvánce a tady by
 * mu jen zabíraly obrazovku.
 */
export function CekaciOkno({
  jazyk,
  zacatek,
  konec,
  pasmo,
  herec,
  hovorOdkaz,
}: {
  jazyk: Jazyk;
  zacatek: string;
  konec: string;
  pasmo: string;
  herec: string | null;
  hovorOdkaz: string | null;
}) {
  const t = (klic: string, hodnoty?: Record<string, string | number>) =>
    hodnoty ? prelozitS(jazyk, klic, hodnoty) : prelozit(jazyk, klic);

  /**
   * `null` do prvního vykreslení v prohlížeči: server a prohlížeč by se
   * v odpočtu nikdy neshodly a React by hlásil nesoulad.
   */
  const [ted, setTed] = useState<number | null>(null);
  useEffect(() => {
    setTed(Date.now());
    const id = window.setInterval(() => setTed(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = new Date(zacatek).getTime();
  const end = new Date(konec).getTime();
  const zbyva = ted === null ? null : start - ted;
  const bezi = ted !== null && ted >= start && ted <= end;
  const doslo = ted !== null && ted > end;

  const kod = jazyk === 'en' ? 'en-GB' : 'cs-CZ';
  const den = new Intl.DateTimeFormat(kod, {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: pasmo,
  }).format(new Date(zacatek));
  const cas = (iso: string) =>
    new Intl.DateTimeFormat(kod, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: pasmo }).format(
      new Date(iso),
    );

  const radky: { popisek: string; hodnota: string }[] = [];
  if (herec?.trim()) radky.push({ popisek: t('cekarna.herec'), hodnota: herec.trim() });
  radky.push({ popisek: t('cekarna.kdy'), hodnota: `${den}, ${cas(zacatek)}–${cas(konec)}` });

  return (
    <div className="flex flex-col gap-6">
      {/* ODPOČET. Dokud je čas, je to hlavní věc na stránce - klient hned vidí,
          že nikam nespěchá a že je ve správný den. */}
      <div
        className={`rounded-card border px-6 py-8 text-center transition-colors ${
          bezi ? 'border-brand-green bg-brand-green/10' : 'border-line bg-surface'
        }`}
      >
        {ted === null ? (
          <p className="font-heading text-sm text-muted m-0">{t('cekarna.nacitam')}</p>
        ) : doslo ? (
          <p className="font-heading text-base text-ink m-0">{t('cekarna.poKonci')}</p>
        ) : zbyva !== null && zbyva > 0 ? (
          <>
            <p className="text-xs font-heading text-brand-green uppercase tracking-[0.2em] m-0">
              {t('cekarna.zacneZa')}
            </p>
            <p className="font-display text-4xl sm:text-6xl text-brand-green m-0 mt-3 tabular-nums leading-none">
              {odpocet(zbyva)}
            </p>
          </>
        ) : (
          <p className="font-display text-3xl sm:text-4xl text-brand-green m-0">{t('cekarna.prave')}</p>
        )}
      </div>

      {hovorOdkaz && (
        <div className="flex flex-col gap-2">
          <a
            href={hovorOdkaz}
            target="_blank"
            rel="noopener noreferrer"
            className={`block text-center rounded-pill px-6 py-4 font-heading font-semibold text-base no-underline transition-colors ${
              bezi
                ? 'bg-brand-green text-brand-purpleDark hover:bg-brand-greenDeep'
                : 'bg-brand-purple text-white hover:bg-brand-purpleDeep'
            }`}
          >
            {t('cekarna.pripojit')}
          </a>
          {/* Odkaz i textem - kdyby tlačítko neotevřelo nové okno, klient si ho
              zkopíruje. Kvůli naší mezistránce nesmí nikdo zmeškat natáčení. */}
          <p className="text-xs font-body text-muted m-0 text-center break-all">
            {t('cekarna.odkazRucne')}{' '}
            <a href={hovorOdkaz} target="_blank" rel="noopener noreferrer" className="text-brand-purple">
              {hovorOdkaz}
            </a>
          </p>
        </div>
      )}

      <dl className="m-0 rounded-card border border-line bg-surface divide-y divide-line">
        {radky.map((r) => (
          <div key={r.popisek} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-5 py-3">
            <dt className="text-xs font-heading text-brand-green uppercase tracking-wide sm:w-32 shrink-0 m-0">
              {r.popisek}
            </dt>
            <dd className="text-sm font-body text-ink m-0">{r.hodnota}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs font-body text-muted m-0">{t('cekarna.kdyzNeco')}</p>
    </div>
  );
}

/**
 * „2 d 14 h 43 m 12 s" - vteřiny vidět vždycky, i když zbývají hodiny. Jednotky
 * jsou zkratky: v obou jazycích stejné a v jednom řádku se vejdou i na telefon.
 */
function odpocet(ms: number): string {
  const celkem = Math.floor(ms / 1000);
  const dny = Math.floor(celkem / 86_400);
  const hodiny = Math.floor((celkem % 86_400) / 3600);
  const minuty = Math.floor((celkem % 3600) / 60);
  const vteriny = celkem % 60;
  const dvojmistne = (n: number) => String(n).padStart(2, '0');

  if (dny > 0) return `${dny} d ${hodiny} h ${dvojmistne(minuty)} m ${dvojmistne(vteriny)} s`;
  if (hodiny > 0) return `${hodiny} h ${dvojmistne(minuty)} m ${dvojmistne(vteriny)} s`;
  if (minuty > 0) return `${minuty} m ${dvojmistne(vteriny)} s`;
  return `${vteriny} s`;
}
