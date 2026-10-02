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

/**
 * Karta firmy (zadani 6. 9. 2026). Fakturacni udaje - IC, DIC, platce DPH,
 * adresa po castech a splatnost - vedeme nove u OBOU typu firem, drive je mel
 * jen dodavatel. Sazba za normostranu se ukazuje jen u klienta, ktery ma
 * zaskrtnute Audioknihy (u reklamnich klientu se bude pocitat z Ceniku).
 */
export function CompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const t = usePreklad();
  const jazyk = useJazyk();
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
  const [caflouCompanyId, setCaflouCompanyId] = useState(company.caflouCompanyId ?? '');
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
                caflouCompanyId,
                driveFolderUrl: driveUrl,
                dealsAudiobooks,
                dealsAds,
                audioknihyNaKlic: dealsAudiobooks ? naKlic : false,
                cenuUrcujeKlient: dealsAudiobooks ? cenuUrcujeKlient : false,
                fakturujeNaCasti: naCasti,
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

          {/* Sazba za normostranu dava smysl jen u audioknih - u reklamnich
              klientu se cena bude pocitat kalkulackou nad Cenikem. A u firmy,
              ktera si cenu navrhuje sama, se nepouzije vubec. */}
          {dealsAudiobooks && !cenuUrcujeKlient && (
            <AdminField label={t('firma.sazba')} required>
              <input required type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="admin-input" />
            </AdminField>
          )}

          <AdminField label={t('firma.caflouId')} hint={t('firma.caflouIdHint')}>
            <input value={caflouCompanyId} onChange={(e) => setCaflouCompanyId(e.target.value)} placeholder={t('firma.caflouIdPlaceholder')} className="admin-input" />
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
