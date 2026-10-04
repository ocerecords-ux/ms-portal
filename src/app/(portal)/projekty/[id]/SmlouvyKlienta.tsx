'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DatumPole } from '@/components/DatumPole';
import { formatDatum, formatDatumCas, type Jazyk } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * SMLOUVY OD KLIENTA (zadání 21. 9. 2026: „potřebuju někam do dokladů projektu
 * nahrát smlouvu v PDF, kterou nám posílá k podpisu klient na práci. Ve chvíli,
 * kdy ji vkládám, už je podepsaná, chci ji jen archivovat. A taky tam chci
 * nějaké tlačítko, když ji tam Karolína vloží, tak ho zmáčkne a Bruno napíše
 * třeba soukromě do chatu Báře Šiblové, že je tam podepsaná smlouva").
 *
 * Nahrání: PDF jde rovnou z prohlížeče do úložiště (jako přílohy v chatu),
 * pak se uloží záznam. U každé smlouvy je tlačítko „Dát vědět Báře" - Bruno
 * jí napíše soukromou zprávu; komu, jde přepnout.
 */
type Smlouva = {
  id: string;
  nazev: string;
  nazevSouboru: string;
  velikost: number | null;
  podepsanoDne: string | null;
  nahralJmeno: string | null;
  createdAt: string;
  oznamenoAt: string | null;
  oznamenoKomu: string | null;
};
type Clovek = { id: string; jmeno: string };

const krestni = (jmeno: string) => jmeno.split(' ')[0];

/**
 * Třetí pád křestního jména pro tlačítko („Báře"). Běžné tvary, jinak jméno.
 * Angličtina pády nemá, takže v ní zůstává křestní jméno, jak je.
 */
function komu3(jmeno: string, jazyk: Jazyk): string {
  const k = krestni(jmeno);
  if (jazyk === 'en') return k;
  const vyjimky: Record<string, string> = { Bára: 'Báře', Barbora: 'Barboře', Karolína: 'Karolíně', Helena: 'Heleně', Helca: 'Helce' };
  if (vyjimky[k]) return vyjimky[k];
  if (/ka$/.test(k)) return k.replace(/ka$/, 'ce');
  if (/a$/.test(k)) return k.replace(/a$/, 'e');
  return k;
}

const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple';

export function SmlouvyKlienta({ caflouProjectId }: { caflouProjectId: string }) {
  const jazyk = useJazyk();
  const t = usePreklad();
  const datum = (iso: string) => formatDatum(jazyk, new Date(iso));
  const datumCas = (iso: string) => formatDatumCas(jazyk, new Date(iso));
  const adresa = `/api/projekty/${encodeURIComponent(caflouProjectId)}/smlouvy-klienta`;
  const [smlouvy, setSmlouvy] = useState<Smlouva[]>([]);
  const [vychozi, setVychozi] = useState<Clovek | null>(null);
  const [lide, setLide] = useState<Clovek[]>([]);
  const [soubor, setSoubor] = useState<File | null>(null);
  const [nazev, setNazev] = useState('');
  const [podepsano, setPodepsano] = useState('');
  const [bezi, setBezi] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [vyberKomu, setVyberKomu] = useState<string | null>(null);
  const [komu, setKomu] = useState('');
  const vstup = useRef<HTMLInputElement | null>(null);

  const nacti = useCallback(async () => {
    const r = await fetch(adresa).catch(() => null);
    const d = r && r.ok ? await r.json().catch(() => null) : null;
    if (!d) return;
    setSmlouvy(d.smlouvy ?? []);
    setVychozi(d.vychoziPrijemce ?? null);
    setLide(d.lide ?? []);
  }, [adresa]);

  useEffect(() => {
    void nacti();
  }, [nacti]);

  function vyber(f: File | null) {
    setChyba(null);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      setChyba(t('smlouvyKl.jenPdf'));
      return;
    }
    setSoubor(f);
    setNazev(f.name.replace(/\.pdf$/i, ''));
  }

  async function nahraj() {
    if (!soubor || bezi) return;
    setBezi('nahravam');
    setChyba(null);
    try {
      const r1 = await fetch(adresa, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ akce: 'nahrat', nazevSouboru: soubor.name }),
      });
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1?.error || t('smlouvyKl.nejdePripravit'));

      const r2 = await fetch(d1.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: soubor });
      if (!r2.ok) throw new Error(t('smlouvyKl.nejdeDoUloziste'));

      const r3 = await fetch(adresa, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          akce: 'ulozit',
          klic: d1.key,
          nazevSouboru: soubor.name,
          nazev: nazev.trim() || null,
          podepsanoDne: podepsano || null,
        }),
      });
      const d3 = await r3.json().catch(() => ({}));
      if (!r3.ok) throw new Error(d3?.error || t('smlouvyKl.nejdeUlozit'));
      setSmlouvy(d3.smlouvy ?? []);
      setSoubor(null);
      setNazev('');
      setPodepsano('');
      setHlaska(t('smlouvyKl.ulozeno'));
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('smlouvyKl.nejdeNahrat'));
    } finally {
      setBezi(null);
    }
  }

  async function oznam(id: string, prijemce?: string) {
    setBezi(id);
    setChyba(null);
    setHlaska(null);
    const r = await fetch(adresa, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ akce: 'oznamit', id, komu: prijemce || null }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBezi(null);
    if (!r || !r.ok) {
      setChyba(d?.error || t('smlouvyKl.nejdeZprava'));
      return;
    }
    setSmlouvy(d.smlouvy ?? []);
    setVyberKomu(null);
    setHlaska(t('smlouvyKl.brunoNapsal', { komu: d.komu ? komu3(d.komu, jazyk) : '' }));
  }

  async function smaz(id: string) {
    if (!window.confirm(t('smlouvyKl.odebratDotaz'))) return;
    const r = await fetch(`${adresa}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setSmlouvy(d.smlouvy ?? []);
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0">
      <h3 className="font-heading font-semibold text-xs text-muted uppercase tracking-wide m-0">
        {t('smlouvyKl.nadpis')}{' '}
        {smlouvy.length > 0 && <span className="tabular-nums opacity-70">({smlouvy.length})</span>}
      </h3>

      {smlouvy.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-col gap-0.5">
          {smlouvy.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surfaceSoft flex-wrap">
              <span aria-hidden="true" className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-brand-purple/10 text-brand-purple text-[10px] font-heading font-bold">
                PDF
              </span>
              <a
                href={`${adresa}?soubor=${encodeURIComponent(s.id)}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 no-underline"
                title={t('smlouvyKl.otevritPdf')}
              >
                <span className="block text-sm font-heading font-semibold text-ink truncate">{s.nazev}</span>
                <span className="block text-xs text-muted font-body">
                  {s.podepsanoDne ? t('smlouvyKl.podepsana', { datum: datum(s.podepsanoDne) }) : ''}
                  {t('smlouvyKl.nahral', { jmeno: s.nahralJmeno ?? '—', datum: datum(s.createdAt) })}
                </span>
              </a>
              <a
                href={`${adresa}?soubor=${encodeURIComponent(s.id)}&stahnout=1`}
                className="text-xs font-heading font-semibold text-brand-purple no-underline hover:underline"
              >
                {t('smlouvyKl.stahnout')}
              </a>
              {s.oznamenoAt ? (
                <span
                  className="inline-flex items-center text-xs font-heading font-semibold px-2.5 py-1 rounded-pill bg-okTint text-status-done whitespace-nowrap"
                  title={t('smlouvyKl.daloVedet', { datum: datumCas(s.oznamenoAt) })}
                >
                  ✓{' '}
                  {s.oznamenoKomu
                    ? t('smlouvyKl.kdoVi', { jmeno: krestni(s.oznamenoKomu) })
                    : t('smlouvyKl.oznameno')}
                </span>
              ) : null}
              {vyberKomu === s.id ? (
                <span className="flex items-center gap-1.5">
                  <select value={komu} onChange={(e) => setKomu(e.target.value)} className={`${pole} py-1 text-xs`}>
                    {lide.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.jmeno}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bezi === s.id || !komu}
                    onClick={() => void oznam(s.id, komu)}
                    className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    {t('smlouvyKl.poslat')}
                  </button>
                  <button type="button" onClick={() => setVyberKomu(null)} className="text-xs text-muted hover:text-ink">
                    ×
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={bezi === s.id || !vychozi}
                    onClick={() => void oznam(s.id)}
                    title={
                      vychozi
                        ? t('smlouvyKl.bublinaBruno', { jmeno: vychozi.jmeno })
                        : t('smlouvyKl.bublinaNikdo')
                    }
                    className="bg-brand-purple text-white font-heading font-semibold text-xs rounded-lg px-3 py-1.5 hover:bg-brand-purpleDeep disabled:opacity-50 whitespace-nowrap"
                  >
                    {bezi === s.id
                      ? t('smlouvyKl.posilam')
                      : t(s.oznamenoAt ? 'smlouvyKl.znovuDatVedet' : 'smlouvyKl.datVedet', {
                          komu: vychozi ? komu3(vychozi.jmeno, jazyk) : '',
                        })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKomu(vychozi?.id ?? lide[0]?.id ?? '');
                      setVyberKomu(s.id);
                    }}
                    title={t('smlouvyKl.jinemu')}
                    className="text-xs text-muted hover:text-brand-purple px-1"
                  >
                    ▾
                  </button>
                </span>
              )}
              <button type="button" onClick={() => void smaz(s.id)} title={t('smlouvyKl.odebrat')} className="text-xs text-muted hover:text-danger px-1">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {soubor ? (
        <div className="flex flex-col gap-2 rounded-lg border border-brand-purple/40 bg-tint/40 p-3">
          <span className="text-xs font-body text-muted">
            {t('smlouvyKl.souborKb', {
              nazev: soubor.name,
              kb: Math.max(1, Math.round(soubor.size / 1024)),
            })}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-body text-ink">{t('smlouvyKl.nazev')}</span>
              <input value={nazev} onChange={(e) => setNazev(e.target.value)} className={pole} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-body text-ink">
                {t('smlouvyKl.podepsanaDne')} <span className="text-muted">{t('smlouvyKl.nepovinne')}</span>
              </span>
              <DatumPole value={podepsano} onChange={(e) => setPodepsano(e.target.value)} className={pole} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void nahraj()}
              disabled={bezi === 'nahravam'}
              className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {bezi === 'nahravam' ? t('smlouvyKl.nahravam') : t('smlouvyKl.ulozitSmlouvu')}
            </button>
            <button type="button" onClick={() => setSoubor(null)} className="text-sm font-heading text-muted hover:text-ink">
              {t('smlouvyKl.zrusit')}
            </button>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            vyber(e.dataTransfer.files?.[0] ?? null);
          }}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm font-heading text-muted cursor-pointer hover:border-brand-purple hover:text-brand-purple transition-colors"
        >
          {t('smlouvyKl.pretahnete')}
          <input
            ref={vstup}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              vyber(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {chyba && <p className="text-sm text-danger m-0">{chyba}</p>}
      {hlaska && <p className="text-sm text-status-done m-0">{hlaska}</p>}
    </div>
  );
}
