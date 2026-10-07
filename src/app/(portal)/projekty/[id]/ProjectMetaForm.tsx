'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SmazatSPrekazkami } from '@/components/SmazatSPrekazkami';
import type { ProjectPriority } from '@prisma/client';
import { PRIORITY_LABELS, projectTypeLabel } from '@/lib/projectTypes';
import { IkonaPriority, VyberPriority } from '@/components/IkonaPriority';
import { STAVY_PROJEKTU, barvaStavu, nazevStavu, popisStavu, stavyProFirmu } from '@/lib/stavyProjektu';
import type { NahledDotoceni } from '@/lib/dotoceni';
import { stavySNotifikaci } from '@/lib/notifikaceFirmy';
import { KresbaIkony, tridaBarvyIkony } from '@/lib/ikonyTypu';
import { type Herec } from '../VyberHerce';
import { VyberHercu } from '../VyberHercu';
import { TRIDA_BUBLINY_DOTOCENO, TRIDA_BUBLINY_HERCE, TRIDA_SLOUPCE_HERCU } from '@/lib/bublinaHerce';
import { OdznakStrany, posledniStranyHercu } from '../OdznakStrany';
import { OdkazTlacitko } from '@/app/(portal)/components/OdkazTlacitko';
import { OdznakSelect } from '../OdznakSelect';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { UkonceniProjektu } from './UkonceniProjektu';
import { formatDatum, prelozitKolem, type Jazyk } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '../../components/JazykProvider';

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

function OdznakStavu({ stav, jazyk }: { stav: string; jazyk: Jazyk }) {
  if (!stav) return <span className="text-sm font-heading text-muted">—</span>;
  return <span className={`${TRIDA_ODZNAKU} ${barvaStavu(stav)}`}>{nazevStavu(stav, jazyk)}</span>;
}

/**
 * Priorita v nahledu karty - JEN KRESBA, bez slova (upresneni 18. 9. 2026:
 * „v nahledu nejde zmenit a objevuji se tam slova. V detailu to musi byt
 * graficky stejne").
 *
 * Slovo vedle ikony delalo z jedne informace dve a v prehledu projektu zadne
 * neni - karta pak vypadala jako jina aplikace. Cele slovo zustava v bublinove
 * napovede, takze se nic neztratilo.
 */
function OdznakPriority({ priorita }: { priorita: string }) {
  const klic = priorita as keyof typeof PRIORITY_LABELS;
  if (!priorita || !PRIORITY_LABELS[klic]) {
    return <span className="text-sm font-heading text-muted">—</span>;
  }
  return <IkonaPriority priorita={klic as ProjectPriority} velikost={18} />;
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
  /**
   * DVE DATA V DETAILU (zadani 17. 9. 2026: „potrebuju mit v detailu projektu
   * zobrazena obe data. Dokonceni i vydani").
   *
   * Do ted byla jen v prehledu projektu jako sloupce, takze kdo mel projekt
   * otevreny, musel se pro ne vracet do seznamu. Drzi se jako "RRRR-MM-DD" -
   * tentyz tvar, jaky posila <DatumPole> i cte /api/projects/[id]/meta.
   */
  endDate: string;
  releaseDate: string;
  /**
   * NORMOSTRANY PROJEKTU (zadání 29. 9. 2026: „potřeboval bych u projektů
   * upravovat počty NS"). Text, ne číslo - do políčka se píše a prázdno musí
   * jít odlišit od nuly.
   */
  pageCount: string;
  /**
   * ÚČEL A ÚZEMÍ UŽITÍ LICENCE (zadání 17. 9. 2026: „užití licence bych ještě
   * dal jako atribut v detailu projektu a na smlouvu by se taky předvyplnil").
   * Je to údaj projektu - do každé smlouvy na ten spot se píše stejný.
   */
  licenceUziti: string;
  /**
   * DRUHY LICENCE (zadání 18. 9. 2026: „potřebuju mít možnost zaškrtnout
   * v detailu projektu někde licenci... mělo by jít přidat i víc druhů té
   * licence k jednomu projektu"). Drží se ID z číselníku, ne názvy -
   * přejmenování druhu se pak propíše samo.
   */
  licenceIds: string[];
  /** Úvod a závěr audioknihy (zadání 22. 9. 2026) - přijde z objednávky. */
  uvodKnihy: string;
  zaverKnihy: string;
};

/**
 * „2026-09-17" na „17. 9. 2026", anglicky na „17/09/2026" (pravidlo 3
 * v docs/preklad-portalu.md - britsky, ne americky). Bez Date - datum je den,
 * ne okamzik v pasmu, takze se nesmi hnat pres casove pasmo.
 */
