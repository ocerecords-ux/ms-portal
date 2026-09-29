'use client';

import { TlacitkoSmazat } from '@/components/TlacitkoSmazat';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import type { Currency, InvoiceStatus } from '@prisma/client';
import {
  CURRENCIES,
  nazevMeny,
  computeTotals,
  formatAddress,
  formatMoney,
  minorToInput,
  parseMoneyToMinor,
} from '@/lib/doklady';
import { formatRate, toCzkMinor } from '@/lib/cnb';
import { ProjectSelect, type ProjectChoice } from '../../ProjectSelect';
import { VyberFirmy, type FirmaVolba } from '../../VyberFirmy';
import { NahledDokladu } from '../../NahledDokladu';
import { SlevaPole } from '../../SlevaPole';
import { VyberPole } from '@/components/VyberPole';
import { DatumPole } from '@/components/DatumPole';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { formatDatum, formatDatumCas, prelozitKolem, type Jazyk } from '@/lib/jazyk';
import { CASTI_FAKTURY, POPIS_CASTI, type CastFaktury } from '@/lib/fakturaCast';

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

type Invoice = {
  id: string;
  number: string;
  variableSymbol: string;
  status: InvoiceStatus;
  /** Interní značka „první / druhá část" - na dokladu není (29. 9. 2026). */
  interniCast: CastFaktury | null;
  companyId: string;
  bankAccountId: string | null;
  currency: Currency;
  exchangeRate: number;
  exchangeRateDate: string | null;
  issueDate: string;
  taxDate: string;
  dueDate: string;
  subject: string;
  note: string;
  sentAt: string | null;
  /**
   * Komu a kdy faktura odešla (zadání 15. 9. 2026: „a záznam někde o tom, kdy
   * a na koho ta faktura šla"). Nejnovější odeslání je první.
   */
  odeslani?: {
    id: string;
    prijemci: string[];
    odeslalJmeno: string | null;
    sRodnymListem: boolean;
    kdy: string;
  }[];
  paidAt: string | null;
  offerNumber: string | null;
  caflouProjectId: string;
  projectName: string | null;
  rezimDph: 'STANDARD' | 'PRENESENA' | 'MIMO_PREDMET';
  jazyk: 'CS' | 'EN';
  /** Sleva na dokladu (zadání 14. 9. 2026). */
  slevaProcent: number;
  slevaMinor: number;
  slevaPopis: string | null;
  items: Item[];
};

const VAT_RATES = [21, 12, 0];

const STATUS_KLICE: Record<string, string> = {
  DRAFT: 'faktura.stavRozpracovana',
  SENT: 'faktura.stavNeuhrazena',
  PAID: 'faktura.stavUhrazena',
  CANCELLED: 'faktura.stavStornovana',
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-field text-muted',
  SENT: 'bg-tint text-brand-purpleDark',
  PAID: 'bg-okTint text-status-done',
  CANCELLED: 'bg-dangerTint text-danger',
};

function emptyItem(): Item {
  return { description: '', quantity: 1, unit: 'ks', unitPriceMinor: 0, vatRate: 21 };
}

// Jazyk chodi parametrem - funkce stoji mimo komponentu, hook by tu nefungoval.
function formatDateTime(jazyk: Jazyk, iso: string | null): string {
  if (!iso) return '';
  return formatDatumCas(jazyk, new Date(iso), '');
}

/**
 * Editor faktury. Vypadá jako samotný doklad, stejně jako u nabídek.
 * U cizí měny je vidět kurz ČNB ke dni vystavení i přepočet do korun -
 * kurz se s dokladem ukládá, takže se pozdějším pohybem na trhu nezmění.
 */
