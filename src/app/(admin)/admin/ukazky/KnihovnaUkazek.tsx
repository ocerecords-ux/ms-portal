'use client';

import { useMemo, useRef, useState } from 'react';
import {
  MAX_UKAZKA_BYTES,
  PRIJIMANE_PRIPONY_UKAZEK,
  SEKCE,
  delkaSlovy,
  hledaniSedi,
  jeVideo,
  odkazNaUkazku,
  rozdelStitky,
  typUkazky,
  type Sekce,
  type UkazkaData,
} from '@/lib/prezentaceNabidky';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';
import { PlochaProPretazeni } from '@/components/PlochaProPretazeni';

/**
 * SPRÁVA KNIHOVNY UKÁZEK (11. 10. 2026).
 *
 * SOUBOR JDE DO ÚLOŽIŠTĚ ROVNOU Z PROHLÍŽEČE. Portál jen podepíše adresu;
 * přes něj by neprošel nic většího než 4,5 MB, což je u reference s obrazem
 * běžná velikost.
 *
 * DÉLKU ZMĚŘÍ PROHLÍŽEČ. Na serveru bychom kvůli ní museli dekódovat celý
 * soubor; tady ji zadarmo řekne `<audio>` nebo `<video>` ještě před odesláním
 * a v prezentaci je pak u každé ukázky vidět, do čeho klient jde.
 */