function datumTextem(iso: string, jazyk: Jazyk): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return '—';
  if (jazyk === 'en') return `${m[3]}/${m[2]}/${m[1]}`;
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
}

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
  jeReklamniFirma,
  rodnyListTypy,
  ikonyTypu,
  druhyLicence,
  initial,
  dotoceniHercu,
  normostranyHercu,
  natoceniZaznamy,
  smiNaKartuFirmy = false,
  vidiKlienta,
  nabizetUvodZaver = false,
  firmaDelaReklamy = false,
  typAudioknihy = null,
  ukonceny,
  dnuDoOprav,
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
  /**
   * Dela firma jen reklamy? (zadani 14. 9. 2026: „budeme se ridit
   * zaskrtavacim polem v detailu firmy"). Podle toho chodi klientovi zpravy
   * podle reklamnich vzoru, a to jen ve stavu „Dokonceno - ke schvaleni".
   */
  jeReklamniFirma: boolean;
  /**
   * Typy projektu, u kterych se dela Rodny list - tedy REKLAMY (radiove
   * spoty). Rozhoduje TYP PROJEKTU, ne firma: reklamni agentura si u nas
   * muze nechat natocit i neco jineho.
   *
   * K cemu to tady je: u reklamy se neptame na datum vydani (zadani
   * 17. 9. 2026: „bacha u reklam jen datum dokonceni"). Seznam jde az sem,
   * aby se policko schovalo hned po prepnuti typu v nabidce - ne teprve po
   * ulozeni a nacteni stranky.
   */
  rodnyListTypy: string[];
  /** Ikony k typum projektu z Ceniku (zadani 10. 9. 2026). */
  ikonyTypu: Record<string, string>;
  /** Číselník druhů licence z Ceníků - nabízené i ty, co projekt už má. */
  druhyLicence: { id: string; nazev: string; ikona: string | null }[];
  initial: Initial;
  /** Kdo z herců má dotočeno - ID účtu -> datum (zadání 11. 9. 2026). */
  dotoceniHercu: Record<string, string>;
  /** Normostrany jednotlivých herců (23. 9. 2026) - ID účtu -> NS. */
  normostranyHercu: Record<string, number>;
  /** Je projekt ukončený? (zadání 16. 9. 2026 - viz UkonceniProjektu.) */
  ukonceny: boolean;
  /**
   * Za kolik dní se stav sám překlopí na „Čekáme na opravy" (zadání
   * 16. 9. 2026: „bylo by dobré tam mít o tom nějaký údaj, za kolik dní se to
   * překlopí"). `null` = projekt v tom stavu není nebo to nejde spočítat.
   */
  dnuDoOprav: number | null;
  /**
   * Zvukař klienta u projektu nevidí (zadání 13. 9. 2026) - viz
   * canViewProjectBusinessInfo. Firma zůstává: podle ní pozná, čí nahrávku
   * má na stole.
   */
  vidiKlienta: boolean;
  /**
   * Úvod a závěr audioknihy (22. 9. 2026) - pole se ukáže u firmy, která je
   * objednává (Audiotéka), nebo když už je text vyplněný.
   */
  nabizetUvodZaver?: boolean;
  /** Firma dělá reklamy (i když třeba i audioknihy) - 22. 9. 2026. */
  firmaDelaReklamy?: boolean;
  /** Název typu projektu „audiokniha" z Ceníků. */
  typAudioknihy?: string | null;
  /**
   * Natáčecí protokol — jeden záznam na každý zápis Bruna z chatu, od
   * nejnovějšího. Celý se vypisuje ve vlastní záložce (ProtokolNataceni);
   * tady z něj formulář bere jen poslední stranu pro odznak u herce (zadání
   * 13. 9. 2026: „nechme i v detailu u toho herce jen odznak"). `userId`
   * chybí, když se ve zprávě nevyjasnilo, o kterého herce jde.
   */
  natoceniZaznamy?: { id: string; strana: number; kdy: string; userId: string | null; jmeno: string | null }[];
  /**
   * SMÍ SE Z NÁZVU FIRMY PROKLIKNOUT NA JEJÍ KARTU? (připomínka Báry
   * Šíblové 7. 10. 2026: „Když např. otevřu projekt, tak se nemůžu přes
   * název firmy prokliknout na kartu firmy. Musím jít přes firmy v liště.")
   * Komu by karta stejně neotevřela (zvukaři), tomu zůstane jen název -
   * odkaz končící přesměrováním je horší než žádný.
   */
  smiNaKartuFirmy?: boolean;
}) {
  const router = useRouter();
  const jazyk = useJazyk();
  const t = usePreklad();
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
  /**
   * NORMOSTRANY JEDNOTLIVÝCH HERCŮ (zadání 23. 9. 2026). Ukládá se hned při
   * vyplnění, stejně jako dotočeno - je to číslo pro plánování frekvencí.
   */
  const [normostrany, setNormostrany] = useState<Record<string, number>>(normostranyHercu);

  async function ulozNormostrany(userId: string, pageCount: number | null) {
    setError(null);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/herci-normostrany`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pageCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string })?.error || t('projektMeta.chybaNormostrany'));
        return;
      }
      setNormostrany((soucasne) => {
        const dalsi = { ...soucasne };
        if (pageCount && pageCount > 0) dalsi[userId] = pageCount;
        else delete dalsi[userId];
        return dalsi;
      });
      // Podle nich se předvyplňuje nabídka termínů - ať tam sedí hned.
      router.refresh();
    } catch {
      setError(t('projektMeta.chybaNormostrany'));
    }
  }

  /**
   * Poslední strana pro každého herce — do odznaku na bublině. Nepatří do
   * stavu: protokol vede Bruno na serveru, formulář ho nijak nemění, takže
   * se jen přepočítá z toho, co přišlo v props.
   */
  const strany = posledniStranyHercu(natoceniZaznamy);
  const [dotoceniBezi, setDotoceniBezi] = useState<string | null>(null);
  /**
   * CO SE STANE, NEŽ SE KLIKNE (zadání 30. 9. 2026: „dal bych tam pojistku,
   * aby když kliknu na dotočeno s hercem, aby se to ještě zeptalo a ukázalo,
   * co se stane — na koho jde notifikace").
   *
   * Jen se ptá; nic se tím nemění. Když se to nepodaří, vrátí se `null`
   * a okno se zeptá i tak - jen bez výčtu.
   */
  async function nahledDotoceni(userId: string) {
    try {
      const res = await fetch(
        `/api/projekty/${encodeURIComponent(caflouProjectId)}/herci-dotoceno/nahled?userId=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) return null;
      return (await res.json()) as NahledDotoceni;
    } catch {
      return null;
    }
  }

  /** Vysledek tlacitka „Poslat klientovi" - kratka hlaska pod vyberem hercu. */
  const [zpravaKlientovi, setZpravaKlientovi] = useState<string | null>(null);

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
        setError((data as { error?: string })?.error || t('projektMeta.chybaUlozit'));
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
      setError(t('projektMeta.chybaUlozit'));
    } finally {
      setDotoceniBezi(null);
    }
  }

  /**
   * Poslat klientovi znovu zprávu o dotočení (zadání 16. 9. 2026: „a můžeme
   * teď poslat Radce zpětně info o tom, že je dotočeno s Lubošem Ondráčkem?").
   *
   * Nic se tím nepřepisuje — jen odejde mail a zvoneček. Viz
   * /api/projekty/[id]/herci-dotoceno/klientovi.
   */
  async function poslatKlientovi(userId: string) {
    setDotoceniBezi(userId);
    setError(null);
    setZpravaKlientovi(null);
    try {
      const res = await fetch(
        `/api/projekty/${encodeURIComponent(caflouProjectId)}/herci-dotoceno/klientovi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string })?.error || t('projektMeta.chybaZprava'));
        return;
      }
      setZpravaKlientovi((data as { zprava?: string })?.zprava ?? t('projektMeta.odeslano'));
    } catch {
      setError(t('projektMeta.chybaZprava'));
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
          setError((odpoved as { error?: string })?.error || t('projektMeta.chybaUlozeni'));
          setSaved(false);
          return;
        }
        setSaved(true);
        // Zbytek stranky (odznak stavu v hlavicce, zalozky, rodny list) se
        // sklada na serveru - bez tohohle by ukazoval starou hodnotu.
        router.refresh();
      } catch {
        if (moje === poradiRef.current) {
          setError(t('projektMeta.chybaUlozeni'));
          setSaved(false);
        }
      } finally {
        if (moje === poradiRef.current) setSaving(false);
      }
    },
    [caflouProjectId, router, t],
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

  /**
   * Je to reklama? Pak se datum vydání neptáme ani neukazujeme (zadání
   * 17. 9. 2026). Spot se vyrobí a odevzdá; „vydání" je pojem z audioknihy.
   *
   * Bere se to z toho, co je zrovna vybrané v nabídce, ne z uloženého typu -
   * jinak by políčko po přepnutí typu zmizelo až po uložení.
   */
  const jeReklama = rodnyListTypy.includes(values.projectType);

  /** Datum vydání zvukaři ne (zadání 13. 9. 2026) - stejně jako v přehledu. */
  /**
   * DATUM VYDÁNÍ U REKLAMY VŮBEC (22. 9. 2026: „datum vydání u projektu typu
   * reklama vůbec nemusí být"). Nejen rádiový spot - reklama je i projekt
   * reklamní firmy, a u firmy, která dělá obojí, každý typ kromě audioknihy.
   */
  /**
   * JE TENHLE PROJEKT REKLAMA? Jedna odpověď pro celý formulář (30. 9. 2026:
   * „u reklam nemáme vůbec vidět stav Čekáme na opravy... Ani Natáčíme/
   * stříháme, Dotočeno, Dotočeno-stříháme").
   *
   * Do teď se to počítalo zvlášť pro datum vydání a zvlášť pro nabídku stavů,
   * a ta druhá znala jen užší pravidlo - u klienta, který dělá reklamy
   * i audioknihy, se proto u spotu nabízely audioknižní stavy. Výpočet je
   * schválně stejný jako na serveru (lib/reklamniProjekt.ts), jen ze zdrojů,
   * které formulář má po ruce.
   */
  const jeReklamniProjekt =
    jeReklama ||
    jeReklamniFirma ||
    Boolean(firmaDelaReklamy && typAudioknihy && values.projectType && values.projectType !== typAudioknihy);
  const bezDataVydani = jeReklamniProjekt;
  const vidiDatumVydani = vidiKlienta && !bezDataVydani;

  /**
   * NORMOSTRANY U HERCŮ JEN U AUDIOKNIHY (zadání 26. 9. 2026: „tady u reklam
   * nemají být vůbec. NS"). Reklama se nepočítá na strany textu - políčko
   * u každého jména jen zabíralo místo. Stejná podmínka jako u data vydání:
   * nejde jen o rádiový spot, ale o reklamu vůbec.
   */
  const bezNormostran = bezDataVydani;

  /**
   * Nápověda pod výběrem herců má uprostřed tučný „počet normostran".
   * Rozdělí se až z přeložené věty (prelozitKolem), takže v angličtině může
   * tučná část stát ve větě jinde než v češtině.
   */
  const [napovedaHerciPred, napovedaHerciPo] = prelozitKolem(
    jazyk,
    'projektMeta.herciNapovedaKniha',
    'ns',
  );

  if (!canEdit) {
    return (
      // Stejne rozdeleni do karet jako editacni podoba (zadani 13. 9. 2026),
      // at Prehled vypada stejne bez ohledu na to, kdo se diva. Zvukar tu
      // navic nevidi klienta - viz canViewProjectBusinessInfo.
      <div className="flex flex-col gap-6">
        <Karta nadpis={t('projektMeta.kartaVyroba')}>
          {/* Odznak „Jen ke cteni" stoji u prvni karty, ne u kazde -
              ctyrikrat pod sebou by z nej byla tapeta. */}
          <span className="text-xs font-heading text-muted bg-field border border-line rounded-pill px-3 py-1 self-start -mt-2">
            {t('projektMeta.jenKeCteni')}
          </span>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 m-0">
            {/* Data nahore, stejne jako v editacni podobe (zadani 17. 9. 2026). */}
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.datumDokonceni')}
              </dt>
              <dd className="text-sm font-heading text-ink m-0 mt-1 tabular-nums">
                {datumTextem(values.endDate, jazyk)}
              </dd>
            </div>
            {vidiDatumVydani ? (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                  {t('projektMeta.datumVydani')}
                </dt>
                <dd className="text-sm font-heading text-ink m-0 mt-1 tabular-nums">
                  {datumTextem(values.releaseDate, jazyk)}
                </dd>
              </div>
            ) : (
              <span aria-hidden />
            )}
            {!bezNormostran && (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                  {t('projektMeta.normostrany')}
                </dt>
                <dd className="text-sm font-heading text-ink m-0 mt-1 tabular-nums">
                  {values.pageCount || '—'}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.stavProjektu')}
              </dt>
              <dd className="m-0 mt-1">
                <OdznakStavu stav={values.statusName} jazyk={jazyk} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {values.actorUserIds.length > 1 ? t('projektMeta.herci') : t('projektMeta.herec')}
              </dt>
              <dd className="text-sm font-heading text-ink m-0 mt-1">
                {values.actorUserIds.length > 0 ? (
                  <span className={TRIDA_SLOUPCE_HERCU}>
                    {values.actorUserIds.map((id) => {
                      const jmeno = herci.find((h) => h.id === id)?.label;
                      if (!jmeno) return null;
                      // Stejna bublina jako v prehledu projektu - na obou
                      // mistech ma herec vypadat stejne. Dotoceno rika zelena
                      // linka kolem bubliny; datum odskrtnuti se doctete
                      // v bublinkove napovede, at nezabira misto.
                      const kdy = dotoceni[id];
                      const strana = strany[id];
                      return (
                        // relative: odznak se stranou sedi na rohu bubliny
                        // (zadani 13. 9. 2026). Obalka musi bublinu presne
                        // obepinat - odznak se kotvi k JEJIMU okraji, takze
                        // padding by ho odsunul mimo roh. Misto na preteceni
                        // proto delaji MARGINY, ne padding.
                        <span key={id} className="relative inline-flex mt-2 mr-2">
                          <span
                            title={
                              kdy
                                ? t('projektMeta.dotocenoKdy', {
                                    datum: formatDatum(jazyk, new Date(kdy)),
                                  })
                                : undefined
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-heading font-semibold ${
                              kdy ? `whitespace-nowrap ${TRIDA_BUBLINY_DOTOCENO}` : `whitespace-nowrap ${TRIDA_BUBLINY_HERCE}`
                            }`}
                          >
                            {jmeno}
                            {kdy && <span className="sr-only">{t('projektMeta.dotocenoSr')}</span>}
                          </span>
                          {/* Misto celeho protokolu jen posledni strana (zadani
                              13. 9. 2026: „nechme i v detailu u toho herce jen
                              odznak"). Po dotoceni mizi - tam uz strana nic
                              nerika. Cela cesta je v zalozce Natacecí protokol. */}
                          {!kdy && typeof strana === 'number' && (
                            <OdznakStrany strana={strana} jazyk={jazyk} />
                          )}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  (herecZCaflou ?? '—')
                )}
              </dd>
            </div>
          </dl>
        </Karta>

        <Karta nadpis={t('projektMeta.kartaZakazka')}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 m-0">
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.firma')}
              </dt>
              {/* NÁZEV FIRMY VEDE NA JEJÍ KARTU (připomínka 7. 10. 2026) -
                  odtud se chodí pro e-mail, když se poslá doklad a firma
                  ho nemá vyplněný. Bez práva na Firmy zůstane jen text. */}
              <dd className="text-sm font-heading text-ink m-0 mt-1">
                {smiNaKartuFirmy && values.companyId ? (
                  <Link
                    href={`/admin/companies/${encodeURIComponent(values.companyId)}`}
                    title={t('projektMeta.firmaKarta')}
                    className="text-ink no-underline hover:text-brand-purple transition-colors"
                  >
                    {firmy.find((f) => f.id === values.companyId)?.label ?? '—'}
                  </Link>
                ) : (
                  (firmy.find((f) => f.id === values.companyId)?.label ?? '—')
                )}
              </dd>
            </div>
            {vidiKlienta && (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                  {t('projektMeta.klient')}
                </dt>
                <dd className="text-sm font-heading text-ink m-0 mt-1">
                  {klienti.find((k) => k.id === values.klientUserId)?.label ?? klientNameZCaflou ?? '—'}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.manazer')}
              </dt>
              <dd className="text-sm font-heading text-ink m-0 mt-1">{managerLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.priorita')}
              </dt>
              <dd className="m-0 mt-1">
                <OdznakPriority priorita={values.priority} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.typProjektu')}
              </dt>
              <dd className="m-0 mt-1">
                <OdznakTypu
                  typ={projectTypeLabel(values.projectType)}
                  ikona={ikonyTypu[values.projectType] ?? null}
                />
              </dd>
            </div>
            {/* V náhledu platí totéž - u audioknihy se licence neukazují
                (23. 9. 2026). */}
            {jeReklama && values.licenceIds.length > 0 && (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                  {t('projektMeta.licence')}
                </dt>
                <dd className="m-0 mt-1 flex flex-wrap gap-1.5">
                  {druhyLicence
                    .filter((d) => values.licenceIds.includes(d.id))
                    .map((d) => (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-pill border border-line bg-field text-sm font-heading font-semibold text-ink"
                      >
                        <span
                          className={`grid place-items-center w-5 h-5 rounded-full ${tridaBarvyIkony(d.ikona)}`}
                        >
                          {d.ikona ? <KresbaIkony klic={d.ikona} velikost={12} /> : null}
                        </span>
                        {d.nazev}
                      </span>
                    ))}
                </dd>
              </div>
            )}
            {jeReklama && (
              <div>
                <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                  {t('projektMeta.licenceUziti')}
                </dt>
                <dd className="text-sm font-heading text-ink m-0 mt-1">
                  {values.licenceUziti || '—'}
                </dd>
              </div>
            )}
            {!jeReklama && (values.uvodKnihy || values.zaverKnihy) && (
              <>
                <div>
                  <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                    {t('projektMeta.uvodKnihy')}
                  </dt>
                  <dd className="text-sm font-body text-ink m-0 mt-1 whitespace-pre-wrap">{values.uvodKnihy || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                    {t('projektMeta.zaverKnihy')}
                  </dt>
                  <dd className="text-sm font-body text-ink m-0 mt-1 whitespace-pre-wrap">{values.zaverKnihy || '—'}</dd>
                </div>
              </>
            )}
          </dl>
        </Karta>

        <Karta nadpis={t('projektMeta.kartaOdkazy')}>
          <dl className="m-0">
            <div>
              <dt className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('projektMeta.odkazKz')}
              </dt>
              <dd className="text-sm font-heading m-0 mt-1">
                <OdkazTlacitko
                  url={values.driveUrl}
                  popisek={t('projektMeta.odkazOtevritSlozku')}
                  varianta="vedlejsi"
                />
              </dd>
            </div>
          </dl>
        </Karta>
      </div>
    );
  }

  return (
    // KARTY MISTO JEDNE DLOUHE TABULE (zadani 13. 9. 2026: „libi se mi,
    // jak je to rozdeleno na ty bubliny treba v rozpoctu, at je to proste
    // prehlednejsi"). Devet poli pod sebou v jedne karte se cetlo jako
    // seznam bez hierarchie; ted ma kazda skupina vlastni kartu se stejnym
    // vzhledem jako Rozpocet a Vykazy, takze detail projektu drzi jeden styl.
    //
    // PORADI PODLE TOHO, JAK CASTO SE TO OTEVIRA: stav a herci jsou duvod,
    // proc clovek do projektu leze; firma a klient se vyplni jednou; odkazy
    // na Disk jsou az potom. Mazani stoji uplne dole a zvlast.
    <div className="flex flex-col gap-6">
      <Karta nadpis={t('projektMeta.kartaVyroba')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* DVĚ DATA ÚPLNĚ NAHOŘE (zadání 17. 9. 2026: „to datum by mohlo být
              v kartě spíše nahoře"). Termín je to první, na co se člověk
              u projektu ptá - proto stojí nad stavem i herci.
              Vedle sebe, protože se čtou spolu: dokončení je náš termín,
              vydání je termín klienta. U reklamy je jen to první -
              viz vidiDatumVydani. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('projektMeta.datumDokonceni')}</span>
            <DatumPole
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              onBlur={ulozHned}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
            />
            <span className="text-xs text-muted font-body">
              {t('projektMeta.datumDokonceniNapoveda')}
            </span>
          </label>

          {vidiDatumVydani ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('projektMeta.datumVydani')}</span>
              <DatumPole
                value={values.releaseDate}
                onChange={(e) => set('releaseDate', e.target.value)}
                onBlur={ulozHned}
                className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
              />
              <span className="text-xs text-muted font-body">
                {t('projektMeta.datumVydaniNapoveda')}
              </span>
            </label>
          ) : (
            // U reklamy musi druhe misto v radku zustat prazdne - jinak by se
            // stav projektu vysunul nahoru vedle data a rozpadlo by se poradi.
            <span aria-hidden />
          )}

          {/* NORMOSTRANY (zadání 29. 9. 2026: „potřeboval bych u projektů
              upravovat počty NS. Práva pro Žůžo-labůžo a produkci").
              Přicházely z Caflou a z objednávky a jinak s nimi nešlo hnout -
              když klient poslal jiný rozsah, nebylo ho kam zapsat. Právo je
              totéž, co na zbytek téhle karty (canEditProjectMeta), takže
              stačí, že je pole tady.

              U REKLAMY NE - stejně jako normostrany u herců (26. 9. 2026:
              „tady u reklam nemají být vůbec. NS"). */}
          {!bezNormostran && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('projektMeta.normostrany')}</span>
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                inputMode="numeric"
                value={values.pageCount}
                /* Delší prodleva jako u psaného pole - jinak by se každá
                   číslice ukládala zvlášť a „338" by odešlo třikrát. */
                onChange={(e) => set('pageCount', e.target.value, true)}
                onBlur={ulozHned}
                className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm tabular-nums outline-none focus:border-brand-purple"
              />
              <span className="text-xs text-muted font-body">
                {t('projektMeta.normostranyNapoveda')}
              </span>
            </label>
          )}

          {/* Stav a herec se od 10. 9. 2026 prehazuji rucne (odchod z Caflou).
              Ze vsech ovladacu se s nimi pracuje nejcasteji - proto hned pod
              daty a pred kartou Zakazka. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('projektMeta.stavProjektu')}</span>
            {/* Odznak v barve stavu je ZAROVEN ovladac - stejne jako v prehledu
                projektu (zadani 10. 9. 2026). Puvodne tu byl <VyberPole> a pod nim
                jeste odznak s touz hodnotou, coz byla tataz vec dvakrat. */}
            <OdznakSelect
              hodnota={values.statusName}
              onZmena={(v) => set('statusName', v)}
              trida={barvaStavu(values.statusName)}
              titulek={t('projektMeta.stavTitulek')}
              /* Stav se vybírá JEN MYŠÍ (zadání 23. 9. 2026: „když mám
                 rozbalenou nabídku změny stavu, fungujou tam klávesové
                 zkratky a člověk se uklikne a změní stav"). */
              bezKlaves
              moznosti={[
                // Stav prenesen z Caflou, ktery v nasi ceste projektu neni - at
                // se pri ulozeni nezmeni na "nevybráno".
                ...(values.statusName && !STAVY_PROJEKTU.some((st) => st.nazev === values.statusName)
                  ? [
                      {
                        hodnota: values.statusName,
                        popisek: t('projektMeta.staryStavCaflou', { stav: values.statusName }),
                      },
                    ]
                  : []),
                // U reklamy kratší nabídka (zadání 18. 9. 2026, upřesněno
                // 22. a 30. 9. 2026) - „Čekáme na opravy", „Natáčíme/stříháme",
                // „Dotočeno" ani „Dotočeno/stříháme" se u ní nemají objevit.
                // Hodnota je ČESKÝ název - ukládá se do databáze (dávka 7e).
                ...stavyProFirmu(jeReklamniProjekt, values.statusName).map((st) => ({
                  hodnota: st.nazev,
                  popisek: nazevStavu(st.nazev, jazyk),
                })),
              ]}
            />
            <span className="text-xs text-muted font-body">
              {/* Od dávky 7e se popis i název stavu překládají podle KÓDU;
                  do databáze se pořád ukládá český název. */}
              {popisStavu(values.statusName, jazyk) ?? t('projektMeta.stavRucne')}
            </span>
            {/* ODPOČET DO AUTOMATICKÉHO PŘEKLOPENÍ (zadání 16. 9. 2026).
                Ukazuje se jen u uloženého stavu „Dokončeno - ke schválení" -
                jakmile se v nabídce přepne jinam, číslo by už neplatilo. */}
            {dnuDoOprav !== null && !jeReklamniProjekt && values.statusName === initial.statusName && (
              <span className="text-xs font-body text-brand-purple">
                {dnuDoOprav === 0
                  ? t('projektMeta.prekopiDnes', { stav: STAV_CEKAME_NA_OPRAVY })
                  : t(klicOdpoctu(dnuDoOprav), {
                      pocet: dnuDoOprav,
                      stav: STAV_CEKAME_NA_OPRAVY,
                    })}
              </span>
            )}
            {/* Zprava ke kazdemu stavu odejde z projektu jen jednou - jinak by ji
                klient dostal pokazde, co nekdo stav prehodi tam a zpatky. Tohle
                je cesta, jak ji poslat znovu (zadani 11. 9. 2026). */}
            <PoslatZnovu
              caflouProjectId={caflouProjectId}
              stav={values.statusName}
              jeReklama={jeReklamniFirma}
            />
          </div>


          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('projektMeta.herci')}</span>
            <VyberHercu
              herci={herci}
              hodnoty={values.actorUserIds}
              onZmena={(ids) => set('actorUserIds', ids)}
              puvodniText={herecZCaflou}
              dotoceni={dotoceni}
              onPrepnoutDotoceno={(id, stav) => void prepniDotoceno(id, stav)}
              onPoslatKlientovi={(id) => void poslatKlientovi(id)}
              nacistNahledDotoceni={nahledDotoceni}
              dotoceniBezi={dotoceniBezi}
              strany={strany}
              normostrany={normostrany}
              /* NORMOSTRANY JEN U AUDIOKNIH (zadání 26. 9. 2026: „tady
                 u reklam nemají být vůbec. NS"). Reklama se nepočítá na
                 strany textu, takže políčko u každého herce jen zabíralo
                 místo a rozbíjelo řádek. Bez funkce se vůbec nevykreslí. */
              onZmenitNormostrany={
                bezNormostran ? undefined : (id, ns) => void ulozNormostrany(id, ns)
              }
            />
            {zpravaKlientovi && (
              <span className="text-xs font-body text-brand-greenDeep">{zpravaKlientovi}</span>
            )}
            {/* Věta je JEDEN KLÍČ (pravidlo 7): u reklamy jedna varianta,
                u audioknihy druhá s tučným „počtem normostran" uprostřed -
                ten se vyřízne z přeložené věty, ne přilepí k jejím kouskům. */}
            <span className="text-xs text-muted font-body">
              {bezNormostran ? (
                t('projektMeta.herciNapovedaReklama')
              ) : (
                <>
                  {napovedaHerciPred}
                  <strong className="font-heading font-semibold">
                    {t('projektMeta.herciNapovedaNs')}
                  </strong>
                  {napovedaHerciPo}
                </>
              )}
            </span>
          </div>

        </div>
      </Karta>

      <Karta nadpis={t('projektMeta.kartaZakazka')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* ODKAZ NA KARTU FIRMY I VE FORMULÁŘI (připomínka 7. 10. 2026).
              Náhled s pouhým názvem vidí jen ten, kdo projekt upravovat
              nesmí - Žůžo-labůžo má rovnou formulář, takže odkaz patří
              i sem. Stojí POD výběrem, ne místo něj: firma se tu pořád
              přepisuje. Obal je `div`, aby odkaz zůstal ve stejném sloupci
              mřížky jako pole a klik na něj neotevíral výběr. */}
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('projektMeta.firma')}</span>
              <VyberPole
                value={values.companyId}
                onChange={(e) => set('companyId', e.target.value)}
                className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
              >
                <option value="">{t('obecne.nevybrano')}</option>
                {firmy.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </VyberPole>
              <span className="text-xs text-muted font-body">{t('projektMeta.firmaNapoveda')}</span>
            </label>
            {smiNaKartuFirmy && values.companyId ? (
              <Link
                href={`/admin/companies/${encodeURIComponent(values.companyId)}`}
                className="text-xs font-heading text-brand-purple no-underline hover:underline"
              >
                {t('projektMeta.firmaKarta')} →
              </Link>
            ) : null}
          </div>


          {/* Klienta zvukar nevidi ani ve formulari (zadani 13. 9. 2026).
              Dnes je to pojistka - formular se zvukari stejne neotevre
              (canEditProjectMeta ho nepousti) - ale az se prava zmeni,
              nezustane tu dira. */}
          {vidiKlienta && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-body text-ink">{t('projektMeta.klient')}</span>
              <VyberPole
                value={values.klientUserId}
                onChange={(e) => set('klientUserId', e.target.value)}
                className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
              >
                <option value="">{t('obecne.nevybrano')}</option>
                {/* Nahore lide z vybrane firmy, pod nimi zbytek - u koprodukci
                    sedi u projektu clovek odjinud, takze se nabidka neomezuje. */}
                {values.companyId && klienti.some((k) => k.companyId === values.companyId) && (
                  <optgroup label={t('projektMeta.klientZFirmy')}>
                    {klienti
                      .filter((k) => k.companyId === values.companyId)
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label={t('projektMeta.klientOstatni')}>
                  {klienti
                    .filter((k) => !values.companyId || k.companyId !== values.companyId)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                </optgroup>
              </VyberPole>
              <span className="text-xs text-muted font-body">
                {klientNameZCaflou
                  ? t('projektMeta.klientNapovedaCaflou', { stitek: klientNameZCaflou })
                  : t('projektMeta.klientNapoveda')}
              </span>
            </label>
          )}


          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('projektMeta.manazer')}</span>
            <VyberPole
              value={values.managerUserId}
              onChange={(e) => set('managerUserId', e.target.value)}
              className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
            >
              <option value="">{t('obecne.nevybrano')}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </VyberPole>
          </label>


          {/* PRIORITA SE KLIKA, NEVYBIRA (upresneni 18. 9. 2026: „vymysli, jak
              se tam ty carky budou pridavat a ubirat. Delal bych to napr
              klikanim na tu ikonu").

              Je to tataz kresba jako v prehledu projektu i v nahledu karty -
              klepnuti na sloupecek nastavi jeho stupen, klepnuti na uz
              nastaveny stupen prioritu zrusi. Rozbalovatko se slovy tu bylo
              jedine misto v portalu, kde se priorita psala textem. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('projektMeta.priorita')}</span>
            <span className="flex items-center gap-3 h-[34px]">
              <VyberPriority
                priorita={(values.priority || null) as ProjectPriority | null}
                onZmena={(v) => set('priority', v)}
                velikost={22}
              />
              <span className="text-xs font-body text-muted">
                {t('projektMeta.prioritaNapoveda')}
              </span>
            </span>
          </div>


          {/* ÚVOD A ZÁVĚR AUDIOKNIHY (zadání 22. 9. 2026) - přijde z objednávky
              Audiotéky, tady se dá doladit. Čte ho herec na začátku a na konci.

              UKÁZKY V POLÍČKU ZŮSTÁVAJÍ ČESKÉ SCHVÁLNĚ: je to text, který se
              opravdu načte do knihy, a ten je český. Anglická ukázka by radila
              napsat do audioknihy něco, co tam nemá být (pravidlo 4). */}
          {!jeReklama && (nabizetUvodZaver || values.uvodKnihy || values.zaverKnihy) && (
            <>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-body text-ink">{t('projektMeta.uvodKnihy')}</span>
                <textarea
                  value={values.uvodKnihy}
                  onChange={(e) => set('uvodKnihy', e.target.value, true)}
                  onBlur={ulozHned}
                  rows={2}
                  placeholder="Audiotéka uvádí audioknihu …"
                  className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-body text-sm outline-none focus:border-brand-purple resize-y"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-body text-ink">{t('projektMeta.zaverKnihy')}</span>
                <textarea
                  value={values.zaverKnihy}
                  onChange={(e) => set('zaverKnihy', e.target.value, true)}
                  onBlur={ulozHned}
                  rows={3}
                  placeholder="Autor: Název. Připravila Audiotéka … Režie Ondřej Černý. …"
                  className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-body text-sm outline-none focus:border-brand-purple resize-y"
                />
                <span className="text-xs text-muted font-body">
                  {t('projektMeta.zaverNapoveda')}
                </span>
              </label>
            </>
          )}

          {/* UŽITÍ LICENCE jen u reklamy - u audioknihy se licence řeší jinak
              a prázdné pole navíc by v kartě jen překáželo (17. 9. 2026). */}
          {jeReklama && (
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-body text-ink">{t('projektMeta.licenceUziti')}</span>
              <input
                value={values.licenceUziti}
                onChange={(e) => set('licenceUziti', e.target.value, true)}
                onBlur={ulozHned}
                placeholder={t('projektMeta.licenceUzitiPlaceholder')}
                className="rounded-lg border border-line bg-field px-3 py-2.5 text-ink font-heading text-sm outline-none focus:border-brand-purple"
              />
              <span className="text-xs text-muted font-body">
                {t('projektMeta.licenceUzitiNapoveda')}
              </span>
            </label>
          )}

          {/* DRUHY LICENCE (zadání 18. 9. 2026). Zaškrtávátka, ne výběr:
              spot běží klidně v TV i online a číselník je krátký, takže se
              všechny druhy vejdou na obrazovku najednou.

              JEN U REKLAMY (zadání 23. 9. 2026: „licence by se měly zobrazit
              jen u reklam, ne u audioknih") - u audioknihy se licence řeší
              jinak a zaškrtávátka by tam jen překážela, stejně jako pole
              Účel a území užití licence nad tím. */}
          {jeReklama && druhyLicence.length > 0 && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-body text-ink">{t('projektMeta.licence')}</span>
              <div className="flex flex-wrap gap-2">
                {druhyLicence.map((d) => {
                  const zaskrtnuto = values.licenceIds.includes(d.id);
                  return (
                    /* ZAŠKRTNUTÁ SE POZNÁ NA PRVNÍ POHLED (zadání 18. 9. 2026:
                       „udělej jednoznačný mnohonásobný výběr, ať tam není vidět
                       licence, která není použita"). Nepoužitá je proto celá
                       bledá - prázdné okénko, šedá ikona, tenký rámeček; jen
                       zaškrtnutá má fajfku, barvu i plnou ikonu. */
                    <button
                      key={d.id}
                      type="button"
                      role="checkbox"
                      aria-checked={zaskrtnuto}
                      onClick={() =>
                        set(
                          'licenceIds',
                          zaskrtnuto
                            ? values.licenceIds.filter((id) => id !== d.id)
                            : [...values.licenceIds, d.id],
                        )
                      }
                      className={`inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-pill border text-sm font-heading font-semibold transition-colors ${
                        zaskrtnuto
                          ? 'border-brand-purple bg-brand-purple/10 text-brand-purpleDeep dark:text-brand-purpleLight'
                          : 'border-dashed border-line bg-transparent text-muted opacity-70 hover:opacity-100 hover:text-ink'
                      }`}
                    >
                      {/* Okénko jako u zaškrtávátka - prázdné vedle vybraného
                          je vidět i koutkem oka. */}
                      <span
                        className={`grid place-items-center w-4 h-4 rounded-[5px] border transition-colors ${
                          zaskrtnuto
                            ? 'bg-brand-purple border-brand-purple text-white'
                            : 'border-line bg-field'
                        }`}
                      >
                        {zaskrtnuto && (
                          <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5l4.5 4.5L19 7" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`grid place-items-center w-6 h-6 rounded-full ${
                          zaskrtnuto ? tridaBarvyIkony(d.ikona) : 'bg-field text-muted'
                        }`}
                      >
                        {d.ikona ? <KresbaIkony klic={d.ikona} velikost={14} /> : null}
                      </span>
                      {d.nazev}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-muted font-body">
                {t('projektMeta.licenceNapoveda')}
              </span>
            </div>
          )}

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('projektMeta.typProjektu')}</span>
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
                  ? [
                      {
                        hodnota: values.projectType,
                        popisek: t('projektMeta.typMimoCenik', { typ: values.projectType }),
                      },
                    ]
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
                ? t('projektMeta.typZCeniku')
                : t('projektMeta.typCenikPrazdny')}
            </span>
          </label>
        </div>
      </Karta>

      <Karta nadpis={t('projektMeta.kartaOdkazy')}>
          {/* Odkaz na KZ: jen tlacitka, samotna adresa se neukazuje (zadani
              10. 9. 2026 - "nechci, at je videt ten dlouhy odkaz"). Policko na
              rucni zadani se rozbali az na vyzadani; potreba je hlavne tehdy,
              kdyz se slozka nezalozila sama. */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('projektMeta.odkazKz')}</span>
            {/* Odkazy pod sebou, kopirovani jen jako ikona na konci radku
                (zadani 10. 9. 2026). Vedle sebe stalo v rade ctvero popsanych
                tlacitek - otevrit, kopirovat, otevrit, kopirovat - a nebylo
                poznat, co k cemu patri. */}
            <span className="flex flex-col items-start gap-2">
              <OdkazTlacitko
                url={values.driveUrl}
                popisek={t('projektMeta.odkazSlozkaProjektu')}
                varianta="radek"
              />
              {companyDriveFolderUrl && (
                <OdkazTlacitko
                  url={companyDriveFolderUrl}
                  popisek={t('projektMeta.odkazSlozkaFirmy')}
                  varianta="radek"
                />
              )}
              <button
                type="button"
                onClick={() => setUpravitOdkaz((v) => !v)}
                className="text-xs font-heading font-semibold text-brand-purple hover:underline mt-0.5"
              >
                {upravitOdkaz
                  ? t('obecne.skryt')
                  : values.driveUrl
                    ? t('projektMeta.odkazZmenit')
                    : t('projektMeta.odkazZadat')}
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
            <span className="text-xs text-muted font-body">{t('projektMeta.odkazNapoveda')}</span>
          </div>

      </Karta>

      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{error}</p>}

      {/* Misto tlacitka jen tichy stav - at je videt, ze se to opravdu ulozilo
          (zadani 11. 9. 2026). */}
      <div className="flex items-center gap-2 text-xs font-heading min-h-[20px]">
        {saving ? (
          <span className="text-muted">{t('obecne.ukladam')}</span>
        ) : saved ? (
          <span className="text-brand-greenDeep">{t('projektMeta.ulozeno')}</span>
        ) : (
          <span className="text-muted">{t('projektMeta.ukladaSeSamo')}</span>
        )}
      </div>

      {/* UKONČENÍ PROJEKTU (zadání 16. 9. 2026). Vlastní karta hned nad
          mazáním: je to taky rozhodnutí o celém projektu, ne políčko, které
          se ukládá samo. Na rozdíl od mazání je vratné. */}
      {canEdit && (
        <Karta>
          <UkonceniProjektu caflouProjectId={caflouProjectId} ukonceny={ukonceny} />
        </Karta>
      )}

      {/* Mazani ma vlastni kartu, ne patu formulare: je to jedina
          nevratna vec na cele strance a nema splyvat s poli, ktera se
          ukladaji sama. */}
      <Karta>
      {/* Smazani projektu (zadani 10. 9. 2026). Kdyz na nem neco visi, portal
          nabidne archivaci - viz SmazatSPrekazkami. */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-heading font-semibold text-sm text-ink m-0">
            {t('projektMeta.smazatProjekt')}
          </p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {t('projektMeta.smazatNapoveda')}
          </p>
        </div>
        <SmazatSPrekazkami
          url={`/api/admin/projekty/${encodeURIComponent(caflouProjectId)}`}
          co={t('projektMeta.smazatCo')}
          popisek={t('projektMeta.smazatProjekt')}
          onSmazano={() => {
            router.push('/projekty');
            router.refresh();
          }}
        />
      </div>
      </Karta>
    </div>
  );
}


/**
 * Jedna karta detailu projektu (zadání 13. 9. 2026: „líbí se mi, jak je to
 * rozdělené na ty bubliny třeba v rozpočtu").
 *
 * Vzhled je schválně TENTÝŽ řetězec tříd, jaký má Rozpočet, Výkazy i Doklady.
 * Kdyby si každá obrazovka psala svoji kartu, po první úpravě by se rozešly
 * a detail projektu by přestal vypadat jako jedna věc.
 *
 * Nadpis je nepovinný — karta bez něj se hodí tam, kde si obsah nadpis nese
 * sám (mazání projektu).
 */
function Karta({ nadpis, children }: { nadpis?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-line shadow-sm p-6 flex flex-col gap-5">
      {nadpis && (
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {nadpis}
        </h2>
      )}
      {children}
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
function PoslatZnovu({
  caflouProjectId,
  stav,
  jeReklama,
}: {
  caflouProjectId: string;
  stav: string;
  jeReklama: boolean;
}) {
  const t = usePreklad();
  const [posila, setPosila] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  // Veta navic nad textem ze vzoru - typicky omluva, kdyz predchozi zprava
  // dorazila rozbita (zadani 11. 9. 2026). Vzor se tim nemeni.
  const [uvod, setUvod] = useState('');
  const [pisu, setPisu] = useState(false);

  // U reklamy odchazi jedina zprava, a to ve stavu „Dokonceno - ke schvaleni"
  // (zadani 14. 9. 2026) - v jinem stavu nemá co nabizet.
  if (!stavySNotifikaci(jeReklama ? 'REKLAMA' : 'AUDIOKNIHA').includes(stav)) return null;

  async function posli() {
    setPosila(true);
    setHlaska(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(caflouProjectId)}/notifikace-znovu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uvod: uvod.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      setHlaska(
        (data as { zprava?: string; error?: string })?.zprava ||
          (data as { error?: string })?.error ||
          t('projektMeta.nepovedloSe'),
      );
    } catch {
      setHlaska(t('projektMeta.spojeniSelhalo'));
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
        {t('projektMeta.ukazatKlientovi')}
      </a>
      <span className="text-muted text-xs">·</span>
      <button
        type="button"
        onClick={() => void posli()}
        disabled={posila}
        className="text-xs font-heading font-semibold text-brand-purple hover:underline disabled:opacity-50"
      >
        {posila ? t('projektMeta.posilam') : t('projektMeta.poslatZnovu')}
      </button>
      <span className="text-muted text-xs">·</span>
      <button
        type="button"
        onClick={() => setPisu((p) => !p)}
        className="text-xs font-heading font-semibold text-brand-purple hover:underline"
      >
        {pisu ? t('projektMeta.vetuZrusit') : t('projektMeta.vetuPridat')}
      </button>
      {hlaska && <span className="text-xs font-body text-muted">{hlaska}</span>}
      {pisu && (
        <textarea
          value={uvod}
          onChange={(e) => setUvod(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={t('projektMeta.vetaPlaceholder')}
          className="w-full mt-1 rounded-lg border border-line bg-field text-ink text-xs font-body p-2.5 resize-y"
        />
      )}
    </span>
  );
}

/**
 * Klíč celé věty o odpočtu podle počtu dní - „1 den", „3 dny", „7 dnů".
 *
 * Věta se neskládá z kousků (pravidlo 7 v docs/preklad-portalu.md): čeština
 * má tři tvary, angličtina dva, takže každý tvar je vlastní klíč a vybírá se
 * podle čísla. Skládáním „Za " + číslo + „ dny" by anglická věta stát nešla.
 */
function klicOdpoctu(pocet: number): string {
  if (pocet === 1) return 'projektMeta.prekopiZaDen';
  if (pocet >= 2 && pocet <= 4) return 'projektMeta.prekopiZaDny';
  return 'projektMeta.prekopiZaDnu';
}

/**
 * Stav, do kterého se projekt překlopí sám. Zůstává český: stavy se ukládají
 * do databáze česky a zatím se nepřekládají (viz dávka 5 a 7e).
 */
const STAV_CEKAME_NA_OPRAVY = 'Čekáme na opravy';
