'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  id: string;
  name: string;
  priceExVat: number | null;
  priceIncVat: number | null;
  active: boolean;
};

function formatPrice(value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('cs-CZ')} Kč`;
}

export function PriceListEditor({ items }: { items: Item[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', priceExVat: '', priceIncVat: '' });
  const [newItem, setNewItem] = useState({ name: '', priceExVat: '', priceIncVat: '' });

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const created = await send('/api/admin/pricelist', 'POST', newItem);
    if (created) setNewItem({ name: '', priceExVat: '', priceIncVat: '' });
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      priceExVat: item.priceExVat != null ? String(item.priceExVat) : '',
      priceIncVat: item.priceIncVat != null ? String(item.priceIncVat) : '',
    });
  }

  async function saveEdit(id: string) {
    const saved = await send(`/api/admin/pricelist/${id}`, 'PATCH', draft);
    if (saved) setEditingId(null);
  }

  async function removeItem(item: Item) {
    const result = await send(`/api/admin/pricelist/${item.id}`, 'DELETE');
    if (result?.deactivatedInsteadOfDeleted) {
      setNote(
        `Položku „${item.name}" už používá ${result.usedByProjects} projektů, takže jsme ji jen vyřadili z nabídky — u těch projektů zůstane.`,
      );
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-ink text-white font-heading text-xs">
                <th className="text-left px-4 py-3.5">Položka</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Cena bez DPH</th>
                <th className="text-right px-4 py-3.5 whitespace-nowrap">Cena s DPH</th>
                <th className="text-left px-4 py-3.5 whitespace-nowrap">V nabídce</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm font-body">
                    Ceník je zatím prázdný. Přidejte první položku formulářem níže.
                  </td>
                </tr>
              )}
              {items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="border-t border-line bg-[#FAF8FF]">
                    <td className="px-4 py-3">
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="numeric"
                        value={draft.priceExVat}
                        onChange={(e) => setDraft({ ...draft, priceExVat: e.target.value })}
                        className={`${inputClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="numeric"
                        value={draft.priceIncVat}
                        onChange={(e) => setDraft({ ...draft, priceIncVat: e.target.value })}
                        className={`${inputClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-heading text-muted">{item.active ? 'Ano' : 'Ne'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          disabled={busy}
                          className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-60"
                        >
                          Uložit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-muted text-xs font-heading"
                        >
                          Zrušit
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-t border-line hover:bg-[#FAF8FF]">
                    <td className="px-4 py-3.5 font-heading font-semibold text-sm">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className={`text-left hover:text-brand-purple ${item.active ? 'text-ink' : 'text-muted line-through'}`}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums text-right whitespace-nowrap">
                      {formatPrice(item.priceExVat)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading tabular-nums text-right whitespace-nowrap">
                      {formatPrice(item.priceIncVat)}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-heading">
                      <button
                        type="button"
                        onClick={() => send(`/api/admin/pricelist/${item.id}`, 'PATCH', { active: !item.active })}
                        disabled={busy}
                        className={item.active ? 'text-brand-greenDeep' : 'text-muted'}
                      >
                        {item.active ? 'Ano' : 'Ne'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-brand-purple text-sm font-heading font-semibold"
                        >
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item)}
                          disabled={busy}
                          className="text-red-600 text-sm font-heading disabled:opacity-60"
                        >
                          Smazat
                        </button>
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {note && <p className="text-sm text-ink bg-[#F1ECFF] border border-line rounded-lg px-3 py-2 m-0">{note}</p>}

      <form onSubmit={addItem} className="bg-white rounded-card border border-line shadow-sm p-6 flex flex-col gap-4 max-w-3xl">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Přidat položku</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Položka</span>
            <input
              required
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="např. Natáčení voiceoveru"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Cena bez DPH</span>
            <input
              inputMode="numeric"
              value={newItem.priceExVat}
              onChange={(e) => setNewItem({ ...newItem, priceExVat: e.target.value })}
              className={`${inputClass} text-right`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Cena s DPH</span>
            <input
              inputMode="numeric"
              value={newItem.priceIncVat}
              onChange={(e) => setNewItem({ ...newItem, priceIncVat: e.target.value })}
              placeholder="dopočítáme"
              className={`${inputClass} text-right`}
            />
          </label>
        </div>
        <div>
          <button
            type="submit"
            disabled={busy}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            Přidat do ceníku
          </button>
        </div>
      </form>
    </div>
  );
}
