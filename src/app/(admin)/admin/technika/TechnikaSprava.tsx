'use client';

import { useMemo, useRef, useState } from 'react';
import { useJazyk } from '@/app/(portal)/components/JazykProvider';

/**
 * TECHNIKA (zadání 22. 10. 2026). Seznam kusů rozdělený do kategorií, u
 * každého kusu je vidět, ve kterém studiu stojí - a přepínačem se dá totéž
 * přečíst obráceně, tedy po studiích.
 *
 * POPISKY JSOU PSANÉ TADY, ne přes `lib/jazyk.ts`: ten má rozdělanou práci
 * překladová dávka a dvě ruce v jednom souboru končí přepsanou prací.
 * Až bude volný, klíče se tam přesunou.
 */

type Kategorie = { id: string; nazev: string; poradi: number };
type Studio = { id: string; name: string; color: string };
type Kus = {
  id: string;
  nazev: string;
  kategorieId: string | null;
  vyrobce: string | null;
  model: string | null;
  serioveCislo: string | null;
  studioId: string | null;
  poznamka: string | null;
  foto: string | null;
  vyrazeno: boolean;
};

const TEXTY = {
  cs: {
    nadpis: 'Technika',
    popis: 'Co máme a kde to stojí. Kusy se dělí do kategorií, u každého je vidět studio.',
    pridat: 'Přidat kus',
    kategorieSprava: 'Kategorie',
    hledat: 'Hledat podle názvu, výrobce nebo sériového čísla…',
    vsechnaStudia: 'Všechna studia',
    bezUmisteni: 'Bez umístění',
    podleKategorii: 'Po kategoriích',
    podleStudii: 'Po studiích',
    ukazVyrazene: 'Ukázat vyřazené',
    bezKategorie: 'Bez kategorie',
    prazdno: 'Zatím tu nic není.',
    nicNenalezeno: 'Nic takového tu není.',
    pocet: (n: number) => `${n} ks`,
    nazev: 'Název',
    vyrobce: 'Výrobce',
    model: 'Model',
    serioveCislo: 'Sériové číslo',
    kategorie: 'Kategorie',
    studio: 'Studio',
    poznamka: 'Poznámka',
    foto: 'Fotka',
    fotoVybrat: 'Vybrat fotku',
    fotoSmazat: 'Odebrat fotku',
    ulozit: 'Uložit',
    ukladam: 'Ukládám…',
    zrusit: 'Zrušit',
    upravit: 'Upravit',
    vyradit: 'Vyřadit',
    vratit: 'Vrátit mezi aktivní',
    smazat: 'Smazat',
    smazatOtazka: 'Opravdu smazat? Vyřazení kus zachová v evidenci, smazání ne.',
    vyrazeno: 'vyřazeno',
    novaKategorie: 'Nová kategorie',
    nazevKategorie: 'Název kategorie',
    prejmenovat: 'Přejmenovat',
    smazatKategorii: 'Smazat kategorii',
    smazatKategoriiOtazka: 'Smazat kategorii? Technika v ní zůstane, spadne do „Bez kategorie".',
    hotovo: 'Hotovo',
    chyba: 'Nepodařilo se to uložit.',
    fotoVelka: 'Fotka je moc velká, zkuste menší.',
  },
  en: {
    nadpis: 'Equipment',
    popis: 'What we own and where it sits. Items are grouped by category, each shows its studio.',
    pridat: 'Add item',
    kategorieSprava: 'Categories',
    hledat: 'Search by name, maker or serial number…',
    vsechnaStudia: 'All studios',
    bezUmisteni: 'No location',
    podleKategorii: 'By category',
    podleStudii: 'By studio',
    ukazVyrazene: 'Show retired',
    bezKategorie: 'No category',
    prazdno: 'Nothing here yet.',
    nicNenalezeno: 'No such item.',
    pocet: (n: number) => `${n} pcs`,
    nazev: 'Name',
    vyrobce: 'Maker',
    model: 'Model',
    serioveCislo: 'Serial number',
    kategorie: 'Category',
    studio: 'Studio',
    poznamka: 'Note',
    foto: 'Photo',
    fotoVybrat: 'Choose a photo',
    fotoSmazat: 'Remove photo',
    ulozit: 'Save',
    ukladam: 'Saving…',
    zrusit: 'Cancel',
    upravit: 'Edit',
    vyradit: 'Retire',
    vratit: 'Back to active',
    smazat: 'Delete',
    smazatOtazka: 'Really delete? Retiring keeps the item on record, deleting does not.',
    vyrazeno: 'retired',
    novaKategorie: 'New category',
    nazevKategorie: 'Category name',
    prejmenovat: 'Rename',
    smazatKategorii: 'Delete category',
    smazatKategoriiOtazka: 'Delete the category? Its items stay and move to "No category".',
    hotovo: 'Done',
    chyba: 'Saving failed.',
    fotoVelka: 'The photo is too large, try a smaller one.',
  },
};

