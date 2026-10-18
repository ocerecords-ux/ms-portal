'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { usePreklad, useJazyk } from '@/app/(portal)/components/JazykProvider';
import { hlaskaChyby } from '@/lib/chybaZOdpovedi';
import {
  PUBLIKA,
  TYPY,
  barvaTypu,
  labelPublika,
  labelTypu,
  mesicKlice,
  mesicTextem,
} from '@/lib/novinky';

/**
 * NOVINKY PORTÁLU - dvě záložky (17. 10. 2026).
 *
 * Historie: co všechno v portálu přibylo, po měsících, s filtrem podle toho,
 * koho se to týká.
 * Newsletter: z vybraného měsíce a publika se poskládá text k rozeslání.
 * Druhá záložka je jen pro toho, kdo novinky píše.
 */
export type NovinkaVPrehledu = {
  id: string;
  klic: string;
  datum: string;
  nazev: string;
  popis: string;
  proNewsletter: string | null;
  modul: string;
  typ: string;
  publikum: string[];
  zverejneno: boolean;
  odeslanoAt: string | null;
};

type Formular = {
  id: string | null;
  datum: string;
  nazev: string;
  modul: string;
  typ: string;
  publikum: string[];
  popis: string;
  proNewsletter: string;
  zverejneno: boolean;
};

const PRAZDNY = (): Formular => ({
  id: null,
  datum: new Date().toISOString().slice(0, 10),
  nazev: '',
  modul: '',
  typ: 'VYLEPSENI',
  publikum: ['TYM'],
  popis: '',
  proNewsletter: '',
  zverejneno: true,
});

