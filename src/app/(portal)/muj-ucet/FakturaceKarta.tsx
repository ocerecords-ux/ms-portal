'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Kam vaší firmě chodí faktury - v profilu klienta (zadání 13. 9. 2026).
 *
 * Totéž je v administraci na kartě firmy; tady si to srovná klient sám, což
 * u větších odběratelů dává smysl: účtárna i lidé u projektů se mění častěji,
 * než to stihne někdo hlásit.
 */
export function FakturaceKarta({
  firma,
  initial,
}: {
  firma: string;
  initial: { contactEmail: string; fakturyKlientovi: boolean };
}) {
  const router = useRouter();
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [fakturyKlientovi, setFakturyKlientovi] = useState(initial.fakturyKlientovi);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/me/fakturace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactEmail, fakturyKlientovi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-ink m-0">Fakturace</h2>
        <p className="text-sm font-body text-muted m-0 mt-1">
          Kam posílat faktury a nabídky pro {firma}.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">E-mail pro faktury</span>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="ucetni@vasefirma.cz"
          className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full max-w-md"
        />
        <span className="text-xs font-body text-muted">Typicky vaše účtárna — sem chodí doklady vždycky.</span>
      </label>

      <label className="flex items-start gap-2 text-sm font-heading text-ink">
        <input
          type="checkbox"
          checked={fakturyKlientovi}
          onChange={(e) => setFakturyKlientovi(e.target.checked)}
          className="mt-0.5"
        />
        {/* Tady to cte clovek o sobe, ne o kolegovi (zadani 13. 9. 2026:
            „tady bych to v te klientske sekci zkopiroval spise: Chci kopii
            i na svuj mail"). V administraci na karte firmy zustava popisek
            ve treti osobe - tam to nastavuje nekdo jiny. */}
        <span>
          Chci kopii i na svůj mail
          <br />
          <span className="text-xs font-body text-muted">
            Kopie přijde na váš e-mail u projektů, kde jste uvedený jako klient. Na účtárnu jde
            faktura vždycky.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-danger m-0">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        {saved && <span className="text-sm font-body text-muted">Uloženo.</span>}
      </div>
    </div>
  );
}
