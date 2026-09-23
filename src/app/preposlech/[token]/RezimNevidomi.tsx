'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nactiPdfJs, nastavPdfWorker } from '@/lib/pdfJs';

/**
 * PŘEPOSLECH PRO NEVIDOMÉ (zadání 23. 9. 2026: „dal by se v audiotaggeru
 * udělat varianta pro slepé lidi? Přepla by se tlačítkem." → poslouchá to
 * externista, kterému klient pošle odkaz).
 *
 * Běžný AudioTagger stojí na obrázku PDF a na označování myší - čtečka
 * obrazovky v něm nemá čeho se chytit. Tenhle režim je postavený naopak:
 *
 *  - všechno je text a tlačítka s popisky, nic se nekreslí do plátna,
 *  - ovládá se z klávesnice (mezerník, šipky, N/P, Z),
 *  - po každé akci portál krátce ohlásí, co se stalo (živá oblast, kterou
 *    čtečka přečte; kdo čtečku nemá, může si zapnout čtení nahlas),
 *  - text scénáře se z PDF vytěží a ukáže jako čitelné odstavce.
 *
 * Připomínky se ukládají stejnou cestou jako v běžném přeposlechu, takže
 * do portálu dorazí úplně stejně (zadání: „přijdou nám jako normální
 * přeposlech").
 */

type Stopa = { id: string; name: string };
type Chyba = {
  id: string;
  trackIndex: number;
  trackName: string;
  localTime: number;
  description: string;
  createdByName: string | null;
  createdAt: string;
};

const RYCHLOSTI = [0.75, 1, 1.25, 1.5, 1.75, 2];

function cas(s: number): string {
  const cele = Math.max(0, Math.floor(s));
  const m = Math.floor(cele / 60);
  const v = cele % 60;
  return `${m}:${String(v).padStart(2, '0')}`;
}

/** Čas do řeči - „4 minuty 12 sekund" se čte líp než „4:12". */
function casSlovy(s: number): string {
  const cele = Math.max(0, Math.floor(s));
  const m = Math.floor(cele / 60);
  const v = cele % 60;
  if (m === 0) return `${v} sekund`;
  return `${m} minut ${v} sekund`;
}

