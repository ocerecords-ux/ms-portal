'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../NewCompanyForm';

/**
 * Zakládání a úprava složek na Disku (zadání 30. 9. 2026).
 *
 * Mazání tu není schválně - viz komentář v /api/admin/slozky/[id]. Vypnutá
 * složka se nikomu nenabízí, ale zaškrtnutí u účtů zůstanou.
 */
export type SlozkaRadek = {
  id: string;
  nazev: string;
  popis: string | null;
  driveUrl: string;
  poradi: number;
  aktivni: boolean;
  /** Kolik lidí ji má přidělenou - ať je vidět, koho se vypnutí dotkne. */
  pocetLidi: number;
  /** Jde z odkazu vyčíst složka? */
  odkazSedi: boolean;
};

export function SlozkyManager({ slozky }: { slozky: SlozkaRadek[] }) {
  const router = useRouter();
  const [nazev, setNazev] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [popis, setPopis] = useState('');
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);
  /** Která složka se zrovna přepíná - ať se dvojklik nepočítá dvakrát. */
  const [prepina, setPrepina] = useState<string | null>(null);

  async function zaloz(e: React.FormEvent) {
    e.preventDefault();
    setChyba(null);
    setUklada(true);
    try {
      const res = await fetch('/api/admin/slozky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, driveUrl, popis: popis || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setNazev('');
      setDriveUrl('');
      setPopis('');
      router.refresh();
    } catch {
      setChyba('Uložení se nezdařilo.');
    } finally {
      setUklada(false);
    }
  }

  async function prepni(slozka: SlozkaRadek) {
    setChyba(null);
    setPrepina(slozka.id);
    try {
      const res = await fetch(`/api/admin/slozky/${slozka.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktivni: !slozka.aktivni }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChyba(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setChyba('Uložení se nezdařilo.');
    } finally {
      setPrepina(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {chyba && (
        <p className="text-sm font-body text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">
          {chyba}
        </p>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm divide-y divide-line">
        {slozky.length === 0 && (
          <p className="text-sm font-body text-muted m-0 p-5">Zatím tu není žádná složka.</p>
        )}
        {slozky.map((s) => (
          <div key={s.id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-heading font-semibold text-sm text-ink m-0">
                {s.nazev}
                {!s.aktivni && <span className="text-muted font-body font-normal"> · vypnutá</span>}
              </p>
              {s.popis && <p className="text-xs font-body text-muted m-0 mt-1">{s.popis}</p>}
              <p className="text-xs font-body text-muted m-0 mt-1 break-all">{s.driveUrl}</p>
              {!s.odkazSedi && (
                <p className="text-xs font-body text-danger m-0 mt-1">
                  Z tohohle odkazu nejde vyčíst složka - nikomu se neukáže. Otevřete složku na Disku
                  a zkopírujte adresu z řádku prohlížeče.
                </p>
              )}
              <p className="text-xs font-body text-muted m-0 mt-1">
                {s.pocetLidi === 0
                  ? 'Zatím ji nemá nikdo přidělenou.'
                  : s.pocetLidi === 1
                    ? 'Přidělená jednomu člověku.'
                    : `Přidělená ${s.pocetLidi} lidem.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => prepni(s)}
              disabled={prepina === s.id}
              className="font-heading text-sm rounded-lg px-4 py-2 border border-line text-muted hover:text-ink hover:border-ink transition-colors disabled:opacity-50"
            >
              {s.aktivni ? 'Vypnout' : 'Zapnout'}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={zaloz} className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <p className="font-heading font-semibold text-sm text-ink m-0">Nová složka</p>
        <AdminField label="Název">
          <input
            value={nazev}
            onChange={(e) => setNazev(e.target.value)}
            placeholder="Klientská zóna"
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        <AdminField label="Odkaz na složku" hint="Otevřete složku na Google Disku a zkopírujte adresu z řádku prohlížeče.">
          <input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        <AdminField label="Popis" hint="Nepovinný. Ukáže se jako bublina u zaškrtávátka.">
          <input
            value={popis}
            onChange={(e) => setPopis(e.target.value)}
            className="w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink"
          />
        </AdminField>
        <div>
          <button
            type="submit"
            disabled={uklada || !nazev.trim() || !driveUrl.trim()}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-6 py-3 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
          >
            {uklada ? 'Ukládám…' : 'Založit složku'}
          </button>
        </div>
      </form>
    </div>
  );
}
