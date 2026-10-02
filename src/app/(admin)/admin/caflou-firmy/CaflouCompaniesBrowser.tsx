'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CaflouContactKind } from '@prisma/client';
import {
  CONTACT_KIND_CLASSES,
  CONTACT_KIND_OPTIONS,
  nazevDruhuKontaktu,
} from '@/lib/caflouCompanies';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { useRazeni, ThRadit } from '@/app/(portal)/components/RaditelnaTabulka';
import { VyberPole } from '@/components/VyberPole';

export type CaflouCompanyRow = {
  id: string;
  name: string;
  ic: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  kind: CaflouContactKind;
  /** Podle ceho se to roztridilo (odhad pri nacteni), null u rucni volby. */
  kindReason: string | null;
  /** Nalezena shoda s tim, co uz v portalu je - kvuli duplicitam. */
  existing: { label: string; where: string } | null;
};

type Filter = 'vse' | CaflouContactKind | 'duplicity';

/**
 * Firmy z Caflou k roztrideni (zadani 8. 9. 2026: "jsou tam najednou klienti
 * i herci, to bychom si roztridili").
 *
 * Import bezi po strankach z prohlizece - jeden pozadavek pres cely ucet by
 * na serveru vyprsel. Nic se nezaklada do Firem ani k Uzivatelum, takze
 * import nemuze vyrobit duplicitu; u kazdeho radku je naopak videt, jestli uz
 * neco takoveho v portalu je.
 */
