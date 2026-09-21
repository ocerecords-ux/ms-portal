'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Podpis, který se tiskne na faktury této firmy (zadání 21. 9. 2026: „na
 * fakturách chybí můj podpis"). Stačí vyfotit/naskenovat podpis na bílém
 * papíře - bílé pozadí se tu v prohlížeči zprůhlední, obrázek se ořízne
 * a zmenší, takže do databáze jde malé PNG.
 */
export function PodpisFirmy({ issuerId, podpis }: { issuerId: string; podpis: string | null }) {
  const router = useRouter();
  const vstup = useRef<HTMLInputElement | null>(null);
  const [aktualni, setAktualni] = useState<string | null>(podpis);
  const [pracuji, setPracuji] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(hodnota: string | null) {
    setPracuji(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/admin/issuers/${issuerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podpis: hodnota }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Podpis se nepodařilo uložit.');
      setAktualni(hodnota);
      router.refresh();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Podpis se nepodařilo uložit.');
    } finally {
      setPracuji(false);
    }
  }

  async function vybrano(soubor: File | undefined) {
    if (!soubor) return;
    setChyba(null);
    try {
      const png = await pripravPodpis(soubor);
      await uloz(png);
    } catch (e) {
      setChyba(e instanceof Error ? e.message : 'Obrázek se nepodařilo načíst.');
    } finally {
      if (vstup.current) vstup.current.value = '';
    }
  }

  return (
    <section className="bg-surface border border-line rounded-card p-6 flex flex-col gap-3 shadow-sm">
      <div>
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Podpis na faktury</h2>
        <p className="text-muted text-sm m-0 mt-1">
          Tiskne se vpravo dole na každou fakturu této firmy. Nahrajte fotku nebo sken podpisu na bílém papíře - pozadí
          se samo zprůhlední.
        </p>
      </div>

      {aktualni ? (
        <div className="bg-white border border-line rounded-xl p-3 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aktualni} alt="Podpis" className="block max-h-20 max-w-[260px]" />
        </div>
      ) : (
        <p className="text-sm text-muted m-0">Podpis zatím není nahraný - faktury vyjdou bez podpisu.</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={vstup}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => vybrano(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={pracuji}
          onClick={() => vstup.current?.click()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {pracuji ? 'Ukládám…' : aktualni ? 'Nahrát jiný podpis' : 'Nahrát podpis'}
        </button>
        {aktualni && (
          <button
            type="button"
            disabled={pracuji}
            onClick={() => uloz(null)}
            className="text-sm font-heading text-danger bg-transparent border-0 cursor-pointer disabled:opacity-60"
          >
            Odebrat podpis
          </button>
        )}
      </div>
      {chyba && <p className="text-danger text-sm m-0">{chyba}</p>}
    </section>
  );
}

/** Načte obrázek, zprůhlední bílé pozadí, ořízne okraje a zmenší na max. 600 px. */
async function pripravPodpis(soubor: File): Promise<string> {
  const url = URL.createObjectURL(soubor);
  try {
    const obr = await new Promise<HTMLImageElement>((ok, chyba) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => chyba(new Error('Soubor není obrázek.'));
      i.src = url;
    });

    const k = Math.min(1, 1200 / Math.max(obr.naturalWidth, obr.naturalHeight));
    const w = Math.max(1, Math.round(obr.naturalWidth * k));
    const h = Math.max(1, Math.round(obr.naturalHeight * k));
    const platno = document.createElement('canvas');
    platno.width = w;
    platno.height = h;
    const ctx = platno.getContext('2d');
    if (!ctx) throw new Error('Prohlížeč neumí upravit obrázek.');
    ctx.drawImage(obr, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;

    // Průhlednost podle tmavosti: papír zmizí, tah pera zůstane.
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const tma = 255 - Math.min(d[o], d[o + 1], d[o + 2]);
      const a = Math.max(0, Math.min(1, (tma - 25) / 140)) * (d[o + 3] / 255);
      d[o] = Math.round(d[o] * 0.8);
      d[o + 1] = Math.round(d[o + 1] * 0.8);
      d[o + 2] = Math.round(d[o + 2] * 0.8);
      d[o + 3] = Math.round(a * 255);
      if (a > 0.05) {
        const x = i % w;
        const y = Math.floor(i / w);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) throw new Error('Na obrázku není vidět žádný podpis.');
    ctx.putImageData(px, 0, 0);

    const okraj = 4;
    const sx = Math.max(0, x0 - okraj);
    const sy = Math.max(0, y0 - okraj);
    const sw = Math.min(w, x1 + okraj + 1) - sx;
    const sh = Math.min(h, y1 + okraj + 1) - sy;
    const k2 = Math.min(1, 600 / sw);
    const vysledek = document.createElement('canvas');
    vysledek.width = Math.max(1, Math.round(sw * k2));
    vysledek.height = Math.max(1, Math.round(sh * k2));
    const ctx2 = vysledek.getContext('2d');
    if (!ctx2) throw new Error('Prohlížeč neumí upravit obrázek.');
    ctx2.drawImage(platno, sx, sy, sw, sh, 0, 0, vysledek.width, vysledek.height);
    return vysledek.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
