'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * NAČTENÍ TECHNICKÝCH PARAMETRŮ DO PROCESŮ (zadání 28. 9. 2026).
 *
 * Sady se dál mění v Administraci; tohle z nich udělá články ke čtení. Běží
 * to na stisk, ne samo - článek se přepisuje celý a nemá se to dít někomu
 * pod rukama uprostřed porady.
 */
export function NacistParametry() {
  const router = useRouter();
  const t = usePreklad();
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);

  async function nacti() {
    if (bezi) return;
    setBezi(true);
    setZprava(null);
    try {
      const res = await fetch('/api/admin/procesy/z-parametru', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setZprava(data?.error || t('procesyAdmin.parametryNejdou'));
        return;
      }
      setZprava(
        t(data.zalozeno ? 'procesyAdmin.hotovoZalozen' : 'procesyAdmin.hotovoPrepsan', {
          celkem: data.celkem,
        }) +
          (data.uklizeno ? t('procesyAdmin.uklizeno', { pocet: data.uklizeno }) : '') +
          '.',
      );
      router.refresh();
    } catch {
      setZprava(t('procesyAdmin.parametryNejdou'));
    } finally {
      setBezi(false);
    }
  }

  return (
    <span className="flex items-center gap-3 flex-wrap">
      {zprava && <span className="text-xs font-body text-muted">{zprava}</span>}
      <button
        type="button"
        onClick={() => void nacti()}
        disabled={bezi}
        title={t('procesyAdmin.bublinaParametry')}
        className="text-sm font-heading font-semibold rounded-pill border border-line bg-surface px-4 py-2 text-brand-purple disabled:opacity-60 hover:border-brand-purple"
      >
        {bezi ? t('procesyAdmin.nacitam') : t('procesyAdmin.nacistParametry')}
      </button>
    </span>
  );
}
