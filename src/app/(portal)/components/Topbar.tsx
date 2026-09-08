'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { PORTAL_PAGES, isExternalHref, type MenuEntry, type NavItem } from '@/lib/menu';

/**
 * Horní fialová lišta. Odkazy si Žůžo-labůžo upravuje přímo tady - tři tečky
 * vpravo, volba "Upravit" (mazání a přidání zkratky) nebo "Přesunout"
 * (přetahování pořadí), jako na ploše iPhonu (zadani 8. 9. 2026).
 *
 * Kdo co uvidí se nikde nenastavuje - řídí se to právy ke stránce
 * (lib/menu.ts > PAGE_ACCESS). V režimu úprav proto admin vidí i položky,
 * které se jemu samotnému běžně nezobrazují, aby s nimi mohl hýbat.
 */
export function Topbar({
  userLabel,
  isAdmin,
  items,
  allItems,
}: {
  userLabel: string;
  isAdmin?: boolean;
  /** Co uvidí přihlášený uživatel podle svých práv. */
  items: NavItem[];
  /** Všechny položky listy - jen pro admina, kvůli úpravám. */
  allItems?: MenuEntry[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<null | 'edit' | 'move'>(null);
  const [draft, setDraft] = useState<MenuEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  // Kdyz server posle novy seznam, prepiseme rozdelanou praci jen mimo rezim uprav.
  useEffect(() => {
    if (!mode) setDraft(allItems ?? []);
  }, [allItems, mode]);

  function startMode(next: 'edit' | 'move') {
    setDraft(allItems ?? []);
    setMode(next);
    setMenuOpen(false);
    setAddOpen(false);
    setError(null);
  }

  function cancel() {
    setDraft(allItems ?? []);
    setMode(null);
    setAddOpen(false);
    setError(null);
  }

  function removeAt(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }

  function addPage(page: { href: string; label: string }) {
    setDraft((current) => [...current, { id: `new-${Date.now()}`, label: page.label, href: page.href }]);
    setAddOpen(false);
  }

  function onDrop(target: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === target) return;
    setDraft((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: draft.map((d) => ({
            id: d.id.startsWith('new-') || d.id.startsWith('default-') ? undefined : d.id,
            label: d.label,
            href: d.href,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setMode(null);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const editing = mode !== null;
  // V rezimu uprav pracujeme s celym seznamem, jinak s tim, co uzivatel vidi.
  const shown: NavItem[] = editing ? draft.map((d) => ({ href: d.href, label: d.label })) : items;
  const missingPages = PORTAL_PAGES.filter((p) => !draft.some((d) => d.href === p.href));

  return (
    <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-5 flex items-center justify-between flex-wrap gap-4">
      {/* Branding "MS portal | [logo]" podle referencniho mockupu uzivatele
          (12. 9. 2026) - svisla oddelovaci cara misto "by" a znatelne vetsi
          logo (jeste zvetseno 5. 9. 2026). */}
      <Link href="/projekty" className="flex items-center gap-3 sm:gap-4 no-underline">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-16 w-auto" />
      </Link>

      <nav className="flex items-center gap-5 sm:gap-8 flex-wrap font-heading text-sm font-medium">
        {shown.map((item, index) => {
          const external = isExternalHref(item.href);
          // "/admin" (Firmy) by jinak jako prefix odpovidal i "/admin/users" -
          // proto je Firmy aktivni jen presne na /admin nebo na detailu firmy.
          const active =
            editing || external || !pathname
              ? false
              : item.href === '/admin'
                ? pathname === '/admin' || pathname.startsWith('/admin/companies')
                : pathname.startsWith(item.href);
          const className = `pb-2 border-b-2 transition-colors ${
            active ? 'text-brand-green border-brand-green' : 'text-white/90 border-transparent hover:text-white'
          }`;

          if (editing) {
            return (
              <span
                key={`${item.href}-${index}`}
                draggable={mode === 'move'}
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                className={`relative pb-2 border-b-2 border-dashed border-white/40 text-white/90 select-none ${
                  mode === 'move' ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
              >
                {item.label}
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    title={`Odebrat ${item.label}`}
                    aria-label={`Odebrat ${item.label}`}
                    className="absolute -top-2.5 -left-3 w-5 h-5 rounded-full bg-white text-brand-purpleDeep text-xs font-bold leading-none flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          }

          if (external) {
            return (
              <a key={`${item.href}-${index}`} href={item.href} target="_blank" rel="noreferrer" className={className}>
                {item.label}
              </a>
            );
          }

          return (
            <Link
              key={`${item.href}-${index}`}
              href={item.href}
              // "/projekty" tahá při každém zobrazení živá data z Caflou, takže
              // výchozí prefetch by ho natahoval při každém vykreslení lišty -
              // zbytečné riziko rate-limitu na Caflou API.
              prefetch={item.href === '/projekty' ? false : undefined}
              className={className}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Přidání zkratky - jen v režimu Upravit. */}
        {mode === 'edit' && (
          <span className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              disabled={missingPages.length === 0}
              title="Přidat zkratku"
              className="w-7 h-7 rounded-full border border-dashed border-white/60 text-white text-lg leading-none flex items-center justify-center hover:bg-white/10 disabled:opacity-40"
            >
              +
            </button>
            {addOpen && missingPages.length > 0 && (
              <div className="absolute left-0 mt-2 bg-white rounded-lg shadow-lg border border-line py-1 min-w-[180px] z-20">
                {missingPages.map((p) => (
                  <button
                    key={p.href}
                    type="button"
                    onClick={() => addPage(p)}
                    className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </span>
        )}

        {/* Tři tečky - úpravy lišty. Vidí je jen Žůžo-labůžo. */}
        {isAdmin && !editing && (
          <span className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="Upravit lištu"
              aria-label="Upravit lištu"
              className="w-7 h-7 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex flex-col items-center justify-center gap-[3px]"
            >
              <span className="w-[3px] h-[3px] rounded-full bg-current" />
              <span className="w-[3px] h-[3px] rounded-full bg-current" />
              <span className="w-[3px] h-[3px] rounded-full bg-current" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-line py-1 min-w-[150px] z-20">
                <button
                  type="button"
                  onClick={() => startMode('edit')}
                  className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field"
                >
                  Upravit
                </button>
                <button
                  type="button"
                  onClick={() => startMode('move')}
                  className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field"
                >
                  Přesunout
                </button>
              </div>
            )}
          </span>
        )}

        {editing && (
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-brand-green text-ink font-heading font-semibold text-xs rounded-pill px-4 py-1.5 disabled:opacity-60"
            >
              {saving ? 'Ukládám…' : 'Hotovo'}
            </button>
            <button type="button" onClick={cancel} className="text-white/70 hover:text-white text-xs font-heading">
              Zrušit
            </button>
          </span>
        )}
      </nav>

      <div className="relative flex items-center gap-3">
        {editing && (
          <span className="text-white/70 text-xs font-body hidden lg:block max-w-[220px]">
            {mode === 'edit'
              ? 'Křížkem odeberete odkaz, „+" přidá zkratku.'
              : 'Přetažením změníte pořadí odkazů.'}
          </span>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-heading text-brand-green bg-white/10 border border-white/20 rounded-pill px-3.5 py-2"
        >
          {userLabel}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-line py-1 min-w-[160px] z-10">
            <Link href="/muj-ucet" className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field no-underline">
              Můj účet
            </Link>
            {isAdmin && (
              <Link href="/admin" className="block w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field no-underline">
                Administrace
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full text-left px-4 py-2 text-sm font-body text-ink hover:bg-field"
            >
              Odhlásit se
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="w-full text-xs text-white bg-red-600/80 rounded-lg px-3 py-2 m-0">{error}</p>
      )}
    </header>
  );
}
