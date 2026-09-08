'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminField } from '../../NewCompanyForm';

/**
 * Založení vlastní fakturační firmy. Stejně jako u Firem stačí vyplnit IČ a
 * zbytek se natáhne z registru - ať se nic nepřepisuje ručně.
 */
export function NewIssuerForm() {
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
        setError(data?.error || 'Načtení z registru se nezdařilo.');
        return;
      }
      if (data.name) setName(data.name);
      if (data.dic) setDic(data.dic);
      if (data.vatPayer !== undefined) setVatPayer(Boolean(data.vatPayer));
      if (data.addressStreet) setAddressStreet(data.addressStreet);
      if (data.addressCity) setAddressCity(data.addressCity);
      if (data.addressZip) setAddressZip(data.addressZip);
      setAresNote('Údaje z registru doplněny — zkontrolujte a uložte.');
    } catch {
      setError('Načtení z registru se nezdařilo.');
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
        setError(data?.error || 'Firmu se nepodařilo založit.');
        return;
      }
      setOpen(false);
      router.push(`/admin/doklady/moje-firmy/${data.id}`);
      router.refresh();
    } catch {
      setError('Firmu se nepodařilo založit.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors self-start"
      >
        + Nová firma
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-line rounded-card p-6 flex flex-col gap-4 max-w-2xl">
      <h2 className="font-display text-xl text-ink m-0">Nová fakturační firma</h2>

      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[140px]">
          <AdminField label="IČ" hint="vyplňte a načtěte zbytek z registru">
            <input value={ic} onChange={(e) => setIc(e.target.value)} inputMode="numeric" className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[140px]">
          <AdminField label="DIČ">
            <input value={dic} onChange={(e) => setDic(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <button
          type="button"
          onClick={loadFromAres}
          disabled={aresBusy || ic.replace(/\D/g, '').length !== 8}
          className="bg-white border border-line text-ink font-heading font-semibold text-sm rounded-lg px-4 py-2.5 hover:bg-field transition-colors disabled:opacity-40 mb-[26px]"
        >
          {aresBusy ? 'Načítám…' : 'Načíst z registru'}
        </button>
      </div>

      {aresNote && <p className="text-sm text-brand-greenDeep m-0">{aresNote}</p>}

      <AdminField label="Název firmy" required hint="ve fakturačních údajích píšeme MEDIA SPACE s.r.o.">
        <input required value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </AdminField>

      <label className="flex items-center gap-2 text-sm font-heading text-ink">
        <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        Plátce DPH
      </label>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-[2] min-w-[220px]">
          <AdminField label="Ulice a číslo popisné">
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[120px]">
          <AdminField label="PSČ">
            <input value={addressZip} onChange={(e) => setAddressZip(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <AdminField label="Město">
            <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
        <div className="flex-1 min-w-[180px]">
          <AdminField label="E-mail odesílatele" hint="z něj chodí nabídky a faktury">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" />
          </AdminField>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60"
        >
          {saving ? 'Ukládám…' : 'Založit firmu'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-muted text-sm font-heading">
          Zrušit
        </button>
      </div>
    </form>
  );
}
