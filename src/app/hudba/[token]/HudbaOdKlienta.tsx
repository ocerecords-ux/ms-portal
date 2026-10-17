'use client';

import { useRef, useState } from 'react';

import { prelozit, type Jazyk } from '@/lib/jazyk';
import { prectiMetadata, zmensiObal, zmerDelku } from '@/lib/metadataHudby';

/**
 * VKLÁDÁNÍ HUDBY KLIENTEM (zadání 17. 10. 2026: „klient pro vkládání u hudby
 * by měl mít taky možnost poznámky ke každému tracku").
 *
 * Stránka stojí MIMO JazykProvider (je veřejná), jazyk proto chodí propem.
 * Soubor jde z prohlížeče rovnou do Dropboxu - padesátimegový WAV by přes
 * portál neprošel - a název s autorem se čtou z metadat souboru, stejně jako
 * když hudbu vkládáme my.
 *
 * POZNÁMKA SE UKLÁDÁ AŽ PO VLOŽENÍ SKLADBY. Napřed musí vzniknout záznam,
 * ke kterému poznámka patří; psát ji dopředu by znamenalo držet ji někde
 * stranou a při selhání nahrání by se ztratila.
 */
type Vlozena = {
  id: string;
  nazev: string;
  autor: string | null;
  velikost: number;
  poznamka: string;
};

type Nahrava = { klic: string; nazev: string; procenta: number; popis?: string; chyba?: string };

