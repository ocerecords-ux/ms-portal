'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
import { Volba } from '@/components/Volba';
import { VyberPole } from '@/components/VyberPole';
import {
  BARVA_PORAD,
  MOZNOSTI_OPAKOVANI,
  NAZEV_KALENDARE_PORADY,
  vPraze,
  type Opakovani,
  type PoradaVKalendari,
} from '@/lib/porady';

type Osoba = { id: string; label: string };

const casZMinut = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * OKNO PORADY (zadání 21. 9. 2026: „chci udělat poradu Já a Karolína, tak
 * když vytvářím událost, dám tam jen nás dva a vidíme to pak jen my").
 *
 * Účastníci se vybírají jako skupina v chatu - zaškrtnutím lidí z týmu. Kdo
 * poradu zakládá, je na ní vždycky. Opakování a odkaz na videohovor jsou
 * dobrovolné.
 *
 * U opakované porady se upravuje celá řada; jeden termín jde jen zrušit
 * (třeba když pondělní porada jednou odpadne).
 */
export function PoradaForm({
  upravovana,
  vychoziDen,
  vychoziCasOd,
  vychoziCasDo,
  ja,
  lidiTymu,
  onClose,
}: {
  upravovana: PoradaVKalendari | null;
  vychoziDen: string;
  vychoziCasOd?: string;
  vychoziCasDo?: string;
  ja: Osoba;
  lidiTymu: Osoba[];
  onClose: () => void;
}) {
  const router = useRouter();
  const lide = (lidiTymu.some((l) => l.id === ja.id) ? lidiTymu : [ja, ...lidiTymu])
    .slice()
    .sort((a, b) => (a.id === ja.id ? -1 : b.id === ja.id ? 1 : a.label.localeCompare(b.label, 'cs')));

  // U opakované porady se upravuje celá řada - datum a čas prvního výskytu.
  const prvni = upravovana ? vPraze(new Date(upravovana.start)) : null;
  const konecPrvni = upravovana ? vPraze(new Date(upravovana.end)) : null;

  const [nazev, setNazev] = useState(upravovana?.nazev ?? '');
  const [den, setDen] = useState(upravovana ? upravovana.den : vychoziDen);
  const [casOd, setCasOd] = useState(prvni ? casZMinut(prvni.minuty) : vychoziCasOd ?? '10:00');
  const [casDo, setCasDo] = useState(konecPrvni ? casZMinut(konecPrvni.minuty) : vychoziCasDo ?? '11:00');
  const [ucastnici, setUcastnici] = useState<string[]>(
    upravovana ? upravovana.ucastnici.map((u) => u.id) : [ja.id],
  );
  const [opakovani, setOpakovani] = useState<Opakovani>(upravovana?.opakovani ?? 'NE');
  const [opakovatDo, setOpakovatDo] = useState(upravovana?.opakovatDo ?? '');
  const [odkaz, setOdkaz] = useState(upravovana?.odkazVideo ?? '');
  const [poznamka, setPoznamka] = useState(upravovana?.poznamka ?? '');
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [potvrdit, setPotvrdit] = useState<'vyskyt' | 'cela' | null>(null);

  const spatnyCas = casDo <= casOd;
  const opakovana = upravovana ? upravovana.opakovani !== 'NE' : false;

  function prepni(id: string) {
    if (id === ja.id) return; // zakladatel je na poradě vždycky
    setUcastnici((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async function uloz() {
    if (bezi || spatnyCas || !nazev.trim()) return;
    setBezi(true);
    setChyba(null);
    try {
      const res = await fetch(
        upravovana ? `/api/kalendar/porady?id=${upravovana.poradaId}` : '/api/kalendar/porady',
        {
          method: upravovana ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nazev: nazev.trim(),
            // U úpravy opakované porady se posílá začátek řady, ne klepnutý výskyt.
            den: upravovana && opakovana && prvni ? prvni.den : den,
            casOd,
            casDo,
            ucastnici,
            opakovani,
            opakovatDo: opakovani !== 'NE' && opakovatDo ? opakovatDo : null,
            odkazVideo: odkaz.trim() || null,
            poznamka: poznamka.trim() || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChyba(data?.error || 'Uložit se nepodařilo.');
        setBezi(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setChyba('Uložit se nepodařilo.');
      setBezi(false);
    }
  }

  async function zrus(jenTento: boolean) {
    if (!upravovana) return;
    setBezi(true);
    const res = await fetch(
      `/api/kalendar/porady?id=${upravovana.poradaId}${jenTento ? `&den=${upravovana.den}` : ''}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setChyba(data?.error || 'Zrušit se nepodařilo.');
      setBezi(false);
      return;
    }
    onClose();
    router.refresh();
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div className="bg-surface rounded-card border-2 shadow-sm p-5 flex flex-col gap-4" style={{ borderColor: BARVA_PORAD }}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BARVA_PORAD }} aria-hidden />
          {upravovana ? 'Úprava porady' : `Nová porada`}
        </h2>
        <button type="button" onClick={onClose} aria-label="Zavřít" className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">Název</span>
        <input
          autoFocus={!upravovana}
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Porada produkce"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{opakovana ? 'Začátek řady' : 'Den'}</span>
          <DatumPole
            value={upravovana && opakovana && prvni ? prvni.den : den}
            onChange={(e) => e.target.value && setDen(e.target.value)}
            disabled={opakovana}
            className={`${inputClass} tabular-nums disabled:opacity-60`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Od</span>
          <input type="time" step={900} value={casOd} onChange={(e) => setCasOd(e.target.value)} className={`${inputClass} tabular-nums`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Do</span>
          <input type="time" step={900} value={casDo} onChange={(e) => setCasDo(e.target.value)} className={`${inputClass} tabular-nums`} />
        </label>
      </div>
      {spatnyCas && <span className="text-xs font-body text-danger -mt-2">Konec musí být po začátku.</span>}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">
          Kdo je na poradě <span className="text-muted">· uvidí ji jen oni</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {lide.map((l) => (
            <Volba
              key={l.id}
              maly
              vybrano={ucastnici.includes(l.id)}
              onZmena={() => prepni(l.id)}
              disabled={l.id === ja.id}
              title={l.id === ja.id ? 'Na poradě, kterou zakládáte, jste vždycky' : undefined}
            >
              {l.id === ja.id ? `${l.label} (já)` : l.label}
            </Volba>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Opakování</span>
          <VyberPole value={opakovani} onChange={(e) => setOpakovani(e.target.value as Opakovani)} className={inputClass}>
            {MOZNOSTI_OPAKOVANI.map((m) => (
              <option key={m.hodnota} value={m.hodnota}>
                {m.popisek}
              </option>
            ))}
          </VyberPole>
        </label>
        {opakovani !== 'NE' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">
              Opakovat do <span className="text-muted">· nepovinné</span>
            </span>
            <DatumPole value={opakovatDo} onChange={(e) => setOpakovatDo(e.target.value)} className={`${inputClass} tabular-nums`} />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">
          Odkaz na videohovor <span className="text-muted">· Meet, Zoom, Teams…</span>
        </span>
        <input
          value={odkaz}
          onChange={(e) => setOdkaz(e.target.value)}
          placeholder="https://meet.google.com/…"
          inputMode="url"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">
          Poznámka <span className="text-muted">· nepovinné</span>
        </span>
        <textarea value={poznamka} onChange={(e) => setPoznamka(e.target.value)} rows={2} className={inputClass} />
      </label>

      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void uloz()}
          disabled={bezi || spatnyCas || !nazev.trim()}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {bezi ? 'Ukládám…' : upravovana ? (opakovana ? 'Uložit celou řadu' : 'Uložit změny') : 'Založit poradu'}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          Zpět
        </button>
        {upravovana && (
          <span className="ml-auto flex items-center gap-3 flex-wrap text-sm font-heading font-semibold">
            {/* Zrušení až na druhé klepnutí - zmizí všem účastníkům. */}
            {opakovana && (
              <button
                type="button"
                disabled={bezi}
                onClick={() => (potvrdit === 'vyskyt' ? void zrus(true) : setPotvrdit('vyskyt'))}
                className="text-danger hover:underline"
              >
                {potvrdit === 'vyskyt' ? 'Opravdu zrušit tento termín?' : 'Zrušit jen tento termín'}
              </button>
            )}
            <button
              type="button"
              disabled={bezi}
              onClick={() => (potvrdit === 'cela' ? void zrus(false) : setPotvrdit('cela'))}
              className="text-danger hover:underline"
            >
              {potvrdit === 'cela'
                ? opakovana
                  ? 'Opravdu zrušit celou řadu?'
                  : 'Opravdu zrušit?'
                : opakovana
                  ? 'Zrušit celou řadu'
                  : 'Zrušit poradu'}
            </button>
          </span>
        )}
      </div>
      <span className="text-xs font-body text-muted -mt-2">
        {NAZEV_KALENDARE_PORADY} vidí jen pozvaní. O pozvání, změně i zrušení jim přijde zpráva pod zvonek.
      </span>
    </div>
  );
}
