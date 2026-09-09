'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/calendar';

type Notifikace = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Zvonek v horní liště (zadani 8. 9. 2026). Seznam se načte až při otevření —
 * kdyby visel v layoutu, tahal by se při každém zobrazení jakékoliv stránky.
 * Počet nepřečtených přijde ze serveru s vykreslením stránky.
 */
export function NotificationBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notifikace[] | null>(null);
  const [pocet, setPocet] = useState(unread);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setPocet(unread), [unread]);

  useEffect(() => {
    function mimo(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, []);

  async function otevri() {
    const dalsi = !open;
    setOpen(dalsi);
    if (!dalsi) return;
    try {
      const res = await fetch('/api/notifikace');
      const data = await res.json().catch(() => ({}));
      setItems(data?.notifikace ?? []);
      if ((data?.notifikace ?? []).some((n: Notifikace) => !n.readAt)) {
        await fetch('/api/notifikace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        setPocet(0);
      }
    } catch {
      setItems([]);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={otevri}
        title="Oznámení"
        aria-label={pocet > 0 ? `Oznámení: ${pocet} nepřečtených` : 'Oznámení'}
        className="relative flex items-center justify-center w-9 h-9 rounded-pill text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {pocet > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
            {pocet}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] max-h-[60vh] overflow-y-auto bg-surface border border-line rounded-card shadow-xl z-50 p-2">
          {items === null && <p className="text-sm font-body text-muted m-0 px-3 py-3">Načítám…</p>}
          {items !== null && items.length === 0 && (
            <p className="text-sm font-body text-muted m-0 px-3 py-3">Zatím tu nic není.</p>
          )}
          {items?.map((n) => {
            const obsah = (
              <>
                <span className="block text-sm font-heading font-semibold text-ink">{n.title}</span>
                {n.body && <span className="block text-xs font-body text-muted mt-0.5">{n.body}</span>}
                <span className="block text-[11px] font-body text-muted mt-1 tabular-nums">
                  {formatDateTime(n.createdAt)}
                </span>
              </>
            );
            return (
              <div key={n.id} className={`rounded-lg px-3 py-2.5 ${n.readAt ? '' : 'bg-tint'}`}>
                {n.url ? (
                  <Link href={n.url} onClick={() => setOpen(false)} className="no-underline block">
                    {obsah}
                  </Link>
                ) : (
                  obsah
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
