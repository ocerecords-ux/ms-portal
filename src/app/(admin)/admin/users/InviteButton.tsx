'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Odeslani pozvanky uzivateli (zadani 5. 9. 2026) - uzivateli prijde e-mail
 * s odkazem, kde si sam nastavi heslo. Kdyz je SMTP jeste nenastavene, server
 * vrati aspon vygenerovany odkaz, aby ho admin mohl predat rucne.
 */
export function InviteButton({
  userId,
  invitedAtLabel,
  variant = 'link',
}: {
  userId: string;
  invitedAtLabel?: string | null;
  variant?: 'link' | 'button';
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function send() {
    setState('sending');
    setMessage(null);
    setFallbackUrl(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/invite`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setMessage(data?.error || 'Pozvánku se nepodařilo odeslat.');
        if (data?.inviteUrl) setFallbackUrl(data.inviteUrl);
        return;
      }
      setState('sent');
      setMessage(`Pozvánka odeslána na ${data?.sentTo ?? 'e-mail uživatele'}.`);
      router.refresh();
    } catch {
      setState('error');
      setMessage('Pozvánku se nepodařilo odeslat.');
    }
  }

  const label =
    state === 'sending' ? 'Odesílám…' : state === 'sent' ? 'Odesláno' : invitedAtLabel ? 'Poslat znovu' : 'Odeslat pozvánku';

  const className =
    variant === 'button'
      ? 'bg-white border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-60'
      : 'text-brand-purple text-sm font-heading font-semibold hover:underline disabled:opacity-60';

  return (
    <span className={variant === 'button' ? 'flex flex-col gap-2 items-start' : 'inline-flex flex-col items-end gap-1'}>
      <button type="button" onClick={send} disabled={state === 'sending'} className={className} title={invitedAtLabel ? `Naposledy odesláno ${invitedAtLabel}` : undefined}>
        {label}
      </button>
      {message && (
        <span className={`text-xs font-body ${state === 'error' ? 'text-red-600' : 'text-brand-greenDeep'}`}>
          {message}
        </span>
      )}
      {fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="text-xs font-body border border-line rounded px-2 py-1 w-64 max-w-full"
        />
      )}
    </span>
  );
}
