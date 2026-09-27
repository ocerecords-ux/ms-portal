'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency, OfferStatus } from '@prisma/client';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import { VyberFirmy, type FirmaVolba } from '../../VyberFirmy';
import { NahledDokladu } from '../../NahledDokladu';
import { SlevaPole } from '../../SlevaPole';
import {
  CURRENCIES,
  CURRENCY_LABELS,
  nazevMeny,
  computeTotals,
  formatMoney,
  minorToInput,
  parseMoneyToMinor,
  OFFER_STATUS_CLASSES,
  formatAddress,
} from '@/lib/doklady';
import { formatDatumCas, prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { DatumPole } from '@/components/DatumPole';
import { VyberPole } from '@/components/VyberPole';

type Item = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  vatRate: number;
};

type Party = {
  name: string;
  ic?: string | null;
  dic?: string | null;
  vatPayer?: boolean;
  contactEmail?: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
};

type Offer = {
  id: string;
  number: string;
  status: OfferStatus;
  issuerCompanyId: string;
  companyId: string;
  currency: Currency;
  issueDate: string;
  validUntil: string;
  subject: string;
  note: string;
  approvalToken: string;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  caflouProjectId: string;
  projectName: string | null;
  jazyk: 'CS' | 'EN';
  /** Sleva na dokladu (zadání 14. 9. 2026). */
  slevaProcent: number;
  slevaMinor: number;
  slevaPopis: string | null;
  /**
   * Faktury vystavené z téhle nabídky (zadání 15. 9. 2026: „když bude nabídka
   * na nějakou cenu a my to pak částečně vyfakturujeme"). Můžou být dvě i víc
   * - portál k nim dopočítá, kolik z nabídky zbývá.
   */
  faktury: { id: string; number: string; status: string; celkemMinor: number }[];
  items: Item[];
};

const VAT_RATES = [21, 12, 0];

function emptyItem(): Item {
  return { description: '', quantity: 1, unit: 'ks', unitPriceMinor: 0, vatRate: 21 };
}

/**
 * Stav nabidky ve slovniku (davka 4). OFFER_STATUS_LABELS z lib/doklady je
 * jen cesky - klice necha stav prelozit i v anglicke verzi portalu.
 */
const KLICE_STAVU: Record<string, string> = {
  DRAFT: 'nabidka.stav.rozpracovana',
  SENT: 'nabidka.stav.odeslana',
  APPROVED: 'nabidka.stav.schvalena',
  REJECTED: 'nabidka.stav.odmitnuta',
};

/**
 * Editor nabídky. Vypadá jako samotný doklad — hlavička s oběma firmami,
 * pod ní položky a součet — a edituje se v něm přímo, aby bylo pořád vidět,
 * co klient dostane (zadani 8. 9. 2026: "ať je vše přehledné a intuitivní").
 */
