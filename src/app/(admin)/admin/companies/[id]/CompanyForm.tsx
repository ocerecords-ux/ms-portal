'use client';

import { useState } from 'react';
import { Volba } from '@/components/Volba';
import { useRouter } from 'next/navigation';
import { SmazatSPrekazkami } from '@/components/SmazatSPrekazkami';
import { AdminField } from '../../NewCompanyForm';
import { CountrySelect } from '../../CountrySelect';
import type { Company } from '@prisma/client';
import { nazevTypuFirmy } from '@/lib/roles';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { CURRENCIES, CURRENCY_LABELS, nazevMeny } from '@/lib/doklady';
import type { Currency } from '@prisma/client';

/**
 * Karta firmy (zadani 6. 9. 2026). Fakturacni udaje - IC, DIC, platce DPH,
 * adresa po castech a splatnost - vedeme nove u OBOU typu firem, drive je mel
 * jen dodavatel. Sazba za normostranu se ukazuje jen u klienta, ktery ma
 * zaskrtnute Audioknihy (u reklamnich klientu se bude pocitat z Ceniku).
 */
export function CompanyForm({
  company,
  ucty = [],
  naseFirmy = [],
}: {
  company: Company;
  /**
   * Účty téhle firmy (12. 10. 2026) - z nich se vybírá, kdo si u ní chodí
   * režírovat. Prázdné u dodavatele, který přihlašovací účty nemá.
   */
  ucty?: { id: string; name: string | null; email: string }[];
  /**
   * Naše firmy (12. 10. 2026) - pod kterou z nich tenhle klient jede. Viz
   * lib/naseFirmy.ts. S jedinou naší firmou se pole nenabízí.
   */
  naseFirmy?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
  /** Popisky psané rovnou v komponentě - viz komentář u pole s fakturami. */
  const jeAnglicky = jazyk === 'en';
  const isClient = company.type === 'KLIENT';

  const [name, setName] = useState(company.name);
  const [ic, setIc] = useState(company.ic ?? '');
  const [dic, setDic] = useState(company.dic ?? '');
  const [vatPayer, setVatPayer] = useState(company.vatPayer);
  const [bankAccount, setBankAccount] = useState(company.bankAccount ?? '');
  const [addressStreet, setAddressStreet] = useState(company.addressStreet ?? company.address ?? '');
  const [addressCity, setAddressCity] = useState(company.addressCity ?? '');
  const [addressZip, setAddressZip] = useState(company.addressZip ?? '');
  const [addressCountry, setAddressCountry] = useState(company.addressCountry ?? DEFAULT_COUNTRY);
  const [paymentTermDays, setPaymentTermDays] = useState(String(company.paymentTermDays ?? ''));

  const [contactName, setContactName] = useState(company.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(company.contactEmail ?? '');
  /**
   * KAM POSÍLAT CENOVÉ NABÍDKY (zadání 12. 10. 2026: „potřebuju ještě u firem
   * nastavit zvlášť maily na zasílání cenových nabídek").
   *
   * Řádek na každou adresu, ne jeden text oddělený čárkami - u hostů natáčení
   * se ukázalo (9. 10. 2026), že z rozdělování podle čárek vznikají chyby,
   * které jsou vidět až v odeslaném mailu.
   */
  const [nabidkyEmaily, setNabidkyEmaily] = useState<string[]>(
    ((company as { nabidkyEmaily?: string[] }).nabidkyEmaily ?? []).filter(Boolean),
  );
  /**
   * KAM POSÍLAT FAKTURY (zadání 20. 10. 2026: „u klientů reklam nastavím maily
   * zvlášť na zasílání nabídek a faktur"). Totéž co u nabídek: vyplněný
   * seznam nahrazuje kontaktní e-mail firmy, prázdný nechává vše po staru.
   */
  const [fakturyEmaily, setFakturyEmaily] = useState<string[]>(
    ((company as { fakturyEmaily?: string[] }).fakturyEmaily ?? []).filter(Boolean),
  );
  const [contactPhone, setContactPhone] = useState(company.contactPhone ?? '');
  /**
   * Komu chodí faktury (zadání 13. 9. 2026: „nastavoval bych to u firem
   * v detailu - primární mail a k tomu zaškrtávátko Klient").
   *
   * Na kontaktní e-mail jde faktura vždycky, tam bývá účetní odběratele.
   * Zaškrtnutí k tomu přidá člověka, který má u nich na starost ten konkrétní
   * projekt - portál si ho vezme z projektu, ke kterému je faktura navázaná,
   * takže se nikde nevypisuje ručně a u každé faktury vyjde ten správný.
   */
  const [fakturyKlientovi, setFakturyKlientovi] = useState(company.fakturyKlientovi ?? false);

  const [rate, setRate] = useState(String(company.ratePerPage ?? ''));
  /**
   * MĚNA KLIENTA (zadání 12. 10. 2026: „u té britské firmy potřebuju nějak
   * nastavit sazbu za NS v librách"). Platí pro sazbu za normostranu
   * a předběžnou cenu v objednávce; dokladu se jen předvyplní.
   */
  // Tagování finálních nahrávek (14. 10. 2026) - zatím jen Albatros.
  const [tagyPovoleny, setTagyPovoleny] = useState<boolean>(
    Boolean((company as { tagyPovoleny?: boolean }).tagyPovoleny),
  );
  const [tagyVydavatel, setTagyVydavatel] = useState<string>(
    (company as { tagyVydavatel?: string | null }).tagyVydavatel ?? '',
  );
  const [mena, setMena] = useState<Currency>(
    ((company as { mena?: Currency }).mena ?? 'CZK') as Currency,
  );
  const [driveUrl, setDriveUrl] = useState(company.driveFolderUrl ?? '');
  const [dealsAudiobooks, setDealsAudiobooks] = useState(company.dealsAudiobooks);
  const [dealsAds, setDealsAds] = useState(company.dealsAds);
  /**
   * Audioknihy na klíč (zadání 14. 9. 2026: „jsou firmy, pro které děláme
   * audioknihy na klíč a ještě k tomu platíme herce a někdy tam zahrnujeme
   * jednorázové položky jako přeposlech a úpravu textu").
   *
   * Zaškrtnutím se v rozpočtu projektu otevřou další položky a celkový
   * rozpočet se ziskem z knihy. Rozpočtu na výrobu se to nedotkne.
   */
  const [naKlic, setNaKlic] = useState(company.audioknihyNaKlic ?? false);
  /**
   * Cenu navrhuje klient (zadání 23. 9. 2026: „u Albatrosu bych dal pryč
   * výpočet ceny z normostran"). Objednávka pak cenu nepočítá - klient si ji
   * do ní napíše sám a sazba za normostranu není potřeba.
   */
  const [cenuUrcujeKlient, setCenuUrcujeKlient] = useState(company.cenuUrcujeKlient ?? false);
  /**
   * Fakturujeme téhle firmě na dvě části (zadání 30. 9. 2026: „ty části
   * faktur mají být jen u Albatrosu"). Jen tehdy se u faktury z nabídky
   * předvyplní a nabídne značka 1. / 2. část.
   */
  const [naCasti, setNaCasti] = useState(company.fakturujeNaCasti ?? false);
  /**
   * HUDBU K AUDIOKNIHÁM DODÁVÁ KLIENT (zadání 17. 10. 2026: „hudbu nevybírám
   * u firem Jan Melvil, Audiolibrix a Čti mi").
   *
   * Je to příznak u firmy, ne seznam jmen v kódu - firem přibývá. Když je
   * zaškrtnutý, portál tři dny před první frekvencí neupozorní nás, ale pošle
   * klientovi odkaz, kterým hudbu vloží sám.
   */
  const [hudbuDodavaKlient, setHudbuDodavaKlient] = useState(
    company.hudbuDodavaKlient ?? false,
  );
  /**
   * REŽII SI DĚLÁ KLIENT (zadání 12. 10. 2026: „u klienta Jan Melvil si chodí
   * režírovat Veronika González první frekvence vždy sama. Takže já u režie
   * na dálku nejsem").
   *
   * Vybírá se ÚČET, ne jméno: ten člověk si pak v natáčecím plánu zaškrtává,
   * na které další frekvence přijde, takže ho portál musí poznat podle
   * přihlášení. První frekvenci každého herce dostane automaticky.
   */
  /**
   * POD KTEROU NAŠI FIRMU TENHLE KLIENT PATŘÍ (zadání 12. 10. 2026: „určitě
   * potřebuji oddělit účetnictví, ale zároveň chci ponechat řízení projektů
   * a kalendáře v jednom portálu").
   *
   * Účetnictví se dělí podle klienta: nabídky, faktury, smlouvy i výdaje
   * u jeho zakázek jdou pod tuhle naši firmu. Prázdné = výchozí firma.
   */
  const [vydavatelId, setVydavatelId] = useState(
    (company as { vydavatelId?: string | null }).vydavatelId ?? '',
  );
  const [rezieKlientaUserId, setRezieKlientaUserId] = useState(
    (company as { rezieKlientaUserId?: string | null }).rezieKlientaUserId ?? '',
  );
  // Vyrazeni misto mazani (zadani 10. 9. 2026): na firme visi doklady
  // a projekty, ktere musi zustat citelne.
  const [aktivni, setAktivni] = useState(company.active);
  const [vyrazuje, setVyrazuje] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aresBusy, setAresBusy] = useState(false);
  const [aresNote, setAresNote] = useState<string | null>(null);

  /** Nacteni udaju z ARES podle IC (zadani 6. 9. 2026). */
  async function loadFromAres() {
    setAresBusy(true);
    setAresNote(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ares?ico=${encodeURIComponent(ic)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('firma.aresNezdarilo'));
        return;
      }
      if (data.name) setName(data.name);
      if (data.dic) setDic(data.dic);
      if (data.vatPayer !== undefined) setVatPayer(Boolean(data.vatPayer));
      if (data.addressStreet) setAddressStreet(data.addressStreet);
      if (data.addressCity) setAddressCity(data.addressCity);
      if (data.addressZip) setAddressZip(data.addressZip);
      if (data.addressCountry) setAddressCountry(data.addressCountry);
      setAresNote(t('firma.aresDoplneno'));
    } catch {
      setError(t('firma.aresNezdarilo'));
    } finally {
      setAresBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: company.type,
          name,
          ic,
          dic,
          vatPayer,
          bankAccount,
          addressStreet,
          addressCity,
          addressZip,
          addressCountry,
          paymentTermDays,
          contactName,
          contactEmail,
          contactPhone,
          fakturyKlientovi,
          ...(isClient
            ? {
                ratePerPage: dealsAudiobooks ? rate : '',
                driveFolderUrl: driveUrl,
                dealsAudiobooks,
                dealsAds,
                audioknihyNaKlic: dealsAudiobooks ? naKlic : false,
                cenuUrcujeKlient: dealsAudiobooks ? cenuUrcujeKlient : false,
                fakturujeNaCasti: naCasti,
                hudbuDodavaKlient: dealsAudiobooks ? hudbuDodavaKlient : false,
                rezieKlientaUserId: rezieKlientaUserId || null,
                vydavatelId: vydavatelId || null,
                mena,
                tagyPovoleny,
                tagyVydavatel: tagyPovoleny ? tagyVydavatel : '',
                nabidkyEmaily: nabidkyEmaily.map((e) => e.trim()).filter(Boolean),
                fakturyEmaily: fakturyEmaily.map((e) => e.trim()).filter(Boolean),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('firma.ulozeniNezdarilo'));
      }
      setSaved(true);
      setAresNote(null);
      // Po ulozeni zpet na seznam firem (zadani 8. 9. 2026: "když uložím
      // firmu, tak se uloží a vrátí na seznam firem") - rovnou na záložku,
      // ze ktere firma je. Tlacitko zamerne zustava neaktivni, dokud
      // prechod neprobehne, aby nesly odeslat dva pozadavky za sebou.
      router.push(`/admin?tab=${company.type === 'KLIENT' ? 'klienti' : 'dodavatele'}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('firma.ulozeniNezdarilo'));
      setSaving(false);
    }
  }

  /**
   * Vyřadí firmu, nebo ji vrátí mezi aktivní.
   *
   * Schválně se nemaže: na firmě visí faktury, nabídky, smlouvy a projekty
   * a smazáním by o svou firmu přišly. Vyřazená firma zmizí z nabídek
   * a seznamů, ale všechno, co na ni odkazuje, zůstane čitelné - a dá se to
   * kdykoliv vrátit.
   */
  async function prepniVyrazeni() {
    const nove = !aktivni;
    setVyrazuje(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: company.type, name, active: nove }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || t('firma.zmenaNezdarila'));
        return;
      }
      setAktivni(nove);
      router.refresh();
    } catch {
      setError(t('firma.zmenaNezdarila'));
    } finally {
      setVyrazuje(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4">
      <p className="text-xs font-heading text-muted uppercase tracking-wide -mb-1">
        {t('firma.typFirmy')} <span className="text-ink">{nazevTypuFirmy(company.type, jazyk)}</span>
      </p>

      <AdminField label={t('firma.nazev')} required>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('firma.ic')}>
            <input value={ic} onChange={(e) => setIc(e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('firma.dic')}>
            <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <button
          type="button"
          onClick={loadFromAres}
          disabled={aresBusy || ic.replace(/\D/g, '').length !== 8}
          title={t('firma.nacistZRegistruTitul')}
          className="bg-surface border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[2px]"
        >
          {aresBusy ? t('obecne.nacitam') : t('firma.nacistZRegistru')}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        {t('firma.platceDph')}
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label={t('firma.ulice')}>
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label={t('firma.psc')}>
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firma.mesto')}>
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firma.zeme')}>
            <CountrySelect value={addressCountry} onChange={setAddressCountry} />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firma.cisloUctu')}>
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('firma.splatnost')} hint={t('firma.splatnostHint')}>
            <input
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
              inputMode="numeric"
              placeholder="14"
              className="admin-input"
            />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firma.kontaktniOsoba')}>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firma.sloupecEmail')} hint={t('firma.emailHint')}>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[160px]">
          <AdminField label={t('firma.sloupecTelefon')}>
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {/* KAM POSÍLAT CENOVÉ NABÍDKY (12. 10. 2026). Prázdné = jako dosud,
          tedy klientovi vedenému u projektu a teprve pak na kontakt firmy. */}
      <AdminField label={t('firma.nabidkyEmaily')} hint={t('firma.nabidkyEmailyHint')}>
        <div className="flex flex-col gap-2">
          {nabidkyEmaily.map((mail, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                value={mail}
                placeholder="nakup@firma.cz"
                onChange={(e) =>
                  setNabidkyEmaily((p) => p.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="admin-input flex-1"
              />
              <button
                type="button"
                onClick={() => setNabidkyEmaily((p) => p.filter((_, j) => j !== i))}
                title={t('obecne.odebrat')}
                aria-label={t('obecne.odebrat')}
                className="shrink-0 w-9 h-9 rounded-lg border border-line text-muted hover:text-danger hover:border-danger transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setNabidkyEmaily((p) => [...p, ''])}
            className="self-start inline-flex items-center gap-1.5 font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer"
          >
            + {t('firma.nabidkyPridatMail')}
          </button>
        </div>
      </AdminField>

      {/**
        * KAM POSÍLAT FAKTURY (20. 10. 2026). Prázdné = kontaktní e-mail firmy,
        * jako dosud. Popisek je zatím psaný rovnou tady, ne přes slovník -
        * `lib/jazyk.ts` má rozepsaný jiný úkol a dvě ruce v jednom souboru
        * končí přepsanou prací; klíče se tam přesunou, až bude volný.
        */}
      <AdminField
        label={jeAnglicky ? 'E-mails for invoices' : 'Maily na zasílání faktur'}
        hint={
          jeAnglicky
            ? 'When filled in, invoices go here instead of the company contact e-mail. Empty = as before.'
            : 'Když je vyplněné, faktury chodí sem místo na kontaktní e-mail firmy. Prázdné = jako dosud.'
        }
      >
        <div className="flex flex-col gap-2">
          {fakturyEmaily.map((mail, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                value={mail}
                placeholder="fakturace@firma.cz"
                onChange={(e) =>
                  setFakturyEmaily((p) => p.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="admin-input flex-1"
              />
              <button
                type="button"
                onClick={() => setFakturyEmaily((p) => p.filter((_, j) => j !== i))}
                title={t('obecne.odebrat')}
                aria-label={t('obecne.odebrat')}
                className="shrink-0 w-9 h-9 rounded-lg border border-line text-muted hover:text-danger hover:border-danger transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFakturyEmaily((p) => [...p, ''])}
            className="self-start inline-flex items-center gap-1.5 font-heading font-semibold text-sm rounded-lg px-3.5 py-2 border border-line text-brand-purple hover:bg-tint transition-colors cursor-pointer"
          >
            + {t('firma.nabidkyPridatMail')}
          </button>
        </div>
      </AdminField>

      <label className="flex items-start gap-2 text-sm font-heading text-ink">
        <input
          type="checkbox"
          checked={fakturyKlientovi}
          onChange={(e) => setFakturyKlientovi(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t('firma.fakturyKlientovi')}
          <br />
          <span className="text-xs font-body text-muted">{t('firma.fakturyKlientoviPopis')}</span>
        </span>
      </label>

      {isClient && (
        <>
          {/* Tahle dve zaskrtavatka rozhoduji i o ZNENI ZPRAV klientovi
              (zadani 14. 9. 2026): kdo dela jen reklamy, dostava reklamni
              vzory a jedinou zpravu ve stavu „Dokonceno - ke schvaleni". */}
          <AdminField label={t('firma.druhZakazek')} hint={t('firma.druhZakazekHint')}>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                <Volba vybrano={dealsAudiobooks} onZmena={setDealsAudiobooks}>
                  {t('firma.audioknihy')}
                </Volba>
                <Volba vybrano={dealsAds} onZmena={setDealsAds}>
                  {t('firma.reklamy')}
                </Volba>
              </div>
              <span className="text-xs font-body text-muted">{t('firma.druhZakazekPopis')}</span>
            </div>
          </AdminField>

          {/* TAGY FINÁLNÍ NAHRÁVKY (zadání 14. 10. 2026: „mělo by to fungovat
              u Albatrosu jen zatím"). Záložka Tagy u projektu se ukáže jen
              firmám, které to mají zapnuté tady - ne podle názvu firmy v kódu. */}
          <AdminField label={t('firma.tagyPovoleny')}>
            <div className="flex flex-col gap-1.5">
              <Volba vybrano={tagyPovoleny} onZmena={setTagyPovoleny}>
                {t('firma.tagyPovoleny')}
              </Volba>
              <span className="text-xs font-body text-muted">{t('firma.tagyPovolenyPopis')}</span>
            </div>
          </AdminField>

          {tagyPovoleny && (
            <AdminField label={t('firma.tagyVydavatel')} hint={t('firma.tagyVydavatelHint')}>
              <input
                value={tagyVydavatel}
                onChange={(e) => setTagyVydavatel(e.target.value)}
                placeholder="Voxi"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
              />
            </AdminField>
          )}

          {/* Na klic = platime i herce a jednorazove veci. Ukazuje se jen
              u audioknih, u reklamy ten pojem nedava smysl. */}
          {dealsAudiobooks && (
            <AdminField label={t('firma.naKlic')} hint={t('firma.naKlicHint')}>
              <label className="flex items-center gap-2 text-sm font-heading text-ink">
                <input type="checkbox" checked={naKlic} onChange={(e) => setNaKlic(e.target.checked)} />
                {t('firma.delameNaKlic')}
              </label>
            </AdminField>
          )}

          {/* Cenu navrhuje klient (23. 9. 2026) - pak se z normostran nic
              nepocita a sazba neni potreba. */}
          {dealsAudiobooks && (
            <AdminField label={t('firma.cenuUrcujeKlient')} hint={t('firma.cenuUrcujeKlientHint')}>
              <label className="flex items-center gap-2 text-sm font-heading text-ink">
                <input
                  type="checkbox"
                  checked={cenuUrcujeKlient}
                  onChange={(e) => setCenuUrcujeKlient(e.target.checked)}
                />
                {t('firma.cenuSiNavrhuje')}
              </label>
            </AdminField>
          )}

          {/* Fakturace na dve casti (30. 9. 2026) - jen u firmy, ktera to tak
              opravdu ma. Nesouvisi s druhem zakazek, proto bez podminky. */}
          <AdminField label={t('firma.naCasti')} hint={t('firma.naCastiHint')}>
            <label className="flex items-center gap-2 text-sm font-heading text-ink">
              <input type="checkbox" checked={naCasti} onChange={(e) => setNaCasti(e.target.checked)} />
              {t('firma.naCastiVolba')}
            </label>
          </AdminField>

          {/* HUDBU DODÁVÁ KLIENT (17. 10. 2026) - jen u firmy, která u nás
              dělá audioknihy; u reklamy se hudba vede v Rodném listu. */}
          {dealsAudiobooks && (
            <AdminField label={t('firma.hudbaKlient')} hint={t('firma.hudbaKlientHint')}>
              <label className="flex items-center gap-2 text-sm font-heading text-ink">
                <input
                  type="checkbox"
                  checked={hudbuDodavaKlient}
                  onChange={(e) => setHudbuDodavaKlient(e.target.checked)}
                />
                {t('firma.hudbaKlientVolba')}
              </label>
            </AdminField>
          )}

          {/* POD KTEROU NAŠI FIRMU KLIENT PATŘÍ (12. 10. 2026). Nabízí se jen
              tehdy, když máme firem víc - jinak není z čeho vybírat. */}
          {naseFirmy.length > 1 && (
            <AdminField label={t('firma.naseFirma')} hint={t('firma.naseFirmaHint')}>
              <select
                value={vydavatelId}
                onChange={(e) => setVydavatelId(e.target.value)}
                className="admin-input"
              >
                <option value="">{t('firma.naseFirmaVychozi')}</option>
                {naseFirmy.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </AdminField>
          )}

          {/* REŽII SI DĚLÁ KLIENT (12. 10. 2026). Pole se nabízí jen tehdy,
              když firma vůbec nějaké přihlašovací účty má - jinak není
              z čeho vybírat. */}
          {ucty.length > 0 && (
            <AdminField label={t('firma.rezieKlienta')} hint={t('firma.rezieKlientaHint')}>
              <select
                value={rezieKlientaUserId}
                onChange={(e) => setRezieKlientaUserId(e.target.value)}
                className="admin-input"
              >
                <option value="">{t('firma.rezieKlientaNikdo')}</option>
                {ucty.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name?.trim() || u.email}
                  </option>
                ))}
              </select>
            </AdminField>
          )}

          {/* Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              klientu se cena bude pocitat kalkulackou nad Cenikem. A u firmy,
              ktera si cenu navrhuje sama, se nepouzije vubec. */}
          {dealsAudiobooks && !cenuUrcujeKlient && (
            <AdminField label={t('firma.sazba', { mena: CURRENCY_LABELS[mena] })} required>
              <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
            </AdminField>
          )}

          {/* MĚNA KLIENTA (12. 10. 2026). Nabízí se u každého klienta, ne jen
              u audioknih: v téhle měně se mu počítá sazba za normostranu
              i předběžná cena v objednávce a předvyplní se na dokladu. */}
          <AdminField label={t('firma.mena')} hint={t('firma.menaHint')}>
            <select
              value={mena}
              onChange={(e) => setMena(e.target.value as Currency)}
              className="admin-input"
            >
              {CURRENCIES.map((m) => (
                <option key={m} value={m}>
                  {nazevMeny(m, jazyk)}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label={t('firma.drive')}>
            <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="admin-input" />
          </AdminField>
        </>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? t('obecne.ukladam') : t('firma.ulozitZmeny')}
        </button>
        {saved && <span className="text-status-done text-sm font-heading">{t('firma.ulozeno')}</span>}
      </div>

      {/* Vyrazeni misto mazani (zadani 10. 9. 2026). */}
      <div className="border-t border-line pt-4 flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <p className="font-heading font-semibold text-sm text-ink m-0">
            {aktivni ? t('firma.vyradit') : t('firma.jeVyrazena')}
          </p>
          <p className="text-xs font-body text-muted m-0 mt-1">
            {aktivni ? t('firma.vyraditPopis') : t('firma.vyrazenaPopis')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void prepniVyrazeni()}
          disabled={vyrazuje}
          className={`font-heading font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors disabled:opacity-60 ${
            aktivni
              ? 'border border-line text-danger hover:bg-dangerTint'
              : 'bg-brand-green text-onAccent hover:brightness-95'
          }`}
        >
          {vyrazuje ? t('firma.menim') : aktivni ? t('firma.vyradit') : t('firma.vratitMeziAktivni')}
        </button>
      </div>

      {/* Tvrde smazani (zadani 10. 9. 2026). Kdyz na firme neco visi, portal
          nabidne archivaci - viz SmazatSPrekazkami. */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-heading font-semibold text-sm text-ink m-0">{t('firma.smazatUplne')}</p>
          <p className="text-xs font-body text-muted m-0 mt-1">{t('firma.smazatUplnePopis')}</p>
        </div>
        <SmazatSPrekazkami
          url={`/api/admin/companies/${company.id}`}
          co={t('firma.smazatCo', { nazev: company.name })}
          popisek={t('firma.smazatPopisek')}
          onSmazano={() => {
            router.push('/admin');
            router.refresh();
          }}
        />
      </div>

    </form>
  );
}
