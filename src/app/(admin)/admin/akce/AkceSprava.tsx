'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  KLIC_DORAZI,
  novyKlicOtazky,
  popisOdpovedi,
  souhrnAkce,
  TYPY_OTAZEK,
  VYCHOZI_OTAZKY,
  type Kandidat,
  type Otazka,
  type PozvankaPrehled,
} from '@/lib/akce';
import { FormularPozvanky } from '@/app/pozvanka/[token]/FormularPozvanky';

/**
 * FIREMNÍ AKCE - obrazovka pořadatele (zadání 25. 11. 2026).
 *
 * Tři kroky pod sebou, jak to člověk dělá: napsat pozvánku, vybrat koho, pak
 * rozeslat a koukat, kdo odpověděl. Vedle toho stojí NÁHLED (zadání
 * 25. 11. 2026: „chci vidět rovnou grafický náhled toho mailu… chci i mít
 * rovnou u toho anketu") - mail tak, jak odejde, a pod ním tytéž otázky,
 * které pozvaný dostane v odkazu. Obojí se překresluje při psaní, takže se
 * nemusí nic odesílat naslepo.
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

/** Otázky se drží zvlášť - jsou to řádky, ne políčko formuláře. */

const PRAZDNA: Detail = { id: '', nazev: '', kdy: '', misto: '', text: '', odpovedDo: '' };

const SKUPINY: { klic: Kandidat['skupina']; nazev: string }[] = [
  { klic: 'TYM', nazev: 'Tým' },
  { klic: 'HERCI', nazev: 'Herci' },
  { klic: 'KLIENTI', nazev: 'Klienti' },
];