export function HudbaOdKlienta({
  token,
  jazyk,
  uzVlozeno,
}: {
  token: string;
  jazyk: Jazyk;
  uzVlozeno: boolean;
}) {
  const t = (klic: string) => prelozit(jazyk, klic);
  const [vlozene, setVlozene] = useState<Vlozena[]>([]);
  const [nahrava, setNahrava] = useState<Nahrava[]>([]);
  const [pretahuje, setPretahuje] = useState(false);
  const [jmeno, setJmeno] = useState('');
  const vstup = useRef<HTMLInputElement | null>(null);
  const zaklad = `/api/hudba-od-klienta/${encodeURIComponent(token)}`;

  async function nahrajObal(obal: Blob): Promise<string | null> {
    try {
      const zmenseny = await zmensiObal(obal);
      if (!zmenseny) return null;
      const podpis = await fetch(`${zaklad}/obal-podpis`, { method: 'POST' });
      if (!podpis.ok) return null;
      const { key, uploadUrl } = (await podpis.json()) as { key: string; uploadUrl: string };
      const nahrano = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: zmenseny,
      });
      return nahrano.ok ? key : null;
    } catch {
      return null;
    }
  }

  async function nahrajJeden(soubor: File, klic: string) {
    const uprav = (zmena: Partial<Nahrava>) =>
      setNahrava((p) => p.map((s) => (s.klic === klic ? { ...s, ...zmena } : s)));

    uprav({ popis: t('hudbaKlient.ctu') });
    const [udaje, delkaS] = await Promise.all([prectiMetadata(soubor), zmerDelku(soubor)]);
    uprav({ popis: undefined, nazev: udaje.nazev });

    const podpis = await fetch(`${zaklad}/podpis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: soubor.name, velikost: soubor.size }),
    });
    if (!podpis.ok) {
      const data = (await podpis.json().catch(() => null)) as { error?: string } | null;
      uprav({ chyba: data?.error || t('hudbaKlient.chyba') });
      return;
    }
    const { odkaz, cesta } = (await podpis.json()) as { odkaz: string; cesta: string };

    const chybaNahrani = await new Promise<string | null>((hotovo) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', odkaz);
      // Dropbox u jednorázové adresy jiný typ obsahu nepřijme.
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) uprav({ procenta: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = () =>
        hotovo(xhr.status >= 200 && xhr.status < 300 ? null : t('hudbaKlient.chyba'));
      xhr.onerror = () => hotovo(t('hudbaKlient.chyba'));
      xhr.send(soubor);
    });
    if (chybaNahrani) {
      uprav({ chyba: chybaNahrani });
      return;
    }

    const obalKlic = udaje.obal ? await nahrajObal(udaje.obal) : null;

    const zapis = await fetch(zaklad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cesta,
        nazev: udaje.nazev,
        autor: udaje.autor,
        delkaS,
        obalKlic,
        jmeno: jmeno.trim() || null,
      }),
    });
    if (!zapis.ok) {
      uprav({ chyba: t('hudbaKlient.chyba') });
      return;
    }
    const { skladba } = (await zapis.json()) as {
      skladba: { id: string; nazev: string; autor: string | null; velikost: number };
    };
    setVlozene((p) => [
      ...p,
      {
        id: skladba.id,
        nazev: skladba.nazev,
        autor: skladba.autor,
        velikost: skladba.velikost,
        poznamka: '',
      },
    ]);
    setNahrava((p) => p.filter((s) => s.klic !== klic));
  }

  async function vyber(soubory: FileList | File[] | null) {
    const seznam = soubory ? Array.from(soubory) : [];
    if (seznam.length === 0) return;
    const davka = seznam.map((soubor, i) => ({
      soubor,
      klic: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    setNahrava((p) => [
      ...p,
      ...davka.map(({ soubor, klic }) => ({ klic, nazev: soubor.name, procenta: 0 })),
    ]);
    for (const { soubor, klic } of davka) {
      await nahrajJeden(soubor, klic);
    }
    if (vstup.current) vstup.current.value = '';
  }

  async function ulozPoznamku(id: string, poznamka: string) {
    setVlozene((p) => p.map((s) => (s.id === id ? { ...s, poznamka } : s)));
    await fetch(`${zaklad}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poznamka }),
    }).catch(() => null);
  }

  return (
    <div className="flex flex-col gap-4">
      {uzVlozeno && vlozene.length === 0 && (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm font-body text-ink m-0">
          {t('hudbaKlient.uzVlozeno')}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-heading uppercase tracking-wide text-muted">
          {t('hudbaKlient.vasJmeno')}
        </span>
        <input
          value={jmeno}
          onChange={(e) => setJmeno(e.target.value)}
          placeholder={t('hudbaKlient.jmenoMisto')}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
        />
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setPretahuje(true);
        }}
        onDragLeave={() => setPretahuje(false)}
        onDrop={(e) => {
          e.preventDefault();
          setPretahuje(false);
          void vyber(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed px-4 py-10 text-center transition-colors ${
          pretahuje ? 'border-brand-purple bg-tint' : 'border-line bg-surface'
        }`}
      >
        <span className="text-sm font-body text-muted">{t('hudbaKlient.pretahnete')}</span>
        <button
          type="button"
          onClick={() => vstup.current?.click()}
          className="rounded-pill border-0 bg-brand-purple px-5 py-2.5 text-sm font-heading font-semibold text-white cursor-pointer hover:bg-brand-purpleDark transition-colors"
        >
          {t('hudbaKlient.zvolit')}
        </button>
        <input
          ref={vstup}
          type="file"
          multiple
          accept="audio/*,.wav,.aif,.aiff,.mp3,.flac"
          onChange={(e) => vyber(e.target.files)}
          className="hidden"
        />
      </div>

      {nahrava.map((s) => (
        <div key={s.klic} className="rounded-card border border-line bg-surface px-4 py-3">
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
        </div>
      ))}

      {vlozene.map((s) => (
        <div key={s.id} className="rounded-card border border-line bg-surface px-4 py-3">
          <span className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-md bg-brand-green text-onAccent grid place-items-center text-xs font-heading font-bold shrink-0">
              ✓
            </span>
            <span className="min-w-0">
              <span className="block font-heading font-semibold text-sm text-ink truncate">
                {s.nazev}
              </span>
              <span className="block text-xs font-body text-muted truncate">
                {[s.autor, velikost(s.velikost)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          {/* POZNÁMKA KE KAŽDÉ SKLADBĚ - propíše se do karty projektu k té samé
              stopě, takže se k nám dostane i to, co by jinak zapadlo v mailu. */}
          <input
            defaultValue={s.poznamka}
            onBlur={(e) => ulozPoznamku(s.id, e.target.value)}
            placeholder={t('hudbaKlient.poznamkaMisto')}
            className="w-full mt-2.5 rounded-lg border border-line bg-field px-3 py-2 text-xs font-body text-ink outline-none focus:border-brand-purple"
          />
        </div>
      ))}

      {vlozene.length > 0 && (
        <p className="text-sm font-body text-muted m-0">{t('hudbaKlient.hotovo')}</p>
      )}
    </div>
  );
}

function velikost(bytes: number): string {
  if (bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} kB`;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}
