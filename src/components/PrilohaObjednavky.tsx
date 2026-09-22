'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Text z objednávky v hlavičce projektu (22. 9. 2026): odkaz na přílohu a když
 * se ji nepodařilo dát do složky na Disku, i důvod a tlačítko „zkusit znovu".
 */
export function PrilohaObjednavky({
  orderId,
  nazev,
  naDisku,
  chyba,
  muzeZkusit,
}: {
  orderId: string;
  nazev: string;
  naDisku: boolean;
  chyba: string | null;
  muzeZkusit: boolean;
}) {
  const router = useRouter();
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  async function znovu() {
    setBezi(true);
    setHlaska(null);
    const res = await fetch(`/api/orders/${orderId}/priloha`, { method: 'POST' }).catch(() => null);
    const telo = res ? await res.json().catch(() => ({})) : {};
    setBezi(false);
    if (res?.ok) {
      setHlaska('Nahráno do složky projektu.');
      router.refresh();
    } else setHlaska(telo.error || 'Nepodařilo se.');
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap text-sm font-body">
      <a href={`/api/orders/${orderId}/priloha`} target="_blank" rel="noopener" className="text-brand-purple hover:underline">
        Text z objednávky: {nazev}
      </a>
      {naDisku && <span className="text-xs text-muted">· je ve složce na Disku</span>}
      {!naDisku && chyba && (
        <span className="text-xs text-status-progress">· na Disk se nedostal: {chyba}</span>
      )}
      {!naDisku && muzeZkusit && (
        <button
          type="button"
          onClick={() => void znovu()}
          disabled={bezi}
          className="text-xs font-heading font-semibold text-brand-purple bg-transparent border-0 cursor-pointer disabled:opacity-60"
        >
          {bezi ? 'Nahrávám…' : 'Nahrát do složky na Disku'}
        </button>
      )}
      {hlaska && <span className="text-xs text-muted">{hlaska}</span>}
    </span>
  );
}
