'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatumPole } from '@/components/DatumPole';
import { Volba } from '@/components/Volba';
import { VyberPole } from '@/components/VyberPole';
import {
  MOZNOSTI_OPAKOVANI,
  barvaKalendare,
  vPraze,
  type DruhPorady,
  type Opakovani,
  type PoradaVKalendari,
} from '@/lib/porady';
import { prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

type Osoba = { id: string; label: string };

/**
 * Jak často se porada opakuje - kód z lib/porady.ts a k němu klíč do
 * slovníku. `popisek` v MOZNOSTI_OPAKOVANI je jen česky.
 */
const KLICE_OPAKOVANI: Record<Opakovani, string> = {
  NE: 'porady.opakovaniNe',
  DENNE: 'porady.opakovaniDenne',
  PRACOVNI_DNY: 'porady.opakovaniPracovniDny',
  TYDNE: 'porady.opakovaniTydne',
  KAZDE_DVA_TYDNY: 'porady.opakovaniDvaTydny',
  MESICNE: 'porady.opakovaniMesicne',
};

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
  druh: vychoziDruh = 'PORADA',
  muzeSchuzky = false,
  ja,
  lidiTymu,
  onClose,
}: {
  upravovana: PoradaVKalendari | null;
  vychoziDen: string;
  vychoziCasOd?: string;
  vychoziCasDo?: string;
  /** Do kterého kalendáře to patří (23. 9. 2026) - Porady, nebo Schůzky. */
  druh?: DruhPorady;
  /** Nepoužívá se, zůstává kvůli volajícím. */
  muzeSchuzky?: boolean;
  ja: Osoba;
  lidiTymu: Osoba[];
  onClose: () => void;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const lide = (lidiTymu.some((l) => l.id === ja.id) ? lidiTymu : [ja, ...lidiTymu])
    .slice()
    .sort((a, b) => (a.id === ja.id ? -1 : b.id === ja.id ? 1 : a.label.localeCompare(b.label, 'cs')));

  // U opakované porady se upravuje celá řada - datum a čas prvního výskytu.
  const prvni = upravovana ? vPraze(new Date(upravovana.start)) : null;
  const konecPrvni = upravovana ? vPraze(new Date(upravovana.end)) : null;

  /**
   * Do kterého kalendáře událost patří. Nepřepíná se: Schůzky jsou
   * samostatný kalendář, ne odnož Porad (upřesnění 23. 9. 2026: „ten kalendář
   * schůzky nemá nic společného s poradama"). Který to je, se pozná z toho,
   * odkud se okno otevřelo.
   */
  const druh: DruhPorady = upravovana?.druh ?? vychoziDruh;
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

  /**
   * Popisky polí, kde je druhá část tišší (šedá). Věta zůstává JEDEN KLÍČ
   * a rozdělí se až tady - v angličtině může značka stát ve větě jinde
   * (pravidlo 7 v docs/preklad-portalu.md).
   */
  const kdoJeNaPorade = prelozitKolem(jazyk, 'porady.kdoJeNaPorade', 'tise');
  const opakovatDoPopisek = prelozitKolem(jazyk, 'porady.opakovatDo', 'tise');
  const odkazPopisek = prelozitKolem(jazyk, 'porady.odkazVideo', 'tise');
  const poznamkaPopisek = prelozitKolem(jazyk, 'porady.poznamka', 'tise');

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
            druh,
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
        setChyba(data?.error || t('porady.chybaUlozeni'));
        setBezi(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setChyba(t('porady.chybaUlozeni'));
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
      setChyba(data?.error || t('porady.chybaZruseni'));
      setBezi(false);
      return;
    }
    onClose();
    router.refresh();
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full';

  return (
    <div
      className="bg-surface rounded-card border-2 shadow-sm p-5 flex flex-col gap-4"
      style={{ borderColor: barvaKalendare(druh) }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0 inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: barvaKalendare(druh) }} aria-hidden />
          {upravovana
            ? t(druh === 'SCHUZKA' ? 'porady.nadpisUpravaSchuzka' : 'porady.nadpisUpravaPorada')
            : t(druh === 'SCHUZKA' ? 'porady.nadpisNovaSchuzka' : 'porady.nadpisNovaPorada')}
        </h2>
        <button type="button" onClick={onClose} aria-label={t('obecne.zavrit')} className="text-muted hover:text-ink text-lg leading-none">
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">{t('porady.nazev')}</span>
        <input
          autoFocus={!upravovana}
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder={t('porady.nazevPlaceholder')}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">
            {opakovana ? t('porady.zacatekRady') : t('porady.den')}
          </span>
          <DatumPole
            value={upravovana && opakovana && prvni ? prvni.den : den}
            onChange={(e) => e.target.value && setDen(e.target.value)}
            disabled={opakovana}
            className={`${inputClass} tabular-nums disabled:opacity-60`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('porady.od')}</span>
          <input type="time" step={900} value={casOd} onChange={(e) => setCasOd(e.target.value)} className={`${inputClass} tabular-nums`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('porady.do')}</span>
          <input type="time" step={900} value={casDo} onChange={(e) => setCasDo(e.target.value)} className={`${inputClass} tabular-nums`} />
        </label>
      </div>
      {spatnyCas && (
        <span className="text-xs font-body text-danger -mt-2">{t('porady.chybaKonecPoZacatku')}</span>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">
          {kdoJeNaPorade[0]}
          <span className="text-muted">{kdoJeNaPorade[1]}</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {lide.map((l) => (
            <Volba
              key={l.id}
              maly
              vybrano={ucastnici.includes(l.id)}
              onZmena={() => prepni(l.id)}
              disabled={l.id === ja.id}
              title={l.id === ja.id ? t('porady.zakladatelVzdy') : undefined}
            >
              {l.id === ja.id ? t('porady.jaZavorka', { jmeno: l.label }) : l.label}
            </Volba>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">{t('porady.opakovani')}</span>
          <VyberPole value={opakovani} onChange={(e) => setOpakovani(e.target.value as Opakovani)} className={inputClass}>
            {MOZNOSTI_OPAKOVANI.map((m) => (
              <option key={m.hodnota} value={m.hodnota}>
                {t(KLICE_OPAKOVANI[m.hodnota])}
              </option>
            ))}
          </VyberPole>
        </label>
        {opakovani !== 'NE' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">
              {opakovatDoPopisek[0]}
              <span className="text-muted">{opakovatDoPopisek[1]}</span>
            </span>
            <DatumPole value={opakovatDo} onChange={(e) => setOpakovatDo(e.target.value)} className={`${inputClass} tabular-nums`} />
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-body text-ink">
          {odkazPopisek[0]}
          <span className="text-muted">{odkazPopisek[1]}</span>
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
          {poznamkaPopisek[0]}
          <span className="text-muted">{poznamkaPopisek[1]}</span>
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
          {bezi
            ? t('obecne.ukladam')
            : upravovana
              ? opakovana
                ? t('porady.ulozitCelouRadu')
                : t('porady.ulozitZmeny')
              : t('porady.zalozitPoradu')}
        </button>
        <button type="button" onClick={onClose} className="text-muted text-sm font-heading">
          {t('obecne.zpet')}
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
                {potvrdit === 'vyskyt' ? t('porady.opravduZrusitVyskyt') : t('porady.zrusitJenTento')}
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
                  ? t('porady.opravduZrusitRadu')
                  : t('porady.opravduZrusit')
                : opakovana
                  ? t('porady.zrusitCelouRadu')
                  : t(druh === 'SCHUZKA' ? 'porady.zrusitSchuzku' : 'porady.zrusitPoradu')}
            </button>
          </span>
        )}
      </div>
      <span className="text-xs font-body text-muted -mt-2">
        {druh === 'SCHUZKA' ? t('porady.vysvetleniSchuzka') : t('porady.vysvetleniPorada')}
      </span>
    </div>
  );
}