export function RezimNevidomi({
  caflouProjectId,
  projectName,
  token,
  onZpet,
}: {
  caflouProjectId: string;
  projectName: string;
  token: string;
  onZpet: () => void;
}) {
  const zaklad = `/api/projekty/${encodeURIComponent(caflouProjectId)}/preposlech`;
  const sKlicem = useCallback(
    (url: string) => `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(token)}`,
    [token],
  );

  const [stopy, setStopy] = useState<Stopa[]>([]);
  const [textId, setTextId] = useState<string | null>(null);
  const [aktivni, setAktivni] = useState(0);
  const [hraje, setHraje] = useState(false);
  const [pozice, setPozice] = useState(0);
  const [delka, setDelka] = useState(0);
  const [rychlost, setRychlost] = useState(1);
  const [chyby, setChyby] = useState<Chyba[]>([]);
  const [popis, setPopis] = useState('');
  const [ukladam, setUkladam] = useState(false);
  const [chyba, setChybaHlaska] = useState<string | null>(null);
  const [nacitam, setNacitam] = useState(true);
  const [hlaseni, setHlaseni] = useState('');
  const [cist, setCist] = useState(false);
  const [text, setText] = useState<{ strana: number; odstavce: string[] }[] | null>(null);
  const [textStav, setTextStav] = useState<'ceka' | 'nacitam' | 'hotovo' | 'nejde'>('ceka');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const popisRef = useRef<HTMLTextAreaElement | null>(null);
  const cistRef = useRef(false);
  cistRef.current = cist;

  /** Krátké ohlášení do živé oblasti; volitelně i nahlas. */
  const ohlas = useCallback((veta: string) => {
    setHlaseni(veta);
    if (!cistRef.current || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const rec = new SpeechSynthesisUtterance(veta);
      rec.lang = 'cs-CZ';
      window.speechSynthesis.speak(rec);
    } catch {
      // Hlas není povinný - ohlášení zůstane aspoň v živé oblasti.
    }
  }, []);

  /* ---------- načtení stop a připomínek ---------- */

  const nactiChyby = useCallback(async () => {
    const res = await fetch(sKlicem(zaklad)).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json().catch(() => ({}))) as { chyby?: Chyba[] };
    setChyby(data.chyby ?? []);
  }, [sKlicem, zaklad]);

  useEffect(() => {
    void (async () => {
      try {
        const [rStopy] = await Promise.all([fetch(sKlicem(`${zaklad}/stopy`)), nactiChyby()]);
        const data = (await rStopy.json().catch(() => ({}))) as {
          stopy?: Stopa[];
          text?: { id: string } | null;
          error?: string;
        };
        if (!rStopy.ok) {
          setChybaHlaska(data.error || 'Nahrávky se nepodařilo načíst.');
          return;
        }
        setStopy(data.stopy ?? []);
        setTextId(data.text?.id ?? null);
        ohlas(`Načteno ${data.stopy?.length ?? 0} stop. Mezerníkem přehrajete, klávesou Z zapíšete připomínku.`);
      } finally {
        setNacitam(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopa = stopy[aktivni] ?? null;
  const zdroj = stopa ? sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(stopa.id)}`) : undefined;

  /* ---------- ovládání přehrávače ---------- */

  const prehrajNeboPauzni = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      ohlas('Přehrávám.');
    } else {
      a.pause();
      ohlas(`Pauza na čase ${casSlovy(a.currentTime)}.`);
    }
  }, [ohlas]);

  const skoc = useCallback(
    (o: number) => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + o));
      ohlas(`Čas ${casSlovy(a.currentTime)}.`);
    },
    [ohlas],
  );

  const prepniStopu = useCallback(
    (kam: number) => {
      if (stopy.length === 0) return;
      const index = Math.max(0, Math.min(stopy.length - 1, kam));
      setAktivni(index);
      setPozice(0);
      ohlas(`Stopa ${index + 1} z ${stopy.length}. ${stopy[index]?.name ?? ''}`);
    },
    [ohlas, stopy],
  );

  const zmenRychlost = useCallback(
    (smer: 1 | -1) => {
      const i = RYCHLOSTI.indexOf(rychlost);
      const nova = RYCHLOSTI[Math.max(0, Math.min(RYCHLOSTI.length - 1, (i < 0 ? 1 : i) + smer))];
      setRychlost(nova);
      if (audioRef.current) audioRef.current.playbackRate = nova;
      ohlas(`Rychlost ${String(nova).replace('.', ',')}.`);
    },
    [ohlas, rychlost],
  );

  /* ---------- zápis připomínky ---------- */

  async function ulozPripominku() {
    const text = popis.trim();
    if (!text || !stopa) return;
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    setUkladam(true);
    setChybaHlaska(null);
    try {
      const res = await fetch(sKlicem(zaklad), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIndex: aktivni + 1,
          trackName: stopa.name,
          localTime: Math.max(0, a?.currentTime ?? pozice),
          description: text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setChybaHlaska(data.error || 'Připomínku se nepodařilo uložit.');
        ohlas('Připomínku se nepodařilo uložit.');
        return;
      }
      setPopis('');
      await nactiChyby();
      ohlas(`Připomínka uložena. Stopa ${aktivni + 1}, čas ${casSlovy(a?.currentTime ?? pozice)}.`);
    } finally {
      setUkladam(false);
    }
  }

  /* ---------- text scénáře z PDF ---------- */

  async function nactiText() {
    if (!textId || textStav === 'nacitam') return;
    setTextStav('nacitam');
    ohlas('Načítám text scénáře.');
    try {
      const pdfjs = await nactiPdfJs();
      await nastavPdfWorker(pdfjs);
      const doc = await pdfjs.getDocument({ url: sKlicem(`${zaklad}/soubor?soubor=${encodeURIComponent(textId)}`) })
        .promise;
      const strany: { strana: number; odstavce: string[] }[] = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        const strana = await doc.getPage(i);
        const obsah = await strana.getTextContent();
        const radky: string[] = [];
        let radek = '';
        for (const polozka of obsah.items as { str: string; hasEOL?: boolean }[]) {
          radek += polozka.str;
          if (polozka.hasEOL) {
            radky.push(radek.trim());
            radek = '';
          }
        }
        if (radek.trim()) radky.push(radek.trim());
        // Prázdný řádek = konec odstavce; kratší úseky se spojí do vět.
        const odstavce: string[] = [];
        let kus = '';
        for (const r of radky) {
          if (!r) {
            if (kus.trim()) odstavce.push(kus.trim());
            kus = '';
          } else {
            kus += `${kus ? ' ' : ''}${r}`;
          }
        }
        if (kus.trim()) odstavce.push(kus.trim());
        strany.push({ strana: i, odstavce });
      }
      setText(strany);
      setTextStav('hotovo');
      ohlas(`Text načten, ${strany.length} stran.`);
    } catch (err) {
      console.error('Text pro režim pro nevidomé se nepodařilo načíst:', err);
      setTextStav('nejde');
      ohlas('Text se nepodařilo načíst.');
    }
  }

  /* ---------- klávesy ---------- */

  useEffect(() => {
    function stisk(e: KeyboardEvent) {
      const cil = e.target as HTMLElement | null;
      const vPoli = cil && (cil.tagName === 'INPUT' || cil.tagName === 'TEXTAREA');
      if (vPoli) {
        // V poli funguje jen uložení; psaní nesmí spouštět přehrávač.
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void ulozPripominku();
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        prehrajNeboPauzni();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skoc(e.shiftKey ? 30 : 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skoc(e.shiftKey ? -30 : -5);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        prepniStopu(aktivni + 1);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        prepniStopu(aktivni - 1);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        audioRef.current?.pause();
        popisRef.current?.focus();
        ohlas('Zapište připomínku. Uložíte ji klávesami Ctrl a Enter.');
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zmenRychlost(1);
      } else if (e.key === '-') {
        e.preventDefault();
        zmenRychlost(-1);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        ohlas(
          `Stopa ${aktivni + 1} z ${stopy.length}, ${stopa?.name ?? ''}, čas ${casSlovy(
            audioRef.current?.currentTime ?? 0,
          )} z ${casSlovy(delka)}. Zapsaných připomínek ${chyby.length}.`,
        );
      }
    }
    window.addEventListener('keydown', stisk);
    return () => window.removeEventListener('keydown', stisk);
  });

  const mojeChyby = useMemo(
    () => chyby.slice().sort((a, b) => a.trackIndex - b.trackIndex || a.localTime - b.localTime),
    [chyby],
  );

  const tlacitko =
    'rounded-lg border-2 border-ink bg-surface px-4 py-3 text-base font-heading font-semibold text-ink hover:bg-field focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple';

  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-6 text-ink">
      {/* Živá oblast - čtečka přečte, co se právě stalo. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {hlaseni}
      </p>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading font-bold text-2xl m-0">Přeposlech: {projectName}</h1>
        <p className="text-base m-0">
          Režim pro nevidomé. Mezerník přehraje a pozastaví, šipky doleva a doprava posouvají o pět vteřin (se Shiftem
          o třicet), N a P přepínají stopu, Z zapíše připomínku, I ohlásí, kde jste.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button type="button" onClick={onZpet} className={tlacitko}>
            Zpět do běžného zobrazení
          </button>
          <button
            type="button"
            onClick={() => {
              setCist((c) => !c);
              setHlaseni(cist ? 'Čtení nahlas vypnuto.' : 'Čtení nahlas zapnuto.');
            }}
            aria-pressed={cist}
            className={tlacitko}
          >
            {cist ? 'Vypnout čtení nahlas' : 'Číst hlášení nahlas'}
          </button>
        </div>
      </header>

      {chyba && (
        <p role="alert" className="text-base font-semibold text-danger m-0">
          {chyba}
        </p>
      )}

      <section aria-labelledby="nadpis-prehravac" className="flex flex-col gap-3">
        <h2 id="nadpis-prehravac" className="font-heading font-semibold text-xl m-0">
          Nahrávka
        </h2>
        {nacitam ? (
          <p className="m-0 text-base">Načítám stopy…</p>
        ) : stopy.length === 0 ? (
          <p className="m-0 text-base">U projektu zatím nejsou žádné nahrávky.</p>
        ) : (
          <>
            <p className="m-0 text-base">
              Stopa {aktivni + 1} z {stopy.length}: {stopa?.name}. Čas {cas(pozice)} z {cas(delka)}.
            </p>
            {/* Systémový přehrávač - čtečky ho umí ovládat samy. */}
            <audio
              ref={audioRef}
              src={zdroj}
              controls
              preload="metadata"
              className="w-full"
              aria-label={`Stopa ${aktivni + 1} z ${stopy.length}, ${stopa?.name ?? ''}`}
              onPlay={() => setHraje(true)}
              onPause={() => setHraje(false)}
              onTimeUpdate={(e) => setPozice(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                setDelka(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
                e.currentTarget.playbackRate = rychlost;
              }}
              onEnded={() => {
                if (aktivni + 1 < stopy.length) {
                  prepniStopu(aktivni + 1);
                } else {
                  ohlas('Konec poslední stopy.');
                }
              }}
            />
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={prehrajNeboPauzni} className={tlacitko}>
                {hraje ? 'Pozastavit' : 'Přehrát'}
              </button>
              <button type="button" onClick={() => skoc(-5)} className={tlacitko}>
                O pět vteřin zpět
              </button>
              <button type="button" onClick={() => skoc(5)} className={tlacitko}>
                O pět vteřin vpřed
              </button>
              <button type="button" onClick={() => prepniStopu(aktivni - 1)} disabled={aktivni === 0} className={tlacitko}>
                Předchozí stopa
              </button>
              <button
                type="button"
                onClick={() => prepniStopu(aktivni + 1)}
                disabled={aktivni + 1 >= stopy.length}
                className={tlacitko}
              >
                Další stopa
              </button>
              <button type="button" onClick={() => zmenRychlost(-1)} className={tlacitko}>
                Pomaleji
              </button>
              <button type="button" onClick={() => zmenRychlost(1)} className={tlacitko}>
                Rychleji ({String(rychlost).replace('.', ',')}×)
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-base font-heading">Vybrat stopu</span>
              <select
                value={aktivni}
                onChange={(e) => prepniStopu(Number(e.target.value))}
                className="rounded-lg border-2 border-ink bg-surface px-3 py-2 text-base"
              >
                {stopy.map((s, i) => (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>

      <section aria-labelledby="nadpis-pripominka" className="flex flex-col gap-3">
        <h2 id="nadpis-pripominka" className="font-heading font-semibold text-xl m-0">
          Nová připomínka
        </h2>
        <p className="m-0 text-base">
          Uloží se k místu, kde právě stojíte: stopa {aktivni + 1}, čas {cas(pozice)}.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-base font-heading">Co je špatně</span>
          <textarea
            ref={popisRef}
            value={popis}
            onChange={(e) => setPopis(e.target.value)}
            rows={4}
            className="rounded-lg border-2 border-ink bg-surface px-3 py-2 text-base"
          />
        </label>
        <div className="flex gap-3 flex-wrap items-center">
          <button type="button" onClick={ulozPripominku} disabled={ukladam || !popis.trim()} className={tlacitko}>
            {ukladam ? 'Ukládám…' : 'Uložit připomínku'}
          </button>
          <span className="text-base">Nebo klávesami Ctrl a Enter.</span>
        </div>
      </section>

      <section aria-labelledby="nadpis-seznam" className="flex flex-col gap-3">
        <h2 id="nadpis-seznam" className="font-heading font-semibold text-xl m-0">
          Zapsané připomínky ({mojeChyby.length})
        </h2>
        {mojeChyby.length === 0 ? (
          <p className="m-0 text-base">Zatím žádné.</p>
        ) : (
          <ol className="flex flex-col gap-3 m-0 pl-5">
            {mojeChyby.map((ch) => (
              <li key={ch.id} className="text-base">
                <strong>
                  Stopa {ch.trackIndex}, čas {cas(ch.localTime)}
                </strong>
                : {ch.description}
                {ch.createdByName ? ` (zapsal ${ch.createdByName})` : ''}{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (ch.trackIndex - 1 !== aktivni) prepniStopu(ch.trackIndex - 1);
                    const a = audioRef.current;
                    if (a) {
                      const nastav = () => {
                        a.currentTime = ch.localTime;
                        setPozice(ch.localTime);
                        ohlas(`Přesunuto na stopu ${ch.trackIndex}, čas ${casSlovy(ch.localTime)}.`);
                      };
                      if (a.readyState >= 1) nastav();
                      else a.addEventListener('loadedmetadata', nastav, { once: true });
                    }
                  }}
                  className="underline text-brand-purple bg-transparent border-0 cursor-pointer text-base"
                >
                  Přejít na místo
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="nadpis-text" className="flex flex-col gap-3">
        <h2 id="nadpis-text" className="font-heading font-semibold text-xl m-0">
          Text scénáře
        </h2>
        {!textId && <p className="m-0 text-base">U projektu není nahraný text.</p>}
        {textId && textStav !== 'hotovo' && (
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={nactiText} disabled={textStav === 'nacitam'} className={tlacitko}>
              {textStav === 'nacitam' ? 'Načítám text…' : 'Načíst text ke čtení'}
            </button>
            {textStav === 'nejde' && (
              <span className="text-base">
                Text se nepodařilo převést - bývá to u PDF, které je jen obrázek.
              </span>
            )}
          </div>
        )}
        {text && (
          <article className="flex flex-col gap-4 text-base leading-relaxed">
            {text.map((s) => (
              <section key={s.strana} aria-label={`Strana ${s.strana}`}>
                <h3 className="font-heading font-semibold text-lg m-0 mb-1">Strana {s.strana}</h3>
                {s.odstavce.map((o, i) => (
                  <p key={i} className="m-0 mb-2">
                    {o}
                  </p>
                ))}
              </section>
            ))}
          </article>
        )}
      </section>
    </div>
  );
}