/** Prázdný formulář - používá se i pro „Přidat kus". */
const PRAZDNY = {
  id: '',
  nazev: '',
  kategorieId: '',
  vyrobce: '',
  model: '',
  serioveCislo: '',
  studioId: '',
  poznamka: '',
  foto: '' as string,
};

export function TechnikaSprava({
  kategorie: pocatecniKategorie,
  kusy: pocatecniKusy,
  studia,
}: {
  kategorie: Kategorie[];
  kusy: Kus[];
  studia: Studio[];
}) {
  const jazyk = useJazyk();
  const t = TEXTY[jazyk === 'en' ? 'en' : 'cs'];

  const [kategorie, setKategorie] = useState<Kategorie[]>(pocatecniKategorie);
  const [kusy, setKusy] = useState<Kus[]>(pocatecniKusy);

  const [hledani, setHledani] = useState('');
  const [studioFiltr, setStudioFiltr] = useState('');
  const [rezim, setRezim] = useState<'kategorie' | 'studio'>('kategorie');
  const [sVyrazenymi, setSVyrazenymi] = useState(false);

  const [formular, setFormular] = useState<typeof PRAZDNY | null>(null);
  const [kategorieOtevrene, setKategorieOtevrene] = useState(false);
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const souborRef = useRef<HTMLInputElement | null>(null);

  const nazevStudia = (id: string | null) =>
    studia.find((s) => s.id === id)?.name ?? t.bezUmisteni;
  const barvaStudia = (id: string | null) => studia.find((s) => s.id === id)?.color ?? '#6C6580';

  /** Co se po filtrech vypisuje. */
  const videt = useMemo(() => {
    const dotaz = hledani.trim().toLowerCase();
    return kusy.filter((k) => {
      if (!sVyrazenymi && k.vyrazeno) return false;
      if (studioFiltr === 'bez' ? k.studioId : studioFiltr && k.studioId !== studioFiltr) return false;
      if (!dotaz) return true;
      return [k.nazev, k.vyrobce, k.model, k.serioveCislo, k.poznamka]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(dotaz));
    });
  }, [kusy, hledani, studioFiltr, sVyrazenymi]);

  /** Skupiny podle přepínače - buď kategorie, nebo studia. */
  const skupiny = useMemo(() => {
    if (rezim === 'studio') {
      const poradi = [...studia.map((s) => ({ id: s.id, nazev: s.name })), { id: '', nazev: t.bezUmisteni }];
      return poradi
        .map((s) => ({ ...s, kusy: videt.filter((k) => (k.studioId ?? '') === s.id) }))
        .filter((s) => s.kusy.length > 0);
    }
    const poradi = [
      ...[...kategorie].sort((a, b) => a.poradi - b.poradi || a.nazev.localeCompare(b.nazev)),
      { id: '', nazev: t.bezKategorie, poradi: 99999 },
    ];
    return poradi
      .map((k) => ({ id: k.id, nazev: k.nazev, kusy: videt.filter((x) => (x.kategorieId ?? '') === k.id) }))
      .filter((k) => k.kusy.length > 0);
  }, [rezim, videt, kategorie, studia, t.bezKategorie, t.bezUmisteni]);

  async function nactiZnovu() {
    try {
      const res = await fetch('/api/admin/technika', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { kategorie?: Kategorie[]; kusy?: Kus[] };
      if (Array.isArray(data.kategorie)) setKategorie(data.kategorie);
      if (Array.isArray(data.kusy)) setKusy(data.kusy);
    } catch {
      // Vypis zustane, jaky byl - priste se nacte znovu.
    }
  }

  async function uloz() {
    if (!formular || pracuje) return;
    if (!formular.nazev.trim()) return;
    setPracuje(true);
    setChyba(null);
    try {
      const telo = {
        nazev: formular.nazev.trim(),
        kategorieId: formular.kategorieId || null,
        vyrobce: formular.vyrobce.trim() || null,
        model: formular.model.trim() || null,
        serioveCislo: formular.serioveCislo.trim() || null,
        studioId: formular.studioId || null,
        poznamka: formular.poznamka.trim() || null,
        foto: formular.foto || null,
      };
      const res = await fetch(
        formular.id ? `/api/admin/technika/${encodeURIComponent(formular.id)}` : '/api/admin/technika',
        {
          method: formular.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telo),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      setFormular(null);
      await nactiZnovu();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  async function prepniVyrazeni(kus: Kus) {
    await fetch(`/api/admin/technika/${encodeURIComponent(kus.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vyrazeno: !kus.vyrazeno }),
    }).catch(() => undefined);
    await nactiZnovu();
  }

  async function smaz(kus: Kus) {
    if (!window.confirm(t.smazatOtazka)) return;
    await fetch(`/api/admin/technika/${encodeURIComponent(kus.id)}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
    await nactiZnovu();
  }

  /**
   * FOTKA SE PŘED ULOŽENÍM ZMENŠÍ. Do databáze jde jako data: URL, takže
   * desetimegový snímek z telefonu by se tam vlekl zbytečně - na poznání
   * mikrofonu v seznamu stačí tisíc bodů na delší straně.
   */
  async function vezmiFotku(soubor: File) {
    setChyba(null);
    try {
      const puvodni = await new Promise<string>((hotovo, chyba) => {
        const r = new FileReader();
        r.onload = () => hotovo(String(r.result));
        r.onerror = () => chyba(new Error('cteni'));
        r.readAsDataURL(soubor);
      });

      const zmensena = await new Promise<string>((hotovo) => {
        const img = new Image();
        img.onload = () => {
          const max = 1000;
          const pomer = Math.min(1, max / Math.max(img.width, img.height));
          const platno = document.createElement('canvas');
          platno.width = Math.round(img.width * pomer);
          platno.height = Math.round(img.height * pomer);
          const ctx = platno.getContext('2d');
          if (!ctx) return hotovo(puvodni);
          ctx.drawImage(img, 0, 0, platno.width, platno.height);
          hotovo(platno.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => hotovo(puvodni);
        img.src = puvodni;
      });

      if (zmensena.length > 2_500_000) {
        setChyba(t.fotoVelka);
        return;
      }
      setFormular((f) => (f ? { ...f, foto: zmensena } : f));
    } catch {
      setChyba(t.fotoVelka);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-semibold text-xl text-ink m-0">{t.nadpis}</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">{t.popis}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setKategorieOtevrene((v) => !v)}
            className="rounded-pill border border-line bg-surface text-muted hover:text-brand-purple hover:border-brand-purple font-heading font-semibold text-xs px-3.5 py-2 transition-colors"
          >
            {t.kategorieSprava}
          </button>
          <button
            type="button"
            onClick={() => {
              setChyba(null);
              setFormular({ ...PRAZDNY });
            }}
            className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer"
          >
            {t.pridat}
          </button>
        </div>
      </div>

      {kategorieOtevrene && (
        <SpravaKategorii
          t={t}
          kategorie={kategorie}
          onZmena={nactiZnovu}
          pocty={kusy.reduce<Record<string, number>>((s, k) => {
            const klic = k.kategorieId ?? '';
            s[klic] = (s[klic] ?? 0) + 1;
            return s;
          }, {})}
        />
      )}

      {formular && (
        <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Pole popis={t.nazev}>
              <input
                value={formular.nazev}
                onChange={(e) => setFormular({ ...formular, nazev: e.target.value })}
                className="admin-input"
                autoFocus
              />
            </Pole>
            <Pole popis={t.kategorie}>
              <select
                value={formular.kategorieId}
                onChange={(e) => setFormular({ ...formular, kategorieId: e.target.value })}
                className="admin-input"
              >
                <option value="">{t.bezKategorie}</option>
                {kategorie.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nazev}
                  </option>
                ))}
              </select>
            </Pole>
            <Pole popis={t.studio}>
              <select
                value={formular.studioId}
                onChange={(e) => setFormular({ ...formular, studioId: e.target.value })}
                className="admin-input"
              >
                <option value="">{t.bezUmisteni}</option>
                {studia.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Pole>
            <Pole popis={t.vyrobce}>
              <input
                value={formular.vyrobce}
                onChange={(e) => setFormular({ ...formular, vyrobce: e.target.value })}
                className="admin-input"
              />
            </Pole>
            <Pole popis={t.model}>
              <input
                value={formular.model}
                onChange={(e) => setFormular({ ...formular, model: e.target.value })}
                className="admin-input"
              />
            </Pole>
            <Pole popis={t.serioveCislo}>
              <input
                value={formular.serioveCislo}
                onChange={(e) => setFormular({ ...formular, serioveCislo: e.target.value })}
                className="admin-input"
              />
            </Pole>
          </div>

          <Pole popis={t.poznamka}>
            <textarea
              value={formular.poznamka}
              onChange={(e) => setFormular({ ...formular, poznamka: e.target.value })}
              rows={2}
              className="admin-input"
            />
          </Pole>

          <div className="flex items-center gap-3 flex-wrap">
            {formular.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formular.foto}
                alt=""
                className="w-20 h-20 object-cover rounded-lg border border-line"
              />
            ) : null}
            <input
              ref={souborRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void vezmiFotku(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => souborRef.current?.click()}
              className="rounded-pill border border-line bg-surface text-muted hover:text-brand-purple font-heading font-semibold text-xs px-3.5 py-2"
            >
              {t.fotoVybrat}
            </button>
            {formular.foto && (
              <button
                type="button"
                onClick={() => setFormular({ ...formular, foto: '' })}
                className="text-xs font-heading font-semibold text-danger"
              >
                {t.fotoSmazat}
              </button>
            )}
          </div>

          {chyba && (
            <p className="text-xs font-body text-danger m-0" role="alert">
              {chyba}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={uloz}
              disabled={pracuje || !formular.nazev.trim()}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {pracuje ? t.ukladam : t.ulozit}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormular(null);
                setChyba(null);
              }}
              className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-3.5 py-2"
            >
              {t.zrusit}
            </button>
          </div>
        </div>
      )}

      {/* Filtry: hledání, studio a přepínač pohledu. */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={hledani}
          onChange={(e) => setHledani(e.target.value)}
          placeholder={t.hledat}
          className="admin-input flex-1 min-w-[220px]"
        />
        <select value={studioFiltr} onChange={(e) => setStudioFiltr(e.target.value)} className="admin-input w-auto">
          <option value="">{t.vsechnaStudia}</option>
          {studia.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="bez">{t.bezUmisteni}</option>
        </select>
        <div className="flex items-center rounded-pill border border-line overflow-hidden">
          {(['kategorie', 'studio'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRezim(r)}
              aria-pressed={rezim === r}
              className={`font-heading font-semibold text-xs px-3 py-2 transition-colors ${
                rezim === r ? 'bg-brand-purple text-white' : 'bg-surface text-muted hover:text-brand-purple'
              }`}
            >
              {r === 'kategorie' ? t.podleKategorii : t.podleStudii}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs font-body text-muted">
          <input type="checkbox" checked={sVyrazenymi} onChange={(e) => setSVyrazenymi(e.target.checked)} />
          {t.ukazVyrazene}
        </label>
      </div>

      {skupiny.length === 0 && (
        <p className="text-sm font-body text-muted m-0">{kusy.length === 0 ? t.prazdno : t.nicNenalezeno}</p>
      )}

      {skupiny.map((skupina) => (
        <div key={`${rezim}-${skupina.id}`} className="rounded-card border border-line bg-surface overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-baseline justify-between gap-2">
            <h2 className="font-heading font-semibold text-sm text-ink m-0">{skupina.nazev}</h2>
            <span className="text-xs font-body text-muted">{t.pocet(skupina.kusy.length)}</span>
          </div>
          <ul className="m-0 p-0 list-none divide-y divide-line">
            {skupina.kusy.map((kus) => (
              <li key={kus.id} className="px-4 py-2.5 flex items-center gap-3">
                {kus.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={kus.foto} alt="" className="w-10 h-10 rounded-lg object-cover border border-line shrink-0" />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-field shrink-0" aria-hidden="true" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-sm text-ink m-0 truncate">
                    {kus.nazev}
                    {kus.vyrazeno && <span className="ml-2 text-[11px] font-body text-muted">({t.vyrazeno})</span>}
                  </p>
                  <p className="text-xs font-body text-muted m-0 truncate">
                    {[kus.vyrobce, kus.model].filter(Boolean).join(' ')}
                    {kus.serioveCislo ? ` · ${kus.serioveCislo}` : ''}
                    {kus.poznamka ? ` · ${kus.poznamka}` : ''}
                  </p>
                </div>

                {rezim === 'kategorie' && (
                  <span
                    className="shrink-0 rounded-pill text-[11px] font-heading font-semibold px-2 py-1"
                    style={{ backgroundColor: `${barvaStudia(kus.studioId)}22`, color: barvaStudia(kus.studioId) }}
                  >
                    {nazevStudia(kus.studioId)}
                  </span>
                )}

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChyba(null);
                      setFormular({
                        id: kus.id,
                        nazev: kus.nazev,
                        kategorieId: kus.kategorieId ?? '',
                        vyrobce: kus.vyrobce ?? '',
                        model: kus.model ?? '',
                        serioveCislo: kus.serioveCislo ?? '',
                        studioId: kus.studioId ?? '',
                        poznamka: kus.poznamka ?? '',
                        foto: kus.foto ?? '',
                      });
                    }}
                    className="text-xs font-heading font-semibold text-brand-purple"
                  >
                    {t.upravit}
                  </button>
                  <button
                    type="button"
                    onClick={() => void prepniVyrazeni(kus)}
                    className="text-xs font-heading font-semibold text-muted hover:text-ink"
                  >
                    {kus.vyrazeno ? t.vratit : t.vyradit}
                  </button>
                  <button
                    type="button"
                    onClick={() => void smaz(kus)}
                    className="text-xs font-heading font-semibold text-danger"
                  >
                    {t.smazat}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Pole({ popis, children }: { popis: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-heading font-semibold text-muted uppercase tracking-wide">{popis}</span>
      {children}
    </label>
  );
}

/** Zakládání, přejmenování a mazání kategorií - otevírá se tlačítkem nahoře. */
function SpravaKategorii({
  t,
  kategorie,
  pocty,
  onZmena,
}: {
  t: (typeof TEXTY)['cs'];
  kategorie: Kategorie[];
  pocty: Record<string, number>;
  onZmena: () => Promise<void>;
}) {
  const [nova, setNova] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function pridej() {
    if (!nova.trim() || pracuje) return;
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch('/api/admin/technika/kategorie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: nova.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      setNova('');
      await onZmena();
    } finally {
      setPracuje(false);
    }
  }

  async function prejmenuj(k: Kategorie) {
    const novy = window.prompt(t.nazevKategorie, k.nazev);
    if (!novy || novy.trim() === k.nazev) return;
    await fetch(`/api/admin/technika/kategorie/${encodeURIComponent(k.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: novy.trim() }),
    }).catch(() => undefined);
    await onZmena();
  }

  async function smaz(k: Kategorie) {
    if (!window.confirm(t.smazatKategoriiOtazka)) return;
    await fetch(`/api/admin/technika/kategorie/${encodeURIComponent(k.id)}`, { method: 'DELETE' }).catch(
      () => undefined,
    );
    await onZmena();
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder={t.nazevKategorie}
          className="admin-input flex-1"
        />
        <button
          type="button"
          onClick={pridej}
          disabled={pracuje || !nova.trim()}
          className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer disabled:opacity-50"
        >
          {t.novaKategorie}
        </button>
      </div>
      {chyba && <p className="text-xs font-body text-danger m-0">{chyba}</p>}

      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {kategorie.map((k) => (
          <li key={k.id} className="flex items-center gap-2 text-sm font-body text-ink">
            <span className="flex-1 truncate">{k.nazev}</span>
            <span className="text-xs text-muted">{t.pocet(pocty[k.id] ?? 0)}</span>
            <button
              type="button"
              onClick={() => void prejmenuj(k)}
              className="text-xs font-heading font-semibold text-brand-purple"
            >
              {t.prejmenovat}
            </button>
            <button
              type="button"
              onClick={() => void smaz(k)}
              className="text-xs font-heading font-semibold text-danger"
            >
              {t.smazat}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
