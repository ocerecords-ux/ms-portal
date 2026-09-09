'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { CONTRACT_PLACEHOLDERS } from '@/lib/contracts';

type Template = { id: string; name: string; body: string; active: boolean };

/** Správa šablon smluv. Text se píše ručně, pole {{…}} se doplní při založení. */
export function TemplateManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(templates[0]?.id ?? null);
  const [navrh, setNavrh] = useState<Record<string, { name: string; body: string }>>({});
  const [novaNazev, setNovaNazev] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otevrena = templates.find((t) => t.id === openId) ?? null;
  const hodnota = (t: Template) => navrh[t.id] ?? { name: t.name, body: t.body };

  function uprav(t: Template, patch: Partial<{ name: string; body: string }>) {
    setNavrh((current) => ({ ...current, [t.id]: { ...hodnota(t), ...patch } }));
    setInfo(null);
  }

  async function posli(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setError('Uložení se nezdařilo.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-ink m-0">Šablony smluv</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Do textu se dají psát pole ve složených závorkách — při založení smlouvy se doplní z databáze.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Nová šablona</span>
            <input
              value={novaNazev}
              onChange={(e) => setNovaNazev(e.target.value)}
              placeholder="Název"
              className={inputClass}
            />
          </label>
          <AddButton
            type="button"
            disabled={busy || !novaNazev.trim()}
            onClick={async () => {
              const created = await posli('/api/admin/contract-templates', 'POST', { name: novaNazev.trim() });
              if (created?.id) {
                setNovaNazev('');
                setOpenId(created.id);
              }
            }}
          >
            Přidat
          </AddButton>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-wrap gap-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide w-full">Dostupná pole</span>
        {CONTRACT_PLACEHOLDERS.map((p) => (
          <span
            key={p.key}
            title={p.label}
            className="text-xs font-body bg-field border border-line rounded-pill px-2.5 py-1 text-ink"
          >
            {`{{${p.key}}}`}
          </span>
        ))}
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-okTint border border-line rounded-lg px-3 py-2 m-0">{info}</p>}

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-full sm:w-[260px] shrink-0 bg-surface rounded-card border border-line shadow-sm p-2 flex flex-col gap-0.5">
          {templates.length === 0 && <p className="text-sm font-body text-muted m-0 px-2 py-3">Zatím žádné šablony.</p>}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenId(t.id)}
              className={`text-left rounded-lg px-3 py-2 text-sm font-heading transition-colors ${
                t.id === openId ? 'bg-tint text-ink' : 'text-muted hover:text-ink hover:bg-field'
              } ${t.active ? '' : 'line-through'}`}
            >
              {hodnota(t).name}
            </button>
          ))}
        </div>

        {otevrena && (
          <div className="flex-1 min-w-0 bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Název šablony</span>
              <input
                value={hodnota(otevrena).name}
                onChange={(e) => uprav(otevrena, { name: e.target.value })}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">Text smlouvy</span>
              <textarea
                value={hodnota(otevrena).body}
                onChange={(e) => uprav(otevrena, { body: e.target.value })}
                rows={24}
                className="rounded-lg border border-line bg-field px-4 py-3 text-ink font-body text-sm leading-relaxed outline-none focus:border-brand-purple w-full"
              />
            </label>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await posli(`/api/admin/contract-templates/${otevrena.id}`, 'PATCH', hodnota(otevrena));
                  if (ok) setInfo('Šablona uložena.');
                }}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                Uložit šablonu
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  posli(`/api/admin/contract-templates/${otevrena.id}`, 'PATCH', { active: !otevrena.active })
                }
                className="text-muted text-sm font-heading"
              >
                {otevrena.active ? 'Vyřadit z nabídky' : 'Vrátit do nabídky'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await posli(`/api/admin/contract-templates/${otevrena.id}`, 'DELETE');
                  if (ok) setOpenId(null);
                }}
                className="text-danger text-sm font-heading ml-auto"
              >
                Smazat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
