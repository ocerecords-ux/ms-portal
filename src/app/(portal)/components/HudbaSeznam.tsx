'use client';

import { useEffect, useRef, useState } from 'react';

import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { WaveformPlayer, type UsekSkladby } from '@/app/(portal)/components/WaveformPlayer';
import { delkaTextem, prectiMetadata, zmensiObal, zmerDelku } from '@/lib/metadataHudby';

/**
 * SEZNAM SKLADEB S VKLÁDÁNÍM - SPOLEČNÁ ČÁST (17. 10. 2026).
 *
 * Používá ho karta Hudba u projektu i správa hudby série. Obojí dělá přesně
 * totéž - přetáhne se soubor, přečtou se z něj údaje, pošle se rovnou do
 * Dropboxu a zapíše se záznam - liší se jen adresy, na které se ptá. Proto
 * jsou adresy parametrem a kód je jeden; dvě kopie téhle logiky by se po
 * první opravě rozešly.
 *
 * SOUBOR JDE Z PROHLÍŽEČE ROVNOU DO DROPBOXU. Portál vydá jednorázovou adresu
 * a pak už jen zapíše, že skladba někde je - přes Vercel by padesátimegový
 * WAV neprošel (strop požadavku je kolem 4,5 MB).
 *
 * ÚDAJE O SKLADBĚ SE ČTOU TADY, ne na serveru - ten soubor nikdy nevidí.
 * Z metadat se vezme název, autor a obal (lib/metadataHudby.ts), délku změří
 * sám prohlížeč. Zapíšou se jednou a dál se nemění; přepsat jde JENOM
 * POZNÁMKA, která je vpravo od skladby.
 */
export type SkladbaVSeznamu = {
  id: string;
  nazev: string;
  autor: string | null;
  delkaS: number;
  maObal: boolean;
  poznamka: string | null;
  /** Která část nahrávky se má použít; vteřiny od začátku, prázdné = celá. */
  usekOd?: number | null;
  usekDo?: number | null;
  puvod?: 'my' | 'klient' | 'serie';
  vlozilKlient?: string | null;
  velikost: number;
  pridal: string | null;
  kdy: string;
};

/** Kam se komponenta ptá. Jediné, čím se karta projektu liší od karty série. */
export type HudbaApi = {
  /** POST {nazev, velikost} → {odkaz, cesta} */
  podpis: string;
  /** POST → {key, uploadUrl} */
  obalPodpis: string;
  /** POST {cesta, nazev, autor, delkaS, obalKlic} → {skladba} */
  zapis: string;
  /** GET → {odkaz}; PATCH {poznamka}; DELETE */
  polozka: (id: string) => string;
  /** Adresa obrázku obalu. */
  obal: (id: string) => string;
  /**
   * Co se přibalí do každého požadavku navíc. U série je to její název
   * a firma - bez nich by skladba nevěděla, kam patří. U projektu je to
   * v adrese, takže tam zůstává prázdné.
   */
  navic?: Record<string, unknown>;
};

type Stav = { klic: string; nazev: string; procenta: number; popis?: string; chyba?: string };

