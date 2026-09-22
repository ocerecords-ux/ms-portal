'use client';

import type { DiloUdaju, MilnikUdaju, UdajeOsoby, ZdrojUdaju } from '@/lib/wikipedieUdaje';

/**
 * Formulář „Údaje o sobě" (zadání 22. 9. 2026: „napíšu o sobě nějaká data
 * a převede se to do toho textu"). Z vyplněných polí skládá wikitext
 * lib/wikipedieUdaje.ts - tenhle soubor je jen formulář.
 */

const pole =
  'w-full rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';
const popisek = 'text-xs font-heading text-muted uppercase tracking-wide';
const tlacitkoMale =
  'font-heading text-sm rounded-lg border border-line px-3 py-1.5 text-ink bg-transparent cursor-pointer hover:border-brand-purple transition-colors';

function Policko({
  label,
  hint,
  hodnota,
  zmena,
  placeholder,
  typ = 'text',
  siroke,
}: {
  label: string;
  hint?: string;
  hodnota: string;
  zmena: (v: string) => void;
  placeholder?: string;
  typ?: string;
  siroke?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${siroke ? 'w-full' : 'flex-1 min-w-[200px]'}`}>
      <span className={popisek}>{label}</span>
      <input type={typ} value={hodnota} onChange={(e) => zmena(e.target.value)} placeholder={placeholder} className={pole} />
      {hint && <span className="text-xs font-body text-muted">{hint}</span>}
    </label>
  );
}

export function UdajeForm({ udaje, zmena }: { udaje: UdajeOsoby; zmena: (u: UdajeOsoby) => void }) {
  function set<K extends keyof UdajeOsoby>(klic: K, hodnota: UdajeOsoby[K]) {
    zmena({ ...udaje, [klic]: hodnota });
  }

  function zdrojeNabidka(vybrany: string, nastav: (v: string) => void) {
    return (
      <select value={vybrany} onChange={(e) => nastav(e.target.value)} className={pole}>
        <option value="">bez zdroje</option>
        {udaje.zdroje
          .filter((z) => z.klic.trim())
          .map((z) => (
            <option key={z.klic} value={z.klic}>
              {z.klic}
            </option>
          ))}
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Základ */}
      <div className="flex flex-col gap-3">
        <h3 className="font-heading font-semibold text-sm text-ink m-0">Kdo jste</h3>
        <div className="flex gap-3 flex-wrap">
          <Policko label="Jméno" hodnota={udaje.jmeno} zmena={(v) => set('jmeno', v)} placeholder="Ondřej Černý" />
          <Policko
            label="Čím jste"
            hint="doplní se za jméno: „… je český režisér audioknih…“"
            hodnota={udaje.cimJe}
            zmena={(v) => set('cimJe', v)}
            placeholder="je český režisér audioknih a zvukový režisér ze studia Mediaspace"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko label="Datum narození" typ="date" hodnota={udaje.datumNarozeni} zmena={(v) => set('datumNarozeni', v)} />
          <Policko label="Místo narození" hodnota={udaje.mistoNarozeni} zmena={(v) => set('mistoNarozeni', v)} placeholder="Brno" />
          <Policko
            label="Povolání"
            hint="do infoboxu, oddělujte čárkou"
            hodnota={udaje.povolani}
            zmena={(v) => set('povolani', v)}
            placeholder="režisér audioknih, zvukový režisér"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko
            label="Fotka na Commons"
            hint="název souboru bez „File:“"
            hodnota={udaje.fotka}
            zmena={(v) => set('fotka', v)}
            placeholder="ONDREJ CERNY.jpg"
          />
          <Policko label="Popisek fotky" hodnota={udaje.popisekFotky} zmena={(v) => set('popisekFotky', v)} placeholder="Ondřej Černý (2026)" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko label="Oficiální web" hodnota={udaje.web} zmena={(v) => set('web', v)} placeholder="https://www.mediaspace.cz" />
          <Policko
            label="Kategorie"
            hint="oddělujte čárkou"
            hodnota={udaje.kategorie}
            zmena={(v) => set('kategorie', v)}
            placeholder="Čeští režiséři, Narození v roce 1985"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className={popisek}>Shrnutí (nepovinné)</span>
          <textarea
            value={udaje.shrnuti}
            onChange={(e) => set('shrnuti', e.target.value)}
            rows={3}
            placeholder="Odstavec pod úvodní větu — čím se zabýváte, s kým spolupracujete."
            className={`${pole} resize-y`}
          />
        </label>
      </div>

      {/* Zdroje */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">Zdroje</h3>
          <button
            type="button"
            className={tlacitkoMale}
            onClick={() => set('zdroje', [...udaje.zdroje, { klic: '', titul: '', kde: '', url: '', datum: '' } as ZdrojUdaju])}
          >
            + Přidat zdroj
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">
          Nezávislé články a rozhovory, ze kterých tvrzení pocházejí. Klíč je jen krátké jméno zdroje (např. „youradio“),
          kterým se pak u údajů níž vybírá.
        </p>
        {udaje.zdroje.map((z, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 w-[110px]">
              <span className={popisek}>Klíč</span>
              <input
                value={z.klic}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, klic: e.target.value } : x)))}
                placeholder="youradio"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className={popisek}>Titulek</span>
              <input
                value={z.titul}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, titul: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>Kde vyšlo</span>
              <input
                value={z.kde}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, kde: e.target.value } : x)))}
                placeholder="Youradio Talk"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className={popisek}>Odkaz</span>
              <input
                value={z.url}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://…"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>Datum vydání</span>
              <input
                type="date"
                value={z.datum}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, datum: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('zdroje', udaje.zdroje.filter((_, j) => j !== i))}>
              Odebrat
            </button>
          </div>
        ))}
      </div>

      {/* Milníky */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">Život — co se kdy stalo</h3>
          <button type="button" className={tlacitkoMale} onClick={() => set('milniky', [...udaje.milniky, { rok: '', text: '', zdroj: '' } as MilnikUdaju])}>
            + Přidat milník
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">
          Z každého řádku vznikne věta: rok + co se stalo. Pište bez hodnocení, třeba „založil studio Mediaspace“.
        </p>
        {udaje.milniky.map((m, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 w-[90px]">
              <span className={popisek}>Rok</span>
              <input
                value={m.rok}
                onChange={(e) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, rok: e.target.value } : x)))}
                placeholder="2015"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[280px]">
              <span className={popisek}>Co se stalo</span>
              <input
                value={m.text}
                onChange={(e) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                placeholder="založil studio Mediaspace"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>Zdroj</span>
              {zdrojeNabidka(m.zdroj, (v) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, zdroj: v } : x))))}
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('milniky', udaje.milniky.filter((_, j) => j !== i))}>
              Odebrat
            </button>
          </div>
        ))}
      </div>

      {/* Tvorba */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">Tvorba</h3>
          <button
            type="button"
            className={tlacitkoMale}
            onClick={() => set('dila', [...udaje.dila, { nazev: '', rok: '', vydavatel: '', poznamka: '', zdroj: '' } as DiloUdaju])}
          >
            + Přidat dílo
          </button>
        </div>
        {udaje.dila.map((d, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <span className={popisek}>Název</span>
              <input
                value={d.nazev}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, nazev: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[90px]">
              <span className={popisek}>Rok</span>
              <input
                value={d.rok}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, rok: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[160px]">
              <span className={popisek}>Vydavatel</span>
              <input
                value={d.vydavatel}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, vydavatel: e.target.value } : x)))}
                placeholder="Audiotéka"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <span className={popisek}>Poznámka</span>
              <input
                value={d.poznamka}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, poznamka: e.target.value } : x)))}
                placeholder="čte Jan Maxián"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>Zdroj</span>
              {zdrojeNabidka(d.zdroj, (v) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, zdroj: v } : x))))}
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('dila', udaje.dila.filter((_, j) => j !== i))}>
              Odebrat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
