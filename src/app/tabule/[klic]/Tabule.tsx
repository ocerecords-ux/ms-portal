'use client';

import { useCallback, useEffect, useState } from 'react';
import { POLOZKY_TABULE, type DataTabule } from '@/lib/tabule';

/**
 * Tabule ve studiu na dotykovém displeji (zadání 21. 9. 2026). Kreslí se
 * v pevném plátně 1920×1080 a zmenší/zvětší se na celou obrazovku - displej
 * může mít jiné rozlišení, rozložení zůstane stejné jako v návrhu.
 *
 * Vlevo dnešní program studia (co teď běží nebo dokdy je volno), vpravo
 * poznámky a dlaždice „co chybí". Hodiny tikají po vteřině, data se
 * obnovují každých 30 s, takže změna v kalendáři se na tabuli objeví sama.
 */

const SIRKA = 1920;
const VYSKA = 1080;
const OBNOVA_MS = 30_000;

const BARVY = {
  pozadi: '#0f0c17',
  karta: '#1c1729',
  karta2: '#241d36',
  tlumena: '#16121f',
  linka: '#2e2742',
  text: '#f3f0fb',
  text2: '#cfc8e2',
  text3: '#b9b2cc',
  sedy: '#8f86a8',
  akcent: '#A6F25C',
  chybiPozadi: '#3b2a0c',
  chybiLinka: '#f2b33d',
  chybiText: '#ffe2a8',
};

const DISPLAY = 'var(--font-jost), system-ui, sans-serif';

