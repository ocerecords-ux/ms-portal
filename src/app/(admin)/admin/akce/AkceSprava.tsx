'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DRUHY_PITI, nazevPiti, souhrnAkce, type Kandidat, type PozvankaPrehled } from '@/lib/akce';

/**
 * FIREMNÍ AKCE - obrazovka pořadatele (zadání 25. 11. 2026).
 *
 * Tři kroky pod sebou, jak to člověk dělá: napsat pozvánku, vybrat koho, pak
 * rozeslat a koukat, kdo odpověděl.
 *
 * POPISKY JSOU PSANÉ TADY, ne přes lib/jazyk.ts: ten má rozdělanou práci
 * překladová dávka a dvě ruce v jednom souboru končí přepsanou prací.
 * Obrazovku vidí jeden člověk z firmy, takže je česky.
 */

type Detail = {
  id: string;
  nazev: string;
  kdy: string;
  misto: string;
  text: string;
  odpovedDo: string;
};

const PRAZDNA: Detail = { id: '', nazev: '', kdy: '', misto: '', text: '', odpovedDo: '' };

const SKUPINY: { klic: Kandidat['skupina']; nazev: string }[] = [
  { klic: 'TYM', nazev: 'Tým' },
  { klic: 'HERCI', nazev: 'Herci' },
  { klic: 'KLIENTI', nazev: 'Klienti' },
];

