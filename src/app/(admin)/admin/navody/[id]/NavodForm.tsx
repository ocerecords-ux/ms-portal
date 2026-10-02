'use client';

import { useMemo, useState } from 'react';
import { Volba, prepniVSeznamu } from '@/components/Volba';
import { useRouter } from 'next/navigation';
import { DRUHY_ZAKAZEK, KATEGORIE_NAVODU, navodNaHtml, nazevDruhuZakazky } from '@/lib/navody';
import { nazevRole } from '@/lib/roles';
import { ALL_ROLES } from '@/lib/menu';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

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
  /** Pro ktery druh zakazek je navod psany (24. 9. 2026). */
  proDruhy: string[];
};

export function NavodForm({ navod }: { navod: NavodKUprave }) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  const [n, setN] = useState<NavodKUprave>(navod);
  const [bezi, setBezi] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [mazani, setMazani] = useState(false);

  const nahled = useMemo(() => navodNaHtml(n.obsah), [n.obsah]);
  const [nahravam, setNahravam] = useState(false);
  const [chybaObrazku, setChybaObrazku] = useState<string | null>(null);

  /** Nahraje printscreen a připíše ho na konec textu jako Markdown obrázek. */
  async function vlozObrazek(soubor: File) {
    setNahravam(true);
    setChybaObrazku(null);
    try {
      const fd = new FormData();
      fd.append('obrazek', soubor);
      const res = await fetch('/api/admin/navody/obrazek', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setChybaObrazku(data?.error || t('navod.obrazekNenahran'));
        return;
      }
      // Popis obrazku je soucast textu navodu, tedy data - zustava, jak je.
      const popis = (soubor.name || 'obrázek').replace(/\.[^.]+$/, '');
      setN((p) => ({ ...p, obsah: `${p.obsah}${p.obsah.endsWith('\n') || !p.obsah ? '' : '\n'}\n![${popis}](${data.url})\n` }));
    } catch {
      setChybaObrazku(t('navod.obrazekNenahran'));
    } finally {
      setNahravam(false);
    }
  }
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
          proDruhy: n.proDruhy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || t('navod.neulozeno'));
        return;
      }
      setZprava(t('navod.ulozeno'));
      router.refresh();
    } catch {
      setChyba(t('navod.neulozeno'));
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
        setChyba(t('navod.nesmazano'));
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
          <span className="text-sm font-heading font-semibold text-ink">{t('navod.nazev')}</span>
          <input value={n.nazev} onChange={(e) => nastav('nazev', e.target.value)} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 w-48">
          <span className="text-sm font-heading font-semibold text-ink">{t('navod.kategorie')}</span>
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
          <span className="text-sm font-heading font-semibold text-ink">{t('navod.poradi')}</span>
          <input
            type="number"
            value={n.poradi}
            onChange={(e) => nastav('poradi', parseInt(e.target.value, 10) || 0)}
            className="admin-input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-heading font-semibold text-ink">{t('navod.perex')}</span>
        <input
          value={n.perex}
          onChange={(e) => nastav('perex', e.target.value)}
          placeholder={t('navod.perexPlaceholder')}
          className="admin-input"
        />
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-heading font-semibold text-ink">
              {t('navod.text')} <span className="font-normal text-muted">{t('navod.textMarkdown')}</span>
            </span>
            {/* VLOŽENÍ OBRÁZKU (zadání 28. 9. 2026: „vkládat k textu obrázky -
                printscreeny"). Soubor jde do úložiště a do textu se připíše
                jen odkaz - printscreen v textu jako data: URL by článek
                nafoukl o stovky kB a nesl by se při každém načtení. */}
            <span className="flex items-center gap-2">
              {chybaObrazku && (
                <span className="text-xs font-body text-danger">{chybaObrazku}</span>
              )}
              <label className="text-xs font-heading font-semibold rounded-pill border border-line text-muted px-3 py-1.5 cursor-pointer hover:text-brand-purple hover:border-brand-purple">
                {nahravam ? t('navod.nahravam') : t('navod.pridatObrazek')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={nahravam}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void vlozObrazek(f);
                  }}
                />
              </label>
            </span>
          </span>
          <textarea
            value={n.obsah}
            onChange={(e) => nastav('obsah', e.target.value)}
            rows={22}
            spellCheck
            className="admin-input font-mono text-xs leading-relaxed"
            placeholder={t('navod.textPlaceholder')}
          />
        </label>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-heading font-semibold text-ink">{t('navod.nahled')}</span>
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
            {t('navod.zverejnit')}
            <span className="block text-xs text-muted">{t('navod.zverejnitPopis')}</span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            {t('navod.komuSeUkaze')}
            <span className="block text-xs text-muted">{t('navod.komuSeUkazePopis')}</span>
          </span>
          <div className="flex gap-2 flex-wrap">
            {/* Klient studia (25. 9. 2026) sem patří taky - má vlastní
                nápovědu na /studio/napoveda. V ALL_ROLES schválně není:
                ten seznam řídí přístup ke stránkám portálu. */}
            {[...ALL_ROLES, 'BOOKING' as const].map((role) => (
              <Volba
                key={role}
                maly
                vybrano={n.proRole.includes(role)}
                onZmena={(zapnout) => nastav('proRole', prepniVSeznamu(n.proRole, role, zapnout))}
              >
                {nazevRole(role, jazyk)}
              </Volba>
            ))}
          </div>
        </div>

        {/* Druh zakazek (zadani 24. 9. 2026: „je treba rozlisit dva druhy -
            pro audioknihy a pro reklamy, podle toho by se i navody mely
            objevovat klientovi"). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            {t('navod.proJakeZakazky')}
            <span className="block text-xs text-muted">{t('navod.proJakeZakazkyPopis')}</span>
          </span>
          <div className="flex gap-2 flex-wrap">
            {DRUHY_ZAKAZEK.map((druh) => (
              <Volba
                key={druh}
                maly
                vybrano={n.proDruhy.includes(druh)}
                onZmena={(zapnout) => nastav('proDruhy', prepniVSeznamu(n.proDruhy, druh, zapnout))}
              >
                {nazevDruhuZakazky(druh, jazyk)}
              </Volba>
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
          {bezi ? t('obecne.ukladam') : t('navod.ulozitNavod')}
        </button>
        <button
          type="button"
          onClick={() => void smaz()}
          disabled={bezi}
          className={`text-sm font-heading font-semibold rounded-pill border px-4 py-2.5 transition-colors ${
            mazani ? 'border-danger text-danger bg-dangerTint' : 'border-line text-muted hover:border-danger'
          }`}
        >
          {mazani ? t('mazani.opravduSmazat') : t('obecne.smazat')}
        </button>
      </div>
    </div>
  );
}
