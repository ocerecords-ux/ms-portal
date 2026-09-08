'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { ALL_ROLES, PORTAL_PAGES, type MenuItemRow } from '@/lib/menu';
import { ROLE_LABELS } from '@/lib/roles';

type Row = {
  key: string;
  id?: string;
  label: string;
  href: string;
  roles: Role[];
  visible: boolean;
};

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function isPortalPage(href: string): boolean {
  return PORTAL_PAGES.some((p) => p.href === href);
}

/**
 * Editor polozek horni listy. Vsechno se upravuje v jedne obrazovce a uklada
 * jednim tlacitkem - admin tak vidi cele menu pohromade a nemusi hlidat, co
 * uz je ulozene a co ne.
 */
export function MenuEditor({ items }: { items: MenuItemRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    items.map((i) => ({ key: i.id, id: i.id, label: i.label, href: i.href, roles: i.roles, visible: i.visible })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewRole, setPreviewRole] = useState<Role>('CLIENT');

  const dirty = useMemo(() => {
    if (rows.length !== items.length) return true;
    return rows.some((r, idx) => {
      const original = items[idx];
      if (!original || original.id !== r.id) return true;
      return (
        original.label !== r.label ||
        original.href !== r.href ||
        original.visible !== r.visible ||
        original.roles.length !== r.roles.length ||
        original.roles.some((role) => !r.roles.includes(role))
      );
    });
  }, [rows, items]);

  function update(key: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleRole(key: string, role: Role) {
    setSaved(false);
    setRows((current) =>
      current.map((r) =>
        r.key === key
          ? { ...r, roles: r.roles.includes(role) ? r.roles.filter((x) => x !== role) : [...r.roles, role] }
          : r,
      ),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    setSaved(false);
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  function addRow() {
    setSaved(false);
    setRows((current) => [
      ...current,
      { key: nextKey(), label: '', href: '/projekty', roles: ['ADMIN'], visible: true },
    ]);
  }

  function removeRow(key: string) {
    setSaved(false);
    setRows((current) => current.filter((r) => r.key !== key));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((r) => ({
            id: r.id,
            label: r.label.trim(),
            href: r.href.trim(),
            roles: r.roles,
            visible: r.visible,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/menu', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Obnovení se nezdařilo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Obnovení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const preview = rows.filter((r) => r.visible && r.roles.includes(previewRole) && r.label.trim());

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="flex flex-col gap-6">
      {/* Nahled listy pro vybranou roli - admin hned vidi, co ktera role uvidi. */}
      <div className="bg-white rounded-card border border-line shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-3 border-b border-line">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Náhled lišty</h2>
          <label className="flex items-center gap-2 text-sm font-body text-muted">
            Role
            <select
              value={previewRole}
              onChange={(e) => setPreviewRole(e.target.value as Role)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-heading text-ink outline-none focus:border-brand-purple"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-5 py-4 flex items-center gap-6 flex-wrap">
          <span className="font-body text-brand-green font-semibold text-lg">MS portal</span>
          <span className="w-px h-6 bg-white/40" aria-hidden="true" />
          {preview.length === 0 ? (
            <span className="text-white/70 text-sm font-body italic">
              Tahle role zatím neuvidí v liště žádný odkaz.
            </span>
          ) : (
            preview.map((r) => (
              <span key={r.key} className="text-white/90 font-heading text-sm">
                {r.label}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Polozky */}
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted font-body bg-white border border-line rounded-card px-5 py-6 text-center m-0">
            Menu je prázdné. Přidejte položku, nebo obnovte výchozí nastavení.
          </p>
        )}

        {rows.map((row, index) => (
          <div key={row.key} className="bg-white rounded-card border border-line shadow-sm p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1.2fr_1.6fr_auto] gap-4 items-start">
              <div className="flex lg:flex-col items-center gap-1 pt-6">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Posunout nahoru"
                  className="w-8 h-8 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple disabled:opacity-30 disabled:hover:text-muted disabled:hover:border-line"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  title="Posunout dolů"
                  className="w-8 h-8 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple disabled:opacity-30 disabled:hover:text-muted disabled:hover:border-line"
                >
                  ↓
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Název</span>
                <input
                  value={row.label}
                  onChange={(e) => update(row.key, { label: e.target.value })}
                  placeholder="např. Projekty"
                  className={inputClass}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-body text-ink">Kam vede</span>
                <select
                  value={isPortalPage(row.href) ? row.href : '__custom__'}
                  onChange={(e) =>
                    update(row.key, { href: e.target.value === '__custom__' ? 'https://' : e.target.value })
                  }
                  className={inputClass}
                >
                  {PORTAL_PAGES.map((p) => (
                    <option key={p.href} value={p.href}>
                      {p.label} ({p.href})
                    </option>
                  ))}
                  <option value="__custom__">Vlastní odkaz…</option>
                </select>
                {!isPortalPage(row.href) && (
                  <input
                    value={row.href}
                    onChange={(e) => update(row.key, { href: e.target.value })}
                    placeholder="https://… nebo /stranka"
                    className={inputClass}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 text-sm font-body text-ink whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={row.visible}
                    onChange={(e) => update(row.key, { visible: e.target.checked })}
                    className="w-4 h-4 accent-[#6C4BF4]"
                  />
                  Zobrazit
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-red-600 text-sm font-heading"
                >
                  Smazat
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-body text-ink">Kdo ji vidí</span>
              <div className="flex items-center gap-2 flex-wrap">
                {ALL_ROLES.map((role) => {
                  const on = row.roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(row.key, role)}
                      className={`text-xs font-heading font-semibold px-3 py-1.5 rounded-pill border transition-colors ${
                        on
                          ? 'bg-[#F1ECFF] border-brand-purple text-brand-purpleDark'
                          : 'bg-white border-line text-muted hover:text-ink'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  );
                })}
              </div>
              {row.roles.length === 0 && (
                <span className="text-xs text-red-600 font-body">Vyberte aspoň jednu roli.</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {saved && !dirty && (
        <p className="text-sm text-ink bg-[#E3F9EC] border border-line rounded-lg px-3 py-2 m-0">Menu je uložené.</p>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={addRow}
          className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-[#F1ECFF] transition-colors"
        >
          + Přidat položku
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Uložit menu'}
        </button>
        <button
          type="button"
          onClick={restoreDefaults}
          disabled={saving}
          className="text-muted text-sm font-heading hover:text-ink disabled:opacity-60"
        >
          Obnovit výchozí menu
        </button>
      </div>
    </div>
  );
}
