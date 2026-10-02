'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROMENNE_NATACENI, VYCHOZI_VZOR_NATACENI } from '@/lib/nataceniText';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * VZORY NATÁČECÍCH TEXTŮ (zadání 26. 9. 2026: „měli bychom nějaké vzory pro
 * natáčení, kde by bylo jasně označené, jak se spot jmenuje a jakou má délku
 * a pro jakou licenci").
 *
 * Dvě pole na vzor: ÚVOD se do dokumentu napíše jednou nahoře, BLOK se
 * zopakuje u každého výstupu. Proměnné se dosadí při vyrábění dokumentu -
 * tady se jen píšou, stejně jako u vzorů zpráv klientovi.
 */

export type VzorNataceniRadek = {
  id: string;
  nazev: string;
  uvod: string | null;
  blok: string;
  vychozi: boolean;
};

const inputClass =
  'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple';

export function VzoryNataceniEditor({ pocatecni }: { pocatecni: VzorNataceniRadek[] }) {
  const router = useRouter();
  const t = usePreklad();
  const [vzory, setVzory] = useState<VzorNataceniRadek[]>(pocatecni);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [ulozeno, setUlozeno] = useState<string | null>(null);

  function zmen(id: string, zmena: Partial<VzorNataceniRadek>) {
    setVzory((s) => s.map((v) => (v.id === id ? { ...v, ...zmena } : v)));
    setUlozeno(null);
  }

  async function uloz(vzor: VzorNataceniRadek) {
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/vzory-nataceni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: vzor.id.startsWith('novy-') ? undefined : vzor.id,
          nazev: vzor.nazev,
          uvod: vzor.uvod ?? '',
          blok: vzor.blok,
          vychozi: vzor.vychozi,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba((data as { error?: string })?.error || t('vzoryNat.neulozeno'));
        return;
      }
      setUlozeno(vzor.id);
      router.refresh();
    } catch {
      setChyba(t('vzoryNat.neulozeno'));
    } finally {
      setPracuje(false);
    }
  }

  async function vyrad(id: string) {
    if (id.startsWith('novy-')) {
      setVzory((s) => s.filter((v) => v.id !== id));
      return;
    }
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/vzory-nataceni?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setChyba(t('vzoryNat.nevyrazeno'));
        return;
      }
      setVzory((s) => s.filter((v) => v.id !== id));
      router.refresh();
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-2">
        <span className="font-heading font-semibold text-sm text-ink">{t('vzoryNat.promenne')}</span>
        <div className="flex flex-wrap gap-2">
          {PROMENNE_NATACENI.map((p) => (
            <span
              key={p.klic}
              title={t(`promennaNat.${p.klic}`)}
              className="rounded-pill border border-line bg-field px-2.5 py-1 text-xs font-heading text-muted"
            >
              {`{{${p.klic}}}`}
            </span>
          ))}
        </div>
        <p className="text-xs font-body text-muted m-0">
          {t('vzoryNat.promennePopis', { znacka: '{{delka}}' })}
        </p>
      </div>

      {chyba && (
        <p className="text-sm font-body text-status-error m-0" role="alert">
          {chyba}
        </p>
      )}

      {vzory.map((vzor) => (
        <div key={vzor.id} className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={vzor.nazev}
              onChange={(e) => zmen(vzor.id, { nazev: e.target.value })}
              placeholder={t('vzoryNat.nazevVzoru')}
              className={`${inputClass} flex-1 min-w-[200px]`}
            />
            <label className="flex items-center gap-2 text-sm font-body text-ink">
              <input
                type="checkbox"
                checked={vzor.vychozi}
                onChange={(e) => zmen(vzor.id, { vychozi: e.target.checked })}
              />
              {t('vzoryNat.vychozi')}
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('vzoryNat.uvodDokumentu')}</span>
            <textarea
              value={vzor.uvod ?? ''}
              onChange={(e) => zmen(vzor.id, { uvod: e.target.value })}
              rows={4}
              placeholder={t('vzoryNat.uvodPlaceholder')}
              className={`${inputClass} font-body`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('vzoryNat.blokSpotu')}</span>
            <textarea
              value={vzor.blok}
              onChange={(e) => zmen(vzor.id, { blok: e.target.value })}
              rows={6}
              placeholder={VYCHOZI_VZOR_NATACENI.blok}
              className={`${inputClass} font-body`}
            />
            <span className="text-xs font-body text-muted">{t('vzoryNat.blokHint')}</span>
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => uloz(vzor)}
              disabled={pracuje}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-sm px-5 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {t('vzoryNat.ulozitVzor')}
            </button>
            {ulozeno === vzor.id && (
              <span className="text-sm font-body text-brand-greenDeep">{t('vzoryNat.ulozeno')}</span>
            )}
            <button
              type="button"
              onClick={() => vyrad(vzor.id)}
              disabled={pracuje}
              className="ml-auto text-sm font-heading text-muted bg-transparent border-0 underline cursor-pointer hover:text-status-error"
            >
              {t('vzoryNat.vyradit')}
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setVzory((s) => [
            ...s,
            {
              id: `novy-${Date.now()}`,
              nazev: '',
              uvod: VYCHOZI_VZOR_NATACENI.uvod,
              blok: VYCHOZI_VZOR_NATACENI.blok,
              vychozi: s.length === 0,
            },
          ])
        }
        className="self-start rounded-pill border border-dashed border-line px-4 py-2 text-sm font-heading text-muted bg-transparent cursor-pointer hover:text-brand-purple hover:border-brand-purple transition-colors"
      >
        {t('vzoryNat.pridatVzor')}
      </button>
    </div>
  );
}
