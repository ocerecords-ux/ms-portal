'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDatumCas, prelozit, prelozitS, prelozitKolem, type Jazyk } from '@/lib/jazyk';

/**
 * Schválení nabídky klientem (zadani 6. 9. 2026: "tlačítko na schválení pro
 * klienta"). Klient je tady bez přihlášení, takže mu jen řekneme, kdo
 * schvaluje, a jedním tlačítkem je hotovo.
 */
export function OfferApproval({
  token,
  status,
  approvedByName,
  approvedAt,
  rejectedAt,
  issuerName,
  issuerEmail,
  jazyk,
}: {
  token: string;
  status: string;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  issuerName: string;
  issuerEmail: string | null;
  /** Veřejná stránka stojí mimo JazykProvider - jazyk chodí propem. */
  jazyk: Jazyk;
}) {
  const t = (klic: string, hodnoty?: Record<string, string | number>) =>
    hodnoty ? prelozitS(jazyk, klic, hodnoty) : prelozit(jazyk, klic);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function formatDateTime(iso: string | null): string {
    return iso ? formatDatumCas(jazyk, new Date(iso), '') : '';
  }

  /**
   * Schválení jedním tlačítkem (zadání 13. 9. 2026: „nech tam jen to tlačítko
   * Schvaluji nabídku"). Políčko na jméno ani odmítnutí tu už nejsou — kdo
   * nabídku nechce, ozve se člověku, se kterým ji domlouval, ne tlačítkem.
   */
  async function send(action: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/nabidka/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('nabidkaVerejna.chyba'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('nabidkaVerejna.chyba'));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'APPROVED') {
    return (
      <div className="bg-okTint border border-line rounded-card p-6 text-center">
        <p className="font-display text-2xl text-ink m-0">{t('nabidkaVerejna.schvalena')}</p>
        <p className="text-sm font-body text-muted m-0 mt-2">
          {approvedByName
            ? t('nabidkaVerejna.schvalilKdo', { jmeno: approvedByName, kdy: formatDateTime(approvedAt) })
            : t('nabidkaVerejna.schvalenoKdy', { kdy: formatDateTime(approvedAt) })}
        </p>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="bg-surface border border-line rounded-card p-6 text-center flex flex-col gap-3">
        <div>
          <p className="font-display text-2xl text-ink m-0">{t('nabidkaVerejna.odmitnuta')}</p>
          <p className="text-sm font-body text-muted m-0 mt-2">
            {issuerEmail ? (
              /* Adresa uvnitř věty je odkaz, proto se věta dělí kolem značky. */
              (() => {
                const [pred, po] = prelozitKolem(jazyk, 'nabidkaVerejna.odmitnutaMail', 'email', {
                  kdy: formatDateTime(rejectedAt),
                });
                return (
                  <>
                    {pred}
                    <a href={`mailto:${issuerEmail}`} className="text-brand-purple">
                      {issuerEmail}
                    </a>
                    {po}
                  </>
                );
              })()
            ) : (
              t('nabidkaVerejna.odmitnutaFirma', { kdy: formatDateTime(rejectedAt), firma: issuerName })
            )}
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => send('approve')}
            disabled={busy}
            className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-60"
          >
            {t('nabidkaVerejna.preceJenSchvalit')}
          </button>
        </div>
        {error && <p className="text-sm text-danger m-0">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-6 flex flex-col gap-4">
      {error && <p className="text-sm text-danger m-0">{error}</p>}

      <div>
        <button
          type="button"
          onClick={() => send('approve')}
          disabled={busy}
          className="bg-brand-green text-onAccent font-heading font-semibold text-base rounded-lg px-6 py-3 hover:brightness-95 transition-[filter] disabled:opacity-60"
        >
          {t(busy ? 'nabidkaVerejna.ukladam' : 'nabidkaVerejna.schvaluji')}
        </button>
      </div>
    </div>
  );
}
