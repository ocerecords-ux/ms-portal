'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Seznam navržených herců pro klienta (22. 10. 2026) - jedno klepnutí na
 * „Vybrat" a je hotovo. Potvrzení je schválně na stránce, ne v mailu: odkaz
 * z mailu otevře i antivir a herce by pak vybral robot (stejné pravidlo jako
 * u schvalování spotu).
 */
export function VyberHerceKlientem({
  token,
  en,
  navrhy,
}: {
  token: string;
  en: boolean;
  navrhy: { id: string; jmeno: string; vybrano: boolean; vybralKdo: string | null }[];
}) {
  const router = useRouter();
  const [pracuje, setPracuje] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const uzVybrano = navrhy.find((n) => n.vybrano) ?? null;

  async function vyber(id: string) {
    if (pracuje) return;
    setPracuje(id);
    setChyba(null);
    try {
      const res = await fetch(`/api/navrhy/${encodeURIComponent(token)}/vybrat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navrhId: id }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || (en ? 'Something went wrong.' : 'Něco se nepovedlo.'));
        return;
      }
      router.refresh();
    } catch {
      setChyba(en ? 'Something went wrong.' : 'Něco se nepovedlo.');
    } finally {
      setPracuje(null);
    }
  }

  if (uzVybrano) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-5 text-center flex flex-col gap-2">
        <h1 className="font-heading font-semibold text-lg text-ink m-0">
          {en ? 'Thanks - we have it.' : 'Díky, máme to.'}
        </h1>
        <p className="text-sm font-body text-muted m-0">
          {en ? 'You picked ' : 'Vybrali jste '}
          <strong className="text-ink">{uzVybrano.jmeno}</strong>
          {en ? '. We will take it from here.' : '. Dál už se o to postaráme.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <p className="text-sm font-body text-muted m-0">
        {en
          ? 'Here are the actors we think fit. Pick the one you want.'
          : 'Tyhle herce jsme pro vás vybrali. Klepněte na toho, kterého chcete.'}
      </p>

      <ul className="list-none m-0 p-0 flex flex-col divide-y divide-line">
        {navrhy.map((n, i) => (
          <li key={n.id} className="flex items-center gap-3 py-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-field text-muted text-xs font-heading font-bold grid place-items-center">
              {i + 1}.
            </span>
            <span className="font-heading font-semibold text-base text-ink truncate">{n.jmeno}</span>
            <button
              type="button"
              onClick={() => void vyber(n.id)}
              disabled={pracuje !== null}
              className="ml-auto shrink-0 rounded-pill bg-brand-green text-onAccent font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {pracuje === n.id ? (en ? 'Sending…' : 'Odesílám…') : en ? 'Pick' : 'Vybrat'}
            </button>
          </li>
        ))}
      </ul>

      {chyba && (
        <p className="text-sm font-body text-danger m-0" role="alert">
          {chyba}
        </p>
      )}

      <p className="text-xs font-body text-muted m-0">
        {en
          ? 'Nothing is binding - if none of them fits, just tell us.'
          : 'Výběr není závazný — kdyby vám nikdo nesedl, dejte nám vědět.'}
      </p>
    </div>
  );
}