export function InvoiceEditor({
  invoice,
  issuerCompanyId,
  issuer,
  company,
  companies,
  bankAccounts,
  projects,
  /**
   * ID nabidky, ze ktere se faktura chysta. Kdyz je vyplnene, faktura JESTE
   * NEEXISTUJE - editor jen ukazuje predvyplneny doklad a teprve tlacitko
   * Ulozit ho zalozi (zadani 8. 9. 2026: "chci se dostat jeste do editace
   * faktury a az pak ji ulozit"). Driv se faktura zalozila uz kliknutim na
   * "Vystavit fakturu", takze kazde rozmysleni si to nechavalo v seznamu
   * rozpracovany doklad a snedlo cislo z rady.
   */
  draftFromOfferId,
  zNabidky,
}: {
  invoice: Invoice;
  /** Vydavatel dokladu - kvuli nahledu, ktery si ho tahne ze serveru. */
  issuerCompanyId: string;
  issuer: Party;
  company: Party;
  companies: FirmaVolba[];
  bankAccounts: { id: string; label: string; accountNumber: string | null; iban: string | null; currency: Currency }[];
  projects: ProjectChoice[];
  draftFromOfferId?: string;
  /**
   * Kolik z nabídky už je vyfakturováno (zadání 15. 9. 2026: „když bude
   * nabídka na nějakou cenu a my to pak částečně vyfakturujeme"). Ukazuje se
   * jen u dokladu rozepsaného z nabídky, ze které už nějaká faktura vyšla.
   */
  zNabidky?: {
    cislo: string;
    celkemMinor: number;
    vyfakturovanoMinor: number;
    mena: Currency;
    faktury: { id: string; number: string }[];
  } | null;
}) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  // Neulozeny doklad: bud se chysta z nabidky, nebo se zaklada od nuly -
  // v obou pripadech jeste nema ani cislo, ani radek v databazi (zadani
  // 10. 9. 2026: cislo z rady se nesmi spotrebovat rozmyslenim).
  const jesteNeulozena = Boolean(draftFromOfferId) || invoice.id === 'nova';
  const locked = invoice.status === 'PAID' || invoice.status === 'CANCELLED';

  const [form, setForm] = useState({
    companyId: invoice.companyId,
    bankAccountId: invoice.bankAccountId ?? '',
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    taxDate: invoice.taxDate,
    dueDate: invoice.dueDate,
    subject: invoice.subject,
    note: invoice.note,
    variableSymbol: invoice.variableSymbol,
    caflouProjectId: invoice.caflouProjectId,
    rezimDph: invoice.rezimDph,
    jazyk: invoice.jazyk,
    // Sleva na celem dokladu (zadani 14. 9. 2026). Jde s formularem, takze
    // se uklada stejnou cestou jako zbytek.
    slevaProcent: invoice.slevaProcent ?? 0,
    slevaMinor: invoice.slevaMinor ?? 0,
    slevaPopis: invoice.slevaPopis ?? '',
  });
  const [items, setItems] = useState<Item[]>(invoice.items.length > 0 ? invoice.items : [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /**
   * Projekt, na který se portál po odeslání faktury ptá, jestli ho ukončit
   * (25. 9. 2026). Prázdné = neptá se.
   */
  const [ukonceni, setUkonceni] = useState<{ id: string; nazev: string | null } | null>(null);

  const totals = useMemo(
    () => computeTotals(items, { slevaProcent: form.slevaProcent, slevaMinor: form.slevaMinor, slevaPopis: form.slevaPopis }),
    [items, form.slevaProcent, form.slevaMinor, form.slevaPopis],
  );

  /**
   * Co se posílá do náhledu. Je to schválně jen to, co je na dokumentu vidět -
   * kdyby se posílal celý stav, překresloval by se i po změnách, které se
   * dokumentu vůbec netýkají.
   */
  const nahledTelo = useMemo(
    () => ({
      druh: 'FAKTURA' as const,
      id: jesteNeulozena ? null : invoice.id,
      issuerCompanyId,
      companyId: form.companyId,
      bankAccountId: form.bankAccountId || null,
      currency: form.currency,
      issueDate: form.issueDate,
      taxDate: form.taxDate || null,
      dueDate: form.dueDate || null,
      subject: form.subject,
      note: form.note,
      variableSymbol: form.variableSymbol,
      projectName: projects.find((p) => p.id === form.caflouProjectId)?.label ?? invoice.projectName ?? null,
      rezimDph: form.rezimDph,
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
    }),
    [form, items, invoice.id, invoice.projectName, issuerCompanyId, jesteNeulozena, projects],
  );
  const accountsForCurrency = bankAccounts.filter((a) => a.currency === form.currency);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setInfo(null);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setInfo(null);
  }

  async function save(extra?: { refreshRate?: boolean }) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (!form.companyId) {
        setError(t('faktura.chybiOdberatel'));
        return false;
      }
      const telo = {
        ...form,
        bankAccountId: form.bankAccountId || null,
        taxDate: form.taxDate || null,
        dueDate: form.dueDate || null,
        refreshRate: extra?.refreshRate,
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
        ? await fetch('/api/admin/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...telo, offerId: draftFromOfferId, issuerCompanyId }),
          })
        : await fetch(`/api/admin/invoices/${invoice.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(telo),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('faktura.ulozeniSelhalo'));
        return false;
      }
      if (jesteNeulozena && data?.id) {
        // Cislo z rady se pridelilo az ted - dal uz se pracuje s hotovou fakturou.
        router.replace(`/admin/doklady/faktury/${data.id}`);
        router.refresh();
        return true;
      }
      setInfo(t('faktura.ulozeno'));
      router.refresh();
      return true;
    } catch {
      setError(t('faktura.ulozeniSelhalo'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  /**
   * Odeslání faktury. Komu jde, rozhoduje karta firmy (kontaktní e-mail
   * a zaškrtávátko „Posílat faktury i klientovi") - viz api/admin/invoices/
   * [id]/send. Po odeslání se vypíše, kdo ji dostal.
   */
  async function sendToClient() {
    const saved = await save();
    if (!saved) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('faktura.odeslaniSelhalo'));
        return;
      }
      const kopie: string[] = Array.isArray(data.kopie) ? data.kopie : [];
      setInfo(
        kopie.length
          ? t('faktura.odeslanoNaSKopii', { komu: data.to, kopie: kopie.join(', ') })
          : t('faktura.odeslanoNa', { komu: data.to }),
      );
      /**
       * MEZIKROK MÍSTO AUTOMATU (zadání 25. 9. 2026). Projekt se po odeslání
       * faktury sám nezavírá - portál se zeptá a zavře ho, teprve když to
       * někdo odklepne.
       */
      if (data?.nabidnoutUkonceni && data?.caflouProjectId) {
        setUkonceni({ id: String(data.caflouProjectId), nazev: data.projectName || null });
      }
      router.refresh();
    } catch {
      setError(t('faktura.odeslaniSelhalo'));
    } finally {
      setSending(false);
    }
  }

  /** „Ukončit projekt?" po odeslání faktury - zavře ho stejná cesta jako ručně. */
  async function ukonciProjekt() {
    if (!ukonceni) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(ukonceni.id)}/ukonceni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ukoncit: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('faktura.ukonceniSelhalo'));
        return;
      }
      setUkonceni(null);
      setInfo(t('faktura.projektUkoncen'));
      router.refresh();
    } catch {
      setError(t('faktura.ukonceniSelhalo'));
    } finally {
      setSending(false);
    }
  }

  async function setPaid(paid: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/uhrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid, paidAmountMinor: paid ? totals.incVat : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('faktura.ulozeniSelhalo'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('faktura.ulozeniSelhalo'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('faktura.smazaniSelhalo'));
        return;
      }
      if (data.smazanoNatrvalo) {
        router.push('/admin/doklady/faktury');
        router.refresh();
        return;
      }
      if (data.cancelledInsteadOfDeleted) {
        setInfo(t('faktura.stornovanaInfo'));
        router.refresh();
        return;
      }
      router.push('/admin/doklady/faktury');
      router.refresh();
    } catch {
      setError(t('faktura.smazaniSelhalo'));
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

  // Kurz CNB je jedna veta i s datem - rozdeli se az kvuli tomu, ze datum je
  // v ni sedive (pravidlo 7 v docs/preklad-portalu.md).
  const kurzHodnoty = { mena: form.currency, kurz: formatRate(invoice.exchangeRate) };
  const [kurzPred, kurzPo] = prelozitKolem(jazyk, 'faktura.kurzKeDni', 'datum', kurzHodnoty);

  // Editor je omezeny sirkou a vycentrovany (zadani 10. 9. 2026: "ta
  // vyberova pole jsou strasne roztahana na sirku"). Formularove radky
  // natazene pres celou obrazovku se spatne ctou a doklad vedle nich by
  // zbyl uzky a nizky.
  return (
    <div className="flex flex-col gap-5 w-full max-w-[1460px] mx-auto">
      {/* Kolik z nabidky uz je vyfakturovano (zadani 15. 9. 2026). Ukazuje se
          jen u dokladu rozepsaneho z nabidky, ze ktere uz nejaka faktura vysla. */}
      {zNabidky && zNabidky.faktury.length > 0 && (
        <p className="text-sm font-body text-ink bg-tint border border-line rounded-card px-4 py-3 m-0">
          {t('faktura.zNabidkyVyfakturovano', {
            cislo: zNabidky.cislo,
            celkem: formatMoney(zNabidky.celkemMinor, zNabidky.mena, jazyk),
            vyfakturovano: formatMoney(zNabidky.vyfakturovanoMinor, zNabidky.mena, jazyk),
            faktury: zNabidky.faktury.map((f) => f.number).join(', '),
            zbyva: formatMoney(
              Math.max(0, zNabidky.celkemMinor - zNabidky.vyfakturovanoMinor),
              zNabidky.mena,
              jazyk,
            ),
          })}
        </p>
      )}

      {/* Komu a kdy faktura odesla - viz invoice.odeslani. */}
      {invoice.odeslani && invoice.odeslani.length > 0 && (
        <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex flex-col gap-2">
          <span className="text-xs font-heading text-muted uppercase tracking-wide">
            {t('faktura.odeslanoNadpis')}
          </span>
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {invoice.odeslani.map((o) => (
              <li key={o.id} className="text-sm font-body text-ink">
                <span className="font-heading">{formatDateTime(jazyk, o.kdy)}</span>{' '}
                <span className="text-muted">→</span> {o.prijemci.join(', ')}
                <span className="block text-[11px] font-body text-muted">
                  {o.odeslalJmeno
                    ? t('faktura.odeslalKdo', { jmeno: o.odeslalJmeno })
                    : t('faktura.odeslanoZPortalu')}
                  {o.sRodnymListem ? ` · ${t('faktura.sRodnymListem')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Cislo dokladu se nepreklada - dokud faktura neni ulozena, zadne
              jeste nema a misto nej tu stoji popisek. */}
          <span className="font-display text-2xl text-ink">
            {jesteNeulozena ? t('faktura.novaFaktura') : invoice.number}
          </span>
          <span
            className={`inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill ${STATUS_CLASSES[invoice.status]}`}
          >
            {jesteNeulozena
              ? t('faktura.stavNeulozena')
              : STATUS_KLICE[invoice.status]
                ? t(STATUS_KLICE[invoice.status])
                : invoice.status}
          </span>
          {!jesteNeulozena && <CastZakazky id={invoice.id} vychozi={invoice.interniCast} />}
          {invoice.offerNumber && (
            <span className="text-xs font-body text-muted">
              {t('faktura.zNabidkyCislo', { cislo: invoice.offerNumber })}
            </span>
          )}
          {invoice.paidAt && (
            <span className="text-xs font-body text-status-done">
              {t('faktura.uhrazenoKdy', { kdy: formatDateTime(jazyk, invoice.paidAt) })}
            </span>
          )}
          {invoice.sentAt && !invoice.paidAt && (
            <span className="text-xs font-body text-muted">
              {t('faktura.odeslanoKdy', { kdy: formatDateTime(jazyk, invoice.sentAt) })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {jesteNeulozena && (
            <>
              <span className="text-xs font-body text-muted max-w-[280px]">
                {t('faktura.vznikneAzUlozenim')}
              </span>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="border border-line text-muted font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
              >
                {t('faktura.zrusit')}
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? t('faktura.zakladam') : t('faktura.ulozitFakturu')}
              </button>
            </>
          )}
          {!jesteNeulozena &&
            (invoice.status === 'PAID' ? (
            <button
              type="button"
              onClick={() => setPaid(false)}
              disabled={saving}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors disabled:opacity-60"
            >
              {t('faktura.zrusitUhradu')}
            </button>
          ) : (
              invoice.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => setPaid(true)}
                  disabled={saving}
                  className="bg-brand-green text-onAccent font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:brightness-95 transition-[filter] disabled:opacity-60"
                >
                  {t('faktura.oznacitZaplacenou')}
                </button>
              )
            ))}
          {!locked && !jesteNeulozena && (
            <>
              <button
                type="button"
                onClick={sendToClient}
                disabled={saving || sending}
                className="border border-brand-purple text-brand-purple font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-tint transition-colors disabled:opacity-60"
              >
                {sending ? t('faktura.odesilam') : t('faktura.odeslatOdberateli')}
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving || sending}
                className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
              >
                {saving ? t('faktura.ukladam') : t('faktura.ulozit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* DVA SLOUPCE (zadani 10. 9. 2026): vlevo udaje, vpravo hotovy doklad.
          Stejny model jako u Rodneho listu - clovek vidi, co vyrabi, uz pri
          zakladani, ne az po ulozeni. */}
      {/* Dokument ma vic mista nez formular (zadani 10. 9. 2026: "nahled
          jeste trosku zvetsi") - do pulky sirky uz se vic vejit nemuze,
          takze si bere 600 bodu a formular zbytek. Dva sloupce az od xl,
          na uzsim okne by na formular zbylo pod 400 bodu. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] gap-5 items-start">
      <div className="flex flex-col gap-5 min-w-0">

      {locked && (
        <p className="text-sm text-ink bg-field border border-line rounded-lg px-4 py-3 m-0">
          {invoice.status === 'PAID'
            ? t('faktura.zamcenaUhrazena')
            : t('faktura.zamcenaStornovana')}
        </p>
      )}
      {error && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-4 py-3 m-0">{error}</p>}
      {info && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-4 py-3 m-0">{info}</p>}

      {/* POJISTKA PO ODESLÁNÍ FAKTURY (zadání 25. 9. 2026: „jakmile se odešle
          faktura, dejme ještě mezikrok, že se systém zeptá Ukončit projekt?").
          Projekt se sám nezavírá; tohle je ta otázka. */}
      {ukonceni && (
        <div className="bg-warnTint border border-line rounded-card px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-body text-ink">
            {ukonceni.nazev
              ? t('faktura.ukoncitProjektNazev', { nazev: ukonceni.nazev })
              : t('faktura.ukoncitProjektOtazka')}
            <span className="block text-xs text-muted">{t('faktura.ukoncitProjektPopis')}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={ukonciProjekt}
              disabled={sending}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
            >
              {t('faktura.ukoncitProjekt')}
            </button>
            <button
              type="button"
              onClick={() => setUkonceni(null)}
              className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-field transition-colors"
            >
              {t('faktura.nechatBezet')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-card border border-line shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-b border-line">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('faktura.dodavatel')}
            </span>
            <p className="font-heading font-semibold text-ink m-0">{issuer.name}</p>
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(issuer) || '—'}
              <br />
              {/* IC a DIC jsou ceske kody, nechavaji se tak, jak stoji na dokladu. */}
              {issuer.ic ? `IČ ${issuer.ic}` : ''} {issuer.dic ? `· DIČ ${issuer.dic}` : ''}
              {issuer.vatPayer === false ? ` · ${t('faktura.neplatceDph')}` : ''}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">
              {t('faktura.odberatel')}
            </span>
            {locked ? (
              <p className="font-heading font-semibold text-ink m-0">{company.name}</p>
            ) : (
              /* Hledani s lupou misto rozbalovaciho seznamu (zadani 13. 9.
                 2026: „mela by tam byt spise lupa na vyhledavani, at tam muzu
                 psat a rychle najit firmu"). Firem jsou stovky. */
              <VyberFirmy firmy={companies} hodnota={form.companyId} onZmena={(id) => set('companyId', id)} />
            )}
            <p className="text-sm font-body text-muted m-0">
              {formatAddress(company) || '—'}
              <br />
              {company.ic ? `IČ ${company.ic}` : ''} {company.dic ? `· DIČ ${company.dic}` : ''}
            </p>
            {/* Az kdyz je nekdo vybrany - u prazdneho vyberu je hlaska
                matouci (13. 9. 2026). */}
            {form.companyId && !company.contactEmail && (
              <p className="text-xs text-danger font-body m-0">{t('faktura.firmaBezEmailu')}</p>
            )}
          </div>
        </div>

        {/* Dva sloupce, ne ctyri: formular ted sedi v polovine sirky, ve
            ctyrech by byla policka na datum uzka na precteni. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 p-6 border-b border-line">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('faktura.polePredmet')}</span>
            <input
              value={form.subject}
              disabled={locked}
              onChange={(e) => set('subject', e.target.value)}
              className={inputClass}
            />
          </label>
          {/* Projekt (zadani 8. 9. 2026) - faktura je pak videt v detailu projektu.
              Z nabidky se predvyplni sama. */}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-body text-ink">{t('faktura.poleProjekt')}</span>
            <ProjectSelect
              value={form.caflouProjectId}
              onChange={(id) => set('caflouProjectId', id)}
              projects={projects}
              currentName={invoice.projectName}
              disabled={locked}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleVariabilniSymbol')}</span>
            <input
              value={form.variableSymbol}
              disabled={locked}
              onChange={(e) => set('variableSymbol', e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleMena')}</span>
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

          {/* Rezim DPH VYBIRA CLOVEK (zadani 10. 9. 2026) - portal ho nehada
              z adresy odberatele, protoze to je vec ucetni, ne adresy.
              Od 13. 9. 2026 je to jedno zaskrtavatko misto rozbalovaciho
              seznamu: „rezim DPH bych dal jen zaskrtavaci pole, ze je
              v rezimu reverse charge. Primarne bude odskrtnute." */}
          <div className="flex flex-col gap-2 sm:col-span-2 2xl:col-span-1 pt-1">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={form.rezimDph === 'PRENESENA'}
                disabled={locked}
                onChange={(e) => set('rezimDph', e.target.checked ? 'PRENESENA' : 'STANDARD')}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-sm font-body text-ink">{t('faktura.prenesenaDan')}</span>
                <span className="text-xs font-body text-muted">{t('faktura.prenesenaDanPopis')}</span>
              </span>
            </label>
            {/* Rezimy se vylucuji, proto zaskrtnuti jednoho odskrtne druhy -
                doklad muze byt jen v jednom rezimu. */}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={form.rezimDph === 'MIMO_PREDMET'}
                disabled={locked}
                onChange={(e) => set('rezimDph', e.target.checked ? 'MIMO_PREDMET' : 'STANDARD')}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-sm font-body text-ink">{t('faktura.mimoPredmetDph')}</span>
                <span className="text-xs font-body text-muted">{t('faktura.mimoPredmetDphPopis')}</span>
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleJazykDokladu')}</span>
            <VyberPole
              value={form.jazyk}
              disabled={locked}
              onChange={(e) => set('jazyk', e.target.value as typeof form.jazyk)}
              className={inputClass}
            >
              <option value="CS">{t('faktura.jazykCestina')}</option>
              <option value="EN">{t('faktura.jazykAnglictina')}</option>
            </VyberPole>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleVystaveno')}</span>
            <DatumPole
              value={form.issueDate}
              disabled={locked}
              onChange={(e) => set('issueDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleDatumPlneni')}</span>
            <DatumPole
              value={form.taxDate}
              disabled={locked}
              onChange={(e) => set('taxDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleSplatnost')}</span>
            <DatumPole
              value={form.dueDate}
              disabled={locked}
              onChange={(e) => set('dueDate', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-body text-ink">{t('faktura.poleUcet')}</span>
            <VyberPole
              value={form.bankAccountId}
              disabled={locked}
              onChange={(e) => set('bankAccountId', e.target.value)}
              className={inputClass}
            >
              <option value="">{t('faktura.vyberteUcet')}</option>
              {accountsForCurrency.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {[a.accountNumber, a.iban].filter(Boolean).join(' / ')}
                </option>
              ))}
            </VyberPole>
          </label>
        </div>

        {/* Kurz ČNB - jen u cizí měny */}
        {form.currency !== 'CZK' && (
          <div className="px-6 py-4 border-b border-line bg-field flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-xs font-heading text-muted uppercase tracking-wide">
                {t('faktura.kurzCnb')}
              </span>
              <p className="text-sm font-heading text-ink m-0 mt-0.5 tabular-nums">
                {invoice.exchangeRateDate ? (
                  <>
                    {kurzPred}
                    <span className="text-muted font-body">
                      {formatDatum(jazyk, new Date(invoice.exchangeRateDate))}
                    </span>
                    {kurzPo}
                  </>
                ) : (
                  t('faktura.kurz', kurzHodnoty)
                )}
              </p>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={() => save({ refreshRate: true })}
                disabled={saving}
                className="border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-surface transition-colors disabled:opacity-60"
              >
                {t('faktura.nacistKurz')}
              </button>
            )}
          </div>
        )}

        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {t('faktura.polozky')}
            </h2>
            <span className="text-xs font-body text-muted">{t('faktura.cenyBezDph')}</span>
          </div>

          {/* POPIS MA CELOU SIRKU (zadani 13. 9. 2026: „pole, kam zadavam
              polozku, je moc kratke, nic moc tam nevejde"). V tabulce mu vedle
              peti ciselnych sloupcu zbyvalo kolem sto padesati pixelu, protoze
              vedle editoru jeste stoji nahled dokladu. Ted ma radek popis
              nahore pres celou sirku a cisla pod nim - a na telefonu se to
              zalomi samo. */}
          <div className="flex flex-col divide-y divide-line">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col gap-2 py-3 first:pt-0">
                <div className="flex items-center gap-2">
                  <input
                    value={item.description}
                    disabled={locked}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={t('faktura.popisPolozky')}
                    className={cellClass}
                  />
                  {!locked && (
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.length === 1 ? [emptyItem()] : current.filter((_, i) => i !== index),
                        )
                      }
                      title={t('faktura.odebratPolozku')}
                      aria-label={t('faktura.odebratPolozku')}
                      className="shrink-0 text-muted hover:text-danger text-sm font-heading px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                  <label className="flex flex-col gap-1 w-20">
                    <span className={popiskaClass}>{t('faktura.mnozstvi')}</span>
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
                    <span className={popiskaClass}>{t('faktura.jednotka')}</span>
                    <input
                      value={item.unit}
                      disabled={locked}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      className={cellClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 w-28">
                    <span className={popiskaClass}>{t('faktura.cenaZaJednotku')}</span>
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
                    <span className={popiskaClass}>{t('faktura.dph')}</span>
                    <VyberPole
                      value={item.vatRate}
                      disabled={locked}
                      onChange={(e) => updateItem(index, { vatRate: Number(e.target.value) })}
                      className={`${cellClass} text-right`}
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r} %
                        </option>
                      ))}
                    </VyberPole>
                  </label>
                  <span className="ml-auto flex flex-col gap-1 items-end">
                    <span className={popiskaClass}>{t('faktura.celkem')}</span>
                    <span className="text-sm font-heading text-ink tabular-nums py-1.5">
                      {formatMoney(Math.round(item.quantity * item.unitPriceMinor), form.currency, jazyk)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!locked && (
            <AddButton
              type="button"
              onClick={() => setItems((current) => [...current, emptyItem()])}
              className="self-start"
            >
              {t('faktura.pridatPolozku')}
            </AddButton>
          )}
        </div>

        <div className="border-t border-line p-6 flex justify-end">
          <div className="w-full max-w-xs flex flex-col gap-1.5">
            {/* Zaklad PRED slevou, at je videt, z ceho se slevovalo. Bez
                slevy je to totez cislo jako doted. */}
            <div className="flex items-center justify-between text-sm font-heading">
              <span className="text-muted">
                {totals.sleva > 0 ? t('faktura.mezisoucetBezDph') : t('faktura.zakladBezDph')}
              </span>
              <span className="text-ink tabular-nums">
                {formatMoney(totals.exVatPredSlevou, form.currency, jazyk)}
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
                <span className="text-muted">{t('faktura.zakladBezDphPoSleve')}</span>
                <span className="text-ink tabular-nums">{formatMoney(totals.exVat, form.currency, jazyk)}</span>
              </div>
            )}
            {totals.byRate.map((r) => (
              <div key={r.rate} className="flex items-center justify-between text-sm font-heading">
                <span className="text-muted">{t('faktura.dphSazba', { sazba: r.rate })}</span>
                <span className="text-muted tabular-nums">{formatMoney(r.vat, form.currency, jazyk)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line pt-2 mt-1">
              <span className="font-heading font-semibold text-ink">{t('faktura.kUhrade')}</span>
              <span className="font-display text-xl text-ink tabular-nums">
                {formatMoney(totals.incVat, form.currency, jazyk)}
              </span>
            </div>
            {form.currency !== 'CZK' && (
              <div className="flex items-center justify-between text-xs font-body text-muted">
                <span>{t('faktura.vKorunachKurzem')}</span>
                <span className="tabular-nums">
                  {formatMoney(toCzkMinor(totals.incVat, invoice.exchangeRate), 'CZK', jazyk)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-2">
        <span className="text-xs font-heading text-muted uppercase tracking-wide">
          {t('faktura.poznamkaNaFakture')}
        </span>
        <textarea
          value={form.note}
          disabled={locked}
          onChange={(e) => set('note', e.target.value)}
          rows={3}
          className="rounded-lg border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple w-full disabled:opacity-70"
        />
      </div>

      </div>

      <NahledDokladu telo={nahledTelo} titulek={t('faktura.nahledTitulek')} />
      </div>

      {!jesteNeulozena && (
        <div className="flex flex-col gap-1">
          {/* Pojistka (18. 9. 2026): faktura ani storno nezmizí na jedno
              kliknutí - první klepnutí se jen zeptá. */}
          <TlacitkoSmazat
            onSmazat={remove}
            disabled={saving}
            popisek={
              invoice.status === 'DRAFT'
                ? t('faktura.smazatFakturu')
                : invoice.status === 'CANCELLED'
                  ? t('faktura.smazatNatrvalo')
                  : t('faktura.stornovatFakturu')
            }
            otazka={
              invoice.status === 'DRAFT'
                ? t('faktura.opravduSmazat')
                : invoice.status === 'CANCELLED'
                  ? t('faktura.opravduSmazatNatrvalo')
                  : t('faktura.opravduStornovat')
            }
            trida="self-start"
          />
          {invoice.status === 'CANCELLED' && (
            <span className="text-xs font-body text-muted">{t('faktura.stornovanaZustavaVRade')}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * INTERNÍ ZNAČKA ČÁSTI ZAKÁZKY (zadání 29. 9. 2026).
 *
 * Ukládá se hned při přepnutí a vlastním endpointem, ne s celou fakturou:
 * jde doplnit i k uhrazenému dokladu, kde je běžná úprava zamčená. Na
 * vytištěné faktuře se neobjeví nic.
 */
function CastZakazky({ id, vychozi }: { id: string; vychozi: CastFaktury | null }) {
  const [cast, setCast] = useState<CastFaktury | null>(vychozi);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState(false);

  async function zmen(hodnota: string) {
    const nova = (hodnota || null) as CastFaktury | null;
    const predtim = cast;
    setCast(nova);
    setUklada(true);
    setChyba(false);
    try {
      const res = await fetch(`/api/admin/invoices/${id}/cast`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cast: nova }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Ať na obrazovce nezůstane hodnota, která se neuložila.
      setCast(predtim);
      setChyba(true);
    } finally {
      setUklada(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-body text-muted">
      <span className="sr-only">Část zakázky (interní)</span>
      <select
        value={cast ?? ''}
        disabled={uklada}
        onChange={(e) => void zmen(e.target.value)}
        title="Jen pro nás — na faktuře se to nikde neobjeví."
        className={`rounded-pill border px-2.5 py-1 text-xs font-heading font-semibold bg-field text-ink ${
          chyba ? 'border-danger' : 'border-line'
        }`}
      >
        <option value="">Celá zakázka</option>
        {CASTI_FAKTURY.map((k) => (
          <option key={k} value={k}>
            {POPIS_CASTI[k]}
          </option>
        ))}
      </select>
      {chyba && <span className="text-danger">neuloženo</span>}
    </label>
  );
}