export function HudbaSeznam({
  api,
  pocatecni,
  pripraveno = true,
  jenCteni = false,
  prazdneHlaska,
}: {
  api: HudbaApi;
  pocatecni: SkladbaVSeznamu[];
  /** Když chybí klíče k Dropboxu, karta to řekne rovnou místo tichého selhání. */
  pripraveno?: boolean;
  /** Jen přehrát a stáhnout - nic se nevkládá ani nemaže. */
  jenCteni?: boolean;
  prazdneHlaska?: string;
}) {
  const t = usePreklad();
  const [skladby, setSkladby] = useState<SkladbaVSeznamu[]>(pocatecni);
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
      const podpis = await fetch(api.obalPodpis, { method: 'POST' });
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
    const podpis = await fetch(api.podpis, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(api.navic ?? {}), nazev: soubor.name, velikost: soubor.size }),
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
    // neděje"). Čtení stavu hned po nahrání vracelo starý obsah - React stav
    // se v rozběhnuté funkci nezmění - takže se chyba nikdy nepoznala a zápis
    // se zkoušel i po neúspěšném nahrání.
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
      // vadí cesta, místo na disku, nebo něco jiného. Soubor jde z prohlížeče
      // rovnou do Dropboxu, takže na serveru se ta odpověď nikde neobjeví.
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
    const zapis = await fetch(api.zapis, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(api.navic ?? {}),
        cesta,
        nazev: udaje.nazev,
        autor: udaje.autor,
        delkaS,
        obalKlic,
      }),
    });
    if (!zapis.ok) {
      const data = (await zapis.json().catch(() => null)) as { error?: string } | null;
      uprav({ chyba: data?.error || t('hudba.chybaZapisu') });
      return;
    }
    const { skladba } = (await zapis.json()) as { skladba: SkladbaVSeznamu };
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
    await fetch(api.polozka(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poznamka }),
    }).catch(() => null);
  }

  /**
   * OZNAČENÝ ÚSEK (zadání 17. 10. 2026: „ještě by se mi líbilo, kdybych mohl
   * označit ve stopě nějak, kterou část nahrávky použít").
   *
   * Je to poznámka pro střih, ne ořez souboru - v Dropboxu zůstává celá
   * skladba. Prázdný úsek znamená „použít celou".
   */
  async function ulozUsek(id: string, usek: UsekSkladby | null) {
    const usekOd = usek ? usek.od : null;
    const usekDo = usek ? usek.do : null;
    setSkladby((p) => p.map((s) => (s.id === id ? { ...s, usekOd, usekDo } : s)));
    await fetch(api.polozka(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usekOd, usekDo }),
    }).catch(() => null);
  }

  async function odpoj(id: string) {
    setSkladby((p) => p.filter((s) => s.id !== id));
    await fetch(api.polozka(id), { method: 'DELETE' }).catch(() => null);
  }

  return (
    <div className="flex flex-col gap-4">
      {!pripraveno && (
        <p className="text-sm font-heading text-status-progress m-0">{t('hudba.bezDropboxu')}</p>
      )}

      {skladby.length === 0 ? (
        <p className="text-sm font-body text-muted m-0">
          {prazdneHlaska ?? t('hudba.zadnaHudba')}
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {skladby.map((s) => (
            <Skladba
              key={s.id}
              skladba={s}
              api={api}
              jenCteni={jenCteni}
              naPoznamku={(text) => ulozPoznamku(s.id, text)}
              naUsek={(usek) => ulozUsek(s.id, usek)}
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
      {!jenCteni && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (pripraveno) setPretahuje(true);
          }}
          onDragLeave={() => setPretahuje(false)}
          onDrop={(e) => {
            e.preventDefault();
            setPretahuje(false);
            if (pripraveno) void vyber(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-2.5 rounded-card border-[1.5px] border-dashed px-4 py-8 text-center transition-colors ${
            pretahuje ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
          } ${pripraveno ? '' : 'opacity-50'}`}
        >
          <span className="text-sm font-body text-muted">
            {pretahuje ? t('hudba.pusteSoubory') : t('hudba.pretahnete')}
          </span>
          <button
            type="button"
            onClick={() => vstup.current?.click()}
            disabled={!pripraveno}
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
            disabled={!pripraveno}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

/**
 * JEDNA SKLADBA. Vlevo obal z metadat, uprostřed název s autorem a přehrávač,
 * VPRAVO POZNÁMKA (zadání 17. 10. 2026: „ta poznámka by měla být napravo od
 * hudby") a úplně vpravo Stáhnout s Odebrat.
 *
 * Odebrání se ptá (zadání 17. 10. 2026: „při kliknutí na smazat nastavit dotaz
 * opravdu odebrat"). Ptá se přímo v řádku, ne systémovým okýnkem - to je šedivé
 * a vyskočí mimo portál.
 */
function Skladba({
  skladba,
  api,
  jenCteni,
  naPoznamku,
  naUsek,
  naOdebrani,
  naChybu,
}: {
  skladba: SkladbaVSeznamu;
  api: HudbaApi;
  jenCteni: boolean;
  naPoznamku: (text: string) => void;
  naUsek: (usek: UsekSkladby | null) => void;
  naOdebrani: () => void;
  naChybu: (text: string | null) => void;
}) {
  const t = usePreklad();
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [nepovedloSe, setNepovedloSe] = useState(false);
  const [ptaSe, setPtaSe] = useState(false);

  /**
   * PŘEHRÁVAČ JE ROZBALENÝ HNED (zadání 17. 10. 2026: „takhle by měl už být
   * rozbalený ten přehrávač ve chvíli, kdy otevřu kartu. Žádné rozbalování").
   *
   * Adresa z Dropboxu platí čtyři hodiny a vyrábí se při otevření karty -
   * u každé skladby jednou a všechny naráz, takže se na sebe nečekají.
   * Přehrávání se samo nespustí; waveforma je tu od toho, aby šlo klepnout
   * rovnou doprostřed skladby.
   */
  useEffect(() => {
    let zahozeno = false;
    (async () => {
      const res = await fetch(api.polozka(skladba.id)).catch(() => null);
      if (zahozeno) return;
      if (!res?.ok) {
        setNepovedloSe(true);
        return;
      }
      const data = (await res.json()) as { odkaz: string };
      if (!zahozeno) setOdkaz(data.odkaz);
    })();
    return () => {
      zahozeno = true;
    };
    // Adresa patří k jedné skladbě; `api` je jen sada cest a nemění se.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skladba.id]);

  /** Tatáž adresa slouží i stahování - podruhé už se o ni nežádá. */
  async function ziskejOdkaz(): Promise<string | null> {
    if (odkaz) return odkaz;
    const res = await fetch(api.polozka(skladba.id)).catch(() => null);
    if (!res?.ok) {
      naChybu(t('hudba.chybaPrehrani'));
      return null;
    }
    const data = (await res.json()) as { odkaz: string };
    setOdkaz(data.odkaz);
    return data.odkaz;
  }

  const usek: UsekSkladby | null =
    skladba.usekOd != null && skladba.usekDo != null
      ? { od: skladba.usekOd, do: skladba.usekDo }
      : null;

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
          src={api.obal(skladba.id)}
          alt={t('hudba.obalPopis')}
          className="w-14 h-14 rounded-lg object-cover shrink-0 bg-field"
        />
      ) : (
        <span className="w-14 h-14 rounded-lg shrink-0 grid place-items-center bg-brand-purple/15 text-brand-purpleLight">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="w-5 h-5"
          >
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
            <WaveformPlayer
              src={odkaz}
              usek={usek}
              naUsek={jenCteni ? undefined : naUsek}
            />
          ) : nepovedloSe ? (
            <span className="text-xs font-body text-danger">{t('hudba.chybaPrehrani')}</span>
          ) : (
            /* Místo si drží i dokud se adresa nenačte, ať řádek nepodskočí. */
            <span className="flex items-center gap-3 py-1 h-[56px]">
              <span className="w-9 h-9 shrink-0 rounded-full bg-line/60" />
              <span className="flex-1 h-2 rounded-full bg-line/60" />
            </span>
          )}
        </div>

        {/* OZNAČENÝ ÚSEK pod křivkou - ať je vidět i bez tažení myší. */}
        {!jenCteni && (
          <p className="text-[11px] font-body text-muted m-0 mt-1">
            {usek ? (
              <>
                <b className="text-ink">
                  {t('hudba.usek')} {delkaTextem(usek.od)} – {delkaTextem(usek.do)}
                </b>
                <button
                  type="button"
                  onClick={() => naUsek(null)}
                  className="ml-3 border-0 bg-transparent p-0 text-[11px] font-heading text-brand-purpleLight cursor-pointer hover:text-ink"
                >
                  {t('hudba.celaSkladba')}
                </button>
              </>
            ) : (
              t('hudba.oznacitUsek')
            )}
          </p>
        )}
      </div>

      {/* POZNÁMKA VPRAVO, A S MÍSTEM (17. 10. 2026: „ta poznámka musí mít více
          místa") - vejde se do ní věta, ne dvě slova. */}
      <div className="w-full sm:w-[300px] lg:w-[360px] shrink-0">
        <span className="block text-[10px] font-heading uppercase tracking-wide text-muted mb-1">
          {t('hudba.poznamka')}
        </span>
        {jenCteni ? (
          <p className="m-0 rounded-lg border border-line bg-field px-2.5 py-1.5 text-xs font-body text-ink min-h-[4.6rem] whitespace-pre-wrap">
            {skladba.poznamka || '—'}
          </p>
        ) : (
          <textarea
            defaultValue={skladba.poznamka ?? ''}
            placeholder={t('hudba.poznamkaMisto')}
            rows={4}
            onBlur={(e) => naPoznamku(e.target.value)}
            className="w-full resize-y rounded-lg border border-line bg-field px-2.5 py-1.5 text-xs font-body text-ink outline-none focus:border-brand-purple"
          />
        )}
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
            {!jenCteni && (
              <button
                type="button"
                onClick={() => setPtaSe(true)}
                title={t('hudba.odpojitPopis')}
                className="border-0 bg-transparent p-0 text-xs font-heading text-muted cursor-pointer hover:text-danger transition-colors"
              >
                {t('hudba.odebrat')}
              </button>
            )}
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