export function OfferEditor({
  offer,
  issuer,
  company,
  issuers,
  companies,
  bankAccounts,
  projects,
  klientiProjektu,
  herciProjektu = {},
}: {
  offer: Offer;
  issuer: Party;
  company: Party;
  issuers: { id: string; name: string }[];
  companies: FirmaVolba[];
  bankAccounts: { label: string; accountNumber: string | null; iban: string | null }[];
  projects: ProjectChoice[];
  /**
   * Klient vedený u projektu (ID projektu -> jméno a e-mail). Podle něj se
   * pozná, komu nabídka poletí - zadání 17. 9. 2026.
   */
  klientiProjektu: Record<string, { jmeno: string | null; email: string }>;
  /** Herci projektu (ID projektu → jména) pro tlačítko „Přidat herce z projektu". */
  herciProjektu?: Record<string, string[]>;
}) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  const locked = offer.status === 'APPROVED';
  /**
   * Neulozena nabidka - clovek klikl na "Nova nabidka" a rovnou vidi doklad
   * (zadani 10. 9. 2026: "dej pryc ten mezikrok"). Vznikne az tlacitkem
   * Ulozit, takze rozmysleni nenechava v seznamu prazdny doklad ani diru
   * v ciselne rade.
   */
  const jesteNeulozena = offer.id === 'nova';

  const [form, setForm] = useState({
    issuerCompanyId: offer.issuerCompanyId,
    companyId: offer.companyId,
    currency: offer.currency,
    issueDate: offer.issueDate,
    validUntil: offer.validUntil,
    subject: offer.subject,
    note: offer.note,
    caflouProjectId: offer.caflouProjectId,
    jazyk: offer.jazyk,
    // Sleva na celem dokladu (zadani 14. 9. 2026). Jde s formularem, takze
    // se uklada stejnou cestou jako zbytek.
    slevaProcent: offer.slevaProcent ?? 0,
    slevaMinor: offer.slevaMinor ?? 0,
    slevaPopis: offer.slevaPopis ?? '',
  });
  const [items, setItems] = useState<Item[]>(offer.items.length > 0 ? offer.items : [emptyItem()]);
  /**
   * NÁZEV SE BERE Z PROJEKTU (zadání 15. 9. 2026: „když tvořím novou nabídku,
   * mohlo by si to taky brát název nabídky z názvu projektu. Pak chci ale
   * název mít možnost upravit, když třeba budou varianty nabídek").
   *
   * Doplní se jen do PRÁZDNÉHO pole a jen dokud si název nikdo nepřepsal -
   * u druhé varianty nabídky („…varianta B") by ho portál jinak přepsal zpátky.
   */
  const [nazevRucne, setNazevRucne] = useState(Boolean(offer.subject.trim()));

  /**
   * Komu nabídka poletí. Stejné pořadí jako na serveru (lib/prijemceNabidky.ts):
   * klient vyplněný u projektu, a teprve když ho projekt nemá, kontakt firmy.
   * Počítá se ze současného výběru, ať je to vidět hned po přehození projektu.
   */
  const klientProjektu = form.caflouProjectId ? klientiProjektu[form.caflouProjectId] : undefined;
  const prijemce: { jmeno: string | null; email: string; zdroj: 'klient' | 'firma' } | null =
    klientProjektu
      ? { ...klientProjektu, zdroj: 'klient' }
      : company.contactEmail
        ? { jmeno: null, email: company.contactEmail, zdroj: 'firma' }
        : null;
  /**
   * Jméno příjemce je uprostřed věty tučně, takže se věta dělí přes
   * prelozitKolem - viz pravidlo 7 v docs/preklad-portalu.md.
   */
  const posleme = prelozitKolem(jazyk, 'nabidka.posleme', 'prijemce');

  /** Co se posílá do náhledu - jen to, co je na dokumentu vidět. */
  const nahledTelo = {
    druh: 'NABIDKA' as const,
    id: offer.id,
    issuerCompanyId: form.issuerCompanyId,
    companyId: form.companyId,
    currency: form.currency,
    issueDate: form.issueDate,
    validUntil: form.validUntil || null,
    subject: form.subject,
    note: form.note,
    projectName: projects.find((p) => p.id === form.caflouProjectId)?.label ?? offer.projectName ?? null,
    jazyk: form.jazyk === 'EN' ? ('en' as const) : ('cs' as const),
    // Aby sleva byla vidět i v náhledu PDF, ne až po uložení.
    slevaProcent: form.slevaProcent,
    slevaMinor: form.slevaMinor,
    slevaPopis: form.slevaPopis,
    items: items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity) || 0,
      unit: i.unit,
      unitPriceMinor: i.unitPriceMinor,
      vatRate: i.vatRate,
    })),
  };
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /**
   * RUCNI SCHVALENI (zadani 14. 9. 2026: „potrebuji pridat moznost rucne
   * schvalit nabidku"). Nabidky se casto odsouhlasi telefonem nebo mailem
   * a odkaz s tokenem uz nikdo nepouzije - stav pak v portalu visi na
   * „Odeslana", i kdyz je davno domluveno.
   */
  const [schvalovani, setSchvalovani] = useState(false);
  const [kdoSchvalil, setKdoSchvalil] = useState('');
  const [schvaluji, setSchvaluji] = useState(false);

  // Kolik z nabidky uz odeslo ve fakturach a kolik zbyva (zadani 15. 9. 2026).
  const vyfakturovano = offer.faktury.reduce((soucet, f) => soucet + f.celkemMinor, 0);

  const totals = useMemo(
    () => computeTotals(items, { slevaProcent: form.slevaProcent, slevaMinor: form.slevaMinor, slevaPopis: form.slevaPopis }),
    [items, form.slevaProcent, form.slevaMinor, form.slevaPopis],
  );
  const zbyva = Math.max(0, totals.incVat - vyfakturovano);
  const approvalUrl = typeof window !== 'undefined' ? `${window.location.origin}/nabidka/${offer.approvalToken}` : '';

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setInfo(null);
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  /**
   * HERCI Z PROJEKTU DO POLOŽEK (zadání 22. 9. 2026: „jakmile budu tvořit
   * nabídku, tak se mi nějakým tlačítkem přenesou i do položkového rozpočtu
   * a já si k nim napíšu jen ceny"). Každý herec = jedna položka bez ceny;
   * kdo už v položkách je, nepřidá se znovu. Prázdný první řádek se nahradí.
   */
  const herciVybranehoProjektu = form.caflouProjectId ? herciProjektu[form.caflouProjectId] ?? [] : [];
  const popisHerce = (jmeno: string) => (form.jazyk === 'EN' ? `Voice-over – ${jmeno}` : `Hlasový výkon – ${jmeno}`);
  const chybejiciHerci = herciVybranehoProjektu.filter(
    (j) => !items.some((i) => i.description.trim().toLowerCase() === popisHerce(j).toLowerCase()),
  );
  function pridatHerce() {
    setItems((current) => {
      const bezPrazdnych = current.filter((i) => i.description.trim() || i.unitPriceMinor);
      return [
        ...bezPrazdnych,
        ...chybejiciHerci.map((j) => ({ ...emptyItem(), description: popisHerce(j) })),
      ];
    });
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? [emptyItem()] : current.filter((_, i) => i !== index)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (!form.companyId) {
        setError(t('nabidka.chybaBezOdberatele'));
        return false;
      }
      const telo = {
        ...form,
        validUntil: form.validUntil || null,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description.trim(),
            quantity: Number(i.quantity) || 0,
            unit: i.unit || undefined,
            unitPriceMinor: i.unitPriceMinor,
            vatRate: i.vatRate,
          })),
      };
      const res = jesteNeulozena
        ? await fetch('/api/admin/offers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telo),
          })
        : await fetch(`/api/admin/offers/${offer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telo),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidka.chybaUlozeni'));
        return false;
      }
      if (jesteNeulozena && data?.id) {
        router.push(`/admin/doklady/nabidky/${data.id}`);
        router.refresh();
        return true;
      }
      setInfo(t('nabidka.ulozeno'));
      router.refresh();
      return true;
    } catch {
      setError(t('nabidka.chybaUlozeni'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendToClient() {
    const saved = await save();
    if (!saved) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidka.chybaOdeslani'));
        return;
      }
      setInfo(t('nabidka.odeslanoNa', { email: data.to }));
      router.refresh();
    } catch {
      setError(t('nabidka.chybaOdeslani'));
    } finally {
      setSending(false);
    }
  }

  async function schvalitRucne() {
    // Nejdriv ulozit: schvalena nabidka je zamcena, takze rozdelane zmeny
    // by uz do ni nesly dostat.
    const saved = await save();
    if (!saved) return;
    setSchvaluji(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}/schvaleni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jmeno: kdoSchvalil.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidka.chybaSchvaleni'));
        return;
      }
      setSchvalovani(false);
      setKdoSchvalil('');
      setInfo(t('nabidka.oznacenaSchvalena'));
      router.refresh();
    } catch {
      setError(t('nabidka.chybaSchvaleni'));
    } finally {
      setSchvaluji(false);
    }
  }

  async function zrusitSchvaleni() {
    setSchvaluji(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}/schvaleni`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('nabidka.chybaZruseniSchvaleni'));
        return;
      }
      setInfo(t('nabidka.schvaleniZruseno'));
      router.refresh();
    } catch {
      setError(t('nabidka.chybaZruseniSchvaleni'));
    } finally {
      setSchvaluji(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(approvalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('nabidka.chybaKopirovani'));
    }
  }

  /**
   * Faktura z nabídky. Nic se tu nezakládá - otevře se předvyplněný doklad
   * k úpravě a teprve tam se uloží (zadani 8. 9. 2026: "chci se dostat ještě
   * do editace faktury a až pak ji uložit"). Dřív klik rovnou založil
   * rozpracovanou fakturu a snědl číslo z řady.
   */
  function createInvoice() {
    router.push(`/admin/doklady/faktury/nova?nabidka=${offer.id}`);
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('nabidka.chybaSmazani'));
        return;
      }
      router.push('/admin/doklady/nabidky');
      router.refresh();
    } catch {
      setError(t('nabidka.chybaSmazani'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-line bg-field px-3 py-2 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70';
  const cellClass =
    'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-ink font-heading text-sm outline-none focus:border-brand-purple w-full disabled:bg-field disabled:opacity-70';
  /** Popisek nad malym polem v radku polozky - nahrazuje hlavicku tabulky. */
  const popiskaClass = 'text-[10px] font-heading text-muted uppercase tracking-wide';

  // Editor je omezeny sirkou a vycentrovany (zadani 10. 9. 2026: "ta
  // vyberova pole jsou strasne roztahana na sirku"). Formularove radky
  // natazene pres celou obrazovku se spatne ctou a doklad vedle nich by
  // zbyl uzky a nizky.
  return (
    <div className="flex flex-col gap-5 w-full max-w-[1460px] mx-auto">
      {/* CO UŽ JE Z NABÍDKY VYFAKTUROVANÉ (zadání 15. 9. 2026: „když bude
          nabídka na nějakou cenu a my to pak částečně vyfakturujeme… jestli to
          bude v pohodě, když z jedné nabídky udělám dvě faktury"). Faktur může
          být víc; tady je vidět kolik z nabídky padlo a co zbývá. */}
      {offer.faktury.length > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('nabidka.vyfakturovano')}
            </span>
            <span className="text-sm font-heading text-ink">
              {t('nabidka.vyfakturovanoZ', {
                castka: formatMoney(vyfakturovano, form.currency),
                celkem: formatMoney(totals.incVat, form.currency),
              })}
              {zbyva > 0 ? (
                <span className="text-muted">
                  {' · '}
                  {t('nabidka.zbyva', { castka: formatMoney(zbyva, form.currency) })}
                </span>
              ) : (
                <span className="text-status-done">
                  {' · '}
                  {t('nabidka.vyfakturovanoCele')}
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {offer.faktury.map((f) => (
              <a
                key={f.id}
                href={`/admin/doklady/faktury/${f.id}`}
                className="inline-flex items-center gap-2 rounded-pill border border-line bg-field px-3 py-1 text-xs font-heading text-ink no-underline hover:border-brand-purple"
              >
                {f.number}
                <span className="text-muted">{formatMoney(f.celkemMinor, form.currency)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Lišta se stavem a akcemi - drží se nahoře, aby byla pořád po ruce. */}
      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-2xl text-ink">{offer.number}</span>
          <span
            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${OFFER_STATUS_CLASSES[offer.status]}`}
          >
            {KLICE_STAVU[offer.status] ? t(KLICE_STAVU[offer.status]) : offer.status}
          </span>
          {offer.approvedAt && (
            <span className="text-xs font-body text-muted">
              {offer.approvedByName
                ? t('nabidka.schvalenoKdyKym', {
                    datum: formatDatumCas(jazyk, new Date(offer.approvedAt)),
                    jmeno: offer.approvedByName,
                  })
                : t('nabidka.schvalenoKdy', {
                    datum: formatDatumCas(jazyk, new Date(offer.approvedAt)),
                  })}
            </span>
          )}
          {offer.rejectedAt && !offer.approvedAt && (
            <span className="text-xs font-body text-danger">
              {t('nabidka.odmitnutoKdy', { datum: formatDatumCas(jazyk, new Date(offer.rejectedAt)) })}
            </span>
          )}
          {offer.sentAt && !offer.approvedAt && !offer.rejectedAt && (
            <span className="text-xs font-body text-muted">
              {t('nabidka.odeslanoKdy', { datum: formatDatumCas(jazyk, new Date(offer.sentAt)) })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!jesteNeulozena && (
          <button
            type="button"
            onClick={copyLink}
            className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors"
          >
            {copied ? t('nabidka.zkopirovano') : t('nabidka.odkazProKlienta')}
          </button>
          )}
          {/* Fakturu jde vystavit z kazde nabidky, kterou klient neodmitl
              (zadani 8. 9. 2026) - schvaleni pres odkaz je dobrovolne a
              casto se domlouva telefonem.

              Tlacitko je plna zelena plocha: zeleny text na zelenkavem
              podkladu se v tmavem rezimu ztratil (zprava uzivatele
              13. 9. 2026: "to tlacitko Vystavit fakturu nejde v nabidkach
              precist"). */}
          {offer.status !== 'REJECTED' && !jesteNeulozena && (
            <button
              type="button"
              onClick={createInvoice}
              disabled={saving || sending}
              className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:brightness-95 transition-[filter] disabled:opacity-60 whitespace-nowrap"
            >
              {offer.faktury.length > 0 ? t('nabidka.vystavitDalsiFakturu') : t('nabidka.vystavitFakturu')}
            </button>
          )}
          {!locked && (
            <>
              {/* Rucni schvaleni (zadani 14. 9. 2026). Nabizi se i u odmitnute
                  nabidky: klient obcas klikne vedle nebo si to rozmysli
                  a bez teto cesty by uz nebylo jak stav opravit. */}
              {!jesteNeulozena && (
                <button
                  type="button"
                  onClick={() => {
                    setSchvalovani((v) => !v);
                    setError(null);
                  }}
                  disabled={saving || sending || schvaluji}
                  className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {t('nabidka.schvalitRucne')}
                </button>
              )}
              {!jesteNeulozena && (
              <button
                type="button"
                onClick={sendToClient}
                disabled={saving || sending}
                className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-tint transition-colors disabled:opacity-60"
              >
                {sending ? t('nabidka.odesilam') : t('nabidka.odeslatKlientovi')}
              </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving || sending}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? t('obecne.ukladam') : t('obecne.ulozit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rucni schvaleni: kdo na strane klienta souhlasil (zadani 14. 9. 2026).
          Jmeno je nepovinne, ale uklada se do stejneho pole jako u schvaleni
          odkazem, takze se pak tiskne a zobrazuje uplne stejne. */}
      {schvalovani && !locked && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-3">
          <p className="text-sm text-ink m-0">{t('nabidka.schvaleniPopis')}</p>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
              <span className="text-[10px] font-heading text-muted uppercase tracking-wide">
                {t('nabidka.kdoSchvalil')}
              </span>
              <input
                type="text"
                value={kdoSchvalil}
                onChange={(e) => setKdoSchvalil(e.target.value)}
                placeholder={t('nabidka.kdoSchvalilPlaceholder')}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={schvalitRucne}
              disabled={saving || sending || schvaluji}
              className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:brightness-95 transition-[filter] disabled:opacity-60 whitespace-nowrap"
            >
              {schvaluji ? t('obecne.ukladam') : t('nabidka.schvalitNabidku')}
            </button>
            <button
              type="button"
              onClick={() => setSchvalovani(false)}
              disabled={schvaluji}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
            >
              {t('obecne.zpet')}
            </button>
          </div>
        </div>
      )}

      {/* DVA SLOUPCE (zadani 10. 9. 2026): vlevo udaje, vpravo hotovy doklad. */}
      {/* Dokument ma vic mista nez formular (zadani 10. 9. 2026: "nahled
          jeste trosku zvetsi") - do pulky sirky uz se vic vejit nemuze,
          takze si bere 600 bodu a formular zbytek. Dva sloupce az od xl,
          na uzsim okne by na formular zbylo pod 400 bodu. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] gap-5 items-start">
      <div className="flex flex-col gap-5 min-w-0">

      {locked && (
        <div className="bg-okTint border border-line rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-ink m-0">{t('nabidka.zamcenaPopis')}</p>
          {/* Zpetne zruseni schvaleni (zadani 14. 9. 2026) - rucne se da
              kliknout vedle a bez teto cesty by zamcenou nabidku uz nikdo
              neopravil. */}
          <button
            type="button"
            onClick={zrusitSchvaleni}
            disabled={schvaluji}
            className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-surface transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {schvaluji ? t('nabidka.rusim') : t('nabidka.zrusitSchvaleni')}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-4 py-3 m-0">{info}</p>}

      {/* Vlastní doklad */}
      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        {/* Hlavička: dodavatel vs. odběratel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-b border-line">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('nabidka.dodavatel')}
            </span>
            {locked ? (
              <p className="font-heading font-semibold text-ink m-0">{issuer.name}</p>
            ) : (
              <VyberPole
                value={form.issuerCompanyId}
                onChange={(e) => set('issuerCompanyId', e.target.value)}
                className={inputClass}
              >
                {issuers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </VyberPole>
            )}
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(issuer) || '—'}
              <br />
              {issuer.ic ? `IČ ${issuer.ic}` : ''} {issuer.dic ? `· DIČ ${issuer.dic}` : ''}
              {issuer.vatPayer === false ? ` · ${t('nabidka.neplatceDph')}` : ''}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('nabidka.odberatel')}
            </span>
            {locked ? (
              <p className="font-heading font-semibold text-ink m-0">{company.name}</p>
            ) : (
              /* Hledani s lupou misto rozbalovaciho seznamu (zadani 13. 9. 2026). */
              <VyberFirmy firmy={companies} hodnota={form.companyId} onZmena={(id) => set('companyId', id)} />
            )}
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(company) || '—'}
              <br />
              {company.ic ? `IČ ${company.ic}` : ''} {company.dic ? `· DIČ ${company.dic}` : ''}
            </p>
            {/* KOMU TO POLETÍ (zadání 17. 9. 2026: „mělo by tady být spíše
                vidět, na jakého klienta nabídku vystavuji"). Nabídka jde
                klientovi vyplněnému u projektu, a teprve když ho projekt nemá,
                na kontakt firmy - stejně to počítá server při odeslání, viz
                lib/prijemceNabidky.ts. Az kdyz je nekdo vybrany (13. 9. 2026). */}
            {form.companyId && (
              <p
                className={`text-xs font-body m-0 ${prijemce ? 'text-muted' : 'text-danger'}`}
              >
                {prijemce ? (
                  <>
                    {posleme[0]}
                    <b className="text-ink font-heading">{prijemce.jmeno ?? prijemce.email}</b>
                    {posleme[1]}
                    {prijemce.jmeno ? ` · ${prijemce.email}` : ''}
                    <span className="block">
                      {prijemce.zdroj === 'klient'
                        ? t('nabidka.prijemceZKlienta')
                        : t('nabidka.prijemceZFirmy')}
                    </span>
                  </>
                ) : form.caflouProjectId ? (
                  t('nabidka.neniKomuPoslatProjekt')
                ) : (
                  t('nabidka.neniKomuPoslat')
                )}
              </p>
            )}
          </div>
        </div>

        {/* Předmět a data */}
        {/* Dva sloupce, ne ctyri: formular ted sedi v polovine sirky, ve
            ctyrech by byla policka na datum uzka na precteni. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 p-6 border-b border-line">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('nabidka.nazev')}</span>
            <input
              value={form.subject}
              disabled={locked}
              onChange={(e) => {
                setNazevRucne(true);
                set('subject', e.target.value);
              }}
              placeholder={t('nabidka.nazevPlaceholder')}
              className={inputClass}
            />
            {!nazevRucne && (
              <span className="text-xs font-body text-muted">{t('nabidka.nazevZProjektu')}</span>
            )}
          </label>
          {/* Projekt (zadani 8. 9. 2026) - nabidka se pak ukaze v detailu projektu
              a vazba se prenese i na fakturu z ni vystavenou. */}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('nabidka.projekt')}</span>
            <ProjectSelect
              value={form.caflouProjectId}
              onChange={(id) => {
                const nazevProjektu = projects.find((p) => p.id === id)?.label.split(' — ')[0].trim() ?? '';
                setForm((f) => ({
                  ...f,
                  caflouProjectId: id,
                  subject: !nazevRucne && nazevProjektu ? nazevProjektu : f.subject,
                }));
              }}
              projects={projects}
              currentName={offer.projectName}
              disabled={locked}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nabidka.vystaveno')}</span>
            <DatumPole
              value={form.issueDate}
              disabled={locked}
              onChange={(e) => set('issueDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nabidka.platnostDo')}</span>
            <DatumPole
              value={form.validUntil}
              disabled={locked}
              onChange={(e) => set('validUntil', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nabidka.mena')}</span>
            <VyberPole
              value={form.currency}
              disabled={locked}
              onChange={(e) => set('currency', e.target.value as Currency)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {nazevMeny(c, jazyk)}
                </option>
              ))}
            </VyberPole>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('nabidka.jazykNabidky')}</span>
            <VyberPole
              value={form.jazyk}
              disabled={locked}
              onChange={(e) => set('jazyk', e.target.value as typeof form.jazyk)}
              className={inputClass}
            >
              <option value="CS">{t('listou.cestina')}</option>
              <option value="EN">{t('listou.anglictina')}</option>
            </VyberPole>
          </label>
        </div>

        {/* Položky */}
        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {t('nabidka.polozky')}
            </h2>
            <span className="text-xs font-body text-muted">{t('nabidka.cenyBezDph')}</span>
          </div>

          {/* Popis ma cely radek, cisla pod nim - stejne jako u faktury
              (zadani 13. 9. 2026: „pole, kam zadavam polozku, je moc kratke"). */}
          <div className="flex flex-col divide-y divide-line">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col gap-2 py-3 first:pt-0">
                <div className="flex items-center gap-2">
                  <input
                    value={item.description}
                    disabled={locked}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={t('nabidka.popisPolozky')}
                    className={cellClass}
                  />
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      title={t('nabidka.odebratPolozku')}
                      aria-label={t('nabidka.odebratPolozku')}
                      className="shrink-0 text-muted hover:text-danger text-sm font-heading px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                  <label className="flex flex-col gap-1 w-20">
                    <span className={popiskaClass}>{t('nabidka.mnozstvi')}</span>
                    <input
                      inputMode="decimal"
                      value={item.quantity}
                      disabled={locked}
                      onChange={(e) =>
                        updateItem(index, { quantity: Number(e.target.value.replace(',', '.')) || 0 })
                      }
                      className={`${cellClass} text-right tabular-nums`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 w-16">
                    <span className={popiskaClass}>{t('nabidka.jednotka')}</span>
                    <input
                      value={item.unit}
                      disabled={locked}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      placeholder="ks"
                      className={cellClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 w-28">
                    <span className={popiskaClass}>{t('nabidka.cenaZaJednotku')}</span>
                    <input
                      inputMode="decimal"
                      defaultValue={item.unitPriceMinor ? minorToInput(item.unitPriceMinor) : ''}
                      placeholder="0,00"
                      disabled={locked}
                      onChange={(e) => updateItem(index, { unitPriceMinor: parseMoneyToMinor(e.target.value) })}
                      className={`${cellClass} text-right tabular-nums`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 w-24">
                    <span className={popiskaClass}>{t('nabidka.dph')}</span>
                    <VyberPole
                      value={item.vatRate}
                      disabled={locked}
                      onChange={(e) => updateItem(index, { vatRate: Number(e.target.value) })}
                      className={`${cellClass} text-right`}
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {t('nabidka.sazbaDph', { sazba: r })}
                        </option>
                      ))}
                    </VyberPole>
                  </label>
                  <span className="ml-auto flex flex-col gap-1 items-end">
                    <span className={popiskaClass}>{t('nabidka.celkemPolozka')}</span>
                    <span className="text-sm font-heading text-ink tabular-nums py-1.5">
                      {formatMoney(Math.round(item.quantity * item.unitPriceMinor), form.currency)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!locked && (
            <div className="flex items-center gap-3 flex-wrap">
              <AddButton type="button" onClick={addItem} className="self-start">
                {t('nabidka.pridatPolozku')}
              </AddButton>
              {chybejiciHerci.length > 0 && (
                <button
                  type="button"
                  onClick={pridatHerce}
                  title={chybejiciHerci.join(', ')}
                  className="text-sm font-heading font-semibold rounded-lg px-3 py-2 border border-line text-ink hover:border-brand-purple"
                >
                  {t('nabidka.herciZProjektu', { pocet: chybejiciHerci.length })}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Součet */}
        <div className="border-t border-line p-6 flex justify-end">
          <div className="w-full max-w-xs flex flex-col gap-1.5">
            {/* Zaklad PRED slevou, at je videt, z ceho se slevovalo. Bez
                slevy je to totez cislo jako doted. */}
            <div className="flex items-center justify-between text-sm font-heading">
              <span className="text-muted">
                {totals.sleva > 0 ? t('nabidka.mezisoucetBezDph') : t('nabidka.zakladBezDph')}
              </span>
              <span className="text-ink tabular-nums">
                {formatMoney(totals.exVatPredSlevou, form.currency)}
              </span>
            </div>

            <SlevaPole
              hodnoty={{
                slevaProcent: form.slevaProcent,
                slevaMinor: form.slevaMinor,
                slevaPopis: form.slevaPopis,
              }}
              onZmena={(zmena) => setForm((f) => ({ ...f, ...zmena }))}
              currency={form.currency}
              totals={totals}
              locked={locked}
            />

            {totals.sleva > 0 && (
              <div className="flex items-center justify-between text-sm font-heading">
                <span className="text-muted">{t('nabidka.zakladBezDphPoSleve')}</span>
                <span className="text-ink tabular-nums">{formatMoney(totals.exVat, form.currency)}</span>
              </div>
            )}
            {totals.byRate.map((r) => (
              <div key={r.rate} className="flex items-center justify-between text-sm font-heading">
                <span className="text-muted">{t('nabidka.dphSazba', { sazba: r.rate })}</span>
                <span className="text-muted tabular-nums">{formatMoney(r.vat, form.currency)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-2 mt-1">
              <span className="font-heading font-semibold text-ink">{t('nabidka.celkem')}</span>
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(totals.incVat, form.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Poznámka a účet */}
      <div className="grid grid-cols-1 gap-5">
        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('nabidka.poznamkaProKlienta')}
          </span>
          <textarea
            value={form.note}
            disabled={locked}
            onChange={(e) => set('note', e.target.value)}
            rows={4}
            placeholder={t('nabidka.poznamkaPlaceholder')}
            className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70"
          />
        </div>

        <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('nabidka.bankovniUcet', { mena: CURRENCY_LABELS[form.currency] })}
          </span>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-muted font-body m-0">{t('nabidka.zadnyUcet')}</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-1">
              {bankAccounts.map((a, i) => (
                <li key={i} className="text-sm font-heading text-ink">
                  {a.label}
                  <span className="block text-xs text-muted font-body tabular-nums">
                    {[a.accountNumber, a.iban].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      </div>

      <NahledDokladu telo={nahledTelo} titulek={t('nabidka.nahled')} />
      </div>

      {!locked && !jesteNeulozena && (
        <div>
          <TlacitkoSmazat
            onSmazat={remove}
            disabled={saving}
            popisek={t('nabidka.smazatNabidku')}
            otazka={t('nabidka.opravduSmazat')}
          />
        </div>
      )}
    </div>
  );
}
