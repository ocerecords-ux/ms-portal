'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sestavWikitext, type UdajeOsoby } from '@/lib/wikipedieUdaje';
import { UdajeForm } from './UdajeForm';
import { WikiChat } from './WikiChat';
import {
  ADRESA_OAUTH,
  JAZYKY_WIKI,
  adresaPiskoviste,
  adresaRegistrace,
  adresaWiki,
  pravidlaWiki,
  type JazykWiki,
} from '@/lib/wikipedie';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';
import { kodJazyka, prelozitKolem, prelozitNaKusy, type Jazyk } from '@/lib/jazyk';

/**
 * Editor konceptu článku na Wikipedii (zadání 22. 9. 2026). Vlevo wikitext,
 * vpravo náhled vykreslený Wikipedií, dole hlídání živého článku a verze.
 */

type Pocatecni = {
  jazyk: string;
  nazev: string;
  wikitext: string;
  udaje: UdajeOsoby;
  sledovanyNazev: string;
  /** Je uložený přístupový token k Wikipedii? Samotný token se sem nikdy nedostane. */
  maToken: boolean;
  cilStranka: string;
  ulozeno: string | null;
  posledniKontrola: string | null;
  chybaKontroly: string | null;
};
type Verze = { id: string; kdy: string; autor: string | null };
type Revize = { revid: number; kdy: string; kdo: string; shrnuti: string; velikost: number; diff: string };

const karta = 'bg-surface rounded-card border border-line shadow-sm p-5 flex flex-col gap-3';
const pole =
  'rounded-lg border border-line bg-field px-3 py-2 text-sm font-heading text-ink outline-none focus:border-brand-purple';
const tlacitko =
  'bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 hover:bg-brand-purpleDeep transition-colors disabled:opacity-60';
const tlacitko2 =
  'font-heading font-semibold text-sm rounded-lg border border-line px-4 py-2 text-ink no-underline hover:border-brand-purple transition-colors bg-transparent cursor-pointer disabled:opacity-60';

/**
 * Datum s časem KRÁTCE, bez roku v plné podobě - `formatDatumCas`
 * z lib/jazyk.ts sází rok naplno a tady by to řádek rozhodilo.
 * Anglicky vyjde „13/09/2026, 14:32".
 */
