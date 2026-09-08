'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Kategorie výdajů. Sedí až pod seznamem, protože se do nich sahá jednou za
 * čas - ale jsou po ruce, aby se za nimi nemuselo nikam chodit
 * (zadani 8. 9. 2026: "u vydaju bych chtel mit moznost pridavat dodatecne
 * kategorie").
 */
export function CategoryManager({
  categories,
}: {
  categories: { id: string; name: string; active: boolean; usedBy: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    const created = await send('/api/admin/expense-categories', 'POST', { name: value });
    if (created) setName('');
  }

  async function remove(category: { id: string; name: string }) {
    const result = await send(`/api/admin/expense-categories/${category.id}`, 'DELETE');
    if (result?.deactivatedInsteadOfDeleted) {
      setNote(
        `Kategorii „${category.name}" už používá ${result.usedByExpenses} dokladů, takže je jen vyřazená z nabídky — u těch dokladů zůstane.`,
      );
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-ink text-sm font-heading self-start"
      >
        Spravovat kategorie ({categories.filter((c) => c.active).length})
      </button>
    );
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Kategorie výdajů</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink text-sm font-heading">
          Skrýt
        </button>
      </div>

      <ul className="list-none p-0 m-0 flex flex-col divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className={`text-sm font-heading ${c.active ? 'text-ink' : 'text-muted line-through'}`}>
              {c.name}
              {c.usedBy > 0 && <span className="ml-2 text-xs text-muted font-body tabular-nums">{c.usedBy} dokladů</span>}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => send(`/api/admin/expense-categories/${c.id}`, 'PATCH', { active: !c.active })}
                disabled={busy}
                className={`text-sm font-heading disabled:opacity-60 ${c.active ? 'text-muted hover:text-ink' : 'text-brand-purple'}`}
              >
                {c.active ? 'Vyřadit' : 'Vrátit do nabídky'}
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                disabled={busy}
                className="text-red-600 text-sm font-heading disabled:opacity-60"
              >
                Smazat
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {note && <p className="text-sm text-ink bg-[#F1ECFF] border border-line rounded-lg px-3 py-2 m-0">{note}</p>}

      <form onSubmit={add} className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <span className="text-sm font-body text-ink">Nová kategorie</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Marketing"
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          Přidat
        </button>
      </form>
    </div>
  );
}
