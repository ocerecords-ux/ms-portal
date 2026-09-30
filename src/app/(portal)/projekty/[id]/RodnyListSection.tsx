'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  missingRodnyListFields,
  rodnyListFileName,
  rodnyListVersionLabel,
} from '@/lib/rodnyList';
import { DatumPole } from '@/components/DatumPole';
import { formatDatumCas } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '../../components/JazykProvider';

/**
 * Záložka „Rodný list" na detailu projektu - zadání 9. 9. 2026.
 *
 * KDY SE CO UKAZUJE (upřesnění 9. 9. 2026: „platí to jen u rádiových spotů"):
 *  - u rádiového spotu celá záložka: údaje pro RL, kontrola a vygenerované verze,
 *  - u ostatních projektů jen sekce „Hudba ve spotu" - tu chtěl mít uživatel
 *    k dispozici u projektů obecně, i když se z ní žádný dokument nedělá.
 *
 * O tom, co je rádiový spot, rozhoduje TYP PROJEKTU (příznak u položky ceníku),
 * ne přepínač u firmy.
 *
 * POZNÁMKA KE KONTROLE PŘED DOKONČENÍM: stav projektu se přepíná v Caflou, ne
 * v portálu - portál tedy nemá kam vložit „zákaz dokončení". Kontrola je proto
 * na dvou místech: tady jako výrazné varování, dokud údaje chybí, a hlavně
 * v okamžiku přechodu stavu - když něco chybí, RL nevznikne, klientovi NIC
 * neodejde a projekt se označí jako vyžadující kontrolu.
 */

export type RodnyListValues = {
  /** Klient na dokumentu - predvyplneny nazvem firmy, jde prepsat. */
  clientName: string;
  spotName: string;
  spotLengthSeconds: string;
  directorName: string;
  musicTitle: string;
  musicAuthor: string;
  noMusic: boolean;
  /** Datum ve tvaru YYYY-MM-DD, jak ho dává <input type="date">. */
  productionDate: string;
};

export type RodnyListRow = {
  id: string;
  version: number;
  fileName: string;
  createdAt: string;
  driveUrl: string | null;
  /** Proč kopie na Disku není - prázdno znamená, že je všechno v pořádku. */
  driveError: string | null;
};

const inputClass =
  'rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple disabled:opacity-60';

