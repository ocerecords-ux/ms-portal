'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KATEGORIE_NAVODU, navodNaHtml } from '@/lib/navody';
import { ROLE_LABELS } from '@/lib/roles';
import { ALL_ROLES } from '@/lib/menu';

/**
 * Psaní návodu (zadání 16. 9. 2026).
 *
 * VLEVO TEXT, VPRAVO NÁHLED. Návod se píše v Markdownu a jediný způsob, jak
 * nepsat naslepo, je vidět výsledek vedle — překlad je tentýž jako na stránce
 * návodu (lib/navody.ts), takže náhled nelže.
 */
export type NavodKUprave = {
  id: string;
  nazev: string;
  perex: string;
  kategorie: string;
  obsah: string;
  poradi: number;
  zverejneno: boolean;
  proRole: string[];
};

export function NavodForm({ navod }: { navod: NavodKUprave }) {
  const router = useRouter();
  const [n, setN] = useState<NavodKUprave>(navod);
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [mazani, setMazani] = useState(false);

  const nahled = useMemo(() => navodNaHtml(n.obsah), [n.obsah]);
  const nastav = <K extends keyof NavodKUprave>(klic: K, hodnota: NavodKUprave[K]) =>
    setN((p) => ({ ...p, [klic]: hodnota }));

  async function uloz() {
    if (bezi) return;
    setBezi(true);
    setChyba(null);
    setZprava(null);
    try {
      const res = await fetch(`/api/admin/navody/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: n.nazev,
          perex: n.perex,
          kategorie: n.kategorie,
          obsah: n.obsah,
          poradi: n.poradi,
          zverejneno: n.zverejneno,
          proRole: n.proRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložení se nepodařilo.');
        return;
      }
      setZprava('Uloženo.');
      router.refresh();
    } catch {
      setChyba('Uložení se nepodařilo.');
    } finally {
      setBezi(false);
    }
  }

  async function smaz() {
    if (!mazani) {
      setMazani(true);
      return;
    }
    setBezi(true);
    try {
      const res = await fetch(`/api/admin/navody/${n.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setChyba('Smazání se nepodařilo.');
        return;
      }
      router.push('/admin/navody');
    } finally {
      setBezi(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4 flex-wrap">
        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <span className="text-sm font-heading font-semibold text-ink">Název</span>
          <input value={n.nazev} onChange={(e) => nastav('nazev', e.target.value)} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 w-48">
          <span className="text-sm font-heading font-semibold text-ink">Kategorie</span>
          <input
            value={n.kategorie}
            onChange={(e) => nastav('kategorie', e.target.value)}
            list="kategorie-navodu"
            className="admin-input"
          />
          <datalist id="kategorie-navodu">
            {KATEGORIE_NAVODU.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 w-24">
          <span className="text-sm font-heading font-semibold text-ink">Pořadí</span>
          <input
            type="number"
            value={n.poradi}
            onChange={(e) => nastav('poradi', parseInt(e.target.value, 10) || 0)}
            className="admin-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">Perex</span>
        <input
          value={n.perex}
          onChange={(e) => nastav('perex', e.target.value)}
          placeholder="Jedna věta do seznamu — o čem návod je."
          className="admin-input"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-heading font-semibold text-ink">
            Text návodu <span className="font-normal text-muted">(Markdown)</span>
          </span>
          <textarea
            value={n.obsah}
            onChange={(e) => nastav('obsah', e.target.value)}
            rows={22}
            spellCheck
            className="admin-input font-mono text-xs leading-relaxed"
            placeholder={'## Nadpis\n\nOdstavec textu.\n\n- odrážka\n- druhá\n\n![Popis obrázku](/navody/soubor.png)'}
          />
        </label>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-heading font-semibold text-ink">Náhled</span>
          <div
            className="navod-text bg-surface rounded-lg border border-line p-4 overflow-auto max-h-[520px]"
            dangerouslySetInnerHTML={{ __html: nahled }}
          />
        </div>
      </div>

      <div className="flex gap-6 flex-wrap items-start">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={n.zverejneno}
            onChange={(e) => nastav('zverejneno', e.target.checked)}
            className="w-4 h-4 accent-brand-purple"
          />
          <span className="text-sm font-body text-ink">
            Zveřejnit
            <span className="block text-xs text-muted">dokud není zaškrtnuté, vidíte návod jen vy</span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            Komu se ukáže
            <span className="block text-xs text-muted">nic nezaškrtnuto = všem přihlášeným</span>
          </span>
          <div className="flex gap-3 flex-wrap">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={n.proRole.includes(role)}
                  onChange={(e) =>
                    nastav(
                      'proRole',
                      e.target.checked
                        ? [...n.proRole, role]
                        : n.proRole.filter((r) => r !== role),
                    )
                  }
                  className="w-4 h-4 accent-brand-purple"
                />
                <span className="text-xs font-body text-ink">{ROLE_LABELS[role]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {chyba && <p className="text-sm font-body text-danger m-0">{chyba}</p>}
      {zprava && <p className="text-sm font-body text-brand-greenDeep m-0">{zprava}</p>}

      <div className="flex gap-3 items-center flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={bezi}
          className="text-sm font-heading font-semibold rounded-pill bg-brand-purple text-white px-6 py-3 disabled:opacity-60"
        >
          {bezi ? 'Ukládám…' : 'Uložit návod'}
        </button>
        <button
          type="button"
          onClick={() => void smaz()}
          disabled={bezi}
          className={`text-sm font-heading font-semibold rounded-pill border px-4 py-2.5 transition-colors ${
            mazani ? 'border-danger text-danger bg-dangerTint' : 'border-line text-muted hover:border-danger'
          }`}
        >
          {mazani ? 'Opravdu smazat?' : 'Smazat'}
        </button>
      </div>
    </div>
  );
}
