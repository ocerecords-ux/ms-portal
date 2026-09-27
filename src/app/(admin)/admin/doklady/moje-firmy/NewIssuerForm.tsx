'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddButton } from '@/components/AddButton';
import { AdminField } from '../../NewCompanyForm';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * Založení vlastní fakturační firmy. Stejně jako u Firem stačí vyplnit IČ a
 * zbytek se natáhne z registru - ať se nic nepřepisuje ručně.
 */
export function NewIssuerForm() {
  const t = usePreklad();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ic, setIc] = useState('');
  const [dic, setDic] = useState('');
  const [vatPayer, setVatPayer] = useState(true);
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [email, setEmail] = useState('');
  const [aresBusy, setAresBusy] = useState(false);
  const [aresNote, setAresNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadFromAres() {
    setAresBusy(true);
    setAresNote(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ares?ico=${encodeURIComponent(ic)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('mojeFirmy.registrSelhal'));
        return;
      }
      if (data.name) setName(data.name);
      if (data.dic) setDic(data.dic);
      if (data.vatPayer !== undefined) setVatPayer(Boolean(data.vatPayer));
      if (data.addressStreet) setAddressStreet(data.addressStreet);
      if (data.addressCity) setAddressCity(data.addressCity);
      if (data.addressZip) setAddressZip(data.addressZip);
      setAresNote(t('mojeFirmy.registrDoplneno'));
    } catch {
      setError(t('mojeFirmy.registrSelhal'));
    } finally {
      setAresBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/issuers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ic, dic, vatPayer, addressStreet, addressCity, addressZip, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t('mojeFirmy.zalozeniSelhalo'));
        return;
      }
      setOpen(false);
      router.push(`/admin/doklady/moje-firmy/${data.id}`);
      router.refresh();
    } catch {
      setError(t('mojeFirmy.zalozeniSelhalo'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <AddButton onClick={() => setOpen(true)} className="self-start">
        {t('mojeFirmy.novaFirma')}
      </AddButton>
    );
  }

  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-card p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-display text-xl text-ink m-0">{t('mojeFirmy.novaFakturacniFirma')}</h2>

      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('mojeFirmy.ic')} hint={t('mojeFirmy.icNapoveda')}>
            <input value={ic} onChange={(e) => setIc(e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label={t('mojeFirmy.dic')}>
            <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <button
          type="button"
          onClick={loadFromAres}
          disabled={aresBusy || ic.replace(/\D/g, '').length !== 8}
          className="bg-surface border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[26px]"
        >
          {aresBusy ? t('obecne.nacitam') : t('mojeFirmy.nacistZRegistru')}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

      <AdminField label={t('mojeFirmy.nazevFirmy')} required hint={t('mojeFirmy.nazevFirmyNapoveda')}>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        {t('mojeFirmy.platceDph')}
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label={t('mojeFirmy.ulice')}>
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label={t('mojeFirmy.psc')}>
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.mesto')}>
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label={t('mojeFirmy.emailOdesilatele')} hint={t('mojeFirmy.emailOdesilateleNapoveda')}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <AddButton type="submit" disabled={saving}>
          {saving ? t('obecne.ukladam') : t('mojeFirmy.zalozitFirmu')}
        </AddButton>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          {t('obecne.zrusit')}
        </button>
      </div>
    </form>
  );
}