export function RodnyListSection({
  caflouProjectId,
  canEdit,
  nazevFirmy,
  projectName,
  jeRadiovySpot,
  rlError,
  rodneListy,
  initial,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  /** Nazev firmy projektu - z nej se predvyplni Klient na RL. */
  nazevFirmy: string;
  projectName: string;
  /** Rádiový spot = typ projektu má v ceníku zapnutý Rodný list. */
  jeRadiovySpot: boolean;
  /** Poslední zaznamenaná chyba generování (ProjectMeta.rlError). */
  rlError: string | null;
  rodneListy: RodnyListRow[];
  initial: RodnyListValues;
}) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const router = useRouter();
  const [values, setValues] = useState<RodnyListValues>(initial);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mazany, setMazany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /**
   * Náhled je vidět rovnou v záložce (zadání 10. 9. 2026: „chci to vidět
   * někde v té záložce Rodný list") - na novou stránku přes celou obrazovku
   * se člověk musel dívat a zase se vracet.
   *
   * `verzeNahledu` je jen počítadlo do adresy. PDF je pro prohlížeč pořád
   * stejná adresa, takže bez něj by po uložení ukazoval starý dokument
   * z paměti.
   */
  const [nahledOtevreny, setNahledOtevreny] = useState(true);
  const [verzeNahledu, setVerzeNahledu] = useState(0);
  /** Adresa právě vykresleného PDF v paměti prohlížeče. */
  const [nahledUrl, setNahledUrl] = useState<string | null>(null);
  const [nahledSeDela, setNahledSeDela] = useState(false);
  const posledniUrl = useRef<string | null>(null);

  function set<K extends keyof RodnyListValues>(key: K, value: RodnyListValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  // Stejná kontrola, jakou dělá server před generováním - uživatel tak vidí
  // rovnou při psaní, co ještě chybí. U jiného typu projektu nemá smysl.
  const chybi = useMemo(
    () =>
      jeRadiovySpot
        ? missingRodnyListFields({
            clientName: values.clientName || nazevFirmy,
            spotName: values.spotName || projectName,
            spotLengthSeconds: values.spotLengthSeconds ? Number(values.spotLengthSeconds) : null,
            directorName: values.directorName,
            musicTitle: values.musicTitle,
            musicAuthor: values.musicAuthor,
            noMusic: values.noMusic,
            productionDate: values.productionDate ? new Date(values.productionDate) : null,
          }, jazyk)
        : [],
    [values, nazevFirmy, projectName, jeRadiovySpot, jazyk],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // U jiného typu projektu posíláme jen hudbu - ať se omylem nepřepíšou
      // pole, která tenhle formulář vůbec neukazuje.
      const telo = jeRadiovySpot
        ? {
            rlClientName: values.clientName,
            spotName: values.spotName,
            spotLengthSeconds: values.spotLengthSeconds,
            directorName: values.directorName,
            musicTitle: values.musicTitle,
            musicAuthor: values.musicAuthor,
            noMusic: values.noMusic,
            productionDate: values.productionDate,
          }
        : {
            musicTitle: values.musicTitle,
            musicAuthor: values.musicAuthor,
            noMusic: values.noMusic,
          };

      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('rodnyList.chybaUlozeni'));
        return;
      }
      setSaved(true);
      setVerzeNahledu((v) => v + 1);
      router.refresh();
    } catch {
      setError(t('rodnyList.chybaUlozeni'));
    } finally {
      setSaving(false);
    }
  }

  async function vygenerovatZnovu() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/rodny-list`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('rodnyList.chybaVytvoreni'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('rodnyList.chybaVytvoreni'));
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Živý náhled (zadání 10. 9. 2026: „když budu měnit údaje, tak se to bude
   * měnit i v tom náhledu").
   *
   * Rozepsané hodnoty se pošlou na server, ten z nich vyrobí PDF a vrátí ho
   * - NIC SE NEUKLÁDÁ. Kreslit dokument v prohlížeči by znamenalo mít
   * podobu Rodného listu na dvou místech a ta by se dřív nebo později
   * rozešla; takhle je náhled doslova to, co pak vznikne.
   *
   * Čeká se půl vteřiny po posledním doťuknutí - jinak by se PDF vyrábělo
   * po každém písmenu. Rozdělaný požadavek se ruší, aby se nestalo, že
   * pomalejší starší odpověď přijde po novější a přebije ji.
   */
  useEffect(() => {
    if (!jeRadiovySpot || !nahledOtevreny || chybi.length > 0) return;

    const rizeni = new AbortController();
    const casovac = window.setTimeout(async () => {
      setNahledSeDela(true);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/rodny-list/nahled`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: rizeni.signal,
          body: JSON.stringify({
            clientName: values.clientName,
            spotName: values.spotName,
            spotLengthSeconds: values.spotLengthSeconds,
            directorName: values.directorName,
            musicTitle: values.musicTitle,
            musicAuthor: values.musicAuthor,
            noMusic: values.noMusic,
            productionDate: values.productionDate,
          }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        // Předchozí PDF pustíme z paměti - bez toho by se při psaní
        // hromadila jedna kopie dokumentu za druhou.
        if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
        posledniUrl.current = url;
        setNahledUrl(url);
      } catch {
        // Přerušený požadavek při dalším ťuknutí není chyba.
      } finally {
        setNahledSeDela(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(casovac);
      rizeni.abort();
    };
  }, [values, chybi.length, jeRadiovySpot, nahledOtevreny, caflouProjectId, verzeNahledu]);

  // Poslední PDF pustíme z paměti, když se od projektu odchází.
  useEffect(() => () => {
    if (posledniUrl.current) URL.revokeObjectURL(posledniUrl.current);
  }, []);

  /**
   * Smazání jedné verze (zadání 10. 9. 2026). Ptáme se, protože je to jediná
   * nevratná akce v celé záložce - kopie na Disku jde sice vytáhnout z koše,
   * ale záznam v portálu už ne.
   */
  async function smazVerzi(rl: RodnyListRow) {
    const potvrzeno = window.confirm(
      t('rodnyList.opravduSmazat', {
        soubor: rl.fileName,
        verze: rodnyListVersionLabel(rl.version, jazyk),
      }) + (rl.driveUrl ? `\n\n${t('rodnyList.kopieDoKose')}` : ''),
    );
    if (!potvrzeno) return;

    setMazany(rl.id);
    setError(null);
    try {
      const res = await fetch(`/api/rodny-list/${rl.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('rodnyList.chybaSmazani'));
        return;
      }
      if (data?.disk === 'zustal') {
        setError(t('rodnyList.diskZustal'));
      }
      router.refresh();
    } catch {
      setError(t('rodnyList.chybaSmazani'));
    } finally {
      setMazany(null);
    }
  }

  const nazevSouboru = rodnyListFileName(values.spotName || projectName);

  /** Sekce „Hudba ve spotu" - jediná část, která je i u jiných typů projektu. */
  const hudba = (
    <div className={jeRadiovySpot ? 'border-t border-line pt-5 flex flex-col gap-4' : 'flex flex-col gap-4'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-heading font-semibold text-sm text-ink m-0">{t('rodnyList.hudbaNadpis')}</h3>
        <label className="flex items-center gap-2 text-sm font-heading text-ink">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={values.noMusic}
            onChange={(e) => set('noMusic', e.target.checked)}
          />
          {t('rodnyList.bezHudby')}
        </label>
      </div>

      {values.noMusic ? (
        <p className="text-sm font-body text-muted m-0">
          {jeRadiovySpot ? t('rodnyList.bezHudbyVDokumentu') : t('rodnyList.bezHudbyPoznamka')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.nazevSkladby')}</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.musicTitle}
              onChange={(e) => set('musicTitle', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.autorHudby')}</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.musicAuthor}
              onChange={(e) => set('musicAuthor', e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );

  const tlacitka = (
    <>
      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}
      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
          >
            {saving ? t('obecne.ukladam') : t('obecne.ulozit')}
          </button>
          {saved && (
            <span className="text-sm font-heading text-brand-greenDeep">{t('rodnyList.ulozeno')}</span>
          )}
        </div>
      )}
    </>
  );

  // Zalozka se od 10. 9. 2026 ukazuje JEN u radioveho spotu (zadani: "hudba
  // ve spotu bude jen u typu projektu Radiovy spot"), takze sem se komponenta
  // s jinym typem projektu uz nedostane. Puvodni varianta "jen hudba bez
  // Rodneho listu" tim odpadla.

  // --- Rádiový spot: celý Rodný list ----------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {rlError && (
        <div className="bg-dangerTint border border-danger/30 rounded-card px-4 py-3">
          <p className="text-sm font-heading font-semibold text-danger m-0">
            {t('rodnyList.vyzadujeKontrolu')}
          </p>
          <p className="text-sm font-body text-danger m-0 mt-1">{rlError}</p>
          <p className="text-xs font-body text-danger m-0 mt-1">{t('rodnyList.nicNeodeslano')}</p>
        </div>
      )}

      {/* Ukazuje se VZDY, kdyz neco chybi (oprava 10. 9. 2026). Driv to bylo
          schovane, kdyz mel projekt zapsanou chybu generovani - takze clovek
          videl zasedla tlacitka a zadne vysvetleni proc. */}
      {chybi.length > 0 && (
        <div className="bg-warnTint border border-line rounded-card px-4 py-3">
          <p className="text-sm font-heading font-semibold text-status-progress m-0">
            {t('rodnyList.chybiUdaje')}
          </p>
          <p className="text-sm font-body text-ink m-0 mt-1">
            {t('rodnyList.chybiUdajeText', { chybi: chybi.join(', ') })}
          </p>
        </div>
      )}

      {/* DVA STEJNE SIROKE SLOUPCE (zadani 10. 9. 2026): vlevo udaje, vpravo
          nahled. Stejna sirka drzi dokument v pomeru A4 zhruba tak vysoky
          jako karta s udaji vedle nej a zaroven nenechava radky formulare
          natahnout se pres celou obrazovku. Na uzkem okne jde formular
          nahoru, protoze na telefonu se hlavne vyplnuje; nahled se pri
          rolovani drzi na miste, at se nemusi jezdit nahoru a dolu. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-5"
      >
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('rodnyList.udajeNadpis')}
          </h2>
          <p className="text-xs text-muted font-body m-0 mt-1">{t('rodnyList.udajeUvod')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.nazevSpotu')}</span>
            <input
              type="text"
              disabled={!canEdit}
              placeholder={projectName}
              value={values.spotName}
              onChange={(e) => set('spotName', e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-muted font-body">
              {t('rodnyList.nazevSpotuNapoveda', { soubor: nazevSouboru })}
            </span>
          </label>

          {/* Klient na dokumentu (zadani 10. 9. 2026). Predvyplneny celym
              nazvem firmy projektu, ale prepsat ho jde - na RL obcas patri
              neco jineho nez firma, ktere se fakturuje. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.klient')}</span>
            <input
              type="text"
              disabled={!canEdit}
              placeholder={nazevFirmy || t('rodnyList.klientPriklad')}
              value={values.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-muted font-body">
              {nazevFirmy
                ? t('rodnyList.klientPredvyplneno', { firma: nazevFirmy })
                : t('rodnyList.klientBezFirmy')}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.delkaSpotu')}</span>
            {/* Jednotka je primo v poli (zadani 10. 9. 2026), at je jasne, ze
                se zadavaji sekundy - a at to sedi s tim, co bude v dokumentu. */}
            <span className="relative flex items-center">
              <input
                type="number"
                min={1}
                max={3600}
                disabled={!canEdit}
                value={values.spotLengthSeconds}
                onChange={(e) => set('spotLengthSeconds', e.target.value)}
                className={`${inputClass} w-full pr-8`}
              />
              <span className="absolute right-3 text-sm font-body text-muted pointer-events-none">s</span>
            </span>
            <span className="text-xs text-muted font-body">{t('rodnyList.delkaNapoveda')}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.rezie')}</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.directorName}
              onChange={(e) => set('directorName', e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('rodnyList.pole.datumVyroby')}</span>
            <DatumPole
              disabled={!canEdit}
              value={values.productionDate}
              onChange={(e) => set('productionDate', e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {hudba}
        {tlacitka}
      </form>

      {/* NÁHLED PŘÍMO V ZÁLOŽCE (zadání 10. 9. 2026). Je to totéž PDF, které
          vznikne po kliknutí na Vygenerovat - jen se nikam neuloží. Rám kolem
          něj je záměrně "papírový": člověk má vidět dokument, ne políčko
          prohlížeče. */}
      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden lg:sticky lg:top-24 self-start">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3.5 border-b border-line">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {t('rodnyList.nahled')}
            </h2>
            <p className="text-xs font-body text-muted m-0 mt-1">
              {nahledSeDela ? t('rodnyList.prekresluji') : t('rodnyList.nahledPopis')}
            </p>
          </div>
          <span className="flex items-center gap-3 flex-wrap">
            {chybi.length === 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setVerzeNahledu((v) => v + 1)}
                  className="text-xs font-heading font-semibold text-brand-purple hover:underline"
                >
                  {t('rodnyList.obnovit')}
                </button>
                <a
                  href={`/api/projects/${encodeURIComponent(caflouProjectId)}/rodny-list/nahled`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-heading font-semibold text-brand-purple no-underline hover:underline"
                >
                  {t('rodnyList.otevritSamostatne')}
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => setNahledOtevreny((o) => !o)}
              className="border border-line font-heading font-semibold text-xs rounded-lg px-3 py-1.5 text-ink hover:border-brand-purple transition-colors"
            >
              {nahledOtevreny ? t('obecne.skryt') : t('rodnyList.zobrazit')}
            </button>
          </span>
        </div>

        {nahledOtevreny && (
          <div className="bg-field px-4 py-5 sm:px-6 sm:py-6">
            {chybi.length > 0 ? (
              <p className="text-sm font-body text-muted m-0 text-center py-10">
                {t('rodnyList.nahledAzPoDoplneni')}
              </p>
            ) : (
              <iframe
                // Zdroj je PDF vyrobene z rozepsanych hodnot a drzene
                // v pameti prohlizece - proto blob:, ne adresa routy.
                // #view=Fit rekne prohlizeci, at ukaze celou stranku, ne
                // jen jeji sirku; pomer stran je A4, takze ram sedi na PDF.
                src={nahledUrl ? `${nahledUrl}#view=Fit&toolbar=0&navpanes=0` : undefined}
                title={t('rodnyList.nahledTitulek')}
                className={`w-full aspect-[210/297] rounded-lg border border-line bg-white shadow-md transition-opacity ${
                  nahledSeDela ? 'opacity-60' : 'opacity-100'
                }`}
              />
            )}
          </div>
        )}
      </div>
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {t('rodnyList.vygenerovaneNadpis')}
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={vygenerovatZnovu}
              disabled={generating || chybi.length > 0}
              title={chybi.length > 0 ? t('rodnyList.nejdrivDoplnte') : undefined}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
            >
              {generating
                ? t('rodnyList.generuji')
                : rodneListy.length === 0
                  ? t('rodnyList.vygenerovat')
                  : t('rodnyList.vygenerovatZnovu')}
            </button>
          )}
        </div>

        {rodneListy.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('rodnyList.zadny')}</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {rodneListy.map((rl) => (
              <li
                key={rl.id}
                className="flex items-center justify-between flex-wrap gap-3 border border-line rounded-lg px-4 py-3"
              >
                <div>
                  <a
                    href={`/api/rodny-list/${rl.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-heading font-semibold text-sm text-brand-purple no-underline"
                  >
                    {rl.fileName} ↗
                  </a>
                  <p className="text-xs font-body text-muted m-0 mt-0.5">
                    {t('rodnyList.vytvoreno', {
                      verze: rodnyListVersionLabel(rl.version, jazyk),
                      kdy: formatDatumCas(jazyk, new Date(rl.createdAt)),
                    })}
                  </p>
                  {/* Proc dokument neni ve slozce projektu (oprava 10. 9.
                      2026). Driv o tom clovek nevedel - selhani skoncilo
                      v logu serveru a v portalu proste nebyl odkaz. */}
                  {rl.driveError && (
                    <p className="text-xs font-body text-status-progress m-0 mt-1">
                      {t('rodnyList.disk', { chyba: rl.driveError })}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-3">
                  {rl.driveUrl && (
                    <a
                      href={rl.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-heading text-muted no-underline"
                    >
                      {t('rodnyList.naDisku')}
                    </a>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => smazVerzi(rl)}
                      disabled={mazany === rl.id}
                      className="text-xs font-heading font-semibold text-muted hover:text-danger transition-colors disabled:opacity-50"
                    >
                      {mazany === rl.id ? t('rodnyList.mazu') : t('obecne.smazat')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