export function AkceSprava({
  akce,
  vybrana,
  pozvanky,
  kandidati,
}: {
  akce: { id: string; nazev: string }[];
  vybrana: Detail | null;
  pozvanky: PozvankaPrehled[];
  kandidati: Kandidat[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail>(vybrana ?? PRAZDNA);
  const [vybrani, setVybrani] = useState<string[]>([]);
  const [rucniJmeno, setRucniJmeno] = useState('');
  const [rucniMail, setRucniMail] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';
  const popisek = 'text-[11px] font-heading uppercase tracking-wide text-muted';

  const pozvaneMaily = useMemo(
    () => new Set(pozvanky.map((p) => p.email.toLowerCase())),
    [pozvanky],
  );
  const souhrn = useMemo(() => souhrnAkce(pozvanky), [pozvanky]);
  const kVyberu = kandidati.filter((k) => !pozvaneMaily.has(k.email));

  async function posli(url: string, telo: unknown, hotovo: string) {
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setChyba(data?.error || 'Nepodařilo se to.');
        return null;
      }
      setHlaska(hotovo);
      router.refresh();
      return data;
    } catch (err) {
      console.error('Akce:', err);
      setChyba('Nepodařilo se to.');
      return null;
    } finally {
      setPracuje(false);
    }
  }

  async function ulozDetail() {
    if (!detail.nazev.trim()) {
      setChyba('Napište aspoň název.');
      return;
    }
    const telo = {
      nazev: detail.nazev,
      kdy: detail.kdy || null,
      misto: detail.misto || null,
      text: detail.text || null,
      odpovedDo: detail.odpovedDo || null,
    };
    if (!detail.id) {
      const data = await posli('/api/admin/akce', telo, 'Akce založena.');
      if (data?.id) router.push(`/admin/akce?id=${encodeURIComponent(data.id)}`);
      return;
    }
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch(`/api/admin/akce/${encodeURIComponent(detail.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setChyba(data?.error || 'Uložení se nepodařilo.');
        return;
      }
      setHlaska('Uloženo.');
      router.refresh();
    } finally {
      setPracuje(false);
    }
  }

  async function pridejVybrane() {
    if (!detail.id || vybrani.length === 0) return;
    const lide = kandidati
      .filter((k) => vybrani.includes(k.id))
      .map((k) => ({ userId: k.id, jmeno: k.jmeno, email: k.email }));
    const data = await posli(
      `/api/admin/akce/${encodeURIComponent(detail.id)}/pozvanky`,
      { lide },
      'Přidáno do seznamu.',
    );
    if (data) setVybrani([]);
  }

  async function pridejRucne() {
    if (!detail.id || !rucniMail.includes('@')) {
      setChyba('Zadejte platnou adresu.');
      return;
    }
    const data = await posli(
      `/api/admin/akce/${encodeURIComponent(detail.id)}/pozvanky`,
      { lide: [{ jmeno: rucniJmeno || rucniMail, email: rucniMail }] },
      'Přidáno do seznamu.',
    );
    if (data) {
      setRucniJmeno('');
      setRucniMail('');
    }
  }

  async function rozesli(ids?: string[]) {
    if (!detail.id) return;
    const kolik = ids?.length ?? pozvanky.filter((p) => !p.odeslanoAt).length;
    if (kolik === 0) {
      setHlaska('Všem už pozvánka odešla.');
      return;
    }
    if (!window.confirm(`Odeslat ${kolik} pozvánek?`)) return;
    await posli(
      `/api/admin/akce/${encodeURIComponent(detail.id)}/odeslat`,
      ids ? { pozvanky: ids } : {},
      'Rozesláno.',
    );
  }

  async function odeber(id: string) {
    if (!detail.id) return;
    await posli(
      `/api/admin/akce/${encodeURIComponent(detail.id)}/pozvanky`,
      { odebrat: id },
      'Odebráno ze seznamu.',
    );
  }

  const stav = (p: PozvankaPrehled) => {
    if (!p.odeslanoAt) return 'nepozváno';
    if (!p.odpovedelAt) return 'čeká na odpověď';
    return p.dorazi ? 'dorazí' : 'nedorazí';
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-semibold text-xl text-ink m-0">Akce a pozvánky</h1>
          <p className="text-sm font-body text-muted m-0 mt-1">
            Napište pozvánku, vyberte koho pozvat a rozešlete ji. Každý dostane vlastní odkaz
            s dotazníkem - účast, ubytování a co pije.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {akce.map((a) => (
            <a
              key={a.id}
              href={`/admin/akce?id=${encodeURIComponent(a.id)}`}
              className={`rounded-pill border px-3.5 py-2 text-xs font-heading font-semibold no-underline transition-colors ${
                a.id === detail.id
                  ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                  : 'border-line text-muted hover:text-brand-purple hover:border-brand-purple'
              }`}
            >
              {a.nazev}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setDetail(PRAZDNA);
              setHlaska(null);
              setChyba(null);
            }}
            className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer"
          >
            Nová akce
          </button>
        </div>
      </div>

      {chyba && (
        <p className="text-sm font-body text-danger bg-dangerTint rounded-lg px-3 py-2 m-0">{chyba}</p>
      )}
      {hlaska && <p className="text-sm font-body text-brand-greenDeep m-0">{hlaska}</p>}

      {/* 1. POZVÁNKA */}
      <section className="rounded-card border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-base text-ink m-0">Pozvánka</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={popisek}>Název</span>
            <input
              value={detail.nazev}
              onChange={(e) => setDetail({ ...detail, nazev: e.target.value })}
              placeholder="Vánoční večírek 2026"
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={popisek}>Kdy</span>
            <input
              type="datetime-local"
              value={detail.kdy}
              onChange={(e) => setDetail({ ...detail, kdy: e.target.value })}
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={popisek}>Kde</span>
            <input
              value={detail.misto}
              onChange={(e) => setDetail({ ...detail, misto: e.target.value })}
              placeholder="Adresa nebo název podniku"
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={popisek}>Odpovědět do</span>
            <input
              type="date"
              value={detail.odpovedDo}
              onChange={(e) => setDetail({ ...detail, odpovedDo: e.target.value })}
              className={pole}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={popisek}>Text a instrukce</span>
          <textarea
            value={detail.text}
            onChange={(e) => setDetail({ ...detail, text: e.target.value })}
            rows={6}
            placeholder={'Krátký text pozvánky.\n\nPrázdný řádek dělá odstavec - sem patří instrukce: kdy dorazit, jak se tam dostat, co s sebou.'}
            className={pole}
          />
        </label>
        <div>
          <button
            type="button"
            onClick={() => void ulozDetail()}
            disabled={pracuje}
            className="rounded-lg bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-60"
          >
            {detail.id ? 'Uložit' : 'Založit akci'}
          </button>
        </div>
      </section>

      {detail.id && (
        <>
          {/* 2. KOHO POZVAT */}
          <section className="rounded-card border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-base text-ink m-0">Koho pozvat</h2>
            {SKUPINY.map((s) => {
              const lide = kVyberu.filter((k) => k.skupina === s.klic);
              if (lide.length === 0) return null;
              const vsichniVybrani = lide.every((k) => vybrani.includes(k.id));
              return (
                <div key={s.klic} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-semibold text-sm text-ink">{s.nazev}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setVybrani((v) =>
                          vsichniVybrani
                            ? v.filter((id) => !lide.some((k) => k.id === id))
                            : Array.from(new Set([...v, ...lide.map((k) => k.id)])),
                        )
                      }
                      className="text-xs font-heading font-semibold text-brand-purple"
                    >
                      {vsichniVybrani ? 'Zrušit výběr' : `Vybrat všechny (${lide.length})`}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lide.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() =>
                          setVybrani((v) =>
                            v.includes(k.id) ? v.filter((x) => x !== k.id) : [...v, k.id],
                          )
                        }
                        title={[k.email, k.firma].filter(Boolean).join(' · ')}
                        className={`rounded-pill border px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
                          vybrani.includes(k.id)
                            ? 'border-brand-green bg-brand-green text-onAccent'
                            : 'border-line bg-surface text-muted hover:border-brand-purple hover:text-brand-purple'
                        }`}
                      >
                        {k.jmeno}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex items-end gap-2 flex-wrap border-t border-line pt-3">
              <label className="flex flex-col gap-1.5 w-[200px]">
                <span className={popisek}>Host bez účtu - jméno</span>
                <input
                  value={rucniJmeno}
                  onChange={(e) => setRucniJmeno(e.target.value)}
                  className={pole}
                />
              </label>
              <label className="flex flex-col gap-1.5 w-[240px]">
                <span className={popisek}>E-mail</span>
                <input
                  value={rucniMail}
                  onChange={(e) => setRucniMail(e.target.value)}
                  className={pole}
                />
              </label>
              <button
                type="button"
                onClick={() => void pridejRucne()}
                disabled={pracuje}
                className="rounded-lg border border-line px-4 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple transition-colors disabled:opacity-60"
              >
                Přidat
              </button>
              <button
                type="button"
                onClick={() => void pridejVybrane()}
                disabled={pracuje || vybrani.length === 0}
                className="rounded-lg bg-brand-purple text-white font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-50 ml-auto"
              >
                Přidat vybrané ({vybrani.length})
              </button>
            </div>
          </section>

          {/* 3. ROZESLÁNÍ A ODPOVĚDI */}
          <section className="rounded-card border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-heading font-semibold text-base text-ink m-0">
                Pozvaní ({souhrn.pozvano})
              </h2>
              <button
                type="button"
                onClick={() => void rozesli()}
                disabled={pracuje}
                className="rounded-lg bg-brand-green text-onAccent font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer disabled:opacity-60"
              >
                Rozeslat ({pozvanky.filter((p) => !p.odeslanoAt).length})
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { popis: 'Odesláno', hodnota: souhrn.odeslano },
                { popis: 'Odpovědělo', hodnota: souhrn.odpovedelo },
                { popis: 'Dorazí', hodnota: souhrn.dorazi },
                { popis: 'Nedorazí', hodnota: souhrn.nedorazi },
                { popis: 'Ubytování', hodnota: souhrn.ubytovani },
              ].map((s) => (
                <span
                  key={s.popis}
                  className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-muted"
                >
                  {s.popis}{' '}
                  <strong className="font-heading text-ink tabular-nums">{s.hodnota}</strong>
                </span>
              ))}
            </div>

            {souhrn.piti.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {souhrn.piti.map((d) => (
                  <span
                    key={d.klic}
                    className="rounded-pill border border-brand-purple/40 bg-brand-purple/10 text-brand-purple px-3 py-1.5 text-xs font-heading font-semibold"
                  >
                    {d.nazev}: {d.pocet}
                  </span>
                ))}
              </div>
            )}

            {pozvanky.length === 0 ? (
              <p className="text-sm font-body text-muted m-0">Zatím tu nikdo není.</p>
            ) : (
              <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                {pozvanky.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-line bg-field px-3 py-2 flex items-center gap-3 flex-wrap"
                  >
                    <span className="font-heading font-semibold text-sm text-ink">{p.jmeno}</span>
                    <span className="text-xs font-body text-muted">{p.email}</span>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[11px] font-heading font-semibold ${
                        p.dorazi === true
                          ? 'bg-brand-green/15 text-brand-greenDeep'
                          : p.dorazi === false
                            ? 'bg-dangerTint text-danger'
                            : 'bg-surface text-muted border border-line'
                      }`}
                    >
                      {stav(p)}
                    </span>
                    {p.ubytovani && (
                      <span className="text-[11px] font-heading font-semibold text-brand-purple">
                        ubytování
                      </span>
                    )}
                    {p.piti.length > 0 && (
                      <span className="text-xs font-body text-muted">
                        {p.piti.map(nazevPiti).join(', ')}
                        {p.pitiText ? ` · ${p.pitiText}` : ''}
                      </span>
                    )}
                    {p.poznamka && (
                      <span className="text-xs font-body text-ink italic basis-full">
                        „{p.poznamka}"
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      {p.odeslanoAt ? (
                        <button
                          type="button"
                          onClick={() => void rozesli([p.id])}
                          disabled={pracuje}
                          className="text-xs font-heading font-semibold text-muted hover:text-brand-purple"
                        >
                          Poslat znovu
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void odeber(p.id)}
                          disabled={pracuje}
                          className="text-xs font-heading font-semibold text-danger"
                        >
                          Odebrat
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs font-body text-muted m-0">
              Nabídka pití: {DRUHY_PITI.map((d) => d.nazev).join(', ')}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
