'use client';

import { useState } from 'react';
import { smazZCesty, stahniNaCestu, stazeneAdresy } from '@/lib/preposlechOffline';

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

function mb(bajtu: number): string {
  if (bajtu >= 1024 ** 3) return `${(bajtu / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
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
    if (!vysledek.ok) setChyba(vysledek.chyba ?? 'Stažení se nepovedlo.');
    onStazene(await stazeneAdresy(soubory.map((s) => s.url)));
  }

  async function smaz() {
    await smazZCesty(soubory.map((s) => s.url));
    setMazat(false);
    onStazene(new Set());
  }

  const stitek = !online
    ? `Offline${cekaZapisu > 0 ? ` · ${cekaZapisu} čeká` : ''}`
    : prubeh
      ? `Stahuji ${prubeh.hotovo}/${prubeh.celkem}`
      : vse
        ? '✓ Poslouchat offline'
        : '⬇ Poslouchat offline';

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOtevreno((v) => !v)}
        title="Stáhnout nahrávky a text do počítače a pracovat bez signálu"
        className={`font-heading font-semibold text-[11px] rounded-lg border px-2.5 py-1 transition-colors ${
          !online ? 'border-status-progress bg-status-progress/40' : 'border-white/40 hover:border-white'
        }`}
      >
        {stitek}
        {online && cekaZapisu > 0 && <span className="text-white/70"> · {cekaZapisu} čeká</span>}
      </button>
      {otevreno && (
        <div className="absolute right-0 top-full mt-2 z-[70] w-[340px] max-w-[90vw] bg-surface text-ink rounded-card border border-line shadow-xl p-4 flex flex-col gap-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-heading font-semibold text-sm m-0">Poslech bez signálu</h3>
            <button type="button" onClick={() => setOtevreno(false)} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
              ×
            </button>
          </div>

          <p className="text-xs font-body text-muted m-0">
            Než budete mimo signál, stáhněte si nahrávky a text do tohoto prohlížeče. Pak jde poslouchat, číst
            i psát poznámky offline — odešlou se samy, jakmile bude signál zpátky.
          </p>

          <div className="text-sm font-body">
            {soubory.length === 0 ? (
              <span className="text-muted">Zatím tu není nic ke stažení.</span>
            ) : vse ? (
              <span className="text-status-done font-semibold">✓ Všechno je stažené ({soubory.length} souborů).</span>
            ) : (
              <span>
                Ke stažení: {zbyva.length} z {soubory.length} souborů
                {velikostZbyva > 0 ? ` · asi ${mb(velikostZbyva)}` : ''}
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
                Stahuji {prubeh.hotovo} z {prubeh.celkem}… nechte okno otevřené.
              </span>
            </div>
          )}

          {!online && (
            <p className="text-xs font-body m-0 rounded-lg bg-tint text-ink border border-status-progress px-3 py-2">
              Jste offline. {cekaZapisu > 0 ? `${cekaZapisu} zápisů čeká a odejde samo se signálem.` : 'Všechno máte uložené.'}
            </p>
          )}
          {online && cekaZapisu > 0 && (
            <button type="button" onClick={onOdeslat} className="self-start text-xs font-heading font-semibold text-brand-purple hover:underline">
              Odeslat {cekaZapisu} čekajících zápisů
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
                {nejakeStazene ? 'Stáhnout zbytek' : `Stáhnout pro offline${velikost > 0 ? ` (${mb(velikost)})` : ''}`}
              </button>
            )}
            {nejakeStazene && !prubeh && (
              <button
                type="button"
                onClick={() => (mazat ? void smaz() : setMazat(true))}
                className="text-xs font-heading font-semibold text-danger hover:underline"
              >
                {mazat ? 'Opravdu smazat z počítače?' : 'Smazat z počítače'}
              </button>
            )}
          </div>

          <p className="text-[11px] font-body text-muted m-0">
            Tip: odkaz si otevřete ještě se signálem a pak ho už nezavírejte. Když přibudou nové stopy, stáhněte
            zbytek znovu.
          </p>
        </div>
      )}
    </span>
  );
}