export function KnihovnaUkazek({ pocatecni }: { pocatecni: UkazkaData[] }) {
  const t = usePreklad();
  const [ukazky, setUkazky] = useState<UkazkaData[]>(pocatecni);
  const [druh, setDruh] = useState<Sekce>(SEKCE.reference);
  const [hledani, setHledani] = useState('');
  const [chyba, setChyba] = useState<string | null>(null);
  const [nahravam, setNahravam] = useState<string | null>(null);
  const vstup = useRef<HTMLInputElement | null>(null);

  const videt = useMemo(
    () => ukazky.filter((u) => u.druh === druh && hledaniSedi(u, hledani)),
    [druh, hledani, ukazky],
  );

  async function nahraj(soubory: ArrayLike<File> | null) {
    if (!soubory || soubory.length === 0) return;
    setChyba(null);

    for (const soubor of Array.from(soubory)) {
      const typ = typUkazky(soubor);
      if (!typ) {
        setChyba(t('ukazky.chybaTyp', { nazev: soubor.name }));
        continue;
      }
      if (soubor.size > MAX_UKAZKA_BYTES) {
        setChyba(t('ukazky.chybaVelikost', { nazev: soubor.name }));
        continue;
      }

      setNahravam(soubor.name);
      try {
        const podpis = await fetch('/api/admin/ukazky/podpis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nazev: soubor.name, typ, velikost: soubor.size }),
        });
        const data = (await podpis.json().catch(() => ({}))) as {
          key?: string;
          uploadUrl?: string;
          error?: string;
        };
        if (!podpis.ok || !data.uploadUrl || !data.key) {
          setChyba(data.error || t('ukazky.chybaAdresa'));
          continue;
        }

        const nahrano = await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': typ },
          body: soubor,
        });
        if (!nahrano.ok) {
          setChyba(t('ukazky.chybaUloziste', { nazev: soubor.name }));
          continue;
        }

        const zapis = await fetch('/api/admin/ukazky', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            druh,
            // Název bez přípony - dá se hned přepsat na „Kofola — vánoční spot".
            nazev: soubor.name.replace(/\.[^.]+$/, ''),
            klic: data.key,
            nazevSouboru: soubor.name,
            typSouboru: typ,
            delka: await zmerDelku(soubor, typ),
          }),
        });
        const zapsano = (await zapis.json().catch(() => ({}))) as {
          ukazka?: UkazkaData;
          error?: string;
        };
        if (!zapis.ok || !zapsano.ukazka) {
          setChyba(zapsano.error || t('ukazky.chybaZapis'));
          continue;
        }
        setUkazky((s) => [zapsano.ukazka as UkazkaData, ...s]);
      } catch (err) {
        console.error('Nahrání ukázky selhalo:', err);
        setChyba(t('ukazky.chybaNahrani', { nazev: soubor.name }));
      } finally {
        setNahravam(null);
      }
    }

    if (vstup.current) vstup.current.value = '';
  }

  async function uloz(id: string, zmeny: Record<string, unknown>) {
    const res = await fetch(`/api/admin/ukazky/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zmeny),
    });
    const data = (await res.json().catch(() => ({}))) as { ukazka?: UkazkaData; error?: string };
    if (!res.ok || !data.ukazka) {
      setChyba(data.error || t('ukazky.neulozeno'));
      return;
    }
    setUkazky((s) => s.map((u) => (u.id === id ? (data.ukazka as UkazkaData) : u)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { kod: SEKCE.reference as Sekce, popisek: t('ukazky.sekceReference') },
          { kod: SEKCE.herec as Sekce, popisek: t('ukazky.sekceHlasy') },
        ].map((z) => (
          <button
            key={z.kod}
            type="button"
            onClick={() => setDruh(z.kod)}
            className={`rounded-pill font-heading font-semibold text-xs px-4 py-2 cursor-pointer border ${
              druh === z.kod
                ? 'bg-brand-purple text-white border-transparent'
                : 'bg-surface text-ink border-line'
            }`}
          >
            {z.popisek}
          </button>
        ))}
        <input
          value={hledani}
          onChange={(e) => setHledani(e.target.value)}
          placeholder={t('ukazky.hledat')}
          className="ml-auto min-w-[220px] flex-1 max-w-sm rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
        />
      </div>

      <PlochaProPretazeni
        onSoubory={(soubory) => void nahraj(soubory)}
        vypnuto={nahravam !== null}
        popisek={t('obecne.pustteSoubory')}
      >
      <label className="rounded-card border border-dashed border-line bg-surface p-4 flex flex-col gap-1 cursor-pointer hover:border-brand-purple">
        <span className="font-heading font-semibold text-sm text-ink">
          {nahravam ? t('ukazky.nahravam', { nazev: nahravam }) : t('ukazky.nahrat')}
        </span>
        <span className="font-body text-xs text-muted">
          {t('ukazky.nahratNapoveda')}
        </span>
        <input
          ref={vstup}
          type="file"
          multiple
          accept={PRIJIMANE_PRIPONY_UKAZEK}
          onChange={(e) => void nahraj(e.target.files)}
          className="hidden"
        />
      </label>
      </PlochaProPretazeni>

      {chyba && <p className="m-0 font-body text-sm text-danger">{chyba}</p>}

      {videt.length === 0 ? (
        <p className="font-body text-sm text-muted m-0">
          {hledani ? t('ukazky.nicNesedi') : t('ukazky.prazdno')}
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {videt.map((u) => (
            <RadekUkazky key={u.id} ukazka={u} onUloz={(z) => void uloz(u.id, z)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RadekUkazky({
  ukazka,
  onUloz,
}: {
  ukazka: UkazkaData;
  onUloz: (zmeny: Record<string, unknown>) => void;
}) {
  const t = usePreklad();
  const [upravuje, setUpravuje] = useState(false);
  const [nazev, setNazev] = useState(ukazka.nazev);
  const [popis, setPopis] = useState(ukazka.popis ?? '');
  const [stitky, setStitky] = useState(ukazka.stitky);

  return (
    <li className="rounded-card border border-line bg-surface p-3 flex flex-col gap-2">
      {upravuje ? (
        <div className="flex flex-col gap-2">
          <input
            value={nazev}
            onChange={(e) => setNazev(e.target.value)}
            placeholder={t('ukazky.poleNazev')}
            className="rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
          />
          <textarea
            value={popis}
            onChange={(e) => setPopis(e.target.value)}
            rows={2}
            placeholder={t('ukazky.polePopis')}
            className="rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
          />
          <input
            value={stitky}
            onChange={(e) => setStitky(e.target.value)}
            placeholder={t('ukazky.poleStitky')}
            className="rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onUloz({ nazev: nazev.trim() || ukazka.nazev, popis, stitky });
                setUpravuje(false);
              }}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-4 py-1.5 border-0 cursor-pointer"
            >
              {t('obecne.ulozit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setNazev(ukazka.nazev);
                setPopis(ukazka.popis ?? '');
                setStitky(ukazka.stitky);
                setUpravuje(false);
              }}
              className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
            >
              {t('obecne.zrusit')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-heading font-semibold text-sm text-ink m-0">
              {ukazka.nazev}
              {ukazka.delka > 0 && (
                <span className="font-body font-normal text-muted"> · {delkaSlovy(ukazka.delka)}</span>
              )}
              {jeVideo(ukazka.typSouboru) && (
                <span className="font-body font-normal text-muted"> · video</span>
              )}
            </p>
            {ukazka.popis && <p className="font-body text-xs text-muted m-0 mt-0.5">{ukazka.popis}</p>}
            {rozdelStitky(ukazka.stitky).length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {rozdelStitky(ukazka.stitky).map((s) => (
                  <span
                    key={s}
                    className="rounded-pill bg-brand-purple/15 text-brand-purpleDeep dark:text-brand-purpleLight px-2 py-0.5 text-[11px] font-heading"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setUpravuje(true)}
            className="shrink-0 rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
          >
            {t('obecne.upravit')}
          </button>
          <button
            type="button"
            onClick={() => onUloz({ aktivni: false })}
            title={t('ukazky.vyraditNapoveda')}
            className="shrink-0 rounded-pill border border-line bg-surface text-danger font-heading font-semibold text-xs px-3 py-1.5 cursor-pointer"
          >
            {t('ukazky.vyradit')}
          </button>
        </div>
      )}

      {/* Poslech rovnou v knihovně - jinak se nedá poznat, co je ve které stopě. */}
      {jeVideo(ukazka.typSouboru) ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={odkazNaUkazku(ukazka.id)} controls preload="none" className="w-full max-w-sm rounded-card" />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={odkazNaUkazku(ukazka.id)} controls preload="none" className="w-full max-w-sm" />
      )}
    </li>
  );
}

/**
 * Délka souboru ještě před odesláním. Když ji prohlížeč neumí přečíst
 * (exotický kodek), vrátí se nula a v prezentaci prostě nebude čas - to je
 * lepší než nahrávání zastavit.
 */
function zmerDelku(soubor: File, typ: string): Promise<number> {
  return new Promise((hotovo) => {
    try {
      const url = URL.createObjectURL(soubor);
      const prvek = document.createElement(typ.startsWith('video/') ? 'video' : 'audio');
      const konec = (hodnota: number) => {
        URL.revokeObjectURL(url);
        hotovo(Number.isFinite(hodnota) ? hodnota : 0);
      };
      prvek.preload = 'metadata';
      prvek.onloadedmetadata = () => konec(prvek.duration);
      prvek.onerror = () => konec(0);
      prvek.src = url;
    } catch {
      hotovo(0);
    }
  });
}
