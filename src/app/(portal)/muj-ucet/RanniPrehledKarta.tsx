'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '../components/JazykProvider';

/**
 * PŘEHLED DNE A PŘIPOMÍNKY (zadání 23. 9. 2026: „chtěl bych, aby mi Bruno
 * sesumíroval události na daný den… v sedm ráno" + upřesnění „ať se mi
 * v portálu otevře průhledné vyskakovací okno … a Bruno mi to připomene
 * zprávou 15 min. před událostí").
 *
 * Jeden přepínač na obojí: kdo chce hlídat den, chce i štouchnutí před
 * natáčením. Ukládá se hned, bez tlačítka.
 */
export function RanniPrehledKarta({ initial }: { initial: boolean }) {
  const t = usePreklad();
  const router = useRouter();
  const [zapnuto, setZapnuto] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uloz(hodnota: boolean) {
    setZapnuto(hodnota);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/me/upozorneni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranniPrehled: hodnota }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('mujUcet.chybaUlozeni'));
        setZapnuto(!hodnota);
        return;
      }
      router.refresh();
    } catch {
      setError(t('mujUcet.chybaUlozeni'));
      setZapnuto(!hodnota);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">{t('mujUcet.prehledDne')}</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">{t('mujUcet.prehledDnePopis')}</p>
      </div>

      <label className="flex items-start gap-2 text-sm font-heading text-ink">
        <input
          type="checkbox"
          checked={zapnuto}
          disabled={saving}
          onChange={(e) => void uloz(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t('mujUcet.hlidatDen')}
          <br />
          <span className="text-xs font-body text-muted">{t('mujUcet.hlidatDenPopis')}</span>
        </span>
      </label>

      {error && <p className="text-sm text-danger m-0">{error}</p>}
    </div>
  );
}
