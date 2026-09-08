'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTRACT_STATUS_CLASSES, CONTRACT_STATUS_LABELS, formatSignedAt } from '@/lib/contracts';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import { SignaturePad } from '../SignaturePad';
import { ContractPaper, type PaperSignature } from '../ContractPaper';

type Contract = {
  id: string;
  number: string;
  title: string;
  body: string;
  status: string;
  companyId: string;
  signerName: string;
  signerEmail: string;
  caflouProjectId: string;
  projectName: string | null;
  issuerName: string;
  sentAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  signUrl: string;
  currentHash: string;
  signatures: PaperSignature[];
};

/**
 * Editor smlouvy. Nahoře se upravují údaje a text, dole je vidět smlouva tak,
 * jak ji uvidí protistrana — včetně podpisové doložky. Podepsaná smlouva se
 * už nedá měnit, protože podpisy jsou vázané na otisk textu.
 */
export function ContractEditor({
  contract,
  companies,
  projects,
}: {
  contract: Contract;
  companies: { id: string; name: string }[];
  projects: ProjectChoice[];
}) {
  const router = useRouter();
  const locked = contract.status === 'SIGNED' || contract.status === 'CANCELLED';
  const podepsanoNami = contract.signatures.some((s) => s.role === 'MEDIASPACE');
  const podepsanoJimi = contract.signatures.some((s) => s.role === 'PROTISTRANA');

  const [form, setForm] = useState({
    title: contract.title,
    body: contract.body,
    companyId: contract.companyId,
    signerName: contract.signerName,
    signerEmail: contract.signerEmail,
    caflouProjectId: contract.caflouProjectId,
  });
  const [podpis, setPodpis] = useState<string | null>(null);
  const [podpisOtevreny, setPodpisOtevreny] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);

  const textZmenen = form.body.trim() !== contract.body.trim();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  async function save(): Promise<boolean> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId: form.companyId || null, caflouProjectId: form.caflouProjectId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return false;
      }
      setInfo('Uloženo.');
      router.refresh();
      return true;
    } catch {
      setError('Uložení se nezdařilo.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function podepsat() {
    if (!podpis) {
      setError('Nejdřív se podepište do rámečku.');
      return;
    }
    if (textZmenen) {
      const ulozeno = await save();
      if (!ulozeno) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}/podpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: podpis }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Podpis se nepodařilo uložit.');
        return;
      }
      setPodpis(null);
      setPodpisOtevreny(false);
      setInfo('Podepsáno za Mediaspace.');
      router.refresh();
    } catch {
      setError('Podpis se nepodařilo uložit.');
    } finally {
      setBusy(false);
    }
  }

  async function odeslat() {
    if (textZmenen) {
      const ulozeno = await save();
      if (!ulozeno) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Odeslání se nezdařilo.');
        return;
      }
      setInfo(`Odkaz k podpisu odešel na ${form.signerEmail}.`);
      router.refresh();
    } catch {
      setError('Odeslání se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  async function zrusit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Zrušení se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Zrušení se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  async function smazat() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${contract.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Smazání se nezdařilo.');
        return;
      }
      router.push('/admin/doklady/smlouvy');
    } catch {
      setError('Smazání se nezdařilo.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-60';

  return (
    <div className="flex flex-col gap-6">
      {/* Hlavicka se stavem a akcemi */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-display text-2xl text-ink">{contract.number}</span>
            <span
              className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${
                CONTRACT_STATUS_CLASSES[contract.status] ?? 'bg-field text-muted'
              }`}
            >
              {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
            </span>
            {contract.sentAt && (
              <span className="text-xs font-body text-muted">Odesláno {formatSignedAt(contract.sentAt)}</span>
            )}
            {contract.completedAt && (
              <span className="text-xs font-body text-status-done font-heading font-semibold">
                Uzavřeno {formatSignedAt(contract.completedAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!locked && (
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="font-heading font-semibold text-sm rounded-lg border border-line px-4 py-2 text-ink hover:border-brand-purple disabled:opacity-60"
              >
                Uložit
              </button>
            )}
            {!locked && !podepsanoNami && (
              <button
                type="button"
                onClick={() => setPodpisOtevreny((v) => !v)}
                disabled={busy}
                className="font-heading font-semibold text-sm rounded-lg border border-brand-purple px-4 py-2 text-brand-purple hover:bg-[#F1ECFF] disabled:opacity-60"
              >
                {podpisOtevreny ? 'Zavřít podpis' : 'Podepsat za Mediaspace'}
              </button>
            )}
            {!locked && (
              <button
                type="button"
                onClick={odeslat}
                disabled={busy}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {contract.status === 'SENT' ? 'Poslat znovu' : 'Odeslat k podpisu'}
              </button>
            )}
            {contract.status !== 'SIGNED' && contract.status !== 'CANCELLED' && (
              <button type="button" onClick={zrusit} disabled={busy} className="text-muted text-sm font-heading px-2">
                Zrušit smlouvu
              </button>
            )}
            {contract.status === 'DRAFT' && (
              <button type="button" onClick={smazat} disabled={busy} className="text-red-600 text-sm font-heading px-2">
                Smazat
              </button>
            )}
          </div>
        </div>

        {contract.rejectedAt && (
          <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">
            Protistrana podpis odmítla {formatSignedAt(contract.rejectedAt)}
            {contract.rejectedReason ? ` — „${contract.rejectedReason}"` : '.'}
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
        {info && <p className="text-sm text-ink bg-[#E3F9EC] border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

        {/* Odkaz k podpisu - da se poslat i jinou cestou nez mailem */}
        <div className="flex items-center gap-3 flex-wrap border-t border-line pt-4">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">Odkaz k podpisu</span>
          <code className="text-xs font-body text-muted bg-field rounded-lg px-3 py-1.5 break-all flex-1 min-w-[240px]">
            {contract.signUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(contract.signUrl);
              setZkopirovano(true);
              setTimeout(() => setZkopirovano(false), 2000);
            }}
            className="text-xs font-heading font-semibold text-brand-purple"
          >
            {zkopirovano ? 'Zkopírováno' : 'Kopírovat'}
          </button>
        </div>
      </div>

      {podpisOtevreny && !podepsanoNami && (
        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Podpis za Mediaspace
          </h2>
          <SignaturePad onChange={setPodpis} />
          <div>
            <button
              type="button"
              onClick={podepsat}
              disabled={busy || !podpis}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {busy ? 'Ukládám…' : 'Podepsat'}
            </button>
          </div>
        </div>
      )}

      {/* Udaje smlouvy */}
      <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Údaje</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Název smlouvy</span>
          <input value={form.title} disabled={locked} onChange={(e) => set('title', e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Protistrana (firma)</span>
            <select
              value={form.companyId}
              disabled={locked}
              onChange={(e) => set('companyId', e.target.value)}
              className={inputClass}
            >
              <option value="">— bez firmy (herec) —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Kdo podepisuje</span>
            <input
              value={form.signerName}
              disabled={locked}
              onChange={(e) => set('signerName', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">E-mail podepisujícího</span>
            <input
              type="email"
              value={form.signerEmail}
              disabled={locked}
              onChange={(e) => set('signerEmail', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Projekt</span>
            <ProjectSelect
              value={form.caflouProjectId}
              onChange={(id) => set('caflouProjectId', id)}
              projects={projects}
              currentName={contract.projectName}
              disabled={locked}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {/* Text smlouvy */}
      {!locked && (
        <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Text smlouvy</h2>
            {(podepsanoNami || podepsanoJimi) && textZmenen && (
              <span className="text-xs font-heading font-semibold text-red-600">
                Uložení změněného textu zruší už pořízené podpisy — podepisovalo se jiné znění.
              </span>
            )}
          </div>
          <textarea
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            rows={22}
            placeholder="Text smlouvy…"
            className="rounded-lg border border-line bg-field px-4 py-3 text-ink font-body text-sm leading-relaxed outline-none focus:border-brand-purple w-full"
          />
        </div>
      )}

      {/* Jak to uvidi protistrana */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">Takhle smlouvu uvidí protistrana</span>
        <ContractPaper
          title={form.title}
          number={contract.number}
          body={form.body || 'Smlouva zatím nemá žádný text.'}
          signatures={contract.signatures}
          currentHash={contract.currentHash}
        />
      </div>
    </div>
  );
}
