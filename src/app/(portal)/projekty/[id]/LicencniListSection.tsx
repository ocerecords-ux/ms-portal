'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';

/**
 * Záložka „Licenční list" v detailu projektu (zadání 22. 9. 2026: „u reklam
 * budeme klientovi vystavovat licenční listy, netýká se to rádiových spotů.
 * Jde o vymezení licence pro daného herce").
 *
 * Vlevo formulář předvyplněný z projektu, vpravo vystavené listy. Jeden list
 * = jeden interpret; u spotu s víc herci se vystaví pro každého zvlášť.
 */

export type LicencniListRadek = {
  id: string;
  fileName: string;
  interpret: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  typLicence: string;
  createdAt: string;
  driveUrl: string | null;
  driveError: string | null;
};

export type LicencniListVychozi = {
  herci: { id: string; jmeno: string }[];
  nazevSpotu: string;
  klient: string;
  objednatel: string;
  dodavatel: string;
  typDila: string;
  uzemi: string;
  media: string;
  delkaLicence: string;
  typLicence: string;
  datumVyroby: string;
  podminky: string;
  misto: string;
  podepisuje: string;
};

const pole =
  'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60';

export function LicencniListSection({
  caflouProjectId,
  canEdit,
  listy,
  vychozi,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  listy: LicencniListRadek[];
  vychozi: LicencniListVychozi;
}) {
  const router = useRouter();
  const prvni = vychozi.herci[0];
  const [v, setV] = useState({
    ...vychozi,
    actorUserId: prvni?.id ?? '',
    interpret: prvni?.jmeno ?? '',
  });
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<string | null>(null);

  const nastav = <K extends keyof typeof v>(k: K, hodnota: (typeof v)[K]) => setV((p) => ({ ...p, [k]: hodnota }));

  async function vystav() {
    setBezi(true);
    setChyba(null);
    setHotovo(null);
    try {
      const { herci: _h, ...data } = v;
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/licencni-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, actorUserId: v.actorUserId || null }),
      });
      const telo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(telo.error || 'Licenční list se nepodařilo vystavit.');
      setHotovo(telo.id);
      router.refresh();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : 'Licenční list se nepodařilo vystavit.');
    } finally {
      setBezi(false);
    }
  }

  async function smaz(id: string) {
    if (!window.confirm('Smazat tenhle licenční list? Kopie na Disku půjde do koše.')) return;
    const res = await fetch(`/api/licencni-list/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  // Obyčejná funkce, ne komponenta - vnořená komponenta by se při každém
  // písmenku vytvořila znovu a políčko by ztrácelo kurzor.
  const policko = (
    k: 'nazevSpotu' | 'klient' | 'objednatel' | 'dodavatel' | 'typDila' | 'uzemi' | 'media' | 'delkaLicence' | 'misto' | 'podepisuje',
    label: string,
    napoveda?: string,
  ) => (
    <label key={k} className="flex flex-col gap-1.5">
      <span className="text-sm font-body text-ink">{label}</span>
      <input value={v[k]} onChange={(e) => nastav(k, e.target.value)} disabled={!canEdit} className={pole} />
      {napoveda && <span className="text-xs text-muted font-body">{napoveda}</span>}
    </label>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {canEdit && (
        <section className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              Nový licenční list
            </h2>
            <p className="text-xs text-muted font-body m-0 mt-1">
              Vymezení licence pro jednoho interpreta. Údaje jsou předvyplněné z projektu, všechno jde přepsat.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Interpret</span>
            {vychozi.herci.length > 0 && (
              <select
                value={v.actorUserId}
                onChange={(e) => {
                  const h = vychozi.herci.find((x) => x.id === e.target.value);
                  setV((p) => ({ ...p, actorUserId: e.target.value, interpret: h?.jmeno ?? p.interpret }));
                }}
                className={pole}
              >
                {vychozi.herci.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.jmeno}
                  </option>
                ))}
                <option value="">Jiný interpret…</option>
              </select>
            )}
            {(v.actorUserId === '' || vychozi.herci.length === 0) && (
              <input
                value={v.interpret}
                onChange={(e) => nastav('interpret', e.target.value)}
                placeholder="Jméno interpreta"
                className={pole}
              />
            )}
          </label>

          {policko('nazevSpotu', 'Název spotu')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {policko('klient', 'Klient', 'Pro koho spot je (koncový zadavatel).')}
            {policko('objednatel', 'Objednatel', 'Kdo si spot u nás objednal.')}
          </div>
          {policko('dodavatel', 'Dodavatel')}
          {policko('typDila', 'Typ díla')}

          <h3 className="font-heading font-semibold text-sm text-ink m-0 mt-2">Rozsah licence</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {policko('uzemi', 'Území')}
            {policko('media', 'Média', 'Předvyplněno z druhů licence u projektu.')}
            {policko('delkaLicence', 'Délka licence')}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Typ licence</span>
              <select value={v.typLicence} onChange={(e) => nastav('typLicence', e.target.value)} className={pole}>
                <option value="výhradní">výhradní</option>
                <option value="nevýhradní">nevýhradní</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Datum výroby</span>
              <DatumPole value={v.datumVyroby} onChange={(e) => nastav('datumVyroby', e.target.value)} className={pole} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Prodloužení licence a podmínky</span>
            <textarea
              value={v.podminky}
              onChange={(e) => nastav('podminky', e.target.value)}
              rows={6}
              className={`${pole} font-body resize-y`}
            />
            <span className="text-xs text-muted font-body">Odstavce oddělte prázdným řádkem.</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {policko('misto', 'Místo (V …, dne)', 'Např. „Brně“.')}
            {policko('podepisuje', 'Za MEDIA SPACE podepisuje')}
          </div>

          {chyba && (
            <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void vystav()}
              disabled={bezi}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {bezi ? 'Vystavuji…' : 'Vystavit licenční list'}
            </button>
            {hotovo && (
              <a
                href={`/api/licencni-list/${hotovo}`}
                target="_blank"
                rel="noopener"
                className="text-sm font-heading font-semibold text-brand-purple hover:underline"
              >
                Hotovo, otevřít PDF
              </a>
            )}
          </div>
        </section>
      )}

      <section className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          Vystavené licenční listy
        </h2>
        {listy.length === 0 && <p className="text-sm font-body text-muted m-0">Zatím žádný.</p>}
        {listy.map((l) => (
          <div key={l.id} className="rounded-lg border border-line px-3 py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <a
                href={`/api/licencni-list/${l.id}`}
                target="_blank"
                rel="noopener"
                className="block text-sm font-heading font-semibold text-ink hover:text-brand-purple truncate"
              >
                {l.interpret}
              </a>
              <p className="text-xs font-body text-muted m-0 mt-0.5">
                {[l.uzemi, l.media, l.delkaLicence, l.typLicence].filter(Boolean).join(' · ')} ·{' '}
                {new Date(l.createdAt).toLocaleDateString('cs-CZ')}
              </p>
              {l.driveUrl ? (
                <a href={l.driveUrl} target="_blank" rel="noopener" className="text-xs font-body text-brand-purple hover:underline">
                  Na Disku
                </a>
              ) : (
                l.driveError && <p className="text-xs font-body text-status-progress m-0">Disk: {l.driveError}</p>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void smaz(l.id)}
                title="Smazat"
                aria-label="Smazat licenční list"
                className="shrink-0 text-muted hover:text-danger text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
