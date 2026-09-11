'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SmazatSPrekazkami } from '@/components/SmazatSPrekazkami';
import { PRIORITY_CLASSES, PRIORITY_LABELS, PRIORITY_OPTIONS, projectTypeLabel } from '@/lib/projectTypes';
import { STAVY_PROJEKTU, barvaStavu, popisStavu } from '@/lib/stavyProjektu';
import { STAVY_S_NOTIFIKACI } from '@/lib/notifikaceFirmy';
import { KresbaIkony } from '@/lib/ikonyTypu';
import { type Herec } from '../VyberHerce';
import { VyberHercu } from '../VyberHercu';
import { FajfkaDotoceno } from '../FajfkaDotoceno';
import { TRIDA_BUBLINY_HERCE, TRIDA_SLOUPCE_HERCU } from '@/lib/bublinaHerce';
import { OdkazTlacitko } from '@/app/(portal)/components/OdkazTlacitko';
import { OdznakSelect } from '../OdznakSelect';

/**
 * Stav, priorita a typ projektu jako barevný odznak (zadání 10. 9. 2026:
 * „stav projektu by se mohl zobrazovat dle naší barevné palety, to samé
 * priorita a typ projektu").
 *
 * Odznaky jsou stejné jako v přehledu projektů - kdo si barvu spojí se
 * stavem v seznamu, přečte ji na detailu bez čtení textu. Proto se berou
 * z týchž zdrojů (lib/stavyProjektu.ts, lib/projectTypes.ts), ne z vlastní
 * palety kousek vedle.
 */
const TRIDA_ODZNAKU = 'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-heading font-semibold';

/** Odznak bez hodnoty - ať je i "nevybráno" vidět jako odznak, ne jako díra. */
const TRIDA_PRAZDNEHO = 'bg-field text-muted border border-line';

/**
 * Typ projektu nese barvu značky a ikonu z Ceníku - vlastní paleta pro typy
 * neexistuje a vymýšlet ji jen sem by přidala další sadu barev, kterou by
 * nikdo jinde v portálu nepotkal.
 */
const TRIDA_TYPU =
  'bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight border border-brand-purple/40';

function OdznakStavu({ stav }: { stav: string }) {
  if (!stav) return <span className="text-sm font-heading text-muted">—</span>;
  return <span className={`${TRIDA_ODZNAKU} ${barvaStavu(stav)}`}>{stav}</span>;
}

function OdznakPriority({ priorita }: { priorita: string }) {
  const klic = priorita as keyof typeof PRIORITY_LABELS;
  if (!priorita || !PRIORITY_LABELS[klic]) {
    return <span className="text-sm font-heading text-muted">—</span>;
  }
  return <span className={`${TRIDA_ODZNAKU} ${PRIORITY_CLASSES[klic]}`}>{PRIORITY_LABELS[klic]}</span>;
}

function OdznakTypu({ typ, ikona }: { typ: string | null; ikona: string | null }) {
  if (!typ) return <span className="text-sm font-heading text-muted">—</span>;
  return (
    <span className={`${TRIDA_ODZNAKU} ${TRIDA_TYPU}`}>
      {/* Jen kresba, ne cely odznak s koleckem - kolecko v odznaku by byl
          odznak v odznaku. */}
      {ikona && <KresbaIkony klic={ikona} velikost={14} />}
      {typ}
    </span>
  );
}

type Initial = {
  driveUrl: string;
  managerUserId: string;
  priority: string;
  projectType: string;
  /** Stav projektu - od 10. 9. 2026 vlastni udaj portalu, ne z Caflou. */
  statusName: string;
  /**
   * Ucty hercu v poradi - prvni je hlavni (zadani 10. 9. 2026: "chci jich tam
   * dat vice"). Herec je konkretni osoba, ne text.
   */
  actorUserIds: string[];
  /** Klient projektu - na nej chodi notifikace o projektu. */
  klientUserId: string;
  /** Firma, pro kterou se projekt dela. */
  companyId: string;
};

/**
 * Interni atributy projektu (zadani 5. 9. 2026) - odkaz na KZ, manazer
 * projektu, priorita, typ projektu. Pri canEdit=false (zvukar) se stejna
 * data jen vypisou ke cteni; skutecnou kontrolu prav dela server (viz
 * /api/projects/[id]/meta).
 */
