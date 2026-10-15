'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { useNeulozeno } from '@/app/(portal)/components/NeulozeneZmeny';
import { cisloTracku, type Track } from '@/lib/tracklist';
import type { StopaKTagovani, SpolecneTagy, SlozkaKVyberu } from '@/lib/tagyServer';

/**
 * TAGY FINÁLNÍ NAHRÁVKY (zadání 14. 10. 2026: „potřebuju nějak pořešit to,
 * abychom mohli finální nahrávku otagovat").
 *
 * ÚDAJE SPOLEČNÉ PRO CELOU KNIHU JSOU V PANELU NA BOKU (zadání: „chci to zadat
 * do polí někde na boku. Zadám jednou a jsou společné pro: artist, album,
 * albumartist, date, label, genre a mění se každý název tracku podle reálných
 * názvů tracků"). Vedle nich je seznam stop a u každé jediné vlastní pole -
 * název stopy.
 *
 * ZAPISUJE SE PO JEDNÉ STOPĚ a je vidět, jak to jde: hodinová stopa se musí
 * stáhnout z Disku, přelepit značkou a nahrát zpátky. Spadne-li jedna, zbytek
 * zůstává hotový a dá se spustit znovu jen ta.
 *
 * ZATÍM JEN MP3 A JEN FIRMÁM, KTERÉ TO MAJÍ ZAPNUTÉ (zadání: „mělo by to
 * fungovat u Albatrosu jen zatím") - viz Administrace → Firmy.
 */

type Stav = 'ceka' | 'bezi' | 'hotovo' | 'chyba';

