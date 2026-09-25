'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * ÚDAJE A UPOZORNĚNÍ KLIENTA STUDIA (zadání 25. 9. 2026).
 *
 * TŘI UPOZORNĚNÍ A NIC VÍC: potvrzení rezervace, změna nebo zrušení termínu
 * z naší strany a připomínka den předem. Delší seznam přepínačů si nikdo
 * nenastaví - a tyhle tři pokrývají všechno, co se člověku, který si u nás
 * drží studio, může stát.
 *
 * UKLÁDÁ SE PO ZMĚNĚ, ne tlačítkem: zaškrtávátko, které se tváří uloženě
 * a není, je horší než žádné.
 */
export function UcetForm({
  jmeno,
  email,
  telefon,
  potvrzeni,
  zmena,
  pripominka,
}: {
  jmeno: string;
  email: string;
  telefon: string;
  potvrzeni: boolean;
  zmena: boolean;
  pripominka: boolean;
}) {
  const t = usePreklad();
  const router = useRouter();

  const [poleJmeno, setJmeno] = useState(jmeno);
  const [poleTelefon, setTelefon] = useState(telefon);
  const [volby, setVolby] = useState({ potvrzeni, zmena, pripominka });
  const [bezi, setBezi] = useState(false);
  const [ulozeno, setUlozeno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(data: Record<string, unknown>) {
    setBezi(true);
    setChyba(null);
    setUlozeno(false);
    try {
      const res = await fetch('/api/studio/ucet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const o = await res.json().catch(() => ({}));
        setChyba(o?.error || t('booking.chybaUlozeni'));
        return;
      }
      setUlozeno(true);
      router.refresh();
    } catch {
      setChyba(t('booking.chybaUlozeni'));
    } finally {
      setBezi(false);
    }
  }

  function prepni(klic: 'potvrzeni' | 'zmena' | 'pripominka', hodnota: boolean) {
    setVolby((v) => ({ ...v, [klic]: hodnota }));
    void uloz({ [klic]: hodnota });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-ink m-0">{t('booking.mojeUdaje')}</h2>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-heading text-muted">{t('booking.jmeno')}</span>
          <input
            value={poleJmeno}
            onChange={(e) => setJmeno(e.target.value)}
            onBlur={() => poleJmeno !== jmeno && uloz({ jmeno: poleJmeno })}
            maxLength={200}
            className={pole}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-heading text-muted">{t('booking.telefon')}</span>
          <input
            value={poleTelefon}
            onChange={(e) => setTelefon(e.target.value)}
            onBlur={() => poleTelefon !== telefon && uloz({ telefon: poleTelefon })}
            maxLength={50}
            className={pole}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-heading text-muted">{t('booking.email')}</span>
          <input value={email} readOnly disabled className={`${pole} opacity-70`} />
          <span className="text-[11px] font-body text-muted">{t('booking.emailNapoveda')}</span>
        </label>
      </section>

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-ink m-0">
          {t('booking.upozorneni')}
        </h2>
        <p className="text-xs font-body text-muted m-0">{t('booking.upozorneniPopis')}</p>

        <Prepinac
          zapnuto={volby.potvrzeni}
          onZmena={(v) => prepni('potvrzeni', v)}
          nadpis={t('booking.mailPotvrzeni')}
          popis={t('booking.mailPotvrzeniPopis')}
          bezi={bezi}
        />
        <Prepinac
          zapnuto={volby.zmena}
          onZmena={(v) => prepni('zmena', v)}
          nadpis={t('booking.mailZmena')}
          popis={t('booking.mailZmenaPopis')}
          bezi={bezi}
        />
        <Prepinac
          zapnuto={volby.pripominka}
          onZmena={(v) => prepni('pripominka', v)}
          nadpis={t('booking.mailPripominka')}
          popis={t('booking.mailPripominkaPopis')}
          bezi={bezi}
        />
      </section>

      {chyba && <p className="m-0 text-sm font-body text-status-error">{chyba}</p>}
      {ulozeno && !chyba && (
        <p className="m-0 text-sm font-body text-status-done">{t('booking.ulozeno')}</p>
      )}
    </div>
  );
}

function Prepinac({
  zapnuto,
  onZmena,
  nadpis,
  popis,
  bezi,
}: {
  zapnuto: boolean;
  onZmena: (v: boolean) => void;
  nadpis: string;
  popis: string;
  bezi: boolean;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer border border-line rounded-lg px-3 py-2.5">
      <input
        type="checkbox"
        checked={zapnuto}
        disabled={bezi}
        onChange={(e) => onZmena(e.target.checked)}
        className="mt-0.5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-heading text-ink">{nadpis}</span>
        <span className="block text-xs font-body text-muted">{popis}</span>
      </span>
    </label>
  );
}

const pole =
  'w-full bg-field border border-line rounded-lg px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';
