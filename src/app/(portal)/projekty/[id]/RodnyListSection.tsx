'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  missingRodnyListFields,
  rodnyListFileName,
  rodnyListVersionLabel,
} from '@/lib/rodnyList';

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
  const router = useRouter();
  const [values, setValues] = useState<RodnyListValues>(initial);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
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
          })
        : [],
    [values, nazevFirmy, projectName, jeRadiovySpot],
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
        setError(data?.error || 'Uložení se nezdařilo.');
        return;
      }
      setSaved(true);
      setVerzeNahledu((v) => v + 1);
      router.refresh();
    } catch {
      setError('Uložení se nezdařilo.');
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
        setError(data?.error || 'Rodný list se nepodařilo vytvořit.');
        return;
      }
      router.refresh();
    } catch {
      setError('Rodný list se nepodařilo vytvořit.');
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

  const nazevSouboru = rodnyListFileName(values.spotName || projectName);

  /** Sekce „Hudba ve spotu" - jediná část, která je i u jiných typů projektu. */
  const hudba = (
    <div className={jeRadiovySpot ? 'border-t border-line pt-5 flex flex-col gap-4' : 'flex flex-col gap-4'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-heading font-semibold text-sm text-ink m-0">Hudba ve spotu</h3>
        <label className="flex items-center gap-2 text-sm font-heading text-ink">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={values.noMusic}
            onChange={(e) => set('noMusic', e.target.checked)}
          />
          Spot nemá hudbu
        </label>
      </div>

      {values.noMusic ? (
        <p className="text-sm font-body text-muted m-0">
          {jeRadiovySpot
            ? 'V Rodném listu bude u hudby uvedeno „Spot bez hudby“ — žádný vymyšlený údaj se tam nedostane.'
            : 'U projektu je poznamenané, že hudbu nemá.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Název skladby</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.musicTitle}
              onChange={(e) => set('musicTitle', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Autor hudby</span>
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
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
          {saved && <span className="text-sm font-heading text-brand-greenDeep">Uloženo.</span>}
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
          <p className="text-sm font-heading font-semibold text-danger m-0">Projekt vyžaduje kontrolu</p>
          <p className="text-sm font-body text-danger m-0 mt-1">{rlError}</p>
          <p className="text-xs font-body text-danger m-0 mt-1">
            Klientovi se v tomhle případě nic neodeslalo. Doplňte údaje a vygenerujte Rodný list znovu.
          </p>
        </div>
      )}

      {/* Ukazuje se VZDY, kdyz neco chybi (oprava 10. 9. 2026). Driv to bylo
          schovane, kdyz mel projekt zapsanou chybu generovani - takze clovek
          videl zasedla tlacitka a zadne vysvetleni proc. */}
      {chybi.length > 0 && (
        <div className="bg-warnTint border border-line rounded-card px-4 py-3">
          <p className="text-sm font-heading font-semibold text-status-progress m-0">
            Chybí údaje pro Rodný list
          </p>
          <p className="text-sm font-body text-ink m-0 mt-1">
            {chybi.join(', ')}. Dokud tyhle údaje chybí, jsou tlačítka Náhled i Vygenerovat RL
            zašedlá — doplňte je ve formuláři níž a uložte.
          </p>
        </div>
      )}

      {/* DVA SLOUPCE (zadani 10. 9. 2026): vlevo dokument, vpravo uzka karta
          s udaji vlevo a nahledem vpravo (zadani 10. 9. 2026). Nahled ma
          pevnou sirku, aby se do ni vesla cela A4 na vysku - o dokumentu se
          rozhoduje podle celku, ne podle vyrezu. Na uzkem okne jde formular
          nahoru, protoze na telefonu se hlavne vyplnuje; nahled se pri
          rolovani drzi na miste, at se nemusi jezdit nahoru a dolu. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-5"
      >
        <div>
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Údaje pro Rodný list
          </h2>
          <p className="text-xs text-muted font-body m-0 mt-1">
            Z nich se vyrobí PDF, až kliknete na „Vygenerovat RL" — sám nevzniká. Náhledem se na
            něj můžete podívat dřív, než se kamkoliv uloží.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Klient na dokumentu (zadani 10. 9. 2026). Predvyplneny celym
              nazvem firmy projektu, ale prepsat ho jde - na RL obcas patri
              neco jineho nez firma, ktere se fakturuje. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Klient</span>
            <input
              type="text"
              disabled={!canEdit}
              placeholder={nazevFirmy || 'název klienta na dokumentu'}
              value={values.clientName}
              onChange={(e) => set('clientName', e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-muted font-body">
              {nazevFirmy
                ? `Předvyplněno podle firmy projektu (${nazevFirmy}). Přepsat jde kdykoliv.`
                : 'Projekt zatím nemá vyplněnou firmu, tak klienta zadejte ručně.'}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Název spotu</span>
            <input
              type="text"
              disabled={!canEdit}
              placeholder={projectName}
              value={values.spotName}
              onChange={(e) => set('spotName', e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-muted font-body">
              Když zůstane prázdný, použije se název projektu. Soubor se uloží jako {nazevSouboru}.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Délka spotu (sekundy)</span>
            <input
              type="number"
              min={1}
              max={3600}
              disabled={!canEdit}
              value={values.spotLengthSeconds}
              onChange={(e) => set('spotLengthSeconds', e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-muted font-body">V dokumentu se zobrazí například jako „20s".</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Datum výroby</span>
            <input
              type="date"
              disabled={!canEdit}
              value={values.productionDate}
              onChange={(e) => set('productionDate', e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">Režie</span>
            <input
              type="text"
              disabled={!canEdit}
              value={values.directorName}
              onChange={(e) => set('directorName', e.target.value)}
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
              Náhled
            </h2>
            <p className="text-xs font-body text-muted m-0 mt-1">
              {nahledSeDela ? 'Překresluji…' : 'Mění se s tím, co píšete. Nikam se neukládá.'}
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
                  Obnovit
                </button>
                <a
                  href={`/api/projects/${encodeURIComponent(caflouProjectId)}/rodny-list/nahled`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-heading font-semibold text-brand-purple no-underline hover:underline"
                >
                  Otevřít samostatně ↗
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => setNahledOtevreny((o) => !o)}
              className="border border-line font-heading font-semibold text-xs rounded-lg px-3 py-1.5 text-ink hover:border-brand-purple transition-colors"
            >
              {nahledOtevreny ? 'Skrýt' : 'Zobrazit'}
            </button>
          </span>
        </div>

        {nahledOtevreny && (
          <div className="bg-field px-4 py-5 sm:px-6 sm:py-6">
            {chybi.length > 0 ? (
              <p className="text-sm font-body text-muted m-0 text-center py-10">
                Náhled se ukáže, až budou doplněné chybějící údaje.
              </p>
            ) : (
              <iframe
                // Zdroj je PDF vyrobene z rozepsanych hodnot a drzene
                // v pameti prohlizece - proto blob:, ne adresa routy.
                // #view=Fit rekne prohlizeci, at ukaze celou stranku, ne
                // jen jeji sirku; pomer stran je A4, takze ram sedi na PDF.
                src={nahledUrl ? `${nahledUrl}#view=Fit&toolbar=0&navpanes=0` : undefined}
                title="Náhled Rodného listu"
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
            Vygenerované Rodné listy
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={vygenerovatZnovu}
              disabled={generating || chybi.length > 0}
              title={chybi.length > 0 ? 'Nejdřív doplňte chybějící údaje.' : undefined}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-50"
            >
              {generating ? 'Generuji…' : rodneListy.length === 0 ? 'Vygenerovat RL' : 'Vygenerovat RL znovu'}
            </button>
          )}
        </div>

        {rodneListy.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">
            Zatím žádný. Vyrobíte ho tlačítkem — sám nevzniká (zadání 10. 9. 2026). Náhledem se
            nejdřív podívejte, jestli sedí; teprve „Vygenerovat RL" ho uloží a nahraje na Disk.
          </p>
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
                    {rodnyListVersionLabel(rl.version)} · vytvořeno{' '}
                    {new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
                      new Date(rl.createdAt),
                    )}
                  </p>
                </div>
                {rl.driveUrl && (
                  <a
                    href={rl.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-heading text-muted no-underline"
                  >
                    Na Google Disku ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
