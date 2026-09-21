'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type DalsiPriloha = { id: string; nazev: string };

/**
 * Přílohy uloženého výdaje (zadání 21. 9. 2026: „potřeboval bych zpětně
 * upravovat výdaje a přidávat přílohy").
 *
 * Hlavní příloha je doklad sám - ukazuje se v náhledu vpravo. Další přílohy
 * (dodací list, objednávka, druhá strana účtenky…) jsou pod ní. Když doklad
 * přílohu nemá, první nahraný soubor se stane hlavní.
 */
export function PrilohyVydaje({
  expenseId,
  hlavni,
  dalsi,
}: {
  expenseId: string;
  hlavni: { nazev: string | null } | null;
  dalsi: DalsiPriloha[];
}) {
  const router = useRouter();
  const vstup = useRef<HTMLInputElement | null>(null);
  const [pracuji, setPracuji] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const zaklad = `/api/admin/expenses/${encodeURIComponent(expenseId)}`;

  async function nahraj(soubory: File[]) {
    if (soubory.length === 0) return;
    setPracuji(true);
    setChyba(null);
    try {
      const body = new FormData();
      for (const s of soubory) body.append('soubor', s);
      const res = await fetch(`${zaklad}/prilohy`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Přílohu se nepodařilo nahrát.');
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Přílohu se nepodařilo nahrát.');
    } finally {
      setPracuji(false);
      if (vstup.current) vstup.current.value = '';
    }
  }

  async function odeber(id: string) {
    if (!window.confirm('Opravdu odebrat přílohu?')) return;
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(`${zaklad}/prilohy?priloha=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Přílohu se nepodařilo odebrat.');
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Přílohu se nepodařilo odebrat.');
    } finally {
      setPracuji(false);
    }
  }

  const radky: { klic: string; nazev: string; odkaz: string; hlavni: boolean }[] = [
    ...(hlavni ? [{ klic: 'hlavni', nazev: hlavni.nazev || 'Doklad', odkaz: `${zaklad}/priloha`, hlavni: true }] : []),
    ...dalsi.map((p) => ({
      klic: p.id,
      nazev: p.nazev,
      odkaz: `${zaklad}/priloha?priloha=${encodeURIComponent(p.id)}`,
      hlavni: false,
    })),
  ];

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3">
      <span className="text-xs font-heading text-muted uppercase tracking-wide">Přílohy</span>

      {radky.length === 0 ? (
        <p className="text-sm text-muted font-body m-0">Bez přílohy.</p>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
          {radky.map((r) => (
            <li key={r.klic} className="flex items-center gap-3 flex-wrap min-w-0">
              {/* Ne primo do uloziste - portal odkaz podepise sam (15. 9. 2026). */}
              <a
                href={r.odkaz}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-heading text-brand-purple truncate max-w-full"
              >
                {r.nazev}
              </a>
              {r.hlavni && radky.length > 1 && <span className="text-xs text-muted font-body">doklad</span>}
              <a
                href={`${r.odkaz}${r.odkaz.includes('?') ? '&' : '?'}stahnout=1`}
                className="text-xs font-heading text-muted hover:text-ink no-underline"
              >
                Stáhnout
              </a>
              <button
                type="button"
                disabled={pracuji}
                onClick={() => odeber(r.klic)}
                className="text-xs font-heading text-muted hover:text-danger bg-transparent border-0 cursor-pointer disabled:opacity-60"
              >
                Odebrat
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={vstup}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => void nahraj(Array.from(e.target.files ?? []))}
      />
      <button
        type="button"
        disabled={pracuji}
        onClick={() => vstup.current?.click()}
        className="self-start text-sm font-heading font-semibold text-brand-purple bg-transparent border border-line rounded-lg px-3 py-1.5 hover:border-brand-purple disabled:opacity-60"
      >
        {pracuji ? 'Pracuji…' : radky.length === 0 ? '+ Nahrát doklad' : '+ Přidat přílohu'}
      </button>
      {chyba && <p className="text-danger text-sm m-0">{chyba}</p>}
    </div>
  );
}
