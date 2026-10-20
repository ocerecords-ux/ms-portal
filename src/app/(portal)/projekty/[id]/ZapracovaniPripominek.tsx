'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJazyk } from '@/app/(portal)/components/JazykProvider';

/**
 * ZAPRACOVALI JSME PŘIPOMÍNKY (zadání 20. 10. 2026: „pak bych tam dal nějaké
 * tlačítko, když připomínky zapracujeme, aby po stisknutí se nezměnil stav,
 * ale šla notifikace, zapracovali jsme připomínky. I s nějakým přehledem, co
 * bylo zapracované, pro přehled... a ještě tohle se může opakovat několikrát,
 * než to klient schválí" + „a připomínky zmizí, ale měla by tam být nějaká
 * historie, co se upravovalo").
 *
 * STAV SE NEMĚNÍ. Zakázka zůstává „Dokončeno - ke schválení"; tohle je zpráva
 * mezi odevzdáním a schválením, a dá se zmáčknout kolikrát je potřeba.
 *
 * PŘIPOMÍNKY ZE SEZNAMU ZMIZÍ, ale nic se nemaže - visí dál u svého kola
 * a jsou vidět v historii dole. Po třech kolech je to jediné místo, kde se
 * zpětně dočtete, co se vlastně opravovalo.
 *
 * POPISKY JSOU PSANÉ ROVNOU TADY, ne přes `lib/jazyk.ts`: ten má rozepsaný
 * jiný úkol a dvě ruce v jednom souboru končí přepsanou prací. Až bude volný,
 * klíče se tam přesunou.
 */

type Polozka = { id: string; soubor: string; cas: string; text: string; autor: string | null };
type Kolo = {
  id: string;
  poradi: number;
  poznamka: string | null;
  kdoJmeno: string | null;
  prijemci: string[];
  odeslanoAt: string | null;
  kdy: string;
  polozky: Polozka[];
};

const TEXTY = {
  cs: {
    nadpis: 'Zapracované připomínky',
    ceka: (n: number) => `Čeká na zapracování: ${n}`,
    nicNeceka: 'Žádné nové připomínky od klienta.',
    tlacitko: 'Zapracovali jsme připomínky',
    posilam: 'Odesílám…',
    poznamka: 'Poznámka pro klienta (nepovinná)',
    poznamkaPlaceholder: 'Např. „Dotáčku jsme zkrátili a hudbu stáhli pod hlasem."',
    potvrdit: 'Odeslat klientovi',
    zrusit: 'Zrušit',
    vysvetleni:
      'Klientovi odejde zpráva se seznamem toho, co bylo zapracováno. Stav zakázky se nemění — pořád čekáme na schválení.',
    historie: 'Historie úprav',
    koloCislo: (n: number) => `${n}. kolo`,
    neodeslano: 'zpráva neodešla',
    bezPolozek: 'bez položek',
    chyba: 'Nepodařilo se to odeslat.',
  },
  en: {
    nadpis: 'Feedback addressed',
    ceka: (n: number) => `Waiting to be addressed: ${n}`,
    nicNeceka: 'No new feedback from the client.',
    tlacitko: 'We have addressed the feedback',
    posilam: 'Sending…',
    poznamka: 'Note for the client (optional)',
    poznamkaPlaceholder: 'E.g. "We shortened the tag and pulled the music under the voice."',
    potvrdit: 'Send to the client',
    zrusit: 'Cancel',
    vysvetleni:
      'The client gets a message listing what was addressed. The project status stays the same — we are still waiting for approval.',
    historie: 'Revision history',
    koloCislo: (n: number) => `Round ${n}`,
    neodeslano: 'message not sent',
    bezPolozek: 'no items',
    chyba: 'Sending failed.',
  },
};

