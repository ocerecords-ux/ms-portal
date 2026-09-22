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
  vsichniHerci: { id: string; jmeno: string }[];
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
  /**
   * VÍC HERCŮ NAJEDNOU (22. 9. 2026: „u těch licenčních listů chci vybírat
   * konkrétní herce a mnohonásobný výběr"). Zaškrtnutí herci projektu, další
   * jdou přidat z celé databáze nebo napsat jménem. Každý dostane vlastní
   * licenční list se stejným rozsahem licence.
   */
  const [vybrani, setVybrani] = useState<{ id: string | null; jmeno: string }[]>(
    vychozi.herci.map((h) => ({ id: h.id, jmeno: h.jmeno })),
  );
  const [hledani, setHledani] = useState('');
  const { herci: _herci, vsichniHerci: _vsichni, ...zbytek } = vychozi;
  const [v, setV] = useState(zbytek);
  const jeVybrany = (jmeno: string, id: string | null) =>
    vybrani.some((x) => (id ? x.id === id : x.jmeno.toLowerCase() === jmeno.toLowerCase()));
  const prepniHerce = (h: { id: string | null; jmeno: string }) =>
    setVybrani((p) =>
      jeVybrany(h.jmeno, h.id) ? p.filter((x) => (h.id ? x.id !== h.id : x.jmeno !== h.jmeno)) : [...p, h],
    );
  const bezDiakritiky = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const navrhy = hledani.trim()
    ? vychozi.vsichniHerci
        .filter((h) => !jeVybrany(h.jmeno, h.id) && bezDiakritiky(h.jmeno).includes(bezDiakritiky(hledani.trim())))
        .slice(0, 8)
    : [];
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<string[]>([]);

  const nastav = <K extends keyof typeof v>(k: K, hodnota: (typeof v)[K]) => setV((p) => ({ ...p, [k]: hodnota }));

  async function vystav() {
    if (vybrani.length === 0) {
      setChyba('Vyberte aspoň jednoho herce.');
      return;
    }
    setBezi(true);
    setChyba(null);
    setHotovo([]);
    try {
      const nova: string[] = [];
      for (const h of vybrani) {
        const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/licencni-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...v, interpret: h.jmeno, actorUserId: h.id }),
        });
        const telo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${h.jmeno}: ${telo.error || 'licenční list se nepodařilo vystavit.'}`);
        nova.push(telo.id);
      }
      setHotovo(nova);
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
              Vymezení licence pro vybrané herce - každý dostane svůj list. Údaje jsou předvyplněné z projektu, všechno jde přepsat.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Interpreti</span>
            <div className="flex flex-wrap gap-2">
              {[...vychozi.herci.map((h) => ({ id: h.id as string | null, jmeno: h.jmeno })), ...vybrani.filter((x) => !vychozi.herci.some((h) => h.id === x.id))].map((h) => {
                const zapnuto = jeVybrany(h.jmeno, h.id);
                return (
                  <button
                    key={h.id ?? h.jmeno}
                    type="button"
                    onClick={() => prepniHerce(h)}
                    aria-pressed={zapnuto}
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-heading transition-colors ${
                      zapnuto ? 'border-brand-purple bg-brand-purple/10 text-ink' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${zapnuto ? 'bg-brand-purple border-brand-purple text-white' : 'border-line'}`}>
                      {zapnuto ? '✓' : ''}
                    </span>
                    {h.jmeno}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <input
                value={hledani}
                onChange={(e) => setHledani(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hledani.trim()) {
                    e.preventDefault();
                    const shoda = navrhy[0];
                    prepniHerce(shoda ? { id: shoda.id, jmeno: shoda.jmeno } : { id: null, jmeno: hledani.trim() });
                    setHledani('');
                  }
                }}
                placeholder="Přidat dalšího herce - začněte psát jméno…"
                className={`${pole} w-full`}
              />
              {navrhy.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-line bg-surface shadow-lg overflow-hidden">
                  {navrhy.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        prepniHerce({ id: h.id, jmeno: h.jmeno });
                        setHledani('');
                      }}
                      className="block w-full text-left px-3 py-2 text-sm font-heading text-ink hover:bg-brand-purple/10"
                    >
                      {h.jmeno}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-muted font-body">
              Každý vybraný herec dostane vlastní licenční list se stejným rozsahem. Kdo není v databázi, napište jméno a potvrďte Enterem.
            </span>
          </div>

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
              {bezi ? 'Vystavuji…' : vybrani.length > 1 ? `Vystavit ${vybrani.length} licenční listy` : 'Vystavit licenční list'}
            </button>
            {hotovo.length > 0 && (
              <span className="text-sm font-heading text-brand-greenDeep">
                Hotovo - vystaveno {hotovo.length === 1 ? '1 licenční list' : `${hotovo.length} licenčních listů`}.
              </span>
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
