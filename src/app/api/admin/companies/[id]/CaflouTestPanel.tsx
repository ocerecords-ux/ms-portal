'use client';

import { useState } from 'react';

// Diagnosticky panel - dokud neni jiste overena presna struktura odpovedi
// Caflou API (nazvy poli u projektu), tady si admin muze kdykoliv overit
// zivé napojeni a videt syrovou odpoved primo v adminu - misto hledani ve
// Vercel Logs.
export function CaflouTestPanel({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
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

  return (
    <div className="bg-white border border-line rounded-card p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-heading font-semibold text-sm text-ink m-0">Test napojení na Caflou</h3>
          <p className="text-muted text-xs font-body mt-1">
            Nejprve ulož ID firmy v Caflou výše, pak zkontroluj, co se z Caflou API opravdu vrátí.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="bg-ink text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDark transition-colors disabled:opacity-60"
        >
          {loading ? 'Testuji…' : 'Otestovat'}
        </button>
      </div>
      {statusLine && <p className="text-xs font-heading text-muted m-0">{statusLine}</p>}
      {result && (
        <pre className="bg-field border border-line rounded-lg p-3 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}
    </div>
  );
}
