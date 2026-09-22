'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sestavWikitext, type UdajeOsoby } from '@/lib/wikipedieUdaje';
import { UdajeForm } from './UdajeForm';
import {
  ADRESA_OAUTH,
  JAZYKY_WIKI,
  adresaPiskoviste,
  adresaRegistrace,
  adresaWiki,
  pravidlaWiki,
  type JazykWiki,
} from '@/lib/wikipedie';

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

function datum(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
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
    if (rucne && !window.confirm('Text v záložce Wikitext se přepíše textem z údajů. Pokračovat?')) return;
    poslednSestaveny.current = novy;
    setWikitext(novy);
    setNazev((n) => n || udaje.jmeno);
    setZalozka('text');
    setHlaska('Text je sestavený z údajů - projděte ho a uložte.');
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
        setChyba(data.error || 'Uložení se nezdařilo.');
        return;
      }
      setUlozeno(data.ulozeno ?? new Date().toISOString());
      if (data.verze) setVerze(data.verze);
      setUlozenyStav({ jazyk, nazev, wikitext, sledovany, udaje: JSON.stringify(udaje) });
      setHlaska('Uloženo.');
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
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
        setNahledChyba(data.error || 'Náhled se nepodařil.');
        return;
      }
      setNahled(data.html);
    } catch {
      setNahledChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setNahledNacita(false);
    }
  }

  async function kopiruj() {
    try {
      await navigator.clipboard.writeText(wikitext);
      setHlaska('Wikitext je ve schránce - vložte ho na Wikipedii.');
    } catch {
      setChyba('Kopírování se nepodařilo - označte text ručně (Cmd+A, Cmd+C).');
    }
  }

  async function obnovVerzi(id: string) {
    setChyba(null);
    const res = await fetch(`/api/admin/wikipedie?verze=${encodeURIComponent(id)}`);
    const data = (await res.json().catch(() => ({}))) as { wikitext?: string; error?: string };
    if (!res.ok || data.wikitext === undefined) {
      setChyba(data.error || 'Verzi se nepodařilo načíst.');
      return;
    }
    setWikitext(data.wikitext);
    setHlaska('Starší verze je v editoru - uložte ji, pokud ji chcete ponechat.');
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
        setChyba(data.error || 'Token se nepodařilo uložit.');
        return;
      }
      setMaToken(Boolean(data.ulozen));
      setToken('');
      setHlaska('Token je uložený.');
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
    } finally {
      setPracuje(false);
    }
  }

  async function smazToken() {
    if (!window.confirm('Opravdu token smazat? Odesílání z portálu pak nebude fungovat.')) return;
    setToken('');
    setPracuje(true);
    try {
      await fetch('/api/admin/wikipedie/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });
      setMaToken(false);
      setHlaska('Token je smazaný.');
    } finally {
      setPracuje(false);
    }
  }

  /** Odeslání uložené verze na Wikipedii - vždy s potvrzením, je to veřejná úprava. */
  async function odesli() {
    const kam = cil.trim();
    if (!kam) return;
    if (!window.confirm(`Uložit koncept na Wikipedii jako „${kam}"? Úprava bude veřejná a pod vaším účtem.`)) return;
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
        setChyba(data.error || 'Odeslání se nepovedlo.');
        return;
      }
      setOdeslano(data.url);
      setHlaska('Hotovo — text je na Wikipedii.');
      if (!sledovany.trim()) setSledovany(kam);
    } catch {
      setChyba('Nepodařilo se spojit se serverem.');
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
        setStavChyba(data.error || 'Wikipedie neodpověděla.');
        return;
      }
      setExistuje(Boolean(data.existuje));
      setRevize(data.revize ?? []);
    } catch {
      setStavChyba('Nepodařilo se spojit se serverem.');
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
        <h2 className="font-heading font-semibold text-base text-ink m-0">Jak článek dostat na Wikipedii</h2>
        <ol className="text-sm font-body text-ink m-0 pl-5 flex flex-col gap-1.5">
          <li>
            Založte si účet na Wikipedii (zdarma, stačí jméno a heslo):{' '}
            <a href={adresaRegistrace(jazyk)} target="_blank" rel="noreferrer" className="text-brand-purple">
              vytvořit účet ↗
            </a>
            . Heslo zadáváte jen tam, portál ho nikdy nevidí.
          </li>
          <li>
            Na své uživatelské stránce uveďte, že píšete o sobě (střet zájmů). Wikipedie to vyžaduje a článek
            bez toho snadno smaže.
          </li>
          <li>
            Každé tvrzení doložte nezávislým zdrojem (rozhovor, článek v médiích) - vlastní web nestačí. Pište
            věcně, bez hodnocení.
          </li>
          <li>
            Wikitext zkopírujte a vložte do svého{' '}
            <a href={adresaPiskoviste(jazyk)} target="_blank" rel="noreferrer" className="text-brand-purple">
              pískoviště ↗
            </a>
            . Odtud ho po kontrole zkušenější wikipedista přesune mezi články - o pomoc se dá požádat na
            diskusní stránce pískoviště.
          </li>
          <li>Až bude článek venku, napište jeho název do Hlídání dole.</li>
        </ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-body">
          <span className="text-muted">Pravidla:</span>
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
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Název článku</span>
            <input value={nazev} onChange={(e) => setNazev(e.target.value)} className={pole} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Wikipedie</span>
            <select value={jazyk} onChange={(e) => setJazyk(e.target.value as JazykWiki)} className={pole}>
              {JAZYKY_WIKI.map((j) => (
                <option key={j} value={j}>
                  {j}.wikipedia.org
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={uloz} disabled={pracuje || !zmeneno} className={tlacitko}>
            {pracuje ? 'Ukládám…' : zmeneno ? 'Uložit' : 'Uloženo'}
          </button>
          <button type="button" onClick={nactiNahled} disabled={nahledNacita} className={tlacitko2}>
            {nahledNacita ? 'Vykresluji…' : 'Náhled'}
          </button>
          <button type="button" onClick={kopiruj} className={tlacitko2}>
            Kopírovat wikitext
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
                {z === 'udaje' ? 'Údaje o sobě' : 'Wikitext'}
              </button>
            ))}
          </div>
          {zalozka === 'udaje' && (
            <button type="button" onClick={sestav} className={tlacitko}>
              Sestavit text z údajů
            </button>
          )}
        </div>
        <p className="text-xs font-body text-muted m-0">
          {pocetSlov} slov · {pocetZdroju} {pocetZdroju === 1 ? 'zdroj' : pocetZdroju >= 2 && pocetZdroju <= 4 ? 'zdroje' : 'zdrojů'}
          {ulozeno ? ` · uloženo ${datum(ulozeno)}` : ' · zatím neuloženo'}
          {zmeneno ? ' · máte neuložené změny' : ''}
        </p>
        {zalozka === 'udaje' && (
          <>
            <p className="text-sm font-body text-muted m-0 max-w-[80ch]">
              Vyplňte, co o sobě chcete mít v článku. „Sestavit text z údajů" z toho poskládá celý wikitext
              i s referencemi a přepíše jím záložku Wikitext — ručních úprav textu se tedy předtím zeptá.
            </p>
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
                title="Náhled článku"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={obalNahledu(nahled, jazyk)}
                className="w-full flex-1 min-h-[560px] rounded-lg border border-line bg-white"
              />
            ) : (
              <div className="flex-1 rounded-lg border border-dashed border-line flex items-center justify-center text-sm font-body text-muted p-6 text-center">
                Klikněte na Náhled - Wikipedie text vykreslí tak, jak by vypadal v článku (šablony, odkazy, reference).
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hlídání živého článku */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">Hlídání článku</h2>
        <p className="text-sm font-body text-muted m-0 max-w-[75ch]">
          Název stránky na Wikipedii, jak je v adrese (např. „Ondřej Černý (režisér)“). Portál ji kontroluje každou
          hodinu a o každé cizí úpravě vám dá vědět zvonkem. Nezapomeňte uložit.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={sledovany}
            onChange={(e) => setSledovany(e.target.value)}
            placeholder="zatím nehlídáno"
            className={`${pole} flex-1 min-w-[240px]`}
          />
          <button type="button" onClick={nactiStav} disabled={!sledovany.trim()} className={tlacitko2}>
            Zkontrolovat teď
          </button>
          {sledovany.trim() && (
            <a href={adresaWiki(jazyk, sledovany)} target="_blank" rel="noreferrer" className="text-sm text-brand-purple font-heading">
              Otevřít článek ↗
            </a>
          )}
        </div>
        {pocatecni.posledniKontrola && (
          <p className="text-xs font-body text-muted m-0">
            Poslední automatická kontrola {datum(pocatecni.posledniKontrola)}
            {pocatecni.chybaKontroly ? ` - ${pocatecni.chybaKontroly}` : ''}
          </p>
        )}
        {stavChyba && <p className="text-sm text-danger m-0">{stavChyba}</p>}
        {existuje === false && <p className="text-sm font-body text-muted m-0">Stránka s tímhle názvem na Wikipedii zatím není.</p>}
        {revize && revize.length > 0 && (
          <table className="w-full border-collapse text-sm font-body">
            <tbody>
              {revize.map((r) => (
                <tr key={r.revid} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-muted whitespace-nowrap">{datum(r.kdy)}</td>
                  <td className="py-1.5 pr-3 text-ink whitespace-nowrap">{r.kdo}</td>
                  <td className="py-1.5 pr-3 text-muted">{r.shrnuti || '—'}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <a href={r.diff} target="_blank" rel="noreferrer" className="text-brand-purple">
                      rozdíl ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Odesílání na Wikipedii */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">Odeslání na Wikipedii</h2>
        <p className="text-sm font-body text-muted m-0 max-w-[80ch]">
          Portál umí uloženou verzi konceptu zapsat na Wikipedii pod vaším účtem. Potřebuje k tomu osobní
          přístupový token:{' '}
          <a href={ADRESA_OAUTH} target="_blank" rel="noreferrer" className="text-brand-purple">
            vytvořit token ↗
          </a>{' '}
          — v žádosti vyberte „This consumer is for use only by <em>vaše jméno</em>", jako povolení stačí
          úprava a zakládání stránek. Schvalovat to nikdo nemusí, token dostanete hned. Vložte ho sem;
          portál ho uloží a už nikdy neukáže.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 flex-1 min-w-[260px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Přístupový token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={maToken ? 'uložený — vyplňte jen při výměně' : 'vložte token z Wikimedie'}
              autoComplete="off"
              className={pole}
            />
          </label>
          <button type="button" onClick={ulozToken} disabled={pracuje || !token.trim()} className={tlacitko2}>
            Uložit token
          </button>
          {maToken && (
            <button type="button" onClick={smazToken} disabled={pracuje} className={tlacitko2}>
              Smazat token
            </button>
          )}
        </div>
        <div className="flex items-end gap-3 flex-wrap border-t border-line pt-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[260px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Kam uložit</span>
            <input
              value={cil}
              onChange={(e) => setCil(e.target.value)}
              placeholder="Wikipedista:VaseJmeno/Pískoviště"
              className={pole}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <span className="text-xs font-heading text-muted uppercase tracking-wide">Shrnutí úpravy</span>
            <input
              value={shrnutiUpravy}
              onChange={(e) => setShrnutiUpravy(e.target.value)}
              placeholder="doplnění zdrojů"
              className={pole}
            />
          </label>
          <button type="button" onClick={odesli} disabled={odesilam || !maToken || !cil.trim() || zmeneno} className={tlacitko}>
            {odesilam ? 'Odesílám…' : 'Odeslat na Wikipedii'}
          </button>
        </div>
        <p className="text-xs font-body text-muted m-0">
          Odesílá se POSLEDNÍ ULOŽENÁ verze konceptu, takže před odesláním uložte. Úprava se na Wikipedii
          objeví pod vaším jménem a je veřejně dohledatelná — u článku o sobě nezapomeňte na střet zájmů.
          {zmeneno ? ' Máte neuložené změny, proto je odesílání zamčené.' : ''}
        </p>
        {odeslano && (
          <p className="text-sm font-body text-ink m-0">
            Uloženo na Wikipedii —{' '}
            <a href={odeslano} target="_blank" rel="noreferrer" className="text-brand-purple">
              otevřít stránku ↗
            </a>
          </p>
        )}
      </div>

      {/* Verze */}
      <div className={karta}>
        <h2 className="font-heading font-semibold text-base text-ink m-0">Uložené verze</h2>
        {verze.length === 0 ? (
          <p className="text-sm font-body text-muted m-0">Zatím žádná - první vznikne uložením.</p>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col">
            {verze.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-sm font-body">
                <span className="text-ink">
                  {datum(v.kdy)}
                  {v.autor ? <span className="text-muted"> · {v.autor}</span> : null}
                </span>
                <button type="button" onClick={() => obnovVerzi(v.id)} className="text-brand-purple bg-transparent border-0 cursor-pointer font-heading text-sm">
                  Načíst do editoru
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