export function NovinkyPrehled({
  novinky,
  moduly,
  mesice,
  pise,
}: {
  novinky: NovinkaVPrehledu[];
  moduly: string[];
  mesice: string[];
  pise: boolean;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();

  const [zalozka, setZalozka] = useState<'historie' | 'newsletter'>('historie');
  const [filtrPublika, setFiltrPublika] = useState<string>('');
  const [filtrModulu, setFiltrModulu] = useState<string>('');
  const [hledani, setHledani] = useState('');
  const [formular, setFormular] = useState<Formular | null>(null);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  const vybrane = useMemo(() => {
    const hledam = hledani.trim().toLowerCase();
    return novinky.filter((n) => {
      if (filtrPublika && !n.publikum.includes(filtrPublika)) return false;
      if (filtrModulu && n.modul !== filtrModulu) return false;
      if (!hledam) return true;
      return `${n.nazev} ${n.popis} ${n.modul}`.toLowerCase().includes(hledam);
    });
  }, [novinky, filtrPublika, filtrModulu, hledani]);

  // Seskupení po měsících - nadpis se opakovat nemá, ať je historie čitelná.
  const skupiny = useMemo(() => {
    const mapa = new Map<string, NovinkaVPrehledu[]>();
    for (const n of vybrane) {
      const klic = mesicKlice(new Date(`${n.datum}T12:00:00Z`));
      const dosud = mapa.get(klic);
      if (dosud) dosud.push(n);
      else mapa.set(klic, [n]);
    }
    return [...mapa.entries()];
  }, [vybrane]);

  const vsechnyModuly = useMemo(
    () => [...new Set([...moduly, ...novinky.map((n) => n.modul)])].sort((a, b) => a.localeCompare(b, 'cs')),
    [moduly, novinky],
  );

  async function uloz() {
    if (!formular) return;
    setUklada(true);
    setChyba(null);
    const telo = {
      datum: formular.datum,
      nazev: formular.nazev,
      popis: formular.popis,
      proNewsletter: formular.proNewsletter || null,
      modul: formular.modul,
      typ: formular.typ,
      publikum: formular.publikum,
      zverejneno: formular.zverejneno,
    };
    const odpoved = await fetch(formular.id ? `/api/novinky/${formular.id}` : '/api/novinky', {
      method: formular.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
    }).catch(() => null);
    setUklada(false);
    if (!odpoved || !odpoved.ok) {
      const data = odpoved ? await odpoved.json().catch(() => null) : null;
      setChyba(hlaskaChyby(data, t, t('novinky.chyba')));
      return;
    }
    setFormular(null);
    router.refresh();
  }

  async function smaz(id: string) {
    if (!window.confirm(t('novinky.opravduSmazat'))) return;
    await fetch(`/api/novinky/${id}`, { method: 'DELETE' }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {pise && (
        <div className="flex gap-2">
          {(['historie', 'newsletter'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setZalozka(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-body ${
                zalozka === k ? 'bg-accent text-onAccent' : 'bg-surface text-muted border border-line'
              }`}
            >
              {t(k === 'historie' ? 'novinky.historie' : 'novinky.newsletter')}
            </button>
          ))}
        </div>
      )}

      {zalozka === 'historie' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltrPublika('')}
              className={`rounded-full px-3 py-1 text-xs font-body ${
                filtrPublika === '' ? 'bg-accent text-onAccent' : 'bg-surface text-muted border border-line'
              }`}
            >
              {t('novinky.vse')}
            </button>
            {PUBLIKA.map((p) => (
              <button
                key={p.kod}
                type="button"
                onClick={() => setFiltrPublika(p.kod)}
                className={`rounded-full px-3 py-1 text-xs font-body ${
                  filtrPublika === p.kod
                    ? 'bg-accent text-onAccent'
                    : 'bg-surface text-muted border border-line'
                }`}
              >
                {labelPublika(p.kod, jazyk)}
              </button>
            ))}

            <select
              value={filtrModulu}
              onChange={(e) => setFiltrModulu(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-body text-ink"
            >
              <option value="">{t('novinky.vsechnyModuly')}</option>
              {vsechnyModuly.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <input
              value={hledani}
              onChange={(e) => setHledani(e.target.value)}
              placeholder={t('novinky.hledat')}
              className="rounded-lg border border-line bg-surface px-3 py-1 text-xs font-body text-ink"
            />

            {pise && (
              <button
                type="button"
                onClick={() => setFormular(PRAZDNY())}
                className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-body text-onAccent"
              >
                {t('novinky.pridat')}
              </button>
            )}
          </div>

          {formular && (
            <FormularNovinky
              hodnoty={formular}
              moduly={vsechnyModuly}
              uklada={uklada}
              chyba={chyba}
              zmen={setFormular}
              uloz={uloz}
              zrus={() => {
                setFormular(null);
                setChyba(null);
              }}
            />
          )}

          {!skupiny.length && <p className="text-sm font-body text-muted">{t('novinky.nicNenalezeno')}</p>}

          {skupiny.map(([mesic, polozky]) => (
            <div key={mesic} className="flex flex-col gap-2">
              <h2 className="font-display text-lg text-ink m-0">{mesicTextem(mesic, jazyk)}</h2>
              {polozky.map((n) => (
                <article
                  key={n.id}
                  className={`rounded-xl border border-line bg-surface p-3 ${
                    n.zverejneno ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-body ${barvaTypu(n.typ)}`}>
                      {labelTypu(n.typ, jazyk)}
                    </span>
                    <span className="text-xs font-body text-muted">{n.modul}</span>
                    <span className="text-xs font-body text-muted">{n.datum}</span>
                    {!n.zverejneno && (
                      <span className="text-xs font-body text-muted">{t('novinky.rozepsana')}</span>
                    )}
                    {n.odeslanoAt && (
                      <span className="text-xs font-body text-muted">{t('novinky.odeslano')}</span>
                    )}
                    {pise && (
                      <span className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormular({
                              id: n.id,
                              datum: n.datum,
                              nazev: n.nazev,
                              modul: n.modul,
                              typ: n.typ,
                              publikum: n.publikum,
                              popis: n.popis,
                              proNewsletter: n.proNewsletter ?? '',
                              zverejneno: n.zverejneno,
                            })
                          }
                          className="text-xs font-body text-muted underline"
                        >
                          {t('novinky.upravit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => smaz(n.id)}
                          className="text-xs font-body text-muted underline"
                        >
                          {t('novinky.smazat')}
                        </button>
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-base text-ink m-0 mt-1">{n.nazev}</h3>
                  {n.popis && (
                    <p className="text-sm font-body text-muted m-0 mt-1 whitespace-pre-line">{n.popis}</p>
                  )}

                  {!!n.publikum.length && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {n.publikum.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-line px-2 py-0.5 text-[11px] font-body text-muted"
                        >
                          {labelPublika(p, jazyk)}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ))}
        </>
      )}

      {zalozka === 'newsletter' && pise && <NewsletterPanel mesice={mesice} />}
    </div>
  );
}

function FormularNovinky({
  hodnoty,
  moduly,
  uklada,
  chyba,
  zmen,
  uloz,
  zrus,
}: {
  hodnoty: Formular;
  moduly: string[];
  uklada: boolean;
  chyba: string | null;
  zmen: (f: Formular) => void;
  uloz: () => void;
  zrus: () => void;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const pole = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm font-body text-ink w-full';

  return (
    <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-body text-muted">{t('novinky.datum')}</span>
          <input
            type="date"
            value={hodnoty.datum}
            onChange={(e) => zmen({ ...hodnoty, datum: e.target.value })}
            className={pole}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-body text-muted">{t('novinky.nazev')}</span>
          <input
            value={hodnoty.nazev}
            onChange={(e) => zmen({ ...hodnoty, nazev: e.target.value })}
            className={pole}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-body text-muted">{t('novinky.typ')}</span>
          <select
            value={hodnoty.typ}
            onChange={(e) => zmen({ ...hodnoty, typ: e.target.value })}
            className={pole}
          >
            {TYPY.map((typ) => (
              <option key={typ.kod} value={typ.kod}>
                {labelTypu(typ.kod, jazyk)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-body text-muted">{t('novinky.modul')}</span>
        <input
          list="novinky-moduly"
          value={hodnoty.modul}
          onChange={(e) => zmen({ ...hodnoty, modul: e.target.value })}
          className={pole}
        />
        <datalist id="novinky-moduly">
          {moduly.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-body text-muted">{t('novinky.publikum')}</span>
        <div className="flex flex-wrap gap-3">
          {PUBLIKA.map((p) => (
            <label key={p.kod} className="flex items-center gap-2 text-sm font-body text-ink">
              <input
                type="checkbox"
                checked={hodnoty.publikum.includes(p.kod)}
                onChange={(e) =>
                  zmen({
                    ...hodnoty,
                    publikum: e.target.checked
                      ? [...hodnoty.publikum, p.kod]
                      : hodnoty.publikum.filter((k) => k !== p.kod),
                  })
                }
              />
              {labelPublika(p.kod, jazyk)}
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-body text-muted">{t('novinky.popis')}</span>
        <textarea
          rows={3}
          value={hodnoty.popis}
          onChange={(e) => zmen({ ...hodnoty, popis: e.target.value })}
          className={pole}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-body text-muted">{t('novinky.proNewsletter')}</span>
        <textarea
          rows={2}
          value={hodnoty.proNewsletter}
          onChange={(e) => zmen({ ...hodnoty, proNewsletter: e.target.value })}
          className={pole}
          placeholder={t('novinky.proNewsletterNapoveda')}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-body text-ink">
        <input
          type="checkbox"
          checked={hodnoty.zverejneno}
          onChange={(e) => zmen({ ...hodnoty, zverejneno: e.target.checked })}
        />
        {t('novinky.zverejneno')}
      </label>

      {chyba && <p className="text-sm font-body text-red-600 m-0">{chyba}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={uloz}
          disabled={uklada}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-body text-onAccent disabled:opacity-60"
        >
          {t('novinky.ulozit')}
        </button>
        <button
          type="button"
          onClick={zrus}
          className="rounded-lg border border-line px-4 py-1.5 text-sm font-body text-muted"
        >
          {t('novinky.zrusit')}
        </button>
      </div>
    </div>
  );
}

function NewsletterPanel({ mesice }: { mesice: string[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const nabidka = mesice.length ? mesice : [mesicKlice(new Date())];

  const [mesic, setMesic] = useState(nabidka[0]);
  const [publikum, setPublikum] = useState<string>('KLIENT_AUDIOKNIHY');
  const [iOdeslane, setIOdeslane] = useState(false);
  const [text, setText] = useState('');
  const [idcka, setIdcka] = useState<string[]>([]);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);

  async function sestav() {
    setPracuje(true);
    setHlaska(null);
    const odpoved = await fetch('/api/novinky/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesic, publikum, vcetneOdeslanych: iOdeslane }),
    }).catch(() => null);
    setPracuje(false);
    const data = odpoved && odpoved.ok ? await odpoved.json().catch(() => null) : null;
    const newsletter = (data as { newsletter?: { text: string; idcka: string[] } } | null)?.newsletter;
    if (!newsletter) {
      setHlaska(t('novinky.chyba'));
      return;
    }
    setText(newsletter.text);
    setIdcka(newsletter.idcka);
    if (!newsletter.text) setHlaska(t('novinky.prazdnyNewsletter'));
  }

  async function oznac() {
    if (!idcka.length) return;
    setPracuje(true);
    const odpoved = await fetch('/api/novinky/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idcka }),
    }).catch(() => null);
    setPracuje(false);
    setHlaska(odpoved && odpoved.ok ? t('novinky.oznaceno') : t('novinky.chyba'));
  }

  const pole = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm font-body text-ink';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-body text-muted">{t('novinky.mesic')}</span>
          <select value={mesic} onChange={(e) => setMesic(e.target.value)} className={pole}>
            {nabidka.map((m) => (
              <option key={m} value={m}>
                {mesicTextem(m, jazyk)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-body text-muted">{t('novinky.publikum')}</span>
          <select value={publikum} onChange={(e) => setPublikum(e.target.value)} className={pole}>
            {PUBLIKA.map((p) => (
              <option key={p.kod} value={p.kod}>
                {labelPublika(p.kod, jazyk)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-body text-ink pb-2">
          <input type="checkbox" checked={iOdeslane} onChange={(e) => setIOdeslane(e.target.checked)} />
          {t('novinky.iOdeslane')}
        </label>

        <button
          type="button"
          onClick={sestav}
          disabled={pracuje}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-body text-onAccent disabled:opacity-60"
        >
          {t('novinky.sestavit')}
        </button>
      </div>

      {hlaska && <p className="text-sm font-body text-muted m-0">{hlaska}</p>}

      {!!text && (
        <>
          <textarea
            readOnly
            rows={16}
            value={text}
            className="rounded-xl border border-line bg-surface p-3 text-sm font-body text-ink w-full"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                setHlaska(t('novinky.zkopirovano'));
              }}
              className="rounded-lg border border-line px-4 py-1.5 text-sm font-body text-muted"
            >
              {t('novinky.kopirovat')}
            </button>
            <button
              type="button"
              onClick={oznac}
              disabled={pracuje}
              className="rounded-lg border border-line px-4 py-1.5 text-sm font-body text-muted disabled:opacity-60"
            >
              {t('novinky.oznacitOdeslane')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