export function Tabule({
  klic,
  pocatecni,
  zpetOdkaz = null,
}: {
  klic: string;
  pocatecni: DataTabule;
  /**
   * Cesta zpátky do portálu (zadání 23. 9. 2026: „když se dostanu do sekce
   * Tabule, tak nemám možnost se pak dostat zpět"). Vyplní se jen
   * přihlášenému člověku z týmu - displej ve studiu žádné tlačítko nemá,
   * ten má být pořád na tabuli.
   */
  zpetOdkaz?: string | null;
}) {
  const [data, setData] = useState(pocatecni);
  const [ted, setTed] = useState(() => new Date());
  const [meritko, setMeritko] = useState(1);
  const [chybaSite, setChybaSite] = useState(false);
  /**
   * SERVISNÍ PANEL (zadání 29. 9. 2026: „napadlo mě dát pryč ten servisní
   * panel s tím, co ve studiu chybí, a udělat ho vyjížděcí… tím ušetříme
   * místo"). Dlaždice „co chybí" se otevřou přes celou tabuli a zase zmizí -
   * na obrazovce tak zůstává jen to, kvůli čemu se na ni lidi dívají.
   */
  const [servis, setServis] = useState(false);
  const zaklad = `/api/tabule/${encodeURIComponent(klic)}`;
  const pasmo = data.studio.casovePasmo;

  const nacti = useCallback(async () => {
    try {
      const res = await fetch(zaklad, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as DataTabule);
      setChybaSite(false);
    } catch {
      setChybaSite(true);
    }
  }, [zaklad]);

  useEffect(() => {
    const hodiny = setInterval(() => setTed(new Date()), 1000);
    const obnova = setInterval(nacti, OBNOVA_MS);
    // Po půlnoci a po probuzení displeje hned nová data.
    const viditelnost = () => {
      if (document.visibilityState === 'visible') void nacti();
    };
    document.addEventListener('visibilitychange', viditelnost);
    return () => {
      clearInterval(hodiny);
      clearInterval(obnova);
      document.removeEventListener('visibilitychange', viditelnost);
    };
  }, [nacti]);

  /**
   * Servisní panel se sám zavře. Kdyby ho někdo nechal otevřený, zůstala by
   * tabule k ničemu do příchodu dalšího člověka.
   */
  useEffect(() => {
    if (!servis) return;
    const t = setTimeout(() => setServis(false), 60_000);
    return () => clearTimeout(t);
  }, [servis, data.chybi]);

  // Plátno přes celou obrazovku.
  useEffect(() => {
    const spocti = () => setMeritko(Math.min(window.innerWidth / SIRKA, window.innerHeight / VYSKA));
    spocti();
    window.addEventListener('resize', spocti);
    return () => window.removeEventListener('resize', spocti);
  }, []);

  // Den se na tabuli mění o půlnoci - obnova to chytí do 30 s, ale datum
  // v hlavičce se přepne hned.
  const cas = (iso: string | Date) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: pasmo, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const hodinyText = new Intl.DateTimeFormat('cs-CZ', { timeZone: pasmo, hour: 'numeric', minute: '2-digit' }).format(ted);
  const datumText = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: pasmo,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(ted);

  const tedMs = ted.getTime();
  const udalosti = data.udalosti.map((u) => ({ ...u, odMs: Date.parse(u.od), doMs: Date.parse(u.do) }));
  /**
   * PRÁVĚ PROBÍHÁ (23. 9. 2026: „na těch tabulích ve studiích by se měl
   * zobrazit i střih, ne jen natáčení"). Když běží víc věcí naráz - třeba
   * natáčení v jedné místnosti a střih ve druhé - ukážou se všechny;
   * první velká, ostatní pod ní menší.
   */
  const probihajici = udalosti.filter((u) => u.odMs <= tedMs && u.doMs > tedMs);
  const probiha = probihajici[0] ?? null;
  const dalsi = udalosti.find((u) => u.odMs > tedMs) ?? null;

  // Rozpis dne s volnými okny mezi událostmi (aspoň 15 minut).
  type Radek =
    | { typ: 'udalost'; u: (typeof udalosti)[number]; stav: 'hotovo' | 'ted' | 'pozdeji' }
    | { typ: 'volno'; od: number; do: number };
  const radky: Radek[] = [];
  udalosti.forEach((u, i) => {
    const pred = udalosti[i - 1];
    if (pred && u.odMs - pred.doMs >= 15 * 60_000) radky.push({ typ: 'volno', od: pred.doMs, do: u.odMs });
    radky.push({ typ: 'udalost', u, stav: u.doMs <= tedMs ? 'hotovo' : u.odMs <= tedMs ? 'ted' : 'pozdeji' });
  });
  // Vejde se kolem šesti řádků: jeden už proběhlý a zbytek dopředu.
  const prvniAktualni = radky.findIndex((r) => (r.typ === 'udalost' ? r.u.doMs > tedMs : r.do > tedMs));
  const zacatek = prvniAktualni <= 0 ? 0 : prvniAktualni - 1;
  // Pruh s ostatními studii sebere kus výšky - rozpis se o řádek zkrátí.
  // Tabule může běžet proti starší odpovědi ze serveru (typicky vteřinu po
  // nasazení), než doběhne obnova - pak pole s ostatními studii chybí.
  const ostatni = data.ostatni ?? [];
  const maOstatni = ostatni.length > 0;
  // Každé studio v pruhu sebere zhruba jeden řádek rozpisu - pruh je teď
  // pod sebou, ne vedle sebe.
  // Spodní hranice jsou tři řádky: pruh se studii je jednořádkový a program
  // je to, kvůli čemu se na tabuli lidi dívají. Co se nevejde, se ořízne
  // (viz obal s overflow: hidden) - dřív to přetékalo mimo plátno.
  const kolikRadku = Math.max(4, (probiha || dalsi ? 7 : 9) - Math.min(3, ostatni.length));
  const viditelne = radky.slice(zacatek, zacatek + kolikRadku);

  const zbyva = (doMs: number) => {
    const min = Math.max(0, Math.round((doMs - tedMs) / 60_000));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: BARVY.pozadi,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Zpátky do portálu - mimo zmenšované plátno, ať je vždycky čitelné
          a v rohu nepřekáží. */}
      {zpetOdkaz && (
        <a
          href={zpetOdkaz}
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            zIndex: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 12,
            border: `1px solid ${BARVY.linka}`,
            background: BARVY.karta,
            color: BARVY.text2,
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Zpět do portálu
        </a>
      )}

      <div
        style={{
          width: SIRKA,
          height: VYSKA,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${meritko})`,
          boxSizing: 'border-box',
          padding: '48px 72px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          color: BARVY.text,
          fontFamily: 'var(--font-poppins), system-ui, sans-serif',
        }}
      >
        {/* Hlavička */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, height: 96 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: data.studio.barva }} />
            <span style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 600 }}>{data.studio.nazev}</span>
            {chybaSite && (
              <span style={{ fontSize: 20, color: BARVY.sedy, marginLeft: 16 }}>· bez spojení, zkouším znovu…</span>
            )}
            {/* SERVIS se přestěhoval do hlavičky (29. 9. 2026), když z tabule
                zmizely poznámky a s nimi celý pravý sloupec. */}
            <TlacitkoServis chybi={data.chybi.length} otevri={() => setServis(true)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: BARVY.text3 }}>{datumText}</span>
            <span
              style={{ fontFamily: DISPLAY, fontSize: 96, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
            >
              {hodinyText}
            </span>
          </div>
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', gap: 48 }}>
          {/* Program studia nahoře, ostatní studia dole. Rozdělené schválně na
              dvě části: horní se smí oříznout, když je den nabitý, dolní pruh
              je vždycky celý - dřív se z něj poslední studio ukusovalo dolů
              mimo plátno (29. 9. 2026). */}
          <div style={{ flexGrow: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
            {probiha ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  padding: '32px 36px',
                  borderRadius: 28,
                  background: BARVY.karta,
                  border: `2px solid ${data.studio.barva}`,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.12em', color: BARVY.akcent }}>
                  PRÁVĚ PROBÍHÁ{probiha.mistnost ? ` · ${probiha.mistnost.toUpperCase()}` : ''}
                </span>
                <span style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 600, lineHeight: 1.05 }}>{probiha.nazev}</span>
                <Lide u={probiha} cas={`${cas(probiha.od)} – ${cas(probiha.do)}`} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ flexGrow: 1, height: 12, borderRadius: 999, background: BARVY.linka, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, ((tedMs - probiha.odMs) / (probiha.doMs - probiha.odMs)) * 100))}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: BARVY.akcent,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 24, color: BARVY.text3, whiteSpace: 'nowrap' }}>zbývá {zbyva(probiha.doMs)}</span>
                </div>
                {/* Další běžící událost (typicky střih vedle natáčení). */}
                {probihajici.slice(1).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingTop: 16,
                      borderTop: `1px solid ${BARVY.linka}`,
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', color: BARVY.sedy }}>
                      ZÁROVEŇ{u.mistnost ? ` · ${u.mistnost.toUpperCase()}` : ''} · ZBÝVÁ {zbyva(u.doMs).toUpperCase()}
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{u.nazev}</span>
                    <Lide u={u} cas={`${cas(u.od)} – ${cas(u.do)}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  padding: '32px 36px',
                  borderRadius: 28,
                  background: BARVY.karta,
                  border: `2px dashed #3a3252`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignSelf: 'flex-start',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 22px',
                    borderRadius: 999,
                    background: '#1d3316',
                    color: BARVY.akcent,
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: BARVY.akcent }} />
                  {dalsi ? `STUDIO JE VOLNÉ DO ${cas(dalsi.od)}` : 'STUDIO JE DNES UŽ VOLNÉ'}
                </span>
                {dalsi ? (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy }}>
                      DALŠÍ V {cas(dalsi.od)} · ZA {zbyva(dalsi.odMs).toUpperCase()}
                    </span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 600, lineHeight: 1.05 }}>{dalsi.nazev}</span>
                    <Lide u={dalsi} cas={`${cas(dalsi.od)} – ${cas(dalsi.do)}`} />
                  </>
                ) : (
                  <span style={{ fontSize: 30, color: BARVY.text2 }}>
                    {data.zitra ? `Zítra ${cas(data.zitra.od)}: ${zitraText(data.zitra)}` : 'Zítra zatím nic naplánováno.'}
                  </span>
                )}
              </div>
            )}

            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy }}>DNES VE STUDIU</span>
            {viditelne.length === 0 && (
              <span style={{ fontSize: 28, color: BARVY.sedy }}>Na dnešek není v kalendáři nic zapsané.</span>
            )}
            {viditelne.map((r) =>
              r.typ === 'volno' ? (
                <div
                  key={`v-${r.od}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 28,
                    padding: '14px 28px',
                    borderRadius: 20,
                    border: `2px dashed ${BARVY.linka}`,
                    opacity: r.do <= tedMs ? 0.45 : 1,
                  }}
                >
                  <span style={{ width: 210, flexShrink: 0, fontSize: 26, fontWeight: 600, color: BARVY.sedy }}>
                    {cas(new Date(r.od))} – {cas(new Date(r.do))}
                  </span>
                  <span style={{ fontSize: 26, color: BARVY.sedy }}>Volno</span>
                </div>
              ) : (
                <div
                  key={r.u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 28,
                    padding: '18px 28px',
                    borderRadius: 20,
                    background: r.stav === 'ted' ? BARVY.karta2 : r.stav === 'hotovo' ? BARVY.tlumena : BARVY.karta,
                    border: r.stav === 'ted' ? `2px solid ${data.studio.barva}` : '2px solid transparent',
                    opacity: r.stav === 'hotovo' ? 0.45 : 1,
                  }}
                >
                  <span style={{ width: 210, flexShrink: 0, fontSize: 28, fontWeight: r.stav === 'ted' ? 700 : 600 }}>
                    {cas(r.u.od)} – {cas(r.u.do)}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flexGrow: 1 }}>
                    {/* Dva řádky místo tří teček: název pořadu je to hlavní,
                        co z řádku člověk čte (29. 9. 2026). */}
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: r.stav === 'ted' ? 700 : 600,
                        lineHeight: 1.15,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {r.u.nazev}
                    </span>
                    <span
                      style={{
                        fontSize: 22,
                        color: BARVY.text3,
                        lineHeight: 1.2,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {[r.u.druh, r.u.mistnost, r.u.herec, r.u.zvukar].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {r.stav === 'ted' && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding: '8px 18px',
                        borderRadius: 999,
                        background: BARVY.akcent,
                        color: '#13101c',
                        fontSize: 20,
                        fontWeight: 800,
                      }}
                    >
                      TEĎ
                    </span>
                  )}
                </div>
              ),
            )}
              {(probiha || dalsi) && data.zitra && (
                <span style={{ marginTop: maOstatni ? 12 : 'auto', fontSize: 24, color: BARVY.sedy }}>
                  Zítra {cas(data.zitra.od)}: {zitraText(data.zitra)}
                </span>
              )}
            </div>

            {maOstatni && <OstatniStudia ostatni={ostatni} ted={ted} domaciPasmo={pasmo} />}
          </div>

          {data.instagram && <InstagramOkno ig={data.instagram} />}
        </div>

        {servis && (
          <ServisniPanel
            zaklad={zaklad}
            data={data}
            setData={setData}
            obnov={nacti}
            zavri={() => setServis(false)}
          />
        )}
      </div>
    </div>
  );
}

/** „Střih · střih" nedává smysl - druh jen když se liší od názvu. */
function zitraText(z: { nazev: string; druh: string }): string {
  return z.nazev.toLowerCase() === z.druh.toLowerCase() ? z.nazev : `${z.nazev} · ${z.druh.toLowerCase()}`;
}

function Lide({ u, cas }: { u: { druh: string; herec: string | null; zvukar: string | null }; cas: string }) {
  return (
    <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', fontSize: 26, color: BARVY.text2 }}>
      <span>
        {u.druh} · {cas}
      </span>
      {u.herec && (
        <span>
          Herec: <span style={{ color: BARVY.text, fontWeight: 600 }}>{u.herec}</span>
        </span>
      )}
      {u.zvukar && (
        <span>
          Zvukař: <span style={{ color: BARVY.text, fontWeight: 600 }}>{u.zvukar}</span>
        </span>
      )}
    </div>
  );
}

/**
 * SERVIS V HLAVIČCE (29. 9. 2026).
 *
 * Když něco chybí, je to vidět i bez otevření - jinak by se na to zapomnělo.
 * Jinak je tlačítko záměrně nenápadné: na tabuli se lidi dívají kvůli
 * programu, ne kvůli kávě.
 */
function TlacitkoServis({ chybi, otevri }: { chybi: number; otevri: () => void }) {
  return (
    <button
      type="button"
      onClick={otevri}
      title="Nahlásit, co ve studiu došlo"
      aria-label={chybi > 0 ? `Servis studia — chybí ${chybi}` : 'Servis studia'}
      style={{
        marginLeft: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 999,
        border: `2px solid ${chybi > 0 ? BARVY.chybiLinka : '#3a3252'}`,
        background: chybi > 0 ? BARVY.chybiPozadi : 'transparent',
        color: chybi > 0 ? BARVY.chybiText : BARVY.text3,
        fontFamily: 'inherit',
        fontSize: 22,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      <IkonaServis />
      Servis
      {chybi > 0 && (
        <span
          style={{
            minWidth: 34,
            height: 34,
            padding: '0 10px',
            borderRadius: 999,
            background: BARVY.chybiLinka,
            color: '#2a1c00',
            fontSize: 20,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {chybi}
        </span>
      )}
    </button>
  );
}

/** Klíč a kolečko - „tady se něco doplňuje", ne „tady se něco nastavuje". */
function IkonaServis() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9.1 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9.1a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

/**
 * SERVISNÍ PANEL (zadání 29. 9. 2026: „schovat ho pod nějaké servisní
 * tlačítko, tím ušetříme místo").
 *
 * Vyjede přes celou tabuli, takže dlaždice můžou být větší než dřív - a na
 * dotykovém displeji se do nich trefí i člověk, který jde okolo. Zavírá se
 * ťuknutím vedle, křížkem a sám po minutě, aby tabule nezůstala zaslepená.
 */
function ServisniPanel({
  zaklad,
  data,
  setData,
  obnov,
  zavri,
}: {
  zaklad: string;
  data: DataTabule;
  setData: (fn: (d: DataTabule) => DataTabule) => void;
  obnov: () => Promise<void>;
  zavri: () => void;
}) {
  const chybi = new Set(data.chybi.map((c) => c.polozka));

  async function prepni(polozka: string) {
    const nove = !chybi.has(polozka);
    setData((d) => ({
      ...d,
      chybi: nove
        ? [...d.chybi, { polozka, kdy: new Date().toISOString() }]
        : d.chybi.filter((c) => c.polozka !== polozka),
    }));
    await fetch(`${zaklad}/chybi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polozka, chybi: nove }),
    }).catch(() => null);
    void obnov();
  }

  return (
    <div
      onClick={zavri}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 72,
        background: 'rgba(8, 6, 14, 0.82)',
      }}
    >
      <div
        // Ťuknutí do dlaždice nesmí panel zavřít.
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1180,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          padding: '40px 44px',
          borderRadius: 36,
          background: BARVY.karta,
          border: `2px solid ${BARVY.linka}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 46, fontWeight: 600 }}>Co ve studiu došlo?</span>
            <span style={{ fontSize: 24, color: BARVY.sedy }}>
              Ťukněte na to, co chybí. Bára se to dozví hned. Až se to doplní, ťukněte znovu.
            </span>
          </div>
          <button
            type="button"
            onClick={zavri}
            aria-label="Zavřít servisní panel"
            style={{
              flexShrink: 0,
              width: 72,
              height: 72,
              borderRadius: 20,
              border: `2px solid ${BARVY.linka}`,
              background: BARVY.karta2,
              color: BARVY.text2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 18 }}>
          {POLOZKY_TABULE.map((p) => {
            const je = chybi.has(p.klic);
            return (
              <button
                key={p.klic}
                type="button"
                onClick={() => prepni(p.klic)}
                aria-pressed={je}
                style={{
                  minHeight: 172,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 24,
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  border: `3px solid ${je ? BARVY.chybiLinka : BARVY.linka}`,
                  background: je ? BARVY.chybiPozadi : BARVY.karta2,
                  color: je ? BARVY.chybiText : '#d9d3ea',
                }}
              >
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: p.svg }}
                />
                <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15 }}>{p.nazev}</span>
                {je && <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.1em', color: '#ffc861' }}>CHYBÍ</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * OSTATNÍ STUDIA (zadání 29. 9. 2026: „aby to, ve kterém tabule je, bylo vždy
 * výraznější", pak „chci tam celé popisy těch událostí v jiných studiích,
 * roztáhni je na šířku a dej po sobě").
 *
 * Proto řádek přes celou šířku na studio, ne tři úzké sloupečky vedle sebe:
 * do sloupečku se název pořadu nevešel a uřízl se po deseti znacích, což je
 * k ničemu. Takhle je vidět celý.
 *
 * Výraznější zůstává domácí studio tím, co má nahoře - šedesátibodový nadpis,
 * barevný rámeček a ukazatel času. Tenhle pruh je záměrně tlumený, jednořádkový
 * a bez barev navíc.
 *
 * Čas se píše v pásmu toho kterého studia (v Londýně se točí v jinou hodinu
 * než v Brně); když se pásmo liší od domácího, stojí u něj „místního".
 */
function OstatniStudia({
  ostatni,
  ted,
  domaciPasmo,
}: {
  ostatni: DataTabule['ostatni'];
  ted: Date;
  domaciPasmo: string;
}) {
  const tedMs = ted.getTime();
  const hodina = (iso: string, pasmo: string) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: pasmo, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy }}>OSTATNÍ STUDIA</span>
      {ostatni.map((s) => {
        const bezi = s.probiha && Date.parse(s.probiha.do) > tedMs;
        const jinePasmo = s.casovePasmo !== domaciPasmo;
        const cas = bezi
          ? `do ${hodina(s.probiha!.do, s.casovePasmo)}`
          : s.dalsi
            ? `od ${hodina(s.dalsi.od, s.casovePasmo)}`
            : '';
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '12px 22px',
              borderRadius: 16,
              background: BARVY.tlumena,
              border: `1px solid ${BARVY.linka}`,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.barva, flexShrink: 0 }} />
            <span
              style={{
                width: 150,
                flexShrink: 0,
                fontSize: 22,
                fontWeight: 700,
                color: BARVY.text3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.kratce}
            </span>
            <span
              style={{
                flexGrow: 1,
                minWidth: 0,
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.2,
                color: bezi ? BARVY.text2 : BARVY.sedy,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}
            >
              {/* Herec patří k natáčení stejně jako název - podle něj se pozná,
                  koho tam mají (zadání 29. 9. 2026: „a u natáčení chci i herce"). */}
              {bezi
                ? [s.probiha!.nazev, s.probiha!.mistnost, s.probiha!.herec].filter(Boolean).join(' · ')
                : s.dalsi
                  ? [s.dalsi.nazev, s.dalsi.herec].filter(Boolean).join(' · ')
                  : 'Dnes volno'}
            </span>
            {cas && (
              <span style={{ flexShrink: 0, fontSize: 20, color: BARVY.sedy, whiteSpace: 'nowrap' }}>
                {cas}
                {jinePasmo ? ' místního' : ''}
              </span>
            )}
            <span
              style={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', background: bezi ? BARVY.akcent : '#4a4263' }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * OKNO S INSTAGRAMEM (zadání 22. 9. 2026: „aby se tam promítaly i příběhy
 * v nějakém okně"). Formát příběhu 9:16 mezi programem a panelem. Fotky
 * po 7 vteřinách, videa celá (bez zvuku), pak další a znovu dokola. Pruhy
 * nahoře ukazují, kolikátý příběh běží - jako v aplikaci.
 */
function InstagramOkno({ ig }: { ig: NonNullable<DataTabule['instagram']> }) {
  const [kde, setKde] = useState(0);
  const polozky = ig.polozky;
  const p = polozky[kde % polozky.length];
  const dalsi = useCallback(() => setKde((k) => (k + 1) % Math.max(1, polozky.length)), [polozky.length]);

  useEffect(() => {
    if (!p || p.typ === 'VIDEO') return;
    const t = setTimeout(dalsi, 7000);
    return () => clearTimeout(t);
  }, [p, dalsi]);

  // Když se seznam změní (nové příběhy), nezůstat mimo rozsah.
  useEffect(() => {
    if (kde >= polozky.length) setKde(0);
  }, [kde, polozky.length]);

  if (!p) return null;
  /**
   * ŠIRŠÍ OKNO (29. 9. 2026: „dejme pryč z tabulí poznámky. Dostaneme tak víc
   * místa a můžeme zvětšit i Instagram"). Šířku drží výška plátna: příběh je
   * 9:16, takže na volných zhruba 856 bodech výšky vyjde 480 na šířku. Víc by
   * okno přeteklo dolů.
   */
  const SIRKA_OKNA = 480;
  return (
    <div style={{ width: SIRKA_OKNA, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy }}>
        {ig.druh === 'pribehy' ? 'PŘÍBĚHY' : 'INSTAGRAM'}
        {ig.ucet ? ` · @${ig.ucet.toUpperCase()}` : ''}
      </span>
      <div
        style={{
          position: 'relative',
          width: SIRKA_OKNA,
          aspectRatio: '9 / 16',
          maxHeight: '100%',
          borderRadius: 28,
          overflow: 'hidden',
          background: BARVY.karta,
        }}
      >
        {p.typ === 'VIDEO' ? (
          <video
            key={p.id}
            src={p.url}
            poster={p.nahled ?? undefined}
            autoPlay
            muted
            playsInline
            onEnded={dalsi}
            onError={dalsi}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt="" onError={dalsi} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {polozky.length > 1 && (
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 6 }}>
            {polozky.map((x, i) => (
              <span
                key={x.id}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 999,
                  background: i <= kde % polozky.length ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
