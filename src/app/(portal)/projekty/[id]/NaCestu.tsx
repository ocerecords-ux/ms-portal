'use client';

import { useState } from 'react';
import { smazZCesty, stahniNaCestu, stazeneAdresy } from '@/lib/preposlechOffline';
import type { Jazyk } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * „POSLOUCHAT OFFLINE" (do 21. 9. 2026 „Na cestu") - AudioTagger bez signálu (zadání 21. 9. 2026: „bylo by super
 * přidat možnost, aby mohl klient v AudioTaggeru pracovat offline, když bude
 * vědět, že bude mimo signál").
 *
 * Tlačítko v hlavičce: stáhne všechny nahrávky a text do počítače. Pak se
 * dá poslouchat, číst i psát poznámky bez připojení; co se napíše, odejde
 * samo, jakmile je signál zpátky. Ukazuje i to, že je člověk offline a kolik
 * zápisů čeká.
 */
type Soubor = { url: string; velikost: number | null; nazev: string };

/** Velikost souborů. Česky s desetinnou čárkou, anglicky s tečkou (pravidlo 3). */
function mb(bajtu: number, jazyk: Jazyk): string {
  if (bajtu >= 1024 ** 3) {
    const gb = (bajtu / 1024 ** 3).toFixed(1);
    return `${jazyk === 'en' ? gb : gb.replace('.', ',')} GB`;
  }
  return `${Math.max(1, Math.round(bajtu / 1024 ** 2))} MB`;
}

export function NaCestu({
  soubory,
  stazene,
  onStazene,
  online,
  cekaZapisu,
  onOdeslat,
}: {
  soubory: Soubor[];
  stazene: Set<string>;
  onStazene: (nove: Set<string>) => void;
  online: boolean;
  cekaZapisu: number;
  onOdeslat: () => void;
}) {
  const jazyk = useJazyk();
  const t = usePreklad();
  const [otevreno, setOtevreno] = useState(false);
  const [prubeh, setPrubeh] = useState<{ hotovo: number; celkem: number } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [mazat, setMazat] = useState(false);

  const vse = soubory.length > 0 && soubory.every((s) => stazene.has(s.url));
  const nejakeStazene = soubory.some((s) => stazene.has(s.url));
  const velikost = soubory.reduce((a, s) => a + (s.velikost ?? 0), 0);
  const zbyva = soubory.filter((s) => !stazene.has(s.url));
  const velikostZbyva = zbyva.reduce((a, s) => a + (s.velikost ?? 0), 0);

  async function stahni() {
    setChyba(null);
    setPrubeh({ hotovo: 0, celkem: soubory.length });
    const vysledek = await stahniNaCestu(
      soubory.map((s) => s.url),
      (hotovo, celkem) => setPrubeh({ hotovo, celkem }),
    );
    setPrubeh(null);
    if (!vysledek.ok) setChyba(vysledek.chyba ?? t('naCestu.nepovedlo'));
    onStazene(await stazeneAdresy(soubory.map((s) => s.url)));
  }

  async function smaz() {
    await smazZCesty(soubory.map((s) => s.url));
    setMazat(false);
    onStazene(new Set());
  }

  const stitek = !online
    ? cekaZapisu > 0
      ? t('naCestu.offlineCeka', { pocet: cekaZapisu })
      : t('naCestu.offline')
    : prubeh
      ? t('naCestu.stahuji', { hotovo: prubeh.hotovo, celkem: prubeh.celkem })
      : vse
        ? t('naCestu.stazeno')
        : t('naCestu.stahnoutStitek');

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOtevreno((v) => !v)}
        title={t('naCestu.bublina')}
        className={`font-heading font-semibold text-[11px] rounded-lg border px-2.5 py-1 transition-colors ${
          !online ? 'border-status-progress bg-status-progress/40' : 'border-white/40 hover:border-white'
        }`}
      >
        {stitek}
        {online && cekaZapisu > 0 && (
          <span className="text-white/70">{t('naCestu.cekaZa', { pocet: cekaZapisu })}</span>
        )}
      </button>
      {otevreno && (
        <div className="absolute right-0 top-full mt-2 z-[70] w-[340px] max-w-[90vw] bg-surface text-ink rounded-card border border-line shadow-xl p-4 flex flex-col gap-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-heading font-semibold text-sm m-0">{t('naCestu.nadpis')}</h3>
            <button type="button" onClick={() => setOtevreno(false)} aria-label={t('naCestu.zavrit')} className="text-muted hover:text-ink text-lg leading-none">
              ×
            </button>
          </div>

          <p className="text-xs font-body text-muted m-0">
            {t('naCestu.uvod')}
          </p>

          <div className="text-sm font-body">
            {soubory.length === 0 ? (
              <span className="text-muted">{t('naCestu.nicKeStazeni')}</span>
            ) : vse ? (
              <span className="text-status-done font-semibold">
                {t('naCestu.vseStazene', { pocet: soubory.length })}
              </span>
            ) : (
              <span>
                {t('naCestu.keStazeni', { zbyva: zbyva.length, celkem: soubory.length })}
                {velikostZbyva > 0
                  ? t('naCestu.asiVelikost', { velikost: mb(velikostZbyva, jazyk) })
                  : ''}
              </span>
            )}
          </div>

          {prubeh && (
            <div className="flex flex-col gap-1">
              <div className="h-1.5 rounded-full bg-field border border-line overflow-hidden">
                <div
                  className="h-full bg-brand-purple transition-all"
                  style={{ width: `${Math.round((prubeh.hotovo / Math.max(1, prubeh.celkem)) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-body text-muted">
                {t('naCestu.prubeh', { hotovo: prubeh.hotovo, celkem: prubeh.celkem })}
              </span>
            </div>
          )}

          {!online && (
            <p className="text-xs font-body m-0 rounded-lg bg-tint text-ink border border-status-progress px-3 py-2">
              {t('naCestu.jsteOffline')}
              {cekaZapisu > 0
                ? t('naCestu.zapisyCekaji', { pocet: cekaZapisu })
                : t('naCestu.vseUlozeno')}
            </p>
          )}
          {online && cekaZapisu > 0 && (
            <button type="button" onClick={onOdeslat} className="self-start text-xs font-heading font-semibold text-brand-purple hover:underline">
              {t('naCestu.odeslatCekajici', { pocet: cekaZapisu })}
            </button>
          )}

          {chyba && <p className="text-xs text-danger m-0">{chyba}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            {!vse && soubory.length > 0 && (
              <button
                type="button"
                disabled={Boolean(prubeh) || !online}
                onClick={() => void stahni()}
                className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-2 disabled:opacity-50"
              >
                {nejakeStazene
                  ? t('naCestu.stahnoutZbytek')
                  : velikost > 0
                    ? t('naCestu.stahnoutProOfflineVel', { velikost: mb(velikost, jazyk) })
                    : t('naCestu.stahnoutProOffline')}
              </button>
            )}
            {nejakeStazene && !prubeh && (
              <button
                type="button"
                onClick={() => (mazat ? void smaz() : setMazat(true))}
                className="text-xs font-heading font-semibold text-danger hover:underline"
              >
                {mazat ? t('naCestu.opravduSmazat') : t('naCestu.smazatZPocitace')}
              </button>
            )}
          </div>

          <p className="text-[11px] font-body text-muted m-0">
            {t('naCestu.tip')}
          </p>
        </div>
      )}
    </span>
  );
}
