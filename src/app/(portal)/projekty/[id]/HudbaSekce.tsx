'use client';

import { useRef, useState } from 'react';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import type { SkladbaProjektu } from '@/lib/hudbaProjektuServer';

/**
 * HUDBA VYBRANÁ PRO PROJEKT (zadání 16. 10. 2026: „potřebuju u projektů mít
 * kartu, kde budu vkládat hudbu, kterou vyberu pro daný projekt").
 *
 * SOUBOR JDE Z PROHLÍŽEČE ROVNOU DO DROPBOXU. Portál vydá jednorázovou adresu
 * a pak už jen zapíše, že skladba u projektu je - přes Vercel by padesátimegový
 * WAV neprošel (strop požadavku je kolem 4,5 MB).
 *
 * POSTUP JE VIDĚT. Padesát megabajtů po běžné lince trvá desítky vteřin a bez
 * ukazatele to vypadá, že se portál seknul. Proto XMLHttpRequest a ne fetch:
 * jen on umí říct, kolik už je nahráno.
 */
type Stav = { klic: string; nazev: string; procenta: number; chyba?: string };

export function HudbaSekce({
  caflouProjectId,
  pocatecni,
  dropboxNastaven,
}: {
  caflouProjectId: string;
  pocatecni: SkladbaProjektu[];
  /** Když chybí klíče, karta to řekne rovnou místo tichého selhání. */
  dropboxNastaven: boolean;
}) {
  const t = usePreklad();
  const [skladby, setSkladby] = useState<SkladbaProjektu[]>(pocatecni);
  const [nahrava, setNahrava] = useState<Stav[]>([]);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pretahuje, setPretahuje] = useState(false);
  const vstup = useRef<HTMLInputElement | null>(null);

  async function nahrajJeden(soubor: File, klic: string) {
    const uprav = (zmena: Partial<Stav>) =>
      setNahrava((p) => p.map((s) => (s.klic === klic ? { ...s, ...zmena } : s)));

    // 1) adresa od portálu
    const podpis = await fetch(`/api/projekty/${caflouProjectId}/hudba/podpis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: soubor.name, velikost: soubor.size }),
    });
    if (!podpis.ok) {
      const data = (await podpis.json().catch(() => null)) as { error?: string } | null;
      uprav({ chyba: data?.error || t('hudba.chybaAdresy') });
      return;
    }
    const { odkaz, cesta } = (await podpis.json()) as { odkaz: string; cesta: string };

    // 2) soubor rovnou do Dropboxu, s ukazatelem postupu
    //
    // VÝSLEDEK SE PŘEDÁVÁ HODNOTOU, NE PŘES STAV (oprava 16. 10. 2026: „nic se
    // neděje"). Čtení `nahrava` hned po nahrání vracelo starý obsah - React
    // stav se v rozběhnuté funkci nezmění - takže se chyba nikdy nepoznala
    // a zápis se zkoušel i po neúspěšném nahrání.
    const chybaNahrani = await new Promise<string | null>((hotovo) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', odkaz);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) uprav({ procenta: Math.round((e.loaded / e.total) * 100) });
      };
      // Kód odpovědi jde do hlášky - bez něj se nedá poznat, jestli Dropbox
      // odmítl soubor, nebo adresa mezitím vypršela.
      xhr.onload = () =>
        hotovo(
          xhr.status >= 200 && xhr.status < 300
            ? null
            : `${t('hudba.chybaNahrani')} (${xhr.status})`,
        );
      xhr.onerror = () => hotovo(t('hudba.chybaNahrani'));
      xhr.send(soubor);
    });
    if (chybaNahrani) {
      uprav({ chyba: chybaNahrani });
      return;
    }

    // 3) zápis do portálu - server si u Dropboxu ověří, že soubor leží na místě
    const zapis = await fetch(`/api/projekty/${caflouProjectId}/hudba`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cesta, nazev: soubor.name.replace(/\.[^.]+$/, '') }),
    });
    if (!zapis.ok) {
      const data = (await zapis.json().catch(() => null)) as { error?: string } | null;
      uprav({ chyba: data?.error || t('hudba.chybaZapisu') });
      return;
    }
    const { skladba } = (await zapis.json()) as { skladba: SkladbaProjektu };
    setSkladby((p) => [...p, skladba]);
    setNahrava((p) => p.filter((s) => s.klic !== klic));
  }

  async function vyber(soubory: FileList | File[] | null) {
    const seznam = soubory ? Array.from(soubory) : [];
    if (seznam.length === 0) return;
    setChyba(null);
    /**
     * KLÍČ SE SPOČÍTÁ JEDNOU (oprava 16. 10. 2026: „nic se neděje"). Do té
     * doby se zakládal `Date.now()` při vykreslení řádku a podruhé při
     * nahrávání - mezi tím uběhla milisekunda, klíče se rozešly a ukazatel
     * postupu ani hláška o chybě neměly co aktualizovat. Ukazatel tak navěky
     * ukazoval 0 % a případná chyba se vůbec neobjevila.
     */
    const davka = seznam.map((soubor, i) => ({
      soubor,
      klic: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    setNahrava((p) => [
      ...p,
      ...davka.map(({ soubor, klic }) => ({ klic, nazev: soubor.name, procenta: 0 })),
    ]);
    // Postupně, ne všechno naráz: pět padesátimegových souborů současně
    // ucpe linku a žádný se nedokončí dřív než ostatní.
    for (const { soubor, klic } of davka) {
      await nahrajJeden(soubor, klic);
    }
    if (vstup.current) vstup.current.value = '';
  }

  async function uloz(id: string, zmena: Partial<SkladbaProjektu>) {
    setSkladby((p) => p.map((s) => (s.id === id ? { ...s, ...zmena } : s)));
    await fetch(`/api/projekty/${caflouProjectId}/hudba/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zmena),
    }).catch(() => null);
  }

  async function prehraj(id: string) {
    setChyba(null);
    const res = await fetch(`/api/projekty/${caflouProjectId}/hudba/${id}`);
    if (!res.ok) {
      setChyba(t('hudba.chybaPrehrani'));
      return;
    }
    const { odkaz } = (await res.json()) as { odkaz: string };
    window.open(odkaz, '_blank', 'noopener,noreferrer');
  }

  async function odpoj(id: string) {
    setSkladby((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/projekty/${caflouProjectId}/hudba/${id}`, { method: 'DELETE' }).catch(
      () => null,
    );
  }

  const pole =
    'w-full rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm font-body text-ink outline-none focus:border-brand-purple';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-body text-muted m-0">{t('hudba.popis')}</p>

      {!dropboxNastaven && (
        <p className="text-sm font-heading text-status-progress m-0">{t('hudba.bezDropboxu')}</p>
      )}

      <div className="rounded-card border border-line bg-surface overflow-hidden">
        {skladby.length === 0 ? (
          <p className="text-sm font-body text-muted m-0 p-4">{t('hudba.zadnaHudba')}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2">
                  {t('hudba.nazev')}
                </th>
                <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2 hidden sm:table-cell w-[160px]">
                  {t('hudba.zdroj')}
                </th>
                <th className="bg-bar text-white text-left text-[11px] font-heading uppercase tracking-wide px-3 py-2 hidden md:table-cell">
                  {t('hudba.poznamka')}
                </th>
                <th className="bg-bar text-white text-right text-[11px] font-heading uppercase tracking-wide px-3 py-2 w-[180px]">
                  {t('hudba.soubor')}
                </th>
              </tr>
            </thead>
            <tbody>
              {skladby.map((s) => (
                <tr key={s.id} className="border-t border-line align-middle">
                  <td className="px-3 py-1.5">
                    <input
                      defaultValue={s.nazev}
                      onBlur={(e) => uloz(s.id, { nazev: e.target.value })}
                      className={pole}
                    />
                    <span className="block text-[11px] font-body text-muted mt-1">
                      {velikost(s.velikost)}
                      {s.pridal ? ` · ${s.pridal}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 hidden sm:table-cell">
                    <input
                      defaultValue={s.zdroj ?? ''}
                      placeholder={t('hudba.zdrojPriklad')}
                      onBlur={(e) => uloz(s.id, { zdroj: e.target.value })}
                      className={pole}
                    />
                  </td>
                  <td className="px-3 py-1.5 hidden md:table-cell">
                    <input
                      defaultValue={s.poznamka ?? ''}
                      onBlur={(e) => uloz(s.id, { poznamka: e.target.value })}
                      className={pole}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => prehraj(s.id)}
                      className="rounded-pill border-0 bg-transparent text-brand-purpleLight text-xs font-heading cursor-pointer hover:text-ink transition-colors"
                    >
                      {t('hudba.prehrat')}
                    </button>
                    <button
                      type="button"
                      onClick={() => odpoj(s.id)}
                      title={t('hudba.odpojitPopis')}
                      className="ml-3 rounded-pill border-0 bg-transparent text-muted text-xs font-heading cursor-pointer hover:text-status-error transition-colors"
                    >
                      {t('hudba.odpojit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nahrava.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {nahrava.map((s) => (
            <li key={s.klic} className="rounded-lg border border-line bg-field/40 px-3 py-2">
              <span className="flex items-center gap-3 text-sm font-body">
                <span className="truncate text-ink">{s.nazev}</span>
                <span className={`ml-auto text-xs ${s.chyba ? 'text-danger' : 'text-muted'}`}>
                  {s.chyba ?? `${s.procenta} %`}
                </span>
              </span>
              {!s.chyba && (
                <span className="block mt-1.5 h-1 rounded-full bg-line overflow-hidden">
                  <span
                    className="block h-full bg-brand-purple transition-all"
                    style={{ width: `${s.procenta}%` }}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {chyba && <p className="text-sm font-heading text-danger m-0">{chyba}</p>}

      {/* PŘETAŽENÍM I TLAČÍTKEM (zadání 16. 10. 2026: „taky by tam mělo být
          drag and drop"). Hudbu člověk tahá z Finderu, ne vybírá v dialogu. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (dropboxNastaven) setPretahuje(true);
        }}
        onDragLeave={() => setPretahuje(false)}
        onDrop={(e) => {
          e.preventDefault();
          setPretahuje(false);
          if (dropboxNastaven) void vyber(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2.5 rounded-card border-[1.5px] border-dashed px-4 py-8 text-center transition-colors ${
          pretahuje ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
        } ${dropboxNastaven ? '' : 'opacity-50'}`}
      >
        <span className="text-sm font-body text-muted">
          {pretahuje ? t('hudba.pusteSoubory') : t('hudba.pretahnete')}
        </span>
        <button
          type="button"
          onClick={() => vstup.current?.click()}
          disabled={!dropboxNastaven}
          className="rounded-pill border-0 bg-brand-purple px-4 py-2 text-sm font-heading font-semibold text-white cursor-pointer hover:bg-brand-purpleDark transition-colors disabled:opacity-50"
        >
          {t('hudba.zvolitSoubory')}
        </button>
        <input
          ref={vstup}
          type="file"
          multiple
          accept="audio/*,.wav,.aif,.aiff,.mp3,.flac"
          onChange={(e) => vyber(e.target.files)}
          disabled={!dropboxNastaven}
          className="hidden"
        />
      </div>
    </div>
  );
}

/** „48,2 MB" - u padesátimegových WAVů je velikost to první, co člověka zajímá. */
function velikost(bytes: number): string {
  if (bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}
