'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PodpisVyber } from '@/app/(admin)/admin/doklady/smlouvy/PodpisVyber';

/**
 * Vlastní podpis na smlouvy (zadání 15. 9. 2026: „ve chvíli, kdy posíláme
 * smlouvu k podpisu, je z naší strany už za Karolínu podepsaná").
 *
 * Kdo za Mediaspace smlouvy podepisuje, uloží si podpis jednou tady a portál
 * ho pak k odesílané smlouvě připojí sám. Bez uloženého podpisu se ve smlouvě
 * vypíše jméno psaným písmem - doložka (čas, IP, otisk textu) je v obou
 * případech stejná.
 */
export function PodpisKarta({
  ulozeny,
  jmeno,
  podepisujeSmlouvy,
}: {
  ulozeny: string | null;
  jmeno: string;
  /** Má tenhle člověk zaškrtnuté „podepisuje smlouvy za Mediaspace"? */
  podepisujeSmlouvy: boolean;
}) {
  const router = useRouter();
  const [upravuje, setUpravuje] = useState(false);
  const [podpis, setPodpis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function posli(telo: Record<string, unknown>) {
    setBusy(true);
    setChyba(null);
    try {
      const res = await fetch('/api/me/podpis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Podpis se nepodařilo uložit.');
        return;
      }
      setUpravuje(false);
      setPodpis(null);
      router.refresh();
    } catch {
      setChyba('Podpis se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Můj podpis na smlouvy
        </h2>
        <p className="text-xs font-body text-muted m-0 mt-1">
          {podepisujeSmlouvy
            ? 'Smlouvy za Mediaspace podepisujete vy — tímhle podpisem odcházejí klientům.'
            : 'Uloží se k účtu. Použije se, až budete podepisovat smlouvy za Mediaspace.'}
        </p>
      </div>

      {!upravuje && (
        <div className="flex items-center gap-4 flex-wrap">
          {ulozeny ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ulozeny}
              alt="Uložený podpis"
              className="max-h-[80px] w-auto bg-white rounded px-2 border border-line"
            />
          ) : (
            <span className="font-podpis text-3xl text-muted">{jmeno}</span>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUpravuje(true)}
              className="text-sm font-heading text-brand-purpleDark hover:underline"
            >
              {ulozeny ? 'Změnit podpis' : 'Uložit podpis'}
            </button>
            {ulozeny && (
              <button
                type="button"
                onClick={() => posli({ smazat: true })}
                disabled={busy}
                className="text-sm font-heading text-muted hover:text-danger"
              >
                Smazat
              </button>
            )}
          </div>
        </div>
      )}

      {!upravuje && !ulozeny && (
        <p className="text-xs font-body text-muted m-0">
          Dokud tu žádný není, podepisuje se jménem psaným písmem — jako výše.
        </p>
      )}

      {upravuje && (
        <>
          <PodpisVyber onChange={setPodpis} jmeno={jmeno} />
          {chyba && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => posli({ imageData: podpis })}
              disabled={busy || !podpis}
              className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-pill px-4 py-2 disabled:opacity-60"
            >
              {busy ? 'Ukládám…' : 'Uložit podpis'}
            </button>
            <button
              type="button"
              onClick={() => {
                setUpravuje(false);
                setPodpis(null);
                setChyba(null);
              }}
              className="text-muted text-sm font-heading"
            >
              Zrušit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
