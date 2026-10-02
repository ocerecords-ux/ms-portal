'use client';

import type { DiloUdaju, MilnikUdaju, UdajeOsoby, ZdrojUdaju } from '@/lib/wikipedieUdaje';
import { DatumPole } from '@/components/DatumPole';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

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

/**
 * UKÁZKY V POLÍCH ZŮSTÁVAJÍ ČESKÉ (dávka 7c, stejné rozhodnutí jako
 * u „Úvod audioknihy" v dávce 7b): je to obsah českého článku - názvy
 * kategorií („Čeští režiséři"), věta „je český režisér audioknih" nebo
 * vydavatel. Anglická ukázka by radila napsat do článku něco, co tam nemá
 * být. Popisky a nápovědy přeložené jsou.
 */
export function UdajeForm({ udaje, zmena }: { udaje: UdajeOsoby; zmena: (u: UdajeOsoby) => void }) {
  const t = usePreklad();
  function set<K extends keyof UdajeOsoby>(klic: K, hodnota: UdajeOsoby[K]) {
    zmena({ ...udaje, [klic]: hodnota });
  }

  function zdrojeNabidka(vybrany: string, nastav: (v: string) => void) {
    return (
      <select value={vybrany} onChange={(e) => nastav(e.target.value)} className={pole}>
        <option value="">{t('wiki.bezZdroje')}</option>
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
        <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('wiki.kdoJste')}</h3>
        <div className="flex gap-3 flex-wrap">
          <Policko label={t('wiki.jmeno')} hodnota={udaje.jmeno} zmena={(v) => set('jmeno', v)} placeholder="Ondřej Černý" />
          <Policko
            label={t('wiki.cimJste')}
            hint={t('wiki.cimJsteHint')}
            hodnota={udaje.cimJe}
            zmena={(v) => set('cimJe', v)}
            placeholder="je český režisér audioknih a zvukový režisér ze studia Mediaspace"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko label={t('wiki.datumNarozeni')} typ="date" hodnota={udaje.datumNarozeni} zmena={(v) => set('datumNarozeni', v)} />
          <Policko label={t('wiki.mistoNarozeni')} hodnota={udaje.mistoNarozeni} zmena={(v) => set('mistoNarozeni', v)} placeholder="Brno" />
          <Policko
            label={t('wiki.povolani')}
            hint={t('wiki.povolaniHint')}
            hodnota={udaje.povolani}
            zmena={(v) => set('povolani', v)}
            placeholder="režisér audioknih, zvukový režisér"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko
            label={t('wiki.fotka')}
            hint={t('wiki.fotkaHint')}
            hodnota={udaje.fotka}
            zmena={(v) => set('fotka', v)}
            placeholder="ONDREJ CERNY.jpg"
          />
          <Policko label={t('wiki.popisekFotky')} hodnota={udaje.popisekFotky} zmena={(v) => set('popisekFotky', v)} placeholder="Ondřej Černý (2026)" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Policko label={t('wiki.web')} hodnota={udaje.web} zmena={(v) => set('web', v)} placeholder="https://www.mediaspace.cz" />
          <Policko
            label={t('wiki.kategorie')}
            hint={t('wiki.oddelujteCarkou')}
            hodnota={udaje.kategorie}
            zmena={(v) => set('kategorie', v)}
            placeholder="Čeští režiséři, Narození v roce 1985"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className={popisek}>{t('wiki.shrnuti')}</span>
          <textarea
            value={udaje.shrnuti}
            onChange={(e) => set('shrnuti', e.target.value)}
            rows={3}
            placeholder={t('wiki.shrnutiHint')}
            className={`${pole} resize-y`}
          />
        </label>
      </div>

      {/* Zdroje */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('wiki.zdroje')}</h3>
          <button
            type="button"
            className={tlacitkoMale}
            onClick={() => set('zdroje', [...udaje.zdroje, { klic: '', titul: '', kde: '', url: '', datum: '' } as ZdrojUdaju])}
          >
            {t('wiki.pridatZdroj')}
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">{t('wiki.zdrojePopis')}</p>
        {udaje.zdroje.map((z, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 w-[110px]">
              <span className={popisek}>{t('wiki.klic')}</span>
              <input
                value={z.klic}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, klic: e.target.value } : x)))}
                placeholder="youradio"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className={popisek}>{t('wiki.titulek')}</span>
              <input
                value={z.titul}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, titul: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>{t('wiki.kdeVyslo')}</span>
              <input
                value={z.kde}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, kde: e.target.value } : x)))}
                placeholder="Youradio Talk"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className={popisek}>{t('wiki.odkaz')}</span>
              <input
                value={z.url}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://…"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>{t('wiki.datumVydani')}</span>
              <DatumPole
                value={z.datum}
                onChange={(e) => set('zdroje', udaje.zdroje.map((x, j) => (j === i ? { ...x, datum: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('zdroje', udaje.zdroje.filter((_, j) => j !== i))}>
              {t('wiki.odebrat')}
            </button>
          </div>
        ))}
      </div>

      {/* Milníky */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('wiki.zivot')}</h3>
          <button type="button" className={tlacitkoMale} onClick={() => set('milniky', [...udaje.milniky, { rok: '', text: '', zdroj: '' } as MilnikUdaju])}>
            {t('wiki.pridatMilnik')}
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">{t('wiki.milnikyPopis')}</p>
        {udaje.milniky.map((m, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 w-[90px]">
              <span className={popisek}>{t('wiki.rok')}</span>
              <input
                value={m.rok}
                onChange={(e) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, rok: e.target.value } : x)))}
                placeholder="2015"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[280px]">
              <span className={popisek}>{t('wiki.coSeStalo')}</span>
              <input
                value={m.text}
                onChange={(e) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                placeholder="založil studio Mediaspace"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>{t('wiki.zdroj')}</span>
              {zdrojeNabidka(m.zdroj, (v) => set('milniky', udaje.milniky.map((x, j) => (j === i ? { ...x, zdroj: v } : x))))}
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('milniky', udaje.milniky.filter((_, j) => j !== i))}>
              {t('wiki.odebrat')}
            </button>
          </div>
        ))}
      </div>

      {/* Tvorba */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('wiki.tvorba')}</h3>
          <button
            type="button"
            className={tlacitkoMale}
            onClick={() => set('dila', [...udaje.dila, { nazev: '', rok: '', vydavatel: '', poznamka: '', zdroj: '' } as DiloUdaju])}
          >
            {t('wiki.pridatDilo')}
          </button>
        </div>
        {udaje.dila.map((d, i) => (
          <div key={i} className="flex gap-2 flex-wrap items-end border-t border-line pt-3">
            <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
              <span className={popisek}>{t('wiki.nazev')}</span>
              <input
                value={d.nazev}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, nazev: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[90px]">
              <span className={popisek}>{t('wiki.rok')}</span>
              <input
                value={d.rok}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, rok: e.target.value } : x)))}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[160px]">
              <span className={popisek}>{t('wiki.vydavatel')}</span>
              <input
                value={d.vydavatel}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, vydavatel: e.target.value } : x)))}
                placeholder="Audiotéka"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <span className={popisek}>{t('wiki.poznamka')}</span>
              <input
                value={d.poznamka}
                onChange={(e) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, poznamka: e.target.value } : x)))}
                placeholder="čte Jan Maxián"
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1 w-[150px]">
              <span className={popisek}>{t('wiki.zdroj')}</span>
              {zdrojeNabidka(d.zdroj, (v) => set('dila', udaje.dila.map((x, j) => (j === i ? { ...x, zdroj: v } : x))))}
            </label>
            <button type="button" className={tlacitkoMale} onClick={() => set('dila', udaje.dila.filter((_, j) => j !== i))}>
              {t('wiki.odebrat')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