function datum(iso: string, jazyk: Jazyk): string {
  return new Intl.DateTimeFormat(kodJazyka(jazyk), { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function obalNahledu(html: string, jazyk: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="https://${jazyk}.wikipedia.org/wiki/" target="_blank">
<style>
body{font-family:Georgia,'Linux Libertine',serif;color:#202122;background:#fff;margin:0;padding:20px 24px;line-height:1.6;font-size:15px}
h1,h2,h3{font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid #a2a9b1;margin:1.2em 0 .4em}
h3{border:0;font-weight:bold;font-family:sans-serif;font-size:1em}
a{color:#3366cc;text-decoration:none} a.new{color:#d73333}
table.infobox{float:right;clear:right;width:22em;margin:0 0 1em 1em;border:1px solid #a2a9b1;background:#f8f9fa;font-size:88%;border-collapse:collapse}
table.infobox th,table.infobox td{padding:.2em .4em;vertical-align:top;text-align:left}
.mw-references-wrap,ol.references{font-size:90%}
sup.reference{font-size:75%}
.navbox,.mw-empty-elt{display:none}
</style></head><body>${html}</body></html>`;
}

export function WikipedieEditor({ pocatecni, verze: verzePocatecni }: { pocatecni: Pocatecni; verze: Verze[] }) {
  const t = usePreklad();
  const jazykPortalu = useJazyk();
  const [jazyk, setJazyk] = useState<JazykWiki>((JAZYKY_WIKI as readonly string[]).includes(pocatecni.jazyk) ? (pocatecni.jazyk as JazykWiki) : 'cs');
  const [nazev, setNazev] = useState(pocatecni.nazev);
  const [wikitext, setWikitext] = useState(pocatecni.wikitext);
  const [udaje, setUdaje] = useState<UdajeOsoby>(pocatecni.udaje);
  const [zalozka, setZalozka] = useState<'udaje' | 'text'>('udaje');
  const [sledovany, setSledovany] = useState(pocatecni.sledovanyNazev);
  const [ulozeno, setUlozeno] = useState(pocatecni.ulozeno);
  const [ulozenyStav, setUlozenyStav] = useState({
    jazyk,
    nazev,
    wikitext,
    sledovany: pocatecni.sledovanyNazev,
    udaje: JSON.stringify(pocatecni.udaje),
  });
  const [verze, setVerze] = useState(verzePocatecni);
  const [pracuje, setPracuje] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  /** Poslední text, který vyrobilo „Sestavit" - podle něj se pozná ruční úprava. */
  const poslednSestaveny = useRef('');

  const [nahled, setNahled] = useState<string | null>(null);
  const [nahledChyba, setNahledChyba] = useState<string | null>(null);
  const [nahledNacita, setNahledNacita] = useState(false);

  // Odesílání na Wikipedii (22. 9. 2026).
  const [token, setToken] = useState('');
  const [maToken, setMaToken] = useState(pocatecni.maToken);
  const [cil, setCil] = useState(pocatecni.cilStranka);
  const [shrnutiUpravy, setShrnutiUpravy] = useState('');
  const [odesilam, setOdesilam] = useState(false);
  const [odeslano, setOdeslano] = useState<string | null>(null);

  const [revize, setRevize] = useState<Revize[] | null>(null);
  const [stavChyba, setStavChyba] = useState<string | null>(null);
  const [existuje, setExistuje] = useState<boolean | null>(null);

  // Dokud koncept nikdy uložený nebyl, jde uložit i beze změny.
  const zmeneno =
    !ulozeno ||
    jazyk !== ulozenyStav.jazyk ||
    nazev !== ulozenyStav.nazev ||
    wikitext !== ulozenyStav.wikitext ||
    sledovany !== ulozenyStav.sledovany ||
    JSON.stringify(udaje) !== ulozenyStav.udaje;

  const pocetSlov = useMemo(() => wikitext.replace(/<!--[\s\S]*?-->/g, '').split(/\s+/).filter(Boolean).length, [wikitext]);
  // Pojmenovaná reference použitá víckrát je jeden zdroj.
  const pocetZdroju = useMemo(() => {
    const znacky = wikitext.replace(/<!--[\s\S]*?-->/g, '').match(/<ref(\s[^>]*)?>/g) ?? [];
    const jmena = new Set<string>();
    let bezJmena = 0;
    for (const z of znacky) {
      const m = z.match(/name\s*=\s*"?([^"\/>]+?)"?\s*\/?>$/) ?? z.match(/name\s*=\s*"([^"]+)"/);
      if (m) jmena.add(m[1].trim());
      else if (!z.endsWith('/>')) bezJmena += 1;
    }
    return jmena.size + bezJmena;
  }, [wikitext]);

  // Neuložené změny - upozornit před odchodem ze stránky.
  useEffect(() => {
    if (!zmeneno) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [zmeneno]);

  /** Z formuláře poskládá wikitext. Ručně upravený text nepřepíše bez dotazu. */
  function sestav() {
    const novy = sestavWikitext(udaje);
    const rucne = wikitext.trim() && wikitext !== poslednSestaveny.current && wikitext !== pocatecni.wikitext;
    if (rucne && !window.confirm(t('wiki.prepsatPotvrzeni'))) return;
    poslednSestaveny.current = novy;
    setWikitext(novy);
    setNazev((n) => n || udaje.jmeno);
    setZalozka('text');
    setHlaska(t('wiki.sestaveno'));
  }

  async function uloz() {
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/wikipedie', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jazyk, nazev, wikitext, udaje, sledovanyNazev: sledovany || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ulozeno?: string; verze?: Verze[] };
      if (!res.ok) {
        setChyba(data.error || t('firma.ulozeniNezdarilo'));
        return;
      }
      setUlozeno(data.ulozeno ?? new Date().toISOString());
      if (data.verze) setVerze(data.verze);
      setUlozenyStav({ jazyk, nazev, wikitext, sledovany, udaje: JSON.stringify(udaje) });
      setHlaska(t('prodleva.ulozeno'));
    } catch {
      setChyba(t('vzory.bezSpojeni'));
    } finally {
      setPracuje(false);
    }
  }

  async function nactiNahled() {
    setNahledNacita(true);
    setNahledChyba(null);
    try {
      const res = await fetch('/api/admin/wikipedie/nahled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jazyk, nazev, wikitext }),
      });
      const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        setNahledChyba(data.error || t('wiki.nahledNepodaril'));
        return;
      }
      setNahled(data.html);
    } catch {
      setNahledChyba(t('vzory.bezSpojeni'));
    } finally {
      setNahledNacita(false);
    }
  }

  async function kopiruj() {
    try {
      await navigator.clipboard.writeText(wikitext);
      setHlaska(t('wiki.wikitextVeSchrance'));
    } catch {
      setChyba(t('wiki.kopirovaniNepodarilo'));
    }
  }

  async function obnovVerzi(id: string) {
    setChyba(null);
    const res = await fetch(`/api/admin/wikipedie?verze=${encodeURIComponent(id)}`);
    const data = (await res.json().catch(() => ({}))) as { wikitext?: string; error?: string };
    if (!res.ok || data.wikitext === undefined) {
      setChyba(data.error || t('wiki.verziNeulozena'));
      return;
    }
    setWikitext(data.wikitext);
    setHlaska(t('wiki.starsiVerze'));
  }

  /** Vloží návrh z chatu do konceptu - přidá na konec, nebo celý nahradí. */
  function vlozZChatu(navrh: string, nahradit: boolean) {
    if (nahradit && !window.confirm(t('wiki.nahraditPotvrzeni'))) return;
    setWikitext((s) => (nahradit ? `${navrh}\n` : `${s.replace(/\s+$/, '')}\n\n${navrh}\n`));
    setZalozka('text');
    setHlaska(nahradit ? t('wiki.konceptNahrazen') : t('wiki.textPridan'));
  }

  async function ulozToken() {
    setPracuje(true);
    setChyba(null);
    setHlaska(null);
    try {
      const res = await fetch('/api/admin/wikipedie/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ulozen?: boolean };
      if (!res.ok) {
        setChyba(data.error || t('wiki.tokenNeulozen'));
        return;
      }
      setMaToken(Boolean(data.ulozen));
      setToken('');
      setHlaska(t('wiki.tokenUlozen'));
    } catch {
      setChyba(t('vzory.bezSpojeni'));
    } finally {
      setPracuje(false);
    }
  }

  async function smazToken() {
    if (!window.confirm(t('wiki.smazatTokenPotvrzeni'))) return;
    setToken('');
    setPracuje(true);
    try {
      await fetch('/api/admin/wikipedie/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });
      setMaToken(false);
      setHlaska(t('wiki.tokenSmazan'));
    } finally {
      setPracuje(false);
    }
  }

  /** Odeslání uložené verze na Wikipedii - vždy s potvrzením, je to veřejná úprava. */
  async function odesli() {
    const kam = cil.trim();
    if (!kam) return;
    if (!window.confirm(t('wiki.odeslatPotvrzeni', { kam }))) return;
    setOdesilam(true);
    setChyba(null);
    setHlaska(null);
    setOdeslano(null);
    try {
      const res = await fetch('/api/admin/wikipedie/odeslat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cil: kam, shrnuti: shrnutiUpravy.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok || !data.url) {
        setChyba(data.error || t('wiki.odeslaniNepovedlo'));
        return;
      }
      setOdeslano(data.url);
      setHlaska(t('wiki.hotovoNaWiki'));
      if (!sledovany.trim()) setSledovany(kam);
    } catch {
      setChyba(t('vzory.bezSpojeni'));
    } finally {
      setOdesilam(false);
    }
  }

  async function nactiStav() {
    if (!sledovany.trim()) return;
    setStavChyba(null);
    setRevize(null);
    try {
      const res = await fetch(`/api/admin/wikipedie/stav?jazyk=${jazyk}&nazev=${encodeURIComponent(sledovany.trim())}`);
      const data = (await res.json().catch(() => ({}))) as { existuje?: boolean; revize?: Revize[]; error?: string };
      if (!res.ok) {
        setStavChyba(data.error || t('wiki.neodpovedela'));
        return;
      }
      setExistuje(Boolean(data.existuje));
      setRevize(data.revize ?? []);
    } catch {
      setStavChyba(t('vzory.bezSpojeni'));
    }
  }

  useEffect(() => {
    if (pocatecni.sledovanyNazev) void nactiStav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {chyba && <p className="text-sm text-danger bg-dangerTint border border-line rounded-lg px-3 py-2 m-0">{chyba}</p>}
      {hlaska && <p className="text-sm text-ink bg-tint border border-line rounded-lg px-3 py-2 m-0">{hlaska}</p>}

      {/* Jak na to - účet, pravidla, kam vložit. */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">{t('wiki.jakNaTo')}</h2>
        <ol className="text-sm font-body text-ink m-0 pl-5 flex flex-col gap-1.5">
          {/* Dvě věty mají uprostřed odkaz - celá věta je jeden klíč
              a rozdělí se až tady (pravidlo 7). */}
          <li>
            {prelozitKolem(jazykPortalu, 'wiki.krokUcet', 'odkaz')[0]}
            <a href={adresaRegistrace(jazyk)} target="_blank" rel="noreferrer" className="text-brand-purple">
              {t('wiki.vytvoritUcet')}
            </a>
            {prelozitKolem(jazykPortalu, 'wiki.krokUcet', 'odkaz')[1]}
          </li>
          <li>{t('wiki.krokStretZajmu')}</li>
          <li>{t('wiki.krokZdroje')}</li>
          <li>
            {prelozitKolem(jazykPortalu, 'wiki.krokPiskoviste', 'odkaz')[0]}
            <a href={adresaPiskoviste(jazyk)} target="_blank" rel="noreferrer" className="text-brand-purple">
              {t('wiki.piskoviste')}
            </a>
            {prelozitKolem(jazykPortalu, 'wiki.krokPiskoviste', 'odkaz')[1]}
          </li>
          <li>{t('wiki.krokHlidani')}</li>
        </ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body">
          <span className="text-muted">{t('wiki.pravidla')}</span>
          {pravidlaWiki(jazyk).map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="text-brand-purple">
              {p.nazev} ↗
            </a>
          ))}
        </div>
      </div>

      {/* Koncept */}
      <div className={karta}>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">{t('wiki.nazevClanku')}</span>
            <input value={nazev} onChange={(e) => setNazev(e.target.value)} className={pole} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">{t('wiki.wikipedie')}</span>
            <select value={jazyk} onChange={(e) => setJazyk(e.target.value as JazykWiki)} className={pole}>
              {JAZYKY_WIKI.map((j) => (
                <option key={j} value={j}>
                  {j}.wikipedia.org
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={uloz} disabled={pracuje || !zmeneno} className={tlacitko}>
            {pracuje ? t('obecne.ukladam') : zmeneno ? t('obecne.ulozit') : t('vzory.ulozeno')}
          </button>
          <button type="button" onClick={nactiNahled} disabled={nahledNacita} className={tlacitko2}>
            {nahledNacita ? t('wiki.vykresluji') : t('wiki.nahled')}
          </button>
          <button type="button" onClick={kopiruj} className={tlacitko2}>
            {t('wiki.kopirovatWikitext')}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap border-t border-line pt-3">
          <div className="flex rounded-lg border border-line overflow-hidden">
            {(['udaje', 'text'] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZalozka(z)}
                className={`font-heading font-semibold text-sm px-4 py-2 border-0 cursor-pointer ${
                  zalozka === z ? 'bg-brand-purple text-white' : 'bg-transparent text-ink'
                }`}
              >
                {t(z === 'udaje' ? 'wiki.zalozkaUdaje' : 'wiki.zalozkaText')}
              </button>
            ))}
          </div>
          {zalozka === 'udaje' && (
            <button type="button" onClick={sestav} className={tlacitko}>
              {t('wiki.sestavit')}
            </button>
          )}
        </div>
        <p className="text-xs font-body text-muted m-0">
          {t('wiki.slov', { pocet: pocetSlov })} ·{' '}
          {t(
            pocetZdroju === 1
              ? 'wiki.zdrojJeden'
              : pocetZdroju >= 2 && pocetZdroju <= 4
                ? 'wiki.zdrojeMalo'
                : 'wiki.zdrojuMnoho',
            { pocet: pocetZdroju },
          )}
          {ulozeno
            ? t('wiki.ulozenoKdy', { kdy: datum(ulozeno, jazykPortalu) })
            : t('wiki.zatimNeulozeno')}
          {zmeneno ? t('wiki.neulozeneZmeny') : ''}
        </p>
        {zalozka === 'udaje' && (
          <>
            <p className="text-sm font-body text-muted m-0 max-w-[80ch]">{t('wiki.sestavitPopis')}</p>
            <UdajeForm udaje={udaje} zmena={setUdaje} />
          </>
        )}
        <div className={`${zalozka === 'text' ? 'grid' : 'hidden'} grid-cols-1 xl:grid-cols-2 gap-4`}>
          <textarea
            value={wikitext}
            onChange={(e) => setWikitext(e.target.value)}
            spellCheck
            className="w-full min-h-[560px] rounded-lg border border-line bg-field px-3 py-2 text-[13px] leading-relaxed font-mono text-ink outline-none focus:border-brand-purple resize-y"
          />
          <div className="flex flex-col gap-2 min-h-[560px]">
            {nahledChyba && <p className="text-sm text-danger m-0">{nahledChyba}</p>}
            {nahled ? (
              <iframe
                title={t('wiki.nahledTitul')}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={obalNahledu(nahled, jazyk)}
                className="w-full flex-1 min-h-[560px] rounded-lg border border-line bg-white"
              />
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-line flex items-center justify-center text-sm font-body text-muted p-6 text-center">
                {t('wiki.nahledPrazdny')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hlídání živého článku */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">{t('wiki.hlidani')}</h2>
        <p className="text-sm font-body text-muted m-0 max-w-[75ch]">{t('wiki.hlidaniPopis')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={sledovany}
            onChange={(e) => setSledovany(e.target.value)}
            placeholder={t('wiki.zatimNehlidano')}
            className={`${pole} flex-1 min-w-[240px]`}
          />
          <button type="button" onClick={nactiStav} disabled={!sledovany.trim()} className={tlacitko2}>
            {t('wiki.zkontrolovatTed')}
          </button>
          {sledovany.trim() && (
            <a href={adresaWiki(jazyk, sledovany)} target="_blank" rel="noreferrer" className="text-sm text-brand-purple font-heading">
              {t('wiki.otevritClanek')}
            </a>
          )}
        </div>
        {pocatecni.posledniKontrola && (
          <p className="text-xs font-body text-muted m-0">
            {t('wiki.posledniKontrola', { kdy: datum(pocatecni.posledniKontrola, jazykPortalu) })}
            {pocatecni.chybaKontroly ? ` - ${pocatecni.chybaKontroly}` : ''}
          </p>
        )}
        {stavChyba && <p className="text-sm text-danger m-0">{stavChyba}</p>}
        {existuje === false && <p className="text-sm font-body text-muted m-0">{t('wiki.strankaNeni')}</p>}
        {revize && revize.length > 0 && (
          <table className="w-full border-collapse text-sm font-body">
            <tbody>
              {revize.map((r) => (
                <tr key={r.revid} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-muted whitespace-nowrap">{datum(r.kdy, jazykPortalu)}</td>
                  <td className="py-1.5 pr-3 text-ink whitespace-nowrap">{r.kdo}</td>
                  <td className="py-1.5 pr-3 text-muted">{r.shrnuti || '—'}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <a href={r.diff} target="_blank" rel="noreferrer" className="text-brand-purple">
                      {t('wiki.rozdil')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Vzpomínání - chat, který z vyprávění píše wikitext (22. 9. 2026). */}
      <WikiChat pripraveno={Boolean(ulozeno)} onVlozit={vlozZChatu} />

      {/* Odesílání na Wikipedii */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">{t('wiki.odeslani')}</h2>
        {/* Věta má DVA vložené kusy - odkaz a kurzívu. Zůstává jedním klíčem
            a rozseká ji prelozitNaKusy (pravidlo 7). */}
        <p className="text-sm font-body text-muted m-0 max-w-[80ch]">
          {prelozitNaKusy(jazykPortalu, 'wiki.odeslaniPopis', ['odkaz', 'jmeno']).map((kus, i) =>
            kus.znacka === 'odkaz' ? (
              <a key={i} href={ADRESA_OAUTH} target="_blank" rel="noreferrer" className="text-brand-purple">
                {t('wiki.vytvoritToken')}
              </a>
            ) : kus.znacka === 'jmeno' ? (
              <em key={i}>{t('wiki.vaseJmeno')}</em>
            ) : (
              <span key={i}>{kus.text}</span>
            ),
          )}
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 flex-1 min-w-[260px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">{t('wiki.token')}</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={maToken ? t('wiki.tokenUlozeny') : t('wiki.tokenPlaceholder')}
              autoComplete="off"
              className={pole}
            />
          </label>
          <button type="button" onClick={ulozToken} disabled={pracuje || !token.trim()} className={tlacitko2}>
            {t('wiki.ulozitToken')}
          </button>
          {maToken && (
            <button type="button" onClick={smazToken} disabled={pracuje} className={tlacitko2}>
              {t('wiki.smazatToken')}
            </button>
          )}
        </div>
        <div className="flex items-end gap-3 flex-wrap border-t border-line pt-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[260px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">{t('wiki.kamUlozit')}</span>
            <input
              value={cil}
              onChange={(e) => setCil(e.target.value)}
              placeholder="Wikipedista:VaseJmeno/Pískoviště"
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">{t('wiki.shrnutiUpravy')}</span>
            <input
              value={shrnutiUpravy}
              onChange={(e) => setShrnutiUpravy(e.target.value)}
              placeholder={t('wiki.shrnutiPlaceholder')}
              className={pole}
            />
          </label>
          <button type="button" onClick={odesli} disabled={odesilam || !maToken || !cil.trim() || zmeneno} className={tlacitko}>
            {odesilam ? t('wiki.odesilam') : t('wiki.odeslat')}
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">
          {t('wiki.odeslaniPoznamka')}
          {zmeneno ? t('wiki.odeslaniZamceno') : ''}
        </p>
        {odeslano && (
          <p className="text-sm font-body text-ink m-0">
            {t('wiki.ulozenoNaWiki')}{' '}
            <a href={odeslano} target="_blank" rel="noreferrer" className="text-brand-purple">
              {t('wiki.otevritStranku')}
            </a>
          </p>
        )}
      </div>

      {/* Verze */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">{t('wiki.ulozeneVerze')}</h2>
        {verze.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">{t('wiki.zadnaVerze')}</p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col">
            {verze.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-sm font-body">
                <span className="text-ink">
                  {datum(v.kdy, jazykPortalu)}
                  {v.autor ? <span className="text-muted"> · {v.autor}</span> : null}
                </span>
                <button type="button" onClick={() => obnovVerzi(v.id)} className="text-brand-purple bg-transparent border-0 cursor-pointer font-heading text-sm">
                  {t('wiki.nacistDoEditoru')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
