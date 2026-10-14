'use client';

import { useState } from 'react';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
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
  pocatecni,
}: {
  caflouProjectId: string;
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
    | { ok: false; duvod: string };
}) {
  const t = usePreklad();
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
      setHlaska(t('tagy.ulozeno'));
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
    return <p className="text-sm font-body text-muted m-0">{data.duvod}</p>;
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
                    {s.nazev}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                        <input
                          inputMode="numeric"
                          value={stopa.cislo}
                          onChange={(e) => {
                            const cislo = parseInt(e.target.value.replace(/\D/g, ''), 10);
                            const nove = [...stopy];
                            nove[i] = { ...stopa, cislo: Number.isFinite(cislo) ? cislo : 1 };
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