export function CaflouCompaniesBrowser({ items }: { items: CaflouCompanyRow[] }) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('vse');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [report, setReport] = useState<{ nazev: string; akce: string; detail: string }[] | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { vse: items.length, duplicity: 0 };
    for (const kind of CONTACT_KIND_OPTIONS) map[kind] = 0;
    for (const item of items) {
      map[item.kind] = (map[item.kind] ?? 0) + 1;
      if (item.existing) map.duplicity += 1;
    }
    return map;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'duplicity' ? !item.existing : filter !== 'vse' && item.kind !== filter) return false;
      if (!needle) return true;
      const haystack = [item.name, item.ic ?? '', item.email ?? '', item.phone ?? '', item.city ?? '']
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
    });
  }, [items, filter, query]);

  // Razeni kliknutim na nazev sloupce (zadani 9. 9. 2026). Pravidla jsou
  // spolecna s ostatnimi tabulkami - viz components/RaditelnaTabulka.
  const { razeni, prepni, serad } = useRazeni<(typeof items)[number]>({ key: 'nazev' });
  const serazene = serad(visible, {
    nazev: (i) => i.name,
    ic: (i) => i.ic ?? null,
    kontakt: (i) => i.email ?? i.phone ?? null,
    mesto: (i) => i.city ?? null,
    // Firmy, ktere v portalu jeste nejsou, jdou napred - to je to, co se resi.
    vPortalu: (i) => (i.existing ? 1 : 0),
    kdoToJe: (i) => i.kind,
  });

  /**
   * Natahne vsechno najednou (zadani 8. 9. 2026): nacte firmy z Caflou,
   * rovnou odhadne, kdo je klient a kdo herec, a co je rozhodnuto, prenese
   * do portalu. Co odhad nerozhodne, zustane tady k rucnimu projiti.
   */
  async function runImport(prenest = false) {
    setImporting(true);
    setError(null);
    setReport(null);
    setProgress(t('caflou.nacitam'));
    try {
      // Typy jsou tu vypsane schvalne. Bez nich TypeScript hlasil "'res'
      // implicitly has type 'any' ... referenced directly or indirectly in its
      // own initializer" a build na Vercelu spadl: odpoved fetche se rozbaluje
      // pres `any` a zaroven z ni vychazi promenna `page`, kterou se ridi tahle
      // smycka - odvozeni typu se tim zacyklilo.
      let page: number | null = 1;
      let total = 0;
      // Pojistka proti nekonecne smycce, kdyby Caflou parametr page ignorovalo.
      for (let guard = 0; page !== null && guard < 60; guard += 1) {
        const res: Response = await fetch('/api/admin/caflou-firmy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, autoKind: true }),
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || t('caflou.importNezdaril'));
          return;
        }
        total += Number(data?.ulozeno ?? 0);
        setProgress(t('caflou.nacteno', { pocet: total }));
        page = typeof data?.dalsiStranka === 'number' ? data.dalsiStranka : null;
      }
      if (!prenest) {
        setProgress(t('caflou.hotovoNacteno', { pocet: total }));
        router.refresh();
        return;
      }
      setProgress(t('caflou.nactenoPrenasim', { pocet: total }));
      const resPrenos: Response = await fetch('/api/admin/caflou-firmy/zalozit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vse: true }),
      });
      const data: any = await resPrenos.json().catch(() => ({}));
      if (!resPrenos.ok) {
        setError(data?.error || t('caflou.prenosNezdaril'));
        return;
      }
      setReport(Array.isArray(data?.vysledky) ? data.vysledky : []);
      setProgress(
        t('caflou.souhrnPrenosu', {
          nacteno: total,
          zalozeno: data?.zalozeno ?? 0,
          doplneno: data?.doplneno ?? 0,
          preskoceno: data?.preskoceno ?? 0,
        }),
      );
      router.refresh();
    } catch {
      setError(t('caflou.importNezdaril'));
    } finally {
      setImporting(false);
    }
  }

  /**
   * Prenese roztridene radky do portalu - klienty do Firem, herce mezi
   * uzivatele. Uz zalozene zaznamy se nezakladaji znovu, jen se u nich
   * doplni prazdna pole (server to hlida znovu, viz /zalozit).
   */
  async function transferToPortal() {
    const ids = items.filter((i) => i.kind === 'KLIENT' || i.kind === 'HEREC').map((i) => i.id);
    if (ids.length === 0) {
      setError(t('caflou.nejdrivRoztridit'));
      return;
    }
    setTransferring(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/caflou-firmy/zalozit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('caflou.prenosNezdaril'));
        return;
      }
      setReport(Array.isArray(data?.vysledky) ? data.vysledky : []);
      setProgress(
        t('caflou.souhrnZalozeni', {
          zalozeno: data?.zalozeno ?? 0,
          doplneno: data?.doplneno ?? 0,
          preskoceno: data?.preskoceno ?? 0,
        }),
      );
      router.refresh();
    } catch {
      setError(t('caflou.prenosNezdaril'));
    } finally {
      setTransferring(false);
    }
  }

  /**
   * Prenese do portalu JEDEN radek (zadani 10. 9. 2026: "hromadne mi to pada,
   * tak to zkusim po jednom").
   *
   * Jde o stejnou routu jako u hromadneho prenosu, jen s jednim ID - pravidla
   * (nic dvakrat, nic neprepisovat) tedy plati uplne stejne. Vyhoda je, ze
   * kdyz jeden zaznam spadne, nestrhne s sebou zbytek davky a je hned videt,
   * ktery to byl.
   */
  async function transferOne(id: string, nazev: string) {
    setBusyId(id);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/caflou-firmy/zalozit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t('caflou.chybaUFirmy', { nazev, chyba: data?.error || t('caflou.prenosNezdarilMale') }));
        return;
      }
      setReport(Array.isArray(data?.vysledky) ? data.vysledky : []);
      setProgress(
        t('caflou.souhrnJednoho', {
          nazev,
          zalozeno: data?.zalozeno ?? 0,
          doplneno: data?.doplneno ?? 0,
          preskoceno: data?.preskoceno ?? 0,
        }),
      );
      router.refresh();
    } catch {
      setError(t('caflou.chybaUFirmy', { nazev, chyba: t('caflou.prenosNezdarilMale') }));
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Dopsani e-mailu primo v tabulce (zadani 10. 9. 2026: "zařvalo mi to, že
   * nemůže, protože chybí email... nemůžu ho pak třeba v tom bodě doplnit
   * ručně a projde to?").
   *
   * Uklada se na radek nactený z Caflou, ne rovnou na ucet - ucet totiz jeste
   * neexistuje, prave proto prenos nesel. Pri dalsim pokusu uz e-mail je
   * a herec se zalozi. Zustane i pro hromadny prenos.
   */
  async function setEmail(id: string, email: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/caflou-firmy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('caflou.emailNeulozen'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('caflou.emailNeulozen'));
    } finally {
      setBusyId(null);
    }
  }

  async function setKind(id: string, kind: CaflouContactKind) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/caflou-firmy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        setError(t('firma.ulozeniNezdarilo'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('firma.ulozeniNezdarilo'));
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'vse', label: t('caflou.vse') },
    { key: 'NEZARAZENO', label: nazevDruhuKontaktu('NEZARAZENO', jazyk) },
    { key: 'KLIENT', label: nazevDruhuKontaktu('KLIENT', jazyk) },
    { key: 'HEREC', label: nazevDruhuKontaktu('HEREC', jazyk) },
    { key: 'IGNOROVAT', label: nazevDruhuKontaktu('IGNOROVAT', jazyk) },
    { key: 'duplicity', label: t('caflou.uzVPortalu') },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="hidden sm:block font-display text-3xl text-ink m-0">{t('caflou.nadpis')}</h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end flex-wrap">
            <button
              type="button"
              onClick={() => runImport(false)}
              disabled={importing || transferring}
              className="font-heading font-semibold text-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              {importing ? t('caflou.pracuji') : t('caflou.jenNacist')}
            </button>
            <button
              type="button"
              onClick={transferToPortal}
              disabled={transferring || importing || counts.KLIENT + counts.HEREC === 0}
              title={t('caflou.prenestRoztrideneTitul')}
              className="font-heading font-semibold text-sm rounded-lg border border-line bg-surface px-4 py-2.5 text-brand-purple hover:border-brand-purple transition-colors disabled:opacity-60"
            >
              {transferring
                ? t('caflou.prenasim')
                : t('caflou.prenestRoztridene', { pocet: counts.KLIENT + counts.HEREC })}
            </button>
            <button
              type="button"
              onClick={() => runImport(true)}
              disabled={importing || transferring}
              title={t('caflou.nacistAPrenestTitul')}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {importing || transferring ? t('caflou.pracuji') : t('caflou.nacistAPrenest')}
            </button>
          </div>
          {progress && <p className="text-xs font-body text-muted m-0 mt-1.5">{progress}</p>}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>
      )}

      {report && report.length > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-4 max-h-64 overflow-y-auto">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 mb-2">
            {t('caflou.coSeStalo')}
          </h2>
          <ul className="m-0 pl-0 list-none flex flex-col gap-1.5">
            {report.map((r, index) => (
              <li key={`${r.nazev}-${index}`} className="text-sm font-body text-ink">
                <span
                  className={`inline-block min-w-[86px] text-xs font-heading font-semibold ${
                    r.akce === 'zalozeno'
                      ? 'text-status-done'
                      : r.akce === 'doplneno'
                        ? 'text-brand-purpleDark'
                        : 'text-status-progress'
                  }`}
                >
                  {r.akce === 'zalozeno'
                    ? t('caflou.zalozeno')
                    : r.akce === 'doplneno'
                      ? t('caflou.doplneno')
                      : t('caflou.preskoceno')}
                </span>
                {r.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap border-b border-line">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2.5 text-sm font-heading font-semibold rounded-t-lg -mb-px border border-b-0 transition-colors ${
                  active ? 'bg-surface border-line text-brand-purple' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab.label} ({counts[tab.key] ?? 0})
              </button>
            );
          })}
        </div>
        <div className="mb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('caflou.hledat')}
            className="w-64 max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple"
          />
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-field [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[1020px] border-collapse">
            <thead>
              <tr className="bg-brand-purple text-white font-heading text-xs">
                <ThRadit label={t('caflou.sloupecNazev')} sloupec="nazev" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label={t('caflou.sloupecIc')} sloupec="ic" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label={t('caflou.sloupecKontakt')} sloupec="kontakt" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label={t('caflou.sloupecMesto')} sloupec="mesto" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label={t('caflou.uzVPortalu')} sloupec="vPortalu" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <ThRadit label={t('caflou.sloupecKdoToJe')} sloupec="kdoToJe" razeni={razeni} prepni={prepni} trida="px-3" naFialovem />
                <th className="text-left px-3 py-3.5 whitespace-nowrap">{t('caflou.sloupecPrenest')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm font-body">
                    {items.length === 0 ? t('caflou.prazdno') : t('caflou.nicNeodpovida')}
                  </td>
                </tr>
              )}
              {serazene.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-surfaceSoft">
                  <td className="px-3 py-3.5 font-heading font-semibold text-sm text-ink">{item.name}</td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted tabular-nums whitespace-nowrap">
                    {item.ic ?? '—'}
                  </td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted">
                    {/* Herec bez e-mailu nejde zalozit - e-mail je prihlasovaci
                        udaj. Misto aby clovek musel do Caflou a nacitat znovu,
                        dopise ho rovnou tady (zadani 10. 9. 2026). */}
                    {item.kind === 'HEREC' && !item.email ? (
                      <input
                        type="email"
                        defaultValue=""
                        disabled={busyId === item.id}
                        placeholder={t('caflou.dopisteEmail')}
                        onBlur={(e) => {
                          const hodnota = e.target.value.trim();
                          if (hodnota) void setEmail(item.id, hodnota);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-[180px] rounded-lg border border-dashed border-brand-purple/60 bg-field px-2 py-1 text-sm font-heading text-ink outline-none focus:border-brand-purple disabled:opacity-50"
                      />
                    ) : (
                      item.email ?? '—'
                    )}
                    {item.phone && <span className="block text-xs font-body text-muted/80">{item.phone}</span>}
                  </td>
                  <td className="px-3 py-3.5 text-sm font-heading text-muted">{item.city ?? '—'}</td>
                  <td className="px-3 py-3.5 text-sm font-heading">
                    {item.existing ? (
                      <span className="inline-flex flex-col">
                        <span className="text-ink">{item.existing.label}</span>
                        <span className="text-xs font-body text-muted/80">{item.existing.where}</span>
                      </span>
                    ) : (
                      <span className="text-muted/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <VyberPole
                      value={item.kind}
                      disabled={busyId === item.id}
                      onChange={(e) => setKind(item.id, e.target.value as CaflouContactKind)}
                      className={`rounded-pill border-0 px-3 py-1.5 text-xs font-heading font-semibold outline-none disabled:opacity-50 ${CONTACT_KIND_CLASSES[item.kind]}`}
                    >
                      {CONTACT_KIND_OPTIONS.map((kind) => (
                        <option key={kind} value={kind}>
                          {nazevDruhuKontaktu(kind, jazyk)}
                        </option>
                      ))}
                    </VyberPole>
                    {item.kindReason && (
                      <span className="block text-xs font-body text-muted/80 mt-1 max-w-[180px] whitespace-normal">
                        {item.kindReason}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    {/* Prenos po jednom (zadani 10. 9. 2026) - hromadny prenos
                        na velkem poctu zaznamu padal. */}
                    {item.kind === 'KLIENT' || item.kind === 'HEREC' ? (
                      <button
                        type="button"
                        onClick={() => void transferOne(item.id, item.name)}
                        disabled={busyId === item.id || transferring || importing}
                        className="font-heading font-semibold text-xs rounded-lg px-3 py-1.5 border border-line text-brand-purple hover:bg-tint transition-colors disabled:opacity-50"
                      >
                        {busyId === item.id ? t('caflou.prenasim') : t('caflou.prenest')}
                      </button>
                    ) : (
                      <span className="text-xs font-body text-muted/60">{t('caflou.nejdrivVyberteVlevo')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