export function ProjectMetaForm({
  caflouProjectId,
  canEdit,
  managers,
  klienti,
  firmy,
  herci,
  herecZCaflou,
  klientNameZCaflou,
  companyDriveFolderUrl,
  projectTypeOptions,
  ikonyTypu,
  initial,
  dotoceniHercu,
}: {
  caflouProjectId: string;
  canEdit: boolean;
  managers: { id: string; label: string }[];
  /** Ucty klientu, ze kterych jde vybrat, ci ten projekt je. */
  klienti: { id: string; label: string; companyId: string | null }[];
  /** Klientske firmy - pro kterou firmu se projekt dela. */
  firmy: { id: string; label: string }[];
  /** Ucty hercu. */
  herci: Herec[];
  /** Jmeno herce z Caflou - voditko, dokud neni pridelen ucet. */
  herecZCaflou: string | null;
  /** Stitek z Caflou se jmenem objednavajici osoby - voditko pri prirazovani. */
  klientNameZCaflou: string | null;
  companyDriveFolderUrl: string | null;
  /** Nazvy polozek ceniku - jen z nich jde typ projektu vybrat (zadani 5. 9. 2026). */
  projectTypeOptions: string[];
  /** Ikony k typum projektu z Ceniku (zadani 10. 9. 2026). */
  ikonyTypu: Record<string, string>;
  initial: Initial;
  /** Kdo z herců má dotočeno - ID účtu -> datum (zadání 11. 9. 2026). */
  dotoceniHercu: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [upravitOdkaz, setUpravitOdkaz] = useState(false);

  /**
   * Dotočení herce (zadání 11. 9. 2026) se ukládá ZVLÁŠŤ, ne se zbytkem
   * formuláře: je to událost, ne rozepsaná hodnota — a odchází na ni zpráva,
   * takže se nesmí odeslat jako vedlejší účinek toho, že člověk vedle
   * přehodil prioritu.
   */
  const [dotoceni, setDotoceni] = useState<Record<string, string>>(dotoceniHercu);
  const [dotoceniBezi, setDotoceniBezi] = useState<string | null>(null);

  async function prepniDotoceno(userId: string, dotocenoNove: boolean) {
    setDotoceniBezi(userId);
    setError(null);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/herci-dotoceno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dotoceno: dotocenoNove }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string })?.error || 'Nepodařilo se to uložit.');
        return;
      }
      setDotoceni((soucasne) => {
        const dalsi = { ...soucasne };
        if (dotocenoNove) dalsi[userId] = (data as { dotocenoAt?: string })?.dotocenoAt ?? new Date().toISOString();
        else delete dalsi[userId];
        return dalsi;
      });
      // Fajfka se ukazuje i v prehledu projektu - at tam sedi hned.
      router.refresh();
    } catch {
      setError('Nepodařilo se to uložit.');
    } finally {
      setDotoceniBezi(null);
    }
  }

  /**
   * UKLÁDÁ SE SAMO (zadání 11. 9. 2026: „u projektu zruš to tlačítko uložit,
   * šel bych cestou, co přepneš, to tam je").
   *
   * Co člověk přepne, to platí. Tlačítko „Uložit" bylo u obrazovky, kde se
   * skoro vždycky mění jediná věc — přehodit stav a pak ještě potvrdit je
   * krok navíc, na který se dá zapomenout, a rozdělaná změna pak tiše zmizí
   * i s odchodem ze stránky.
   *
   * Nečeká se na každé klepnutí do klávesnice: změna se odloží o chvilku, aby
   * se rychlé úpravy za sebou poslaly jednou. U políčka s odkazem je ta chvíle
   * delší (píše se do něj) a odkliknutím se uloží hned.
   *
   * Kdyby mezitím přišla novější změna, odpověď té starší se zahodí — jinak by
   * pomalejší požadavek mohl přepsat to, co už je na obrazovce.
   */
  const PRODLEVA_MS = 400;
  const PRODLEVA_PSANI_MS = 900;

  const valuesRef = useRef(values);
  const casovacRef = useRef<number | null>(null);
  const poradiRef = useRef(0);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const uloz = useCallback(
    async (data: Initial) => {
      const moje = ++poradiRef.current;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/meta`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const odpoved = await res.json().catch(() => ({}));
        // Mezitim prisla novejsi zmena - tahle odpoved uz nic neridi.
        if (moje !== poradiRef.current) return;
        if (!res.ok) {
          setError((odpoved as { error?: string })?.error || 'Uložení se nezdařilo.');
          setSaved(false);
          return;
        }
        setSaved(true);
        // Zbytek stranky (odznak stavu v hlavicce, zalozky, rodny list) se
        // sklada na serveru - bez tohohle by ukazoval starou hodnotu.
        router.refresh();
      } catch {
        if (moje === poradiRef.current) {
          setError('Uložení se nezdařilo.');
          setSaved(false);
        }
      } finally {
        if (moje === poradiRef.current) setSaving(false);
      }
    },
    [caflouProjectId, router],
  );

  const naplanujUlozeni = useCallback(
    (prodleva: number = PRODLEVA_MS) => {
      if (casovacRef.current) window.clearTimeout(casovacRef.current);
      casovacRef.current = window.setTimeout(() => {
        casovacRef.current = null;
        void uloz(valuesRef.current);
      }, prodleva);
    },
    [uloz],
  );

  /** Uloz hned - po odkliknuti policka, at se necekaci nic neztrati. */
  const ulozHned = useCallback(() => {
    if (casovacRef.current) {
      window.clearTimeout(casovacRef.current);
      casovacRef.current = null;
    }
    void uloz(valuesRef.current);
  }, [uloz]);

  useEffect(
    () => () => {
      if (casovacRef.current) window.clearTimeout(casovacRef.current);
    },
    [],
  );

  function set<K extends keyof Initial>(key: K, value: Initial[K], psani = false) {
    setValues((v) => {
      const dalsi = { ...v, [key]: value };
      valuesRef.current = dalsi;
      return dalsi;
    });
    setSaved(false);
    naplanujUlozeni(psani ? PRODLEVA_PSANI_MS : PRODLEVA_MS);
  }

  const managerLabel = managers.find((m) => m.id === values.managerUserId)?.label ?? '—';

  if (!canEdit) {
    return (
      <div className="bg-surface rounded-card border border-line shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            Interní údaje
          </h2>
          <span className="text-xs font-heading text-muted bg-field border border-line rounded-pill px-3 py-1">
            Jen ke čtení
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 m-0">
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Odkaz na KZ</dt>
            <dd className="text-sm font-heading m-0 mt-1">
              <OdkazTlacitko url={values.driveUrl} popisek="Otevřít složku" varianta="vedlejsi" />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Stav projektu</dt>
            <dd className="m-0 mt-1">
              <OdznakStavu stav={values.statusName} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">
              {values.actorUserIds.length > 1 ? 'Herci' : 'Herec'}
            </dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {values.actorUserIds.length > 0 ? (
                <span className={TRIDA_SLOUPCE_HERCU}>
                  {values.actorUserIds.map((id) => {
                    const jmeno = herci.find((h) => h.id === id)?.label;
                    if (!jmeno) return null;
                    // Stejna bublina i fajfka uvnitr jako v prehledu projektu
                    // (zadani 11. 9. 2026) - na obou mistech ma herec vypadat
                    // stejne.
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-heading font-semibold ${TRIDA_BUBLINY_HERCE}`}
                      >
                        {jmeno}
                        {dotoceni[id] && <FajfkaDotoceno kdy={dotoceni[id]} />}
                      </span>
                    );
                  })}
                </span>
              ) : (
                (herecZCaflou ?? '—')
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Firma</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {firmy.find((f) => f.id === values.companyId)?.label ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Klient</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">
              {klienti.find((k) => k.id === values.klientUserId)?.label ?? klientNameZCaflou ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Manažer projektu</dt>
            <dd className="text-sm font-heading text-ink m-0 mt-1">{managerLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Priorita</dt>
            <dd className="m-0 mt-1">
              <OdznakPriority priorita={values.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-heading text-muted uppercase tracking-wide">Typ projektu</dt>
            <dd className="m-0 mt-1">
              <OdznakTypu
                typ={projectTypeLabel(values.projectType)}
                ikona={ikonyTypu[values.projectType] ?? null}
              />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">Interní údaje</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Odkaz na KZ: jen tlacitka, samotna adresa se neukazuje (zadani
            10. 9. 2026 - "nechci, at je videt ten dlouhy odkaz"). Policko na
            rucni zadani se rozbali az na vyzadani; potreba je hlavne tehdy,
            kdyz se slozka nezalozila sama. */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Odkaz na KZ</span>
          {/* Odkazy pod sebou, kopirovani jen jako ikona na konci radku
              (zadani 10. 9. 2026). Vedle sebe stalo v rade ctvero popsanych
              tlacitek - otevrit, kopirovat, otevrit, kopirovat - a nebylo
              poznat, co k cemu patri. */}
          <span className="flex flex-col items-start gap-2">
            <OdkazTlacitko url={values.driveUrl} popisek="Složka projektu" varianta="radek" />
            {companyDriveFolderUrl && (
              <OdkazTlacitko url={companyDriveFolderUrl} popisek="Složka firmy" varianta="radek" />
            )}
            <button
              type="button"
              onClick={() => setUpravitOdkaz((v) => !v)}
              className="text-xs font-heading font-semibold text-brand-purple hover:underline mt-0.5"
            >
              {upravitOdkaz ? 'Skrýt' : values.driveUrl ? 'Změnit odkaz' : 'Zadat odkaz'}
            </button>
          </span>
          {upravitOdkaz && (
            <input
              type="url"
              autoFocus
              placeholder="https://drive.google.com/..."
              value={values.driveUrl}
              onChange={(e) => set('driveUrl', e.target.value, true)}
              onBlur={ulozHned}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
            />
          )}
          <span className="text-xs text-muted font-body">Složka projektu na Google Disku.</span>
        </div>

        {/* Stav a herec se od 10. 9. 2026 prehazuji rucne (odchod z Caflou).
            Stav je prvni, protoze se s nim pracuje nejcasteji. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Stav projektu</span>
          {/* Odznak v barve stavu je ZAROVEN ovladac - stejne jako v prehledu
              projektu (zadani 10. 9. 2026). Puvodne tu byl <select> a pod nim
              jeste odznak s touz hodnotou, coz byla tataz vec dvakrat. */}
          <OdznakSelect
            hodnota={values.statusName}
            onZmena={(v) => set('statusName', v)}
            trida={barvaStavu(values.statusName)}
            titulek="Přehodit stav projektu"
            moznosti={[
              // Stav prenesen z Caflou, ktery v nasi ceste projektu neni - at
              // se pri ulozeni nezmeni na "nevybráno".
              ...(values.statusName && !STAVY_PROJEKTU.some((st) => st.nazev === values.statusName)
                ? [{ hodnota: values.statusName, popisek: `${values.statusName} (starý stav z Caflou)` }]
                : []),
              ...STAVY_PROJEKTU.map((st) => ({ hodnota: st.nazev, popisek: st.nazev })),
            ]}
          />
          <span className="text-xs text-muted font-body">
            {popisStavu(values.statusName) ?? 'Stav přehazujete ručně podle toho, kde projekt je.'}
          </span>
          {/* Zprava ke kazdemu stavu odejde z projektu jen jednou - jinak by ji
              klient dostal pokazde, co nekdo stav prehodi tam a zpatky. Tohle
              je cesta, jak ji poslat znovu (zadani 11. 9. 2026). */}
          <PoslatZnovu caflouProjectId={caflouProjectId} stav={values.statusName} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Herci</span>
          <VyberHercu
            herci={herci}
            hodnoty={values.actorUserIds}
            onZmena={(ids) => set('actorUserIds', ids)}
            puvodniText={herecZCaflou}
            dotoceni={dotoceni}
            onPrepnoutDotoceno={(id, stav) => void prepniDotoceno(id, stav)}
            dotoceniBezi={dotoceniBezi}
          />
          <span className="text-xs text-muted font-body">
            Herců může být víc. Podle Herce 1 se předvyplňuje natáčecí frekvence, pořadí se mění
            šipkou.
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Firma</span>
          <select
            value={values.companyId}
            onChange={(e) => set('companyId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {firmy.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted font-body">Pro koho se projekt dělá.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Klient</span>
          <select
            value={values.klientUserId}
            onChange={(e) => set('klientUserId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {/* Nahore lide z vybrane firmy, pod nimi zbytek - u koprodukci
                sedi u projektu clovek odjinud, takze se nabidka neomezuje. */}
            {values.companyId && klienti.some((k) => k.companyId === values.companyId) && (
              <optgroup label="Z vybrané firmy">
                {klienti
                  .filter((k) => k.companyId === values.companyId)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="Ostatní">
              {klienti
                .filter((k) => !values.companyId || k.companyId !== values.companyId)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
            </optgroup>
          </select>
          <span className="text-xs text-muted font-body">
            {klientNameZCaflou
              ? `Na tuhle osobu chodí zprávy o projektu. V Caflou tu byl štítek „${klientNameZCaflou}".`
              : 'Na tuhle osobu chodí zprávy o projektu.'}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Manažer projektu</span>
          <select
            value={values.managerUserId}
            onChange={(e) => set('managerUserId', e.target.value)}
            className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
          >
            <option value="">— nevybráno —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-body text-ink">Priorita</span>
          <OdznakSelect
            hodnota={values.priority}
            onZmena={(v) => set('priority', v)}
            trida={PRIORITY_CLASSES[values.priority as keyof typeof PRIORITY_CLASSES] ?? TRIDA_PRAZDNEHO}
            prazdnyPopisek="— bez priority —"
            moznosti={PRIORITY_OPTIONS.map((p) => ({ hodnota: p, popisek: PRIORITY_LABELS[p] }))}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-body text-ink">Typ projektu</span>
          {/* Typ nese svou ikonu z Ceniku - stejne jako pred nazvem projektu
              v prehledu (zadani 10. 9. 2026). */}
          <OdznakSelect
            hodnota={values.projectType}
            onZmena={(v) => set('projectType', v)}
            trida={values.projectType ? TRIDA_TYPU : TRIDA_PRAZDNEHO}
            moznosti={[
              // Ulozeny typ, ktery uz v ceniku neni (vyrazena polozka), at se
              // pri ulozeni nezmeni na "nevybráno".
              ...(values.projectType && !projectTypeOptions.includes(values.projectType)
                ? [{ hodnota: values.projectType, popisek: `${values.projectType} (mimo ceník)` }]
                : []),
              ...projectTypeOptions.map((t) => ({
                hodnota: t,
                popisek: t,
                obsah: (
                  <>
                    {ikonyTypu[t] && <KresbaIkony klic={ikonyTypu[t]} velikost={14} />}
                    {t}
                  </>
                ),
              })),
            ]}
          />
          <span className="text-xs text-muted font-body">
            {projectTypeOptions.length > 0
              ? 'Nabídka se bere z Ceníků v administraci.'
              : 'Ceník je zatím prázdný — typy projektu se přidávají v administraci v sekci Ceníky.'}
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      {/* Misto tlacitka jen tichy stav - at je videt, ze se to opravdu ulozilo
          (zadani 11. 9. 2026). */}
      <div className="flex items-center gap-2 text-xs font-heading min-h-[20px]">
        {saving ? (
          <span className="text-muted">Ukládám…</span>
        ) : saved ? (
          <span className="text-brand-greenDeep">Uloženo</span>
        ) : (
          <span className="text-muted">Změny se ukládají samy.</span>
        )}
      </div>

      {/* Smazani projektu (zadani 10. 9. 2026). Kdyz na nem neco visi, portal
          nabidne archivaci - viz SmazatSPrekazkami. */}
      <div className="border-t border-line pt-4 flex flex-col gap-3">
        <div>
          <p className="font-heading font-semibold text-sm text-ink m-0">Smazat projekt</p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            Když na projektu nic nevisí, smaže se rovnou. Když visí doklady, portál ukáže co
            a nabídne archivaci — doklady se přitom neruší, jen se od projektu odpojí. Složka na
            Disku zůstane, tu si smažte sami, pokud ji nechcete.
          </p>
        </div>
        <SmazatSPrekazkami
          url={`/api/admin/projekty/${encodeURIComponent(caflouProjectId)}`}
          co="Projekt"
          popisek="Smazat projekt"
          onSmazano={() => {
            router.push('/projekty');
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}


/**
 * „Poslat zprávu znovu" pod stavem projektu (zadání 11. 9. 2026).
 *
 * Zpráva o stavu odchází sama při přehození a pak už NIKDY - o to se stará
 * jednorázová známka v databázi, aby klienta neotravovalo přehazování stavu
 * tam a zpátky. Jenže pak nejde zprávu vyzkoušet ani ji poslat znovu, když
 * spadla do spamu. Tohle tu známku smaže a pošle to znovu; komu a jestli
 * vůbec, o tom pořád rozhoduje nastavení u firmy.
 */
function PoslatZnovu({ caflouProjectId, stav }: { caflouProjectId: string; stav: string }) {
  const [posila, setPosila] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);

  if (!STAVY_S_NOTIFIKACI.includes(stav)) return null;

  async function posli() {
    setPosila(true);
    setHlaska(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/notifikace-znovu`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => null);
      setHlaska((data as { zprava?: string; error?: string })?.zprava || (data as { error?: string })?.error || 'Nepodařilo se to.');
    } catch {
      setHlaska('Nepodařilo se spojit se serverem.');
    } finally {
      setPosila(false);
    }
  }

  return (
    <span className="flex items-center gap-2 flex-wrap">
      <a
        href={`/api/projects/${encodeURIComponent(caflouProjectId)}/notifikace-nahled`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-heading font-semibold text-brand-purple no-underline hover:underline"
      >
        Ukázat, co klientovi dorazí
      </a>
      <span className="text-muted text-xs">·</span>
      <button
        type="button"
        onClick={() => void posli()}
        disabled={posila}
        className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-50"
      >
        {posila ? 'Posílám…' : 'Poslat zprávu ke stavu znovu'}
      </button>
      {hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>}
    </span>
  );
}
