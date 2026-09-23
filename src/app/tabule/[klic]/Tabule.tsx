'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLOZKY_TABULE, nazevPolozky, type DataTabule } from '@/lib/tabule';

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
  const viditelne = radky.slice(zacatek, zacatek + (probiha || dalsi ? 5 : 7));

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
          {/* Program studia */}
          <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: r.stav === 'ted' ? 700 : 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.u.nazev}
                    </span>
                    <span style={{ fontSize: 22, color: BARVY.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              <span style={{ marginTop: 'auto', fontSize: 24, color: BARVY.sedy }}>
                Zítra {cas(data.zitra.od)}: {zitraText(data.zitra)}
              </span>
            )}
          </div>

          {data.instagram && <InstagramOkno ig={data.instagram} />}

          <Panel klic={klic} zaklad={zaklad} data={data} setData={setData} obnov={nacti} />
        </div>
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

/** Pravý panel: poznámky a co chybí. Změny se ukážou hned, server se dožene. */
function Panel({
  zaklad,
  data,
  setData,
  obnov,
}: {
  klic: string;
  zaklad: string;
  data: DataTabule;
  setData: (fn: (d: DataTabule) => DataTabule) => void;
  obnov: () => Promise<void>;
}) {
  const [pridavam, setPridavam] = useState(false);
  const [text, setText] = useState('');
  const [autor, setAutor] = useState('');
  const pole = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (pridavam) pole.current?.focus();
  }, [pridavam]);

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

  async function uloz() {
    const t = text.trim();
    if (!t) return;
    setPridavam(false);
    setText('');
    setData((d) => ({
      ...d,
      poznamky: [{ id: `nova-${Date.now()}`, text: t, autor: autor.trim() || null, kdy: new Date().toISOString() }, ...d.poznamky],
    }));
    await fetch(`${zaklad}/poznamky`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, autor: autor.trim() || null }),
    }).catch(() => null);
    void obnov();
  }

  async function hotovo(id: string) {
    setData((d) => ({ ...d, poznamky: d.poznamky.filter((p) => p.id !== id) }));
    if (!id.startsWith('nova-')) {
      await fetch(`${zaklad}/poznamky`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(() => null);
    }
    void obnov();
  }

  const kdy = (iso: string) => {
    const d = new Date(iso);
    const dnes = new Date();
    const stejnyDen = d.toDateString() === dnes.toDateString();
    const cas = new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', minute: '2-digit' }).format(d);
    return stejnyDen ? `dnes ${cas}` : `${new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(d)} ${cas}`;
  };

  const tlacitko: React.CSSProperties = {
    minHeight: 64,
    padding: '0 26px',
    borderRadius: 16,
    border: '2px solid #3a3252',
    background: BARVY.karta2,
    color: BARVY.text,
    fontSize: 24,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
  const nazvyChybi = data.chybi.map((c) => nazevPolozky(c.polozka));

  return (
    <div style={{ width: 640, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '28px 30px',
          borderRadius: 28,
          background: BARVY.karta,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy }}>POZNÁMKY</span>
          {!pridavam && (
            <button type="button" onClick={() => setPridavam(true)} style={tlacitko}>
              + Přidat
            </button>
          )}
        </div>

        {pridavam && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              ref={pole}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={500}
              aria-label="Text poznámky"
              placeholder="Co mají ostatní vědět…"
              style={{
                boxSizing: 'border-box',
                width: '100%',
                padding: '16px 18px',
                borderRadius: 16,
                border: '2px solid #5a4f7a',
                background: BARVY.pozadi,
                color: BARVY.text,
                fontFamily: 'inherit',
                fontSize: 26,
                resize: 'none',
              }}
            />
            <input
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              maxLength={60}
              aria-label="Kdo píše (nepovinné)"
              placeholder="Kdo píše (nepovinné)"
              style={{
                boxSizing: 'border-box',
                width: '100%',
                minHeight: 60,
                padding: '0 18px',
                borderRadius: 16,
                border: '2px solid #3a3252',
                background: BARVY.pozadi,
                color: BARVY.text,
                fontFamily: 'inherit',
                fontSize: 24,
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={uloz}
                style={{ ...tlacitko, flexGrow: 1, border: 0, background: BARVY.akcent, color: '#13101c', fontWeight: 800 }}
              >
                Uložit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPridavam(false);
                  setText('');
                }}
                style={{ ...tlacitko, background: 'transparent' }}
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', minHeight: 0 }}>
          {data.poznamky.length === 0 && !pridavam && (
            <span style={{ fontSize: 24, color: BARVY.sedy }}>Žádné poznámky.</span>
          )}
          {data.poznamky.map((p) => (
            <div
              key={p.id}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 20px', borderRadius: 18, background: BARVY.karta2 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1, minWidth: 0 }}>
                <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {p.text}
                </span>
                <span style={{ fontSize: 19, color: BARVY.sedy }}>
                  {[p.autor, kdy(p.kdy)].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => hotovo(p.id)}
                aria-label="Odškrtnout poznámku"
                style={{
                  flexShrink: 0,
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  border: '2px solid #3a3252',
                  background: 'transparent',
                  color: BARVY.text3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l4.5 4.5L19 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '28px 30px', borderRadius: 28, background: BARVY.karta }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: BARVY.sedy, whiteSpace: 'nowrap' }}>
            CO CHYBÍ VE STUDIU
          </span>
          <span style={{ fontSize: 20, color: nazvyChybi.length ? BARVY.chybiText : BARVY.sedy, textAlign: 'right' }}>
            {nazvyChybi.length ? `Chybí: ${nazvyChybi.join(', ')}` : 'Ťukněte, co došlo'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {POLOZKY_TABULE.map((p) => {
            const je = chybi.has(p.klic);
            return (
              <button
                key={p.klic}
                type="button"
                onClick={() => prepni(p.klic)}
                aria-pressed={je}
                style={{
                  minHeight: 128,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  borderRadius: 20,
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  border: `3px solid ${je ? BARVY.chybiLinka : BARVY.linka}`,
                  background: je ? BARVY.chybiPozadi : BARVY.karta2,
                  color: je ? BARVY.chybiText : '#d9d3ea',
                }}
              >
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: p.svg }}
                />
                <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{p.nazev}</span>
                {je && <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', color: '#ffc861' }}>CHYBÍ</span>}
              </button>
            );
          })}
        </div>
      </div>
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
  const SIRKA_OKNA = 420;
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
