'use client';

import { useRef, useState } from 'react';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { WaveformPlayer } from '@/app/(portal)/components/WaveformPlayer';
import type { SkladbaProjektu } from '@/lib/hudbaProjektuServer';
import { delkaTextem, prectiMetadata, zmensiObal, zmerDelku } from '@/lib/metadataHudby';

/**
 * HUDBA VYBRANÁ PRO PROJEKT (zadání 16. 10. 2026, předělané 17. 10. 2026:
 * „ať se tam vypíše název skladby a autor, když tam vložím soubor… ten název
 * autor by neměl jít měnit").
 *
 * SOUBOR JDE Z PROHLÍŽEČE ROVNOU DO DROPBOXU. Portál vydá jednorázovou adresu
 * a pak už jen zapíše, že skladba u projektu je - přes Vercel by padesátimegový
 * WAV neprošel (strop požadavku je kolem 4,5 MB).
 *
 * ÚDAJE O SKLADBĚ SE ČTOU TADY, ne na serveru - ten soubor nikdy nevidí.
 * Z metadat se vezme název, autor a obal (lib/metadataHudby.ts), délku změří
 * sám prohlížeč. Do karty se zapíšou jednou a dál se nemění; přepsat jde
 * JENOM POZNÁMKA, která je vpravo od skladby.
 *
 * POSTUP JE VIDĚT. Padesát megabajtů po běžné lince trvá desítky vteřin a bez
 * ukazatele to vypadá, že se portál seknul. Proto XMLHttpRequest a ne fetch:
 * jen on umí říct, kolik už je nahráno.
 */