export function TagySekce({
  caflouProjectId,
  tracklist,
  pocatecni,
}: {
  caflouProjectId: string;
  /** Předpis z vedlejší záložky - podle něj se tagují názvy (15. 10. 2026). */
  tracklist: Track[];
  pocatecni:
    | {
        ok: true;
        slozkaId: string;
        slozkaUrl: string | null;
        slozky: SlozkaKVyberu[];
        stopy: StopaKTagovani[];
        spolecne: SpolecneTagy;
        zapsanoAt: string | null;
      }
    | { ok: false; duvod: string; duvodKlic?: string };
}) {
  const t = usePreklad();
  const router = useRouter();
  const [data, setData] = useState(pocatecni);
  const [spolecne, setSpolecne] = useState<SpolecneTagy>(
    pocatecni.ok ? pocatecni.spolecne : { autor: '', album: '', interpret: '', rok: null, zanr: '', vydavatel: '' },
  );
  const [stopy, setStopy] = useState<StopaKTagovani[]>(pocatecni.ok ? pocatecni.stopy : []);
  const [slozka, setSlozka] = useState(pocatecni.ok ? pocatecni.slozkaId : '');
  const [stavy, setStavy] = useState<Record<string, Stav>>({});
  const [chyby, setChyby] = useState<Record<string, string>>({});
  const [uklada, setUklada] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  /** U které stopy je rozbalený náhled tagů (15. 10. 2026). */
  const [nahled, setNahled] = useState<string | null>(null);
  /** Co bylo naposledy uloženo - podle toho se pozná rozdělaná práce. */
  const [ulozene, setUlozene] = useState<string>(() =>
    JSON.stringify(pocatecni.ok ? { spolecne: pocatecni.spolecne, stopy: pocatecni.stopy } : null),
  );

  /** Pojistka při odchodu ze stránky (15. 10. 2026) - viz NeulozeneZmeny.tsx. */
  useNeulozeno(JSON.stringify({ spolecne, stopy }) !== ulozene, uloz);

  const pole =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple';
  const popisek = 'text-[11px] font-heading font-semibold uppercase tracking-wide text-muted';

  async function prepniSlozku(novaSlozka: string) {
    setSlozka(novaSlozka);
    setStavy({});
    setChyby({});
    try {
      const res = await fetch(
        `/api/projekty/${caflouProjectId}/tagy?slozka=${encodeURIComponent(novaSlozka)}`,
        { cache: 'no-store' },
      );
      const nove = await res.json();
      setData(nove);
      if (nove?.ok) setStopy(nove.stopy);
    } catch {
      setHlaska(t('tagy.nactenoNeslo'));
    }
  }

  /**
   * PŘEVZETÍ NÁZVŮ Z TRACKLISTU (zadání 15. 10. 2026: „potřebuju, abych mohl
   * otagovat dle vytvořeného tracklistu. Potřebuju nějaké tlačítko").
   *
   * Tracklist je předpis, jak se mají tracky jmenovat; tahle záložka ho jen
   * zapíše do souborů. Páruje se PODLE POŘADÍ - první soubor ve složce
   * k prvnímu řádku tracklistu - a čísla stop se srovnají podle něj.
   *
   * DO TITLE JDE NÁZEV KAPITOLY, a když kniha kapitoly pojmenované nemá,
   * použije se název tracku (dohoda z 14. 10. 2026: „když nemá názvy kapitol,
   * tak title kopíruje název tracků").
   */
  function prevezmiZTracklistu() {
    if (tracklist.length === 0) return;
    setStopy(
      stopy.map((stopa, i) => {
        const radek = tracklist[i];
        if (!radek) return stopa;
        return {
          ...stopa,
          cislo: radek.poradi,
          title: radek.nazevKapitoly.trim() || radek.nazevTracku.trim() || stopa.title,
        };
      }),
    );
    setHlaska(t('tagy.prevzatoZTracklistu', { pocet: Math.min(tracklist.length, stopy.length) }));
  }

  /** Jak budou tagy v souboru vypadat - to samé, co zapíše lib/id3.ts. */
  function nahledTagu(stopa: StopaKTagovani): { popisek: string; hodnota: string }[] {
    const celkem = stopy.length;
    return [
      { popisek: t('tagy.nahledTitle'), hodnota: stopa.title },
      { popisek: t('tagy.nahledArtist'), hodnota: spolecne.autor },
      { popisek: t('tagy.nahledAlbumArtist'), hodnota: spolecne.interpret },
      { popisek: t('tagy.nahledAlbum'), hodnota: spolecne.album },
      { popisek: t('tagy.nahledRok'), hodnota: spolecne.rok != null ? String(spolecne.rok) : '' },
      { popisek: t('tagy.nahledZanr'), hodnota: spolecne.zanr },
      {
        popisek: t('tagy.nahledTrack'),
        hodnota: celkem > 0 ? `${cisloTracku(stopa.cislo)}/${cisloTracku(celkem)}` : cisloTracku(stopa.cislo),
      },
      { popisek: t('tagy.nahledVydavatel'), hodnota: spolecne.vydavatel },
    ];
  }

  async function uloz(): Promise<boolean> {
    setUklada(true);
    setHlaska(null);
    try {
      const res = await fetch(`/api/projekty/${caflouProjectId}/tagy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spolecne,
          stopy: stopy.map((s) => ({
            driveFileId: s.driveFileId,
            nazevSouboru: s.nazevSouboru,
            cislo: s.cislo,
            title: s.title,
          })),
        }),
      });
      if (!res.ok) {
        const telo = await res.json().catch(() => ({}));
        setHlaska(telo?.error || t('tagy.ulozeniNeslo'));
        return false;
      }
      setUlozene(JSON.stringify({ spolecne, stopy }));
      setHlaska(t('tagy.ulozeno'));
      // Ať se po návratu na stránku neukáže její stará podoba - viz Tracklist.
      router.refresh();
      return true;
    } catch {
      setHlaska(t('tagy.ulozeniNeslo'));
      return false;
    } finally {
      setUklada(false);
    }
  }

  /** Nejdřív uložit, pak stopu po stopě přepsat značku na Disku. */
  async function zapis() {
    if (!(await uloz())) return;
    setZapisuje(true);
    setHlaska(null);
    const novaChyby: Record<string, string> = {};
    for (const stopa of stopy) {
      setStavy((s) => ({ ...s, [stopa.driveFileId]: 'bezi' }));
      try {
        const res = await fetch(`/api/projekty/${caflouProjectId}/tagy/zapsat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveFileId: stopa.driveFileId, slozka }),
        });
        if (res.ok) {
          setStavy((s) => ({ ...s, [stopa.driveFileId]: 'hotovo' }));
        } else {
          const telo = await res.json().catch(() => ({}));
          novaChyby[stopa.driveFileId] = telo?.error || t('tagy.zapisNeslo');
          setStavy((s) => ({ ...s, [stopa.driveFileId]: 'chyba' }));
        }
      } catch {
        novaChyby[stopa.driveFileId] = t('tagy.zapisNeslo');
        setStavy((s) => ({ ...s, [stopa.driveFileId]: 'chyba' }));
      }
    }
    setChyby(novaChyby);
    setZapisuje(false);
    setHlaska(Object.keys(novaChyby).length === 0 ? t('tagy.zapsanoVse') : t('tagy.zapsanoSChybou'));
  }

  if (!data.ok) {
    /* Server posila cesky duvod i klic do slovniku (davka 7l) - prelozeny
       vyhrava, cestina zustava zalohou pro pripad klice, ktery ve slovniku
       jeste neni. */
    const text = data.duvodKlic ? t(data.duvodKlic) : data.duvod;
    return (
      <p className="text-sm font-body text-muted m-0">
        {text === data.duvodKlic ? data.duvod : text}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-body text-muted m-0 max-w-3xl">{t('tagy.uvod')}</p>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* SPOLEČNÉ ÚDAJE - zadají se jednou pro celou knihu. */}
        <div className="w-full lg:w-[320px] shrink-0 rounded-card border border-line bg-field p-4 flex flex-col gap-3">
          <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('tagy.spolecne')}</h3>

          <label className="flex flex-col gap-1.5">
            <span className={popisek}>{t('tagy.autor')}</span>
            <input
              value={spolecne.autor}
              onChange={(e) => setSpolecne({ ...spolecne, autor: e.target.value })}
              placeholder={t('tagy.autorPriklad')}
              className={pole}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={popisek}>{t('tagy.album')}</span>
            <input
              value={spolecne.album}
              onChange={(e) => setSpolecne({ ...spolecne, album: e.target.value })}
              className={pole}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={popisek}>{t('tagy.interpret')}</span>
            <input
              value={spolecne.interpret}
              onChange={(e) => setSpolecne({ ...spolecne, interpret: e.target.value })}
              placeholder={t('tagy.interpretPriklad')}
              className={pole}
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1.5 w-[110px]">
              <span className={popisek}>{t('tagy.rok')}</span>
              <input
                inputMode="numeric"
                value={spolecne.rok ?? ''}
                onChange={(e) => {
                  const cislo = parseInt(e.target.value.replace(/\D/g, ''), 10);
                  setSpolecne({ ...spolecne, rok: Number.isFinite(cislo) ? cislo : null });
                }}
                className={pole}
              />
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-0">
              <span className={popisek}>{t('tagy.zanr')}</span>
              <input
                value={spolecne.zanr}
                onChange={(e) => setSpolecne({ ...spolecne, zanr: e.target.value })}
                className={pole}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={popisek}>{t('tagy.vydavatel')}</span>
            <input
              value={spolecne.vydavatel}
              onChange={(e) => setSpolecne({ ...spolecne, vydavatel: e.target.value })}
              className={pole}
            />
          </label>

          {data.slozky.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className={popisek}>{t('tagy.slozka')}</span>
              <select value={slozka} onChange={(e) => prepniSlozku(e.target.value)} className={pole}>
                {data.slozky.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.korenova ? t('tagy.slozkaProjektu') : s.nazev}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* PŘEVZÍT NÁZVY Z TRACKLISTU (15. 10. 2026) - viz prevezmiZTracklistu. */}
          <button
            type="button"
            onClick={prevezmiZTracklistu}
            disabled={tracklist.length === 0 || uklada || zapisuje}
            title={
              tracklist.length === 0 ? t('tagy.tracklistPrazdny') : t('tagy.prevzitZTracklistuPopis')
            }
            className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent disabled:opacity-50"
          >
            {t('tagy.prevzitZTracklistu')}
          </button>

          <div className="flex gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={uloz}
              disabled={uklada || zapisuje}
              className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer bg-transparent disabled:opacity-50"
            >
              {uklada ? t('obecne.ukladam') : t('tagy.ulozit')}
            </button>
            <button
              type="button"
              onClick={zapis}
              disabled={uklada || zapisuje || stopy.length === 0}
              className="font-heading font-semibold text-sm rounded-lg px-3.5 py-2 bg-brand-green text-onAccent hover:opacity-90 transition-opacity cursor-pointer border-0 disabled:opacity-50"
            >
              {zapisuje ? t('tagy.zapisuji') : t('tagy.zapsat')}
            </button>
          </div>

          {hlaska && <p className="text-xs font-body text-muted m-0">{hlaska}</p>}
          {data.zapsanoAt && (
            <p className="text-xs font-body text-muted m-0">
              {t('tagy.naposledy', { kdy: new Date(data.zapsanoAt).toLocaleString('cs-CZ') })}
            </p>
          )}
        </div>

        {/* STOPY - jediné vlastní pole je název. */}
        <div className="flex-1 min-w-0 w-full rounded-card border border-line bg-surface overflow-hidden">
          {stopy.length === 0 ? (
            <p className="text-sm font-body text-muted m-0 p-4">{t('tagy.zadneMp3')}</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2 w-[60px]">
                    #
                  </th>
                  <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2">
                    {t('tagy.nazevStopy')}
                  </th>
                  <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2 hidden sm:table-cell">
                    {t('tagy.soubor')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stopy.map((stopa, i) => {
                  const stav = stavy[stopa.driveFileId];
                  return (
                    <tr key={stopa.driveFileId} className="border-t border-line align-middle">
                      <td className="px-3 py-1.5">
                        {/* DVOJMÍSTNĚ, STEJNĚ JAKO V TRACKLISTU (zadání 15. 10.
                            2026: „pořadové číslo tracku musí být 01, 02, 03,
                            jako v tracklistu"). Píše se 1 i 01 - do pole se
                            vrátí tvar s nulou napřed. */}
                        <input
                          inputMode="numeric"
                          value={cisloTracku(stopa.cislo)}
                          onChange={(e) => {
                            const cislo = parseInt(e.target.value.replace(/\D/g, ''), 10);
                            const nove = [...stopy];
                            nove[i] = { ...stopa, cislo: Number.isFinite(cislo) && cislo > 0 ? cislo : 1 };
                            setStopy(nove);
                          }}
                          className={`${pole} text-center tabular-nums px-1.5`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={stopa.title}
                          onChange={(e) => {
                            const nove = [...stopy];
                            nove[i] = { ...stopa, title: e.target.value };
                            setStopy(nove);
                          }}
                          className={pole}
                        />
                        {chyby[stopa.driveFileId] && (
                          <span className="block text-xs font-body text-danger mt-1">
                            {chyby[stopa.driveFileId]}
                          </span>
                        )}
                        {/* NÁHLED TAGŮ (zadání 15. 10. 2026: „ještě předtím,
                            než otaguju soubory, bych potřeboval mít u každého
                            tracku v kartě, kde taguju, náhled, jak vypadají
                            tagy"). Je to přesně to, co zapíše lib/id3.ts -
                            ne popis, ale hotové hodnoty. */}
                        <button
                          type="button"
                          onClick={() => setNahled(nahled === stopa.driveFileId ? null : stopa.driveFileId)}
                          className="mt-1 text-[11px] font-heading font-semibold text-brand-purple hover:underline bg-transparent border-0 px-0 cursor-pointer"
                        >
                          {nahled === stopa.driveFileId ? t('tagy.nahledSkryt') : t('tagy.nahledUkazat')}
                        </button>
                        {nahled === stopa.driveFileId && (
                          <span className="mt-1.5 grid grid-cols-[minmax(0,130px)_1fr] gap-x-3 gap-y-0.5 rounded-lg border border-line bg-field p-2.5">
                            {nahledTagu(stopa).map((r) => (
                              <Fragment key={r.popisek}>
                                <span className="text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
                                  {r.popisek}
                                </span>
                                <span
                                  className={`text-xs font-body break-words ${
                                    r.hodnota ? 'text-ink' : 'text-muted italic'
                                  }`}
                                >
                                  {r.hodnota || t('tagy.nahledPrazdne')}
                                </span>
                              </Fragment>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-body text-muted hidden sm:table-cell">
                        <span className="block truncate max-w-[260px]" title={stopa.nazevSouboru}>
                          {stopa.nazevSouboru}
                        </span>
                        <span className="block mt-0.5">
                          {stav === 'bezi'
                            ? t('tagy.stavBezi')
                            : stav === 'hotovo'
                              ? t('tagy.stavHotovo')
                              : stav === 'chyba'
                                ? t('tagy.stavChyba')
                                : stopa.zapsanoAt
                                  ? t('tagy.stavDrive')
                                  : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