export function AkceSprava({
  akce,
  vybrana,
  otazkyAkce,
  pozvanky,
  kandidati,
}: {
  akce: { id: string; nazev: string }[];
  vybrana: Detail | null;
  otazkyAkce: Otazka[];
  pozvanky: PozvankaPrehled[];
  kandidati: Kandidat[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail>(vybrana ?? PRAZDNA);
  const [otazky, setOtazky] = useState<Otazka[]>(
    vybrana ? otazkyAkce : VYCHOZI_OTAZKY,
  );
  const [vybrani, setVybrani] = useState<string[]>([]);
  /**
   * SEZNAM JMEN JE SBALENÝ (zadání 25. 11. 2026: „ten seznam jmen musíme
   * udělat jinak, zabírá to celý formulář"). Tým, herci a klienti dohromady
   * jsou stovky jmen; rozbalí se, až když se vybírá, a hledá se v nich.
   */
  const [vyberOtevreny, setVyberOtevreny] = useState(false);
  const [hledaniLidi, setHledaniLidi] = useState('');
  const [skupinaFiltr, setSkupinaFiltr] = useState<Kandidat['skupina'] | 'VSE'>('VSE');
  const [rucniJmeno, setRucniJmeno] = useState('');
  const [rucniMail, setRucniMail] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [nahledHtml, setNahledHtml] = useState<string | null>(null);
  const [kreslim, setKreslim] = useState(false);
  /** Náhled přes celou obrazovku - stejné okno jako u náhledu zpráv. */
  const [velkyNahled, setVelkyNahled] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const pole =
    'rounded-lg border border-line bg-field px-3 py-2.5 text-sm font-body text-ink outline-none focus:border-brand-purple w-full';

  /**
   * NÁHLED MAILU. Skládá ho server toutéž funkcí, která mail doopravdy
   * posílá - jinak by náhled dřív nebo později ukazoval něco jiného, než co
   * odejde. Vteřina po posledním úhozu, ať se nevolá na každé písmeno.
   */
  const otiskDetailu = JSON.stringify({
    nazev: detail.nazev,
    kdy: detail.kdy,
    misto: detail.misto,
    text: detail.text,
    odpovedDo: detail.odpovedDo,
  });
  useEffect(() => {
    let platne = true;
    setKreslim(true);
    const casovac = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/admin/akce/nahled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: otiskDetailu,
          });
          const data = (await res.json().catch(() => ({}))) as { html?: string };
          if (platne && data?.html) setNahledHtml(data.html);
        } catch (err) {
          console.error('Nahled pozvanky se nepodaril:', err);
        } finally {
          if (platne) setKreslim(false);
        }
      })();
    }, 700);
    return () => {
      platne = false;
      window.clearTimeout(casovac);
    };
  }, [otiskDetailu]);

  /** Datum „odpovězte do" tak, jak ho uvidí pozvaný. */
  const doKdyText = (() => {
    if (!detail.odpovedDo) return null;
    const d = new Date(`${detail.odpovedDo}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? null
      : new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' }).format(d);
  })();
  const popisek = 'text-[11px] font-heading uppercase tracking-wide text-muted';

  const pozvaneMaily = useMemo(
    () => new Set(pozvanky.map((p) => p.email.toLowerCase())),
    [pozvanky],
  );
  const souhrn = useMemo(() => souhrnAkce(pozvanky, otazky), [pozvanky, otazky]);
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
      otazky,
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

  /**
   * ÚPRAVY ANKETY (zadání 25. 11. 2026: „chci ty anketní otázky modifikovat
   * a přidávat nové"). Mění se jen tady v prohlížeči; uloží se s pozvánkou,
   * takže se nikam neklikne dvakrát.
   *
   * Klíč otázky se po založení UŽ NEMĚNÍ - odpovědi se podle něj ukládají
   * a přejmenováním klíče by se ztratily.
   */
  function upravOtazku(id: string, zmena: Partial<Otazka>) {
    setOtazky((o) => o.map((x) => (x.id === id ? { ...x, ...zmena } : x)));
  }

  function pridejOtazku(typ: Otazka['typ']) {
    setOtazky((o) => [
      ...o,
      {
        id: novyKlicOtazky(),
        text: '',
        typ,
        ...(typ === 'VYBER' ? { moznosti: [], vicMoznosti: true } : {}),
        napoveda: null,
      },
    ]);
  }

  function posunOtazku(id: string, smer: -1 | 1) {
    if (id === KLIC_DORAZI) return;
    setOtazky((o) => {
      const i = o.findIndex((x) => x.id === id);
      const j = i + smer;
      if (i < 0 || j < 0 || j >= o.length) return o;
      // Přes základní otázku se nepřesouvá - ta je vždycky první.
      if (o[j]?.id === KLIC_DORAZI) return o;
      const nove = [...o];
      [nove[i], nove[j]] = [nove[j], nove[i]];
      return nove;
    });
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

      {/* VŠECHNO NA JEDNÉ STRÁNCE (25. 11. 2026): vlevo se píše a vybírá,
          vpravo je vidět, co z toho vznikne. Na úzké obrazovce jde náhled
          pod ovládání, ať se nic nemačká. */}
      <div className="grid gap-5 items-start lg:grid-cols-2">
        <div className="flex flex-col gap-5 min-w-0">

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

      {/* 1b. ANKETA (zadání 25. 11. 2026: „chci ty anketní otázky modifikovat
          a přidávat nové"). „Dorazíte?" tu schválně není - tu drží portál sám,
          stojí na ní celý přehled. Uloží se tlačítkem u pozvánky výš. */}
      <section className="rounded-card border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-heading font-semibold text-base text-ink m-0">Anketa</h2>
          <p className="text-sm font-body text-muted m-0 mt-1">
            První otázka je základní - přepsat ji můžeš, ale smazat ne; na její odpovědi stojí
            celý přehled a na zbytek se ptáme jen těch, kdo dorazí. Změny se uloží tlačítkem{' '}
            {detail.id ? '„Uložit"' : '„Založit akci"'} výš.
          </p>
        </div>


        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {otazky.map((o, i) => {
            const jeZaklad = o.id === KLIC_DORAZI;
            return (
            <li key={o.id} className="rounded-lg border border-line bg-field p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={o.text}
                  onChange={(e) => upravOtazku(o.id, { text: e.target.value })}
                  placeholder="Na co se ptáme?"
                  className={`${pole} flex-1 min-w-[200px]`}
                />
                {jeZaklad ? (
                  <span
                    title="Tahle otázka musí zůstat - podle ní se pozná, kdo dorazí."
                    className="rounded-pill border border-brand-green/50 bg-brand-green/10 text-brand-greenDeep px-3 py-1.5 text-xs font-heading font-semibold"
                  >
                    základní otázka
                  </span>
                ) : (
                  <select
                    value={o.typ}
                    onChange={(e) => {
                      const typ = e.target.value as Otazka['typ'];
                      upravOtazku(o.id, {
                        typ,
                        ...(typ === 'VYBER'
                          ? { moznosti: o.moznosti ?? [], vicMoznosti: o.vicMoznosti !== false }
                          : {}),
                      });
                    }}
                    className={`${pole} w-[180px]`}
                  >
                    {TYPY_OTAZEK.map((t) => (
                      <option key={t.typ} value={t.typ}>
                        {t.nazev}
                      </option>
                    ))}
                  </select>
                )}
                {!jeZaklad && (
                  <>
                    <button
                      type="button"
                      onClick={() => posunOtazku(o.id, -1)}
                      disabled={i <= 1}
                      aria-label="Posunout nahoru"
                      className="rounded-lg border border-line px-2 py-1.5 text-sm text-muted hover:text-brand-purple hover:border-brand-purple disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => posunOtazku(o.id, 1)}
                      disabled={i === otazky.length - 1}
                      aria-label="Posunout dolů"
                      className="rounded-lg border border-line px-2 py-1.5 text-sm text-muted hover:text-brand-purple hover:border-brand-purple disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtazky((x) => x.filter((y) => y.id !== o.id))}
                      aria-label="Smazat otázku"
                      title="Smazat otázku"
                      className="rounded-lg border border-line px-2 py-1.5 text-sm text-danger hover:border-danger"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>

              {/* Popisky tlačítek u ano/ne - „Dorazím / Nedorazím", „Přespím
                  / Odjedu"… Prázdné znamená prosté Ano a Ne. */}
              {o.typ === 'ANO_NE' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={o.ano ?? ''}
                    onChange={(e) => upravOtazku(o.id, { ano: e.target.value })}
                    placeholder="Popisek pro ano"
                    className={`${pole} w-[180px]`}
                  />
                  <input
                    value={o.ne ?? ''}
                    onChange={(e) => upravOtazku(o.id, { ne: e.target.value })}
                    placeholder="Popisek pro ne"
                    className={`${pole} w-[180px]`}
                  />
                </div>
              )}

              <input
                value={o.napoveda ?? ''}
                onChange={(e) => upravOtazku(o.id, { napoveda: e.target.value })}
                placeholder="Věta pod otázkou - nepovinné"
                className={pole}
              />

              {o.typ === 'VYBER' && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={(o.moznosti ?? []).join('\n')}
                    onChange={(e) =>
                      upravOtazku(o.id, {
                        moznosti: e.target.value
                          .split('\n')
                          .map((m) => m.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={4}
                    placeholder={'Jedna možnost na řádek\nBílé víno\nPivo\nNealko'}
                    className={pole}
                  />
                  <label className="flex items-center gap-2 text-xs font-body text-muted">
                    <input
                      type="checkbox"
                      checked={o.vicMoznosti !== false}
                      onChange={(e) => upravOtazku(o.id, { vicMoznosti: e.target.checked })}
                      className="w-4 h-4 accent-brand-green"
                    />
                    Smí zaškrtnout víc možností
                  </label>
                </div>
              )}
            </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-body text-muted">Přidat otázku:</span>
          {TYPY_OTAZEK.map((t) => (
            <button
              key={t.typ}
              type="button"
              onClick={() => pridejOtazku(t.typ)}
              title={t.popis}
              className="rounded-pill border border-line px-3 py-1.5 text-xs font-heading font-semibold text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
            >
              + {t.nazev}
            </button>
          ))}
        </div>
      </section>

      {detail.id && (
        <>
          {/* 2. KOHO POZVAT - sbalené, ať formulář nezabírá celou stránku. */}
          <section className="rounded-card border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-heading font-semibold text-base text-ink m-0">
                Koho pozvat{vybrani.length > 0 ? ` · vybráno ${vybrani.length}` : ''}
              </h2>
              <button
                type="button"
                onClick={() => setVyberOtevreny((v) => !v)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-heading font-semibold text-brand-purple hover:border-brand-purple transition-colors"
              >
                {vyberOtevreny ? 'Sbalit' : `Vybrat ze seznamu (${kVyberu.length})`}
              </button>
            </div>

            {vyberOtevreny && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={hledaniLidi}
                    onChange={(e) => setHledaniLidi(e.target.value)}
                    placeholder="Hledat jméno, firmu nebo adresu…"
                    className={`${pole} flex-1 min-w-[200px]`}
                  />
                  <span className="inline-flex rounded-lg border border-line overflow-hidden">
                    {[{ klic: 'VSE' as const, nazev: 'Všichni' }, ...SKUPINY].map((f) => (
                      <button
                        key={f.klic}
                        type="button"
                        onClick={() => setSkupinaFiltr(f.klic)}
                        className={`px-3 py-1.5 text-xs font-heading font-semibold transition-colors ${
                          skupinaFiltr === f.klic
                            ? 'bg-brand-purple text-white'
                            : 'bg-surface text-muted hover:text-ink'
                        }`}
                      >
                        {f.nazev}
                      </button>
                    ))}
                  </span>
                </div>

                {/* Výpis má vlastní rolování - stovka jmen už formulář
                    neroztáhne přes celou obrazovku. */}
                <div className="max-h-[260px] overflow-y-auto flex flex-col gap-3 pr-1">
                  {SKUPINY.map((sk) => {
                    const lide = kVyberu
                      .filter((k) => skupinaFiltr === 'VSE' || k.skupina === skupinaFiltr)
                      .filter((k) => k.skupina === sk.klic)
                      .filter((k) => {
                        const dotaz = hledaniLidi.trim().toLowerCase();
                        if (!dotaz) return true;
                        return [k.jmeno, k.email, k.firma ?? '']
                          .join(' ')
                          .toLowerCase()
                          .includes(dotaz);
                      });
                    if (lide.length === 0) return null;
                    const vsichniVybrani = lide.every((k) => vybrani.includes(k.id));
                    return (
                      <div key={sk.klic} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-heading uppercase tracking-wide text-muted">
                            {sk.nazev}
                          </span>
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
                </div>
              </>
            )}

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

            {/* Souhrn po otázkách - počítá se jen z těch, kdo dorazí. */}
            {souhrn.otazky.map((o) => {
              const maCo =
                o.ano > 0 || o.ne > 0 || o.moznosti.length > 0 || o.texty.length > 0;
              if (!maCo) return null;
              return (
                <div key={o.otazka.id} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-heading uppercase tracking-wide text-muted">
                    {o.otazka.text}
                  </span>
                  {o.otazka.typ === 'ANO_NE' && (
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-pill border border-brand-green/40 bg-brand-green/10 text-brand-greenDeep px-3 py-1.5 text-xs font-heading font-semibold">
                        ano: {o.ano}
                      </span>
                      <span className="rounded-pill border border-line bg-field text-muted px-3 py-1.5 text-xs font-heading font-semibold">
                        ne: {o.ne}
                      </span>
                    </div>
                  )}
                  {o.otazka.typ === 'VYBER' && (
                    <div className="flex flex-wrap gap-2">
                      {o.moznosti.map((m) => (
                        <span
                          key={m.nazev}
                          className="rounded-pill border border-brand-green/40 bg-brand-green/10 text-brand-greenDeep px-3 py-1.5 text-xs font-heading font-semibold"
                        >
                          {m.nazev}: {m.pocet}
                        </span>
                      ))}
                    </div>
                  )}
                  {o.otazka.typ === 'TEXT' && (
                    <ul className="list-none p-0 m-0 flex flex-col gap-1">
                      {o.texty.map((t) => (
                        <li key={t.jmeno + t.text} className="text-xs font-body text-ink">
                          <span className="font-heading font-semibold">{t.jmeno}:</span> {t.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

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
                    {p.odpovedelAt && popisOdpovedi(otazky, p.odpovedi) && (
                      <span className="text-xs font-body text-muted basis-full">
                        {popisOdpovedi(otazky, p.odpovedi)}
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
          </section>
        </>
      )}
        </div>

        {/* NÁHLED - mail a anketa pohromadě. */}
        <div className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-24">
          <section className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-heading font-semibold text-base text-ink m-0">Jak přijde mail</h2>
              <span className="flex items-center gap-3">
                {kreslim && <span className="text-xs font-body text-muted">překresluju…</span>}
                {nahledHtml && (
                  <button
                    type="button"
                    onClick={() => setVelkyNahled(true)}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-heading font-semibold text-brand-purple hover:border-brand-purple transition-colors"
                  >
                    Zvětšit
                  </button>
                )}
              </span>
            </div>
            {nahledHtml ? (
              /* Rám je „papírový" jako u Rodného listu: člověk se má dívat na
                 dokument, ne na políčko prohlížeče. Výška podle obrazovky, ať
                 je vidět celý mail, ne jen jeho hlavička. */
              <iframe
                title="Náhled pozvánky"
                srcDoc={nahledHtml}
                sandbox=""
                className="w-full h-[70vh] min-h-[520px] rounded-lg border border-line bg-white shadow-md"
              />
            ) : (
              <p className="text-sm font-body text-muted m-0">
                Napiš název a text; náhled se vykreslí sám.
              </p>
            )}
            <p className="text-xs font-body text-muted m-0">
              Skládá ho tatáž funkce, která mail doopravdy posílá - co vidíš, to odejde.
            </p>
          </section>

          <section className="rounded-card border border-line bg-surface p-4 flex flex-col gap-3">
            <h2 className="font-heading font-semibold text-base text-ink m-0">
              Anketa v odkazu
            </h2>
            <p className="text-xs font-body text-muted m-0">
              Tohle vyplní pozvaný po kliknutí na tlačítko v mailu. Klidně si to proklikej -
              odsud se nic neukládá.
            </p>
            <FormularPozvanky
              nahled
              token=""
              jmeno={pozvanky[0]?.jmeno ?? 'Jméno pozvaného'}
              doKdy={doKdyText}
              uzOdpovedel={false}
              otazky={otazky}
              puvodni={{ dorazi: null, odpovedi: {} }}
            />
          </section>
        </div>
      </div>

      {/* NÁHLED PŘES CELOU OBRAZOVKU (25. 11. 2026: „ten náhled je malý.
          Musí to být jako u notifikací a RL"). Stejné okno jako u náhledu
          odeslaných zpráv - klepnutí vedle ho zavře. */}
      {velkyNahled && nahledHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setVelkyNahled(false)}
        >
          <div
            className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                  Náhled pozvánky
                </p>
                <p className="m-0 truncate text-sm font-heading text-ink">
                  {detail.nazev || 'Název akce'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVelkyNahled(false)}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-heading font-semibold text-ink hover:bg-field transition-colors"
              >
                Zavřít
              </button>
            </div>
            <iframe
              title="Náhled pozvánky přes celou obrazovku"
              srcDoc={nahledHtml}
              sandbox=""
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