type Stav = { klic: string; nazev: string; procenta: number; popis?: string; chyba?: string };

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

  /**
   * Obal do úložiště. Jde tam zmenšený na hranu 500 px, takže z dvoumegového
   * obrázku v metadatech zbyde pár desítek kilobajtů. Když se to nepovede,
   * skladba se uloží bez obalu - kvůli obrázku se nahrávání nezahazuje.
   */
  async function nahrajObal(obal: Blob): Promise<string | null> {
    try {
      const zmenseny = await zmensiObal(obal);
      if (!zmenseny) return null;
      const podpis = await fetch(`/api/projekty/${caflouProjectId}/hudba/obal-podpis`, {
        method: 'POST',
      });
      if (!podpis.ok) return null;
      const { key, uploadUrl } = (await podpis.json()) as { key: string; uploadUrl: string };
      const nahrano = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: zmenseny,
      });
      return nahrano.ok ? key : null;
    } catch (err) {
      console.error('Obal se nepodařilo nahrát:', err);
      return null;
    }
  }

  async function nahrajJeden(soubor: File, klic: string) {
    const uprav = (zmena: Partial<Stav>) =>
      setNahrava((p) => p.map((s) => (s.klic === klic ? { ...s, ...zmena } : s)));

    // 1) co je to za skladbu - čte se ze souboru, ne z portálu
    uprav({ popis: t('hudba.ctuMetadata') });
    const [udaje, delkaS] = await Promise.all([prectiMetadata(soubor), zmerDelku(soubor)]);
    uprav({ popis: undefined, nazev: udaje.nazev });

    // 2) adresa od portálu
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

    // 3) soubor rovnou do Dropboxu, s ukazatelem postupu
    //
    // VÝSLEDEK SE PŘEDÁVÁ HODNOTOU, NE PŘES STAV (oprava 16. 10. 2026: „nic se
    // neděje"). Čtení `nahrava` hned po nahrání vracelo starý obsah - React
    // stav se v rozběhnuté funkci nezmění - takže se chyba nikdy nepoznala
    // a zápis se zkoušel i po neúspěšném nahrání.
    const chybaNahrani = await new Promise<string | null>((hotovo) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', odkaz);
      // Dropbox u jednorázové adresy jiný typ obsahu nepřijme - bez téhle
      // hlavičky vrací 400 „The only allowed Content-Type is
      // application/octet-stream".
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) uprav({ procenta: Math.round((e.loaded / e.total) * 100) });
      };
      // Kód odpovědi I DŮVOD OD DROPBOXU jdou do hlášky (16. 10. 2026).
      // Samotné „(409)" neřekne nic - teprve tělo odpovědi prozradí, jestli
      // vadí cesta, místo na disku, nebo něco jiného. Tenhle soubor jde
      // z prohlížeče rovnou do Dropboxu, takže na serveru se ta odpověď
      // nikde neobjeví a jinde než tady ji nemáme kde přečíst.
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          hotovo(null);
          return;
        }
        const duvod = (xhr.responseText || '').trim().slice(0, 200);
        hotovo(`${t('hudba.chybaNahrani')} (${xhr.status}) ${duvod}`);
      };
      xhr.onerror = () => hotovo(t('hudba.chybaNahrani'));
      xhr.send(soubor);
    });
    if (chybaNahrani) {
      uprav({ chyba: chybaNahrani });
      return;
    }

    // 4) obal z metadat, když tam nějaký je
    const obalKlic = udaje.obal ? await nahrajObal(udaje.obal) : null;

    // 5) zápis do portálu - server si u Dropboxu ověří, že soubor leží na místě
    const zapis = await fetch(`/api/projekty/${caflouProjectId}/hudba`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cesta, nazev: udaje.nazev, autor: udaje.autor, delkaS, obalKlic }),
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
     * postupu ani hláška o chybě neměly co aktualizovat.
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

  async function ulozPoznamku(id: string, poznamka: string) {
    setSkladby((p) => p.map((s) => (s.id === id ? { ...s, poznamka } : s)));
    await fetch(`/api/projekty/${caflouProjectId}/hudba/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poznamka }),
    }).catch(() => null);
  }

  async function odpoj(id: string) {
    setSkladby((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/projekty/${caflouProjectId}/hudba/${id}`, { method: 'DELETE' }).catch(
      () => null,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-body text-muted m-0">{t('hudba.popis')}</p>

      {!dropboxNastaven && (
        <p className="text-sm font-heading text-status-progress m-0">{t('hudba.bezDropboxu')}</p>
      )}

      {skladby.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">{t('hudba.zadnaHudba')}</p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {skladby.map((s) => (
            <Skladba
              key={s.id}
              skladba={s}
              caflouProjectId={caflouProjectId}
              naPoznamku={(text) => ulozPoznamku(s.id, text)}
              naOdebrani={() => odpoj(s.id)}
              naChybu={setChyba}
            />
          ))}
        </ul>
      )}

      {nahrava.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {nahrava.map((s) => (
            <li key={s.klic} className="rounded-lg border border-line bg-field/40 px-3 py-2">
              <span className="flex items-center gap-3 text-sm font-body">
                <span className="truncate text-ink">{s.nazev}</span>
                <span className={`ml-auto text-xs ${s.chyba ? 'text-danger' : 'text-muted'}`}>
                  {s.chyba ?? s.popis ?? `${s.procenta} %`}
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

/**
 * JEDNA SKLADBA V KARTĚ. Vlevo obal z metadat, uprostřed název s autorem
 * a přehrávač, VPRAVO POZNÁMKA (zadání 17. 10. 2026: „ta poznámka by měla být
 * napravo od hudby") a úplně vpravo Stáhnout s Odebrat.
 *
 * Odebrání se ptá (zadání 17. 10. 2026: „při kliknutí na smazat nastavit dotaz
 * opravdu odebrat"). Ptá se přímo v řádku, ne systémovým okýnkem - to je šedivé
 * a vyskočí mimo portál.
 */
function Skladba({
  skladba,
  caflouProjectId,
  naPoznamku,
  naOdebrani,
  naChybu,
}: {
  skladba: SkladbaProjektu;
  caflouProjectId: string;
  naPoznamku: (text: string) => void;
  naOdebrani: () => void;
  naChybu: (text: string | null) => void;
}) {
  const t = usePreklad();
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [nacita, setNacita] = useState(false);
  const [ptaSe, setPtaSe] = useState(false);

  /**
   * Adresa z Dropboxu se vyrábí AŽ PŘI KLIKNUTÍ a platí čtyři hodiny.
   * Kdyby se dělala při vykreslení karty, volal by se Dropbox pokaždé tolikrát,
   * kolik je u projektu skladeb - i když si nikdo nic nepustí.
   */
  async function ziskejOdkaz(): Promise<string | null> {
    if (odkaz) return odkaz;
    setNacita(true);
    const res = await fetch(`/api/projekty/${caflouProjectId}/hudba/${skladba.id}`).catch(
      () => null,
    );
    setNacita(false);
    if (!res?.ok) {
      naChybu(t('hudba.chybaPrehrani'));
      return null;
    }
    const data = (await res.json()) as { odkaz: string };
    setOdkaz(data.odkaz);
    return data.odkaz;
  }

  const popisky = [
    velikost(skladba.velikost),
    delkaTextem(skladba.delkaS),
    skladba.puvod === 'klient'
      ? `${t('hudba.odKlienta')}${skladba.vlozilKlient ? ` · ${skladba.vlozilKlient}` : ''}`
      : skladba.puvod === 'serie'
        ? t('hudba.zeSerie')
        : skladba.pridal,
  ].filter(Boolean);

  return (
    <li className="rounded-card border border-line bg-surface p-3 flex flex-wrap items-start gap-3">
      {/* Obal z metadat; bez něj nota v našem fialovém čtverci. */}
      {skladba.maObal ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/projekty/${caflouProjectId}/hudba/${skladba.id}/obal`}
          alt={t('hudba.obalPopis')}
          className="w-14 h-14 rounded-lg object-cover shrink-0 bg-field"
        />
      ) : (
        <span className="w-14 h-14 rounded-lg shrink-0 grid place-items-center bg-brand-purple/15 text-brand-purpleLight">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-5 h-5">
            <path d="M9 18V5l10-2v13" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="16.5" cy="16" r="2.5" />
          </svg>
        </span>
      )}

      <div className="flex-1 min-w-[220px]">
        <span className="block font-heading font-semibold text-sm text-ink">{skladba.nazev}</span>
        <span className="block text-xs font-body text-muted">
          {skladba.autor || t('hudba.autorNeznamy')}
        </span>
        <span className="block text-[11px] font-body text-muted/80 mt-0.5">
          {popisky.join(' · ')}
        </span>

        <div className="mt-1.5">
          {odkaz ? (
            <WaveformPlayer src={odkaz} autoPlay />
          ) : (
            <button
              type="button"
              onClick={() => void ziskejOdkaz()}
              disabled={nacita}
              className="inline-flex items-center gap-2 rounded-pill border-0 bg-brand-green text-onAccent px-3 py-1.5 text-xs font-heading font-semibold cursor-pointer hover:brightness-95 transition-[filter] disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M7 5v14l11-7z" />
              </svg>
              {t('hudba.prehrat')}
            </button>
          )}
        </div>
      </div>

      {/* POZNÁMKA VPRAVO OD SKLADBY - jediné pole, které jde přepsat. */}
      <div className="w-full sm:w-[220px] shrink-0">
        <span className="block text-[10px] font-heading uppercase tracking-wide text-muted mb-1">
          {t('hudba.poznamka')}
        </span>
        <textarea
          defaultValue={skladba.poznamka ?? ''}
          placeholder={t('hudba.poznamkaMisto')}
          rows={2}
          onBlur={(e) => naPoznamku(e.target.value)}
          className="w-full resize-y rounded-lg border border-line bg-field px-2.5 py-1.5 text-xs font-body text-ink outline-none focus:border-brand-purple"
        />
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto">
        {ptaSe ? (
          <>
            <span className="text-[11px] font-heading text-muted">{t('hudba.opravduOdebrat')}</span>
            <span className="flex gap-3">
              <button
                type="button"
                onClick={naOdebrani}
                className="border-0 bg-transparent p-0 text-xs font-heading font-semibold text-danger cursor-pointer"
              >
                {t('hudba.ano')}
              </button>
              <button
                type="button"
                onClick={() => setPtaSe(false)}
                className="border-0 bg-transparent p-0 text-xs font-heading text-muted cursor-pointer"
              >
                {t('hudba.zpet')}
              </button>
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={async () => {
                const adresa = await ziskejOdkaz();
                if (adresa) window.open(adresa, '_blank', 'noopener,noreferrer');
              }}
              className="border-0 bg-transparent p-0 text-xs font-heading font-semibold text-brand-purpleLight cursor-pointer hover:text-ink transition-colors"
            >
              {t('hudba.stahnout')}
            </button>
            <button
              type="button"
              onClick={() => setPtaSe(true)}
              title={t('hudba.odpojitPopis')}
              className="border-0 bg-transparent p-0 text-xs font-heading text-muted cursor-pointer hover:text-danger transition-colors"
            >
              {t('hudba.odebrat')}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** „48,2 MB" - u padesátimegových WAVů je velikost to první, co člověka zajímá. */
function velikost(bytes: number): string {
  if (bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}