export function ZapracovaniPripominek({
  caflouProjectId,
  canEdit,
}: {
  caflouProjectId: string;
  canEdit: boolean;
}) {
  const jazyk = useJazyk();
  const t = TEXTY[jazyk === 'en' ? 'en' : 'cs'];
  const router = useRouter();

  const [ceka, setCeka] = useState(0);
  const [kola, setKola] = useState<Kolo[]>([]);
  const [otevreno, setOtevreno] = useState(false);
  const [poznamka, setPoznamka] = useState('');
  const [pracuje, setPracuje] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [rozbalene, setRozbalene] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/zapracovani`);
      if (!res.ok) return;
      const data = (await res.json()) as { ceka?: number; kola?: Kolo[] };
      setCeka(data.ceka ?? 0);
      setKola(data.kola ?? []);
    } catch {
      // Prehled je navic - kdyz se nenacte, tlacitko tim nepada.
    }
  }, [caflouProjectId]);

  useEffect(() => {
    void nacti();
  }, [nacti]);

  async function odesli() {
    if (pracuje) return;
    setPracuje(true);
    setChyba(null);
    try {
      const res = await fetch(`/api/projekty/${encodeURIComponent(caflouProjectId)}/zapracovani`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poznamka: poznamka.trim() || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setChyba(data?.error || t.chyba);
        return;
      }
      setPoznamka('');
      setOtevreno(false);
      await nacti();
      // Seznam pripominek v taggeru se plni ze serveru - at zmizi i tam.
      router.refresh();
    } catch {
      setChyba(t.chyba);
    } finally {
      setPracuje(false);
    }
  }

  const den = (iso: string) =>
    new Intl.DateTimeFormat(jazyk === 'en' ? 'en-GB' : 'cs-CZ', {
      timeZone: 'Europe/Prague',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  if (!canEdit && kola.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-heading font-semibold text-sm text-ink m-0">{t.nadpis}</h3>
        <span className="text-xs font-body text-muted">
          {ceka > 0 ? t.ceka(ceka) : t.nicNeceka}
        </span>
        {canEdit && ceka > 0 && !otevreno && (
          <button
            type="button"
            onClick={() => setOtevreno(true)}
            className="ml-auto shrink-0 rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer"
          >
            {t.tlacitko}
          </button>
        )}
      </div>

      {otevreno && (
        <div className="flex flex-col gap-2 rounded-lg bg-field px-3 py-3">
          <p className="text-xs font-body text-muted m-0">{t.vysvetleni}</p>
          <label className="text-xs font-heading text-muted">{t.poznamka}</label>
          <textarea
            value={poznamka}
            onChange={(e) => setPoznamka(e.target.value)}
            rows={3}
            placeholder={t.poznamkaPlaceholder}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={odesli}
              disabled={pracuje}
              className="rounded-pill bg-brand-purple text-white font-heading font-semibold text-xs px-3.5 py-2 border-0 cursor-pointer disabled:opacity-50"
            >
              {pracuje ? t.posilam : t.potvrdit}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtevreno(false);
                setChyba(null);
              }}
              className="rounded-pill border border-line bg-surface text-muted font-heading font-semibold text-xs px-3.5 py-2 cursor-pointer"
            >
              {t.zrusit}
            </button>
          </div>
        </div>
      )}

      {chyba && (
        <p className="text-xs font-body text-danger m-0" role="alert">
          {chyba}
        </p>
      )}

      {kola.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-heading text-muted uppercase tracking-wide m-0">
            {t.historie}
          </p>
          {kola.map((k) => (
            <div key={k.id} className="rounded-lg border border-line bg-field/40 px-3 py-2">
              <button
                type="button"
                onClick={() => setRozbalene((r) => (r === k.id ? null : k.id))}
                className="w-full text-left text-xs font-body text-muted hover:text-ink"
              >
                {rozbalene === k.id ? '▾ ' : '▸ '}
                <span className="font-heading font-semibold text-ink">{t.koloCislo(k.poradi)}</span>
                {' · '}
                {den(k.kdy)}
                {k.kdoJmeno ? ` · ${k.kdoJmeno}` : ''}
                {' · '}
                {k.polozky.length > 0 ? `${k.polozky.length}×` : t.bezPolozek}
                {!k.odeslanoAt && ` · ${t.neodeslano}`}
              </button>

              {rozbalene === k.id && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {k.poznamka && (
                    <p className="text-xs font-body text-ink m-0 italic">{k.poznamka}</p>
                  )}
                  {k.polozky.map((p) => (
                    <p key={p.id} className="text-xs font-body text-ink m-0">
                      <span className="font-heading font-semibold tabular-nums">{p.cas}</span>{' '}
                      {p.text}
                      {p.autor ? <span className="text-muted"> · {p.autor}</span> : null}
                      <span className="text-muted"> · {p.soubor}</span>
                    </p>
                  ))}
                  {k.prijemci.length > 0 && (
                    <p className="text-[11px] font-body text-muted m-0">{k.prijemci.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
