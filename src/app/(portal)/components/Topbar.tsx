'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { isExternalHref, type NavItem } from '@/lib/menu';
import { initials } from '@/lib/chat';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

/**
 * Horní fialová lišta. Odkazy si upravuje přímo tady každý sám - tři tečky
 * vpravo a lišta se dá rovnou přetahovat, mazat i doplňovat, jako na ploše
 * iPhonu (zadani 8. 9. 2026).
 *
 * Lišta patří KONKRÉTNÍMU UŽIVATELI (zadani 8. 9. 2026: "když jsem si dal
 * pryč výkazy, zmizelo to i u zvukařů"). Nikomu jinému se nemění.
 *
 * Kdo co může mít v liště se nenastavuje - řídí se to právy ke stránce
 * (lib/menu.ts > PAGE_ACCESS); nabídka pod "+" proto obsahuje jen stránky,
 * na které uživatel opravdu smí.
 */
export function Topbar({
  userLabel,
  userPhotoUrl,
  items,
  pageOptions,
  unreadNotifications = 0,
}: {
  userLabel: string;
  /** Fotka z karty uživatele; bez ní se ukážou iniciály. */
  userPhotoUrl?: string | null;
  /** Kolik nepřečtených oznámení má uživatel pod zvonkem. */
  unreadNotifications?: number;
  /** Vlastní lišta přihlášeného uživatele. */
  items: NavItem[];
  /** Stránky, které si smí do lišty přidat. */
  pageOptions: NavItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Jeden rezim uprav, ne dva (zadani 8. 9. 2026: "je blbost upravovat na
  // dvakrát. Stačí kliknout na tři tečky a můžeš upravit i přesunout") -
  // v nem jde zaroven odebirat, pridavat i pretahovat poradi.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NavItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);

  // Kdyz server posle novy seznam, prepiseme rozdelanou praci jen mimo rezim uprav.
  useEffect(() => {
    if (!editing) setDraft(items);
  }, [items, editing]);

  function startEditing() {
    setDraft(items);
    setEditing(true);
    setAddOpen(false);
    setError(null);
  }

  function cancel() {
    setDraft(items);
    setEditing(false);
    setAddOpen(false);
    setError(null);
  }

  function removeAt(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }

  function addPage(page: { href: string; label: string }) {
    setDraft((current) => [...current, { label: page.label, href: page.href }]);
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

  /** Zpet na vychozi listu - smaze vlastni nastaveni uzivatele. */
  async function resetToDefault() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/menu', { method: 'DELETE' });
      if (!res.ok) {
        setError('Obnovení se nezdařilo.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Obnovení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: draft.map((d) => ({ label: d.label, href: d.href })) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  const shown: NavItem[] = editing ? draft : items;
  const missingPages = pageOptions.filter((p) => !draft.some((d) => d.href === p.href));

  return (
    // Lista zustava nahore i pri rolovani (zadani 9. 9. 2026: "hlavni fialova
    // lista at je na celem portalu zakotvena, ze nezmizi"). Vyssi vrstva nez
    // vysouvaci panely po stranach, at ji nic neprekryje.
    //
    // Lista se pri uprave NESMI prelamovat (zprava uzivatele 9. 9. 2026:
    // "cele to menu pri uprave ujede nekam doprava a jmeno s fotkou
    // a zvonecek se da na dalsi radek, chci at se to upravuje na tom samem
    // miste"). Drive tu bylo flex-wrap a v rezimu uprav pribyly krizky,
    // tlacitko "+" a Hotovo/Zrusit/Vychozi - rada se proto zalomila a cela
    // lista poskocila. Ted se misto toho v uzkem miste posouvaji odkazy do
    // stran; jmeno, zvonecek ani prepinac se nikam nestehuji.
    <header className="sticky top-0 z-50 bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-6 sm:px-10 py-5 flex items-center justify-between gap-4 shadow-md">
      {/* Branding "MS portal | [logo]" podle referencniho mockupu uzivatele
          (12. 9. 2026) - svisla oddelovaci cara misto "by" a znatelne vetsi
          logo (jeste zvetseno 5. 9. 2026). */}
      <Link href="/projekty" className="flex items-center gap-3 sm:gap-4 no-underline">
        <span className="font-body text-brand-green font-semibold text-2xl sm:text-3xl">MS portal</span>
        <span className="w-px h-8 sm:h-10 bg-white/40" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-12 sm:h-16 w-auto" />
      </Link>

      {/* py-3 -my-3: posuvny pruh oreze vsechno, co z nej cni - a krizky
          u odkazu cni nahoru, takze se usekavaly (zprava uzivatele
          9. 9. 2026: "jsou useknute krizky"). Svisle odsazeni jim udela
          misto uvnitr pruhu, zaporny okraj vrati liste puvodni vysku. */}
      <nav className="flex items-center gap-5 sm:gap-8 font-heading text-sm font-medium min-w-0 py-3 -my-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                draggable
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                title="Přetažením změníte pořadí"
                className="relative pb-2 border-b-2 border-dashed border-white/40 text-white/90 select-none cursor-grab active:cursor-grabbing"
              >
                {item.label}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  title={`Odebrat ${item.label}`}
                  aria-label={`Odebrat ${item.label}`}
                  className="absolute -top-2.5 -left-3 w-5 h-5 rounded-full bg-white text-brand-purpleDeep text-xs font-bold leading-none flex items-center justify-center shadow"
                >
                  ×
                </button>
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
              // Prefetch je od 9. 9. 2026 zapnutý (dřív byl u "/projekty"
              // vypnutý, protože by při každém vykreslení lišty tahal živá data
              // z Caflou). Od chvíle, kdy sekce mají loading.tsx, přednačte
              // Next.js jen tu kostru a k datům se nesáhne - proklik je díky
              // tomu okamžitý a Caflou to nezatěžuje.
              className={className}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Přidání zkratky. */}
        {editing && (
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
              <div className="absolute left-0 mt-2 bg-surface rounded-lg shadow-lg border border-line py-1 min-w-[180px] z-20">
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

        {/* Tři tečky - jedno kliknutí a lišta se dá rovnou upravovat
            i přetahovat. Každý si upravuje svou vlastní.

            Zelené, ne bílé (zadání 9. 9. 2026) - na fialové lište splývaly
            s odkazy a nikdo si jich nevšiml. */}
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            title="Upravit lištu"
            aria-label="Upravit lištu"
            className="w-7 h-7 rounded-full text-brand-green hover:bg-white/15 flex flex-col items-center justify-center gap-[3px] transition-colors"
          >
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
            <span className="w-[3px] h-[3px] rounded-full bg-current" />
          </button>
        )}

        {editing && (
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-brand-green text-onAccent font-heading font-semibold text-xs rounded-pill px-4 py-1.5 disabled:opacity-60"
            >
              {saving ? 'Ukládám…' : 'Hotovo'}
            </button>
            <button type="button" onClick={cancel} className="text-white/70 hover:text-white text-xs font-heading">
              Zrušit
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              disabled={saving}
              title="Vrátit lištu do původní podoby"
              className="text-white/70 hover:text-white text-xs font-heading underline disabled:opacity-50"
            >
              Výchozí
            </button>
          </span>
        )}
      </nav>

      {/* Vpravo uz zadna rozbalovaci nabidka (zadani 8. 9. 2026: "dame pryc
          rozbalovaci nabidku i tu sipku") - kliknuti na jmeno vede rovnou na
          Muj ucet, vedle je jen odhlaseni. Do administrace se chodi odkazy
          v liste (Firmy, Uzivatele, Ceniky, Doklady). */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
        <NotificationBell unread={unreadNotifications} />
        <Link
          href="/muj-ucet"
          title="Můj účet"
          className="flex items-center gap-2 text-sm font-heading text-brand-green bg-white/10 border border-white/20 rounded-pill pl-1.5 pr-3.5 py-1.5 no-underline hover:bg-white/20 transition-colors"
        >
          {/* Fotka u jmena (zadani 9. 9. 2026). Bez fotky iniciály, at lista
              nepreskakuje podle toho, kdo je prihlaseny. */}
          {userPhotoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={userPhotoUrl}
              alt=""
              className="w-7 h-7 rounded-full object-cover shrink-0 bg-white/20"
            />
          ) : (
            <span className="w-7 h-7 rounded-full bg-white/20 text-white text-[11px] font-semibold grid place-items-center shrink-0">
              {initials(userLabel)}
            </span>
          )}
          {userLabel}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Odhlásit se"
          aria-label="Odhlásit se"
          className="flex items-center justify-center w-9 h-9 rounded-pill text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="w-full text-xs text-white bg-red-600/80 rounded-lg px-3 py-2 m-0">{error}</p>
      )}
    </header>
  );
}
