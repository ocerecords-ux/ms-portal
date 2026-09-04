'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Inline editace stitku konkretni osoby v Caflou primo v tabulce uctu dane
// firmy - stitek je u User (ne u Company), aby slo v Caflou rozlisit, ktery
// projekt patri ktere konkretni osobe i pod jednou firmou.
export function UserCaflouTagCell({ userId, initialTag }: { userId: string; initialTag: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTag ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caflouTag: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Uložení se nezdařilo.');
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm font-heading text-left hover:text-brand-purple"
        title="Upravit štítek"
      >
        {initialTag || <span className="text-muted">— přidat</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(initialTag ?? '');
            setEditing(false);
          }
        }}
        className="admin-input"
        style={{ maxWidth: 160 }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="text-brand-purple text-xs font-heading font-semibold disabled:opacity-60"
      >
        {saving ? '…' : 'Uložit'}
      </button>
      {error && <span className="text-red-600 text-xs font-body">{error}</span>}
    </div>
  );
}
