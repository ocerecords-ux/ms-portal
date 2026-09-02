'use client';

import { useState } from 'react';

type CompanyHit = { id: string | number; name: string };

// Diagnosticky panel - dokud neni jiste overena presna struktura odpovedi
// Caflou API (nazvy poli u projektu), tady si admin muze kdykoliv overit
// zivé napojeni a videt syrovou odpoved primo v adminu - misto hledani ve
// Vercel Logs. Hledani firem je zvlast (zobrazuje jen nazev + ID, ne cely
// syrovy JSON), protoze uctu ma MEDIA SPACE pres Caflou stovky.
export function CaflouTestPanel({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [companyHits, setCompanyHits] = useState<CompanyHit[] | null>(null);
  const [companyHitsInfo, setCompanyHitsInfo] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    setCompanyHits(null);
    setStatusLine(null);
    try {
      const res = await fetch(`/api/admin/caflou-debug?companyId=${encodeURIComponent(companyId)}`);
      const body = await res.json();
      setStatusLine(`HTTP ${res.status}`);
      setResult(JSON.stringify(body, null, 2));
    } catch (err) {
      setStatusLine('Chyba požadavku');
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleListCompanies() {
    setLoading(true);
    setResult(null);
    setCompanyHits(null);
    setCompanyHitsInfo(null);
    setStatusLine(null);
    try {
      const url = search.trim()
        ? `/api/admin/caflou-debug?list=companies&q=${encodeURIComponent(search.trim())}`
        : `/api/admin/caflou-debug?list=companies`;
      const res = await fetch(url);
      const body = await res.json();
      setStatusLine(`HTTP ${res.status}`);
      if (res.ok && body?.body?.results) {
        const hits: CompanyHit[] = body.body.results.map((r: any) => ({ id: r.id, name: r.name }));
        setCompanyHits(hits);
        setCompanyHitsInfo(
          `Nalezeno ${body.body.total_results ?? hits.length} firem${body.body.total_pages > 1 ? ` (zobrazeno prvních ${hits.length}, zkus hledání zúžit)` : ''}.`,
        );
      } else {
        setResult(JSON.stringify(body, null, 2));
      }
    } catch (err) {
      setStatusLine('Chyba požadavku');
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copyId(id: string | number) {
    try {
      await navigator.clipboard.writeText(String(id));
    } catch {
      // schránka nemusí být dostupná - nevadí, ID je vidět i takto
    }
  }

  return (
    <div className="bg-white border border-line rounded-card p-6 flex flex-col gap-3">
      <div>
        <h3 className="font-heading font-semibold text-sm text-ink m-0">Test napojení na Caflou</h3>
        <p className="text-muted text-xs font-body mt-1">
          Nevíš ID firmy v Caflou? Napiš níže její název (nebo část) a klikni na „Najít" — vypíšou se jen odpovídající firmy.
          Až ID doplníš a uložíš výše, ověř přímo projekty tlačítkem „Otestovat".
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleListCompanies()}
          placeholder="název firmy v Caflou…"
          className="admin-input flex-1 min-w-[200px]"
        />
        <button
          type="button"
          onClick={handleListCompanies}
          disabled={loading}
          className="bg-white border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
        >
          {loading ? 'Hledám…' : 'Najít'}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="bg-ink text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDark transition-colors disabled:opacity-60"
        >
          {loading ? 'Testuji…' : 'Otestovat projekty'}
        </button>
      </div>

      {statusLine && <p className="text-xs font-heading text-muted m-0">{statusLine}</p>}
      {companyHitsInfo && <p className="text-xs font-body text-muted m-0">{companyHitsInfo}</p>}

      {companyHits && (
        <div className="border border-line rounded-lg divide-y divide-line max-h-80 overflow-y-auto">
          {companyHits.length === 0 && <p className="text-sm text-muted font-body p-3 m-0">Nic nenalezeno.</p>}
          {companyHits.map((hit) => (
            <div key={hit.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-heading text-ink m-0 truncate">{hit.name}</p>
                <p className="text-xs font-body text-muted m-0">ID: {hit.id}</p>
              </div>
              <button
                type="button"
                onClick={() => copyId(hit.id)}
                className="shrink-0 text-xs font-heading font-semibold text-brand-purple border border-line rounded-lg px-2.5 py-1.5 hover:bg-field transition-colors"
              >
                Kopírovat ID
              </button>
            </div>
          ))}
        </div>
      )}

      {result && (
        <pre className="bg-field border border-line rounded-lg p-3 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}
    </div>
  );
}
