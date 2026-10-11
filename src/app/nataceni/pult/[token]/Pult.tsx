'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DOTAZ_SPOJOVANI_MS,
  DOTAZ_USAZENO_MS,
  OBRAZ_PULTU,
  TICHO_ODCHOD_MS,
  ZVUK_STUDIO,
  nahodneId,
  zacinamJa,
  type ZpravaPultu,
} from '@/lib/pultNataceni';

/**
 * PULT - TEXT VLEVO, LIDI VPRAVO (zadání 11. 10. 2026).
 *
 * CELÝ HOVOR JE NÁŠ. Obraz a zvuk jdou přímo mezi prohlížeči; náš server
 * slouží jen jako schránka na vzkazy při navazování (viz /api/pult/[token]).
 * Nic se u nás nenahrává ani neprochází.
 *
 * ZVUK BEZ ÚPRAV PROHLÍŽEČE (ZVUK_STUDIO). Tohle je věcný důvod, proč to
 * stavíme: Meet potlačení echa, redukci šumu ani automatickou hlasitost
 * vypnout nedovolí, a právě ty herci polykají konce slov a berou dynamiku.
 *
 * KOLIK LIDÍ UNESE: každý se spojuje s každým, takže rozumně 4-5. Víc by
 * potřebovalo přeposílací server - to je na jinou chvíli, ne na ruční psaní.
 *
 * KAMERA SE NEZAPÍNÁ SAMA. Stránka nejdřív počká na jméno a klepnutí - kdo si
 * odkaz jen otevře, nemá hned rozsvícenou kontrolku u kamery.
 */

type Ucastnik = {
  id: string;
  jmeno: string;
  stream: MediaStream | null;
  naposledy: number;
};

type Spot = { nazev: string; delka: string; text: string | null };

export function Pult({
  token,
  nazevProjektu,
  herec,
  studio,
  zacatek,
  konec,
  pasmo,
  uvod,
  spoty,
  iceServers,
}: {
  token: string;
  nazevProjektu: string;
  herec: string | null;
  studio: string | null;
  zacatek: string;
  konec: string;
  pasmo: string;
  uvod: string | null;
  spoty: Spot[];
  iceServers: RTCIceServer[];
}) {
  const [jmeno, setJmeno] = useState('');
  const [uvnitr, setUvnitr] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [ucastnici, setUcastnici] = useState<Ucastnik[]>([]);
  const [mikrofon, setMikrofon] = useState(true);
  const [kamera, setKamera] = useState(true);
  const [velikostTextu, setVelikostTextu] = useState(16);

  /** Moje náhodné id v téhle místnosti. Nemá nic společného s účtem. */
  const ja = useMemo(() => nahodneId(), []);
  const jmenoRef = useRef(jmeno);
  jmenoRef.current = jmeno;

  const mujStream = useRef<MediaStream | null>(null);
  const mojeVideo = useRef<HTMLVideoElement | null>(null);
  const spojeni = useRef<Map<string, RTCPeerConnection>>(new Map());
  /** ICE kandidáti, co dorazili dřív než popis spojení - jinak by se zahodili. */
  const cekajiciCesty = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const zivy = useRef(false);
  /**
   * CO JSEM UŽ SLYŠEL. Ohlášení „jsem tady" a „odcházím" jsou pro všechny,
   * takže se ze schránky nemazou po přečtení - dozví se o nich i ten, kdo přijde
   * později. Zároveň by ale při každém dotazu přišly znovu: kdo odejde, by se
   * starým „jsem tady" vrátil do dlaždic. Proto se každá zpráva zpracuje jen
   * jednou - podle svého id.
   */
  const videno = useRef<Map<string, number>>(new Map());

  const posli = useCallback(
    async (druh: string, telo: unknown, komu?: string | null) => {
      try {
        await fetch(`/api/pult/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ odKoho: ja, komu: komu ?? null, druh, telo, jmeno: jmenoRef.current }),
          keepalive: druh === 'odchod',
        });
      } catch {
        /* Jedna nedoručená zpráva spojení nezboří - ohlášení se opakuje. */
      }
    },
    [ja, token],
  );

  /** Vyrobí (nebo najde) spojení s jedním protějškem. */
  const spojeniS = useCallback(
    (cizi: string): RTCPeerConnection => {
      const stare = spojeni.current.get(cizi);
      if (stare) return stare;

      const pc = new RTCPeerConnection({ iceServers });
      spojeni.current.set(cizi, pc);

      mujStream.current?.getTracks().forEach((t) => pc.addTrack(t, mujStream.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) void posli('cesta', e.candidate.toJSON(), cizi);
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? null;
        setUcastnici((p) =>
          p.map((u) => (u.id === cizi ? { ...u, stream, naposledy: Date.now() } : u)),
        );
      };

      /**
       * Když spojení spadne, zkusí se ICE přehodit. Teprve 'failed' znamená,
       * že to bez přeposílacího serveru (TURN) nepůjde - to se v panelu napíše,
       * ať se nehledá chyba v kameře.
       */
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
          setChyba('Spojení s někým z účastníků se nepodařilo navázat napřímo (přísná síť).');
        }
      };

      return pc;
    },
    [iceServers, posli],
  );

  const nabidni = useCallback(
    async (cizi: string) => {
      const pc = spojeniS(cizi);
      if (pc.signalingState !== 'stable') return;
      try {
        const nabidka = await pc.createOffer();
        await pc.setLocalDescription(nabidka);
        await posli('nabidka', nabidka, cizi);
      } catch (err) {
        console.error('Nabídku spojení se nepodařilo poslat:', err);
      }
    },
    [posli, spojeniS],
  );

  const dosypCesty = useCallback(async (cizi: string, pc: RTCPeerConnection) => {
    const cesty = cekajiciCesty.current.get(cizi) ?? [];
    cekajiciCesty.current.delete(cizi);
    for (const c of cesty) await pc.addIceCandidate(c).catch(() => null);
  }, []);

  const zpracuj = useCallback(
    async (z: ZpravaPultu) => {
      const kdo = z.odKoho;

      if (z.druh === 'odchod') {
        spojeni.current.get(kdo)?.close();
        spojeni.current.delete(kdo);
        setUcastnici((p) => p.filter((u) => u.id !== kdo));
        return;
      }

      // Kdokoli se ozve, patří do dlaždic - i když jeho obraz ještě nedorazil.
      setUcastnici((p) => {
        const znamy = p.find((u) => u.id === kdo);
        if (znamy) {
          return p.map((u) =>
            u.id === kdo
              ? { ...u, jmeno: z.jmeno || u.jmeno, naposledy: Date.now() }
              : u,
          );
        }
        return [...p, { id: kdo, jmeno: z.jmeno || 'Účastník', stream: null, naposledy: Date.now() }];
      });

      if (z.druh === 'ahoj') {
        /**
         * NABÍDKU POSÍLÁ JEN JEDEN Z DVOJICE. Kdyby si ji poslali oba, skočí si
         * do řeči a spojení se nenaváže; rozhodne porovnání náhodných id.
         */
        if (zacinamJa(ja, kdo) && !spojeni.current.has(kdo)) await nabidni(kdo);
        return;
      }

      if (z.druh === 'nabidka') {
        const pc = spojeniS(kdo);
        try {
          await pc.setRemoteDescription(z.telo as RTCSessionDescriptionInit);
          await dosypCesty(kdo, pc);
          const odpoved = await pc.createAnswer();
          await pc.setLocalDescription(odpoved);
          await posli('odpoved', odpoved, kdo);
        } catch (err) {
          console.error('Na nabídku spojení se nepodařilo odpovědět:', err);
        }
        return;
      }

      if (z.druh === 'odpoved') {
        const pc = spojeni.current.get(kdo);
        if (!pc || pc.signalingState === 'stable') return;
        await pc.setRemoteDescription(z.telo as RTCSessionDescriptionInit).catch(() => null);
        await dosypCesty(kdo, pc);
        return;
      }

      if (z.druh === 'cesta') {
        const pc = spojeni.current.get(kdo);
        const cesta = z.telo as RTCIceCandidateInit;
        if (!pc || !pc.remoteDescription) {
          const front = cekajiciCesty.current.get(kdo) ?? [];
          front.push(cesta);
          cekajiciCesty.current.set(kdo, front);
          return;
        }
        await pc.addIceCandidate(cesta).catch(() => null);
      }
    },
    [dosypCesty, ja, nabidni, posli, spojeniS],
  );

  /** Vstup do místnosti: kamera, mikrofon, ohlášení a chození pro zprávy. */
  async function vstup() {
    setChyba(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: ZVUK_STUDIO,
        video: OBRAZ_PULTU,
      });
      mujStream.current = stream;
      if (mojeVideo.current) mojeVideo.current.srcObject = stream;
      zivy.current = true;
      setUvnitr(true);
      await posli('ahoj', null);
    } catch (err) {
      console.error('Kameru nebo mikrofon se nepodařilo zapnout:', err);
      setChyba('Nepodařilo se zapnout kameru nebo mikrofon. Zkontrolujte povolení v prohlížeči.');
    }
  }

  /** Chození pro poštu + opakované ohlášení, dokud jsem uvnitř. */
  useEffect(() => {
    if (!uvnitr) return;
    let bezi = true;
    let casovac: ReturnType<typeof setTimeout> | null = null;

    async function kolo() {
      if (!bezi) return;
      try {
        const res = await fetch(
          `/api/pult/${encodeURIComponent(token)}?ja=${encodeURIComponent(ja)}`,
          { cache: 'no-store' },
        );
        const data = (await res.json().catch(() => ({}))) as { zpravy?: ZpravaPultu[] };
        const teraz = Date.now();
        for (const z of data.zpravy ?? []) {
          if (videno.current.has(z.id)) continue;
          videno.current.set(z.id, teraz);
          await zpracuj(z);
        }
        // Paměť se nesmí nafukovat celou poradu - co už ze schránky vypadlo, může zmizet i tady.
        if (videno.current.size > 500) {
          for (const [id, kdy] of videno.current) {
            if (teraz - kdy > 120_000) videno.current.delete(id);
          }
        }
      } catch {
        /* Vynechané kolo nic nezkazí - za chvíli se zkusí znovu. */
      }
      if (!bezi) return;
      // Dokud se někdo spojuje, chodí se pro poštu často; pak líněji.
      const spojuje = Array.from(spojeni.current.values()).some(
        (pc) => pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed',
      );
      const za = spojuje || spojeni.current.size === 0 ? DOTAZ_SPOJOVANI_MS : DOTAZ_USAZENO_MS;
      casovac = setTimeout(kolo, za);
    }

    void kolo();

    /** Opakované „jsem tady" - kdo přijde později, se o mně dozví. */
    const ohlaseni = setInterval(() => void posli('ahoj', null), 6_000);

    /** Kdo se dlouho neozval, zmizí z dlaždic (zavřel okno bez odhlášení). */
    const uklid = setInterval(() => {
      const mez = Date.now() - TICHO_ODCHOD_MS;
      setUcastnici((p) => {
        const zbyde = p.filter((u) => u.naposledy >= mez);
        if (zbyde.length !== p.length) {
          for (const u of p) {
            if (u.naposledy < mez) {
              spojeni.current.get(u.id)?.close();
              spojeni.current.delete(u.id);
            }
          }
        }
        return zbyde;
      });
    }, 5_000);

    return () => {
      bezi = false;
      if (casovac) clearTimeout(casovac);
      clearInterval(ohlaseni);
      clearInterval(uklid);
    };
  }, [ja, posli, token, uvnitr, zpracuj]);

  /** Odhlášení při zavření okna - ostatním dlaždice zmizí hned. */
  useEffect(() => {
    function odejdi() {
      if (!zivy.current) return;
      zivy.current = false;
      void posli('odchod', null);
      mujStream.current?.getTracks().forEach((t) => t.stop());
      spojeni.current.forEach((pc) => pc.close());
      spojeni.current.clear();
    }
    window.addEventListener('pagehide', odejdi);
    return () => {
      window.removeEventListener('pagehide', odejdi);
      odejdi();
    };
  }, [posli]);

  function prepniMikrofon() {
    const dalsi = !mikrofon;
    mujStream.current?.getAudioTracks().forEach((t) => (t.enabled = dalsi));
    setMikrofon(dalsi);
  }

  function prepniKameru() {
    const dalsi = !kamera;
    mujStream.current?.getVideoTracks().forEach((t) => (t.enabled = dalsi));
    setKamera(dalsi);
  }

  const kdy = useMemo(() => {
    const f = (d: Date) =>
      new Intl.DateTimeFormat('cs-CZ', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: pasmo,
      }).format(d);
    const den = new Intl.DateTimeFormat('cs-CZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      timeZone: pasmo,
    }).format(new Date(zacatek));
    return `${den}, ${f(new Date(zacatek))}–${f(new Date(konec))}`;
  }, [konec, pasmo, zacatek]);

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* Hlavička jako v čekárně a v mailu - jeden celek, ne jiná stránka. */}
      <header className="bg-gradient-to-b from-brand-purple to-brand-purpleDeep px-4 sm:px-8 py-3 flex items-center gap-4 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mediaspace-logo.gif" alt="Mediaspace" className="h-9 sm:h-10 w-auto" />
        <div className="min-w-0">
          <p className="font-heading font-semibold text-white text-sm sm:text-base m-0 truncate">
            {nazevProjektu}
          </p>
          <p className="font-body text-white/70 text-xs m-0 truncate">
            {[herec, studio, kdy].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="ml-auto rounded-pill bg-white/15 text-white font-heading font-semibold text-[11px] px-3 py-1">
          zkušební provoz
        </span>
      </header>
      <div className="h-1 bg-brand-green" aria-hidden="true" />

      {chyba && (
        <p className="m-0 px-4 sm:px-8 py-2 bg-danger/10 text-danger font-body text-sm">{chyba}</p>
      )}

      {!uvnitr ? (
        /* NEJDŘÍV JMÉNO, PAK KAMERA. Ostatní v dlaždicích uvidí jméno, ne „Účastník". */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
            <h1 className="font-display text-2xl text-ink m-0">Vstup do natáčení</h1>
            <p className="font-body text-sm text-muted m-0">
              Napište, jak vás mají ostatní vidět. Kamera a mikrofon se zapnou až po klepnutí.
            </p>
            <input
              value={jmeno}
              onChange={(e) => setJmeno(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && jmeno.trim()) void vstup();
              }}
              placeholder="Jméno"
              className="w-full rounded-card border border-line bg-field px-3 py-2 text-ink font-body text-sm outline-none focus:border-brand-purple"
            />
            <button
              type="button"
              onClick={() => void vstup()}
              disabled={!jmeno.trim()}
              className="rounded-pill bg-brand-green text-black font-heading font-semibold text-sm px-5 py-2.5 border-0 cursor-pointer disabled:opacity-40"
            >
              Vstoupit do natáčení
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,38%)] gap-0 min-h-0">
          {/* VLEVO TEXT Z VÝSTUPŮ - to, kvůli čemu celý pult vzniká. */}
          <section className="min-h-0 overflow-y-auto p-4 sm:p-8 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-line">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-heading text-muted uppercase tracking-wide">
                Text k natáčení
              </span>
              {/* Velikost písma: ve studiu se čte z dálky, na notebooku zblízka. */}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setVelikostTextu((v) => Math.max(13, v - 1))}
                  aria-label="Menší písmo"
                  className="rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs w-7 h-7 cursor-pointer"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setVelikostTextu((v) => Math.min(30, v + 1))}
                  aria-label="Větší písmo"
                  className="rounded-pill border border-line bg-surface text-ink font-heading font-semibold text-xs w-7 h-7 cursor-pointer"
                >
                  A+
                </button>
              </div>
            </div>

            {uvod?.trim() && (
              <p className="font-body text-muted m-0 whitespace-pre-wrap" style={{ fontSize: velikostTextu - 2 }}>
                {uvod}
              </p>
            )}

            {spoty.length === 0 ? (
              <p className="font-body text-sm text-muted m-0">
                Projekt nemá výstupy s textem — doplňte je v záložce Výstupy a stránku načtěte znovu.
              </p>
            ) : (
              spoty.map((s, i) => (
                <article key={`${s.nazev}-${i}`} className="flex flex-col gap-1.5">
                  <h2 className="font-heading font-semibold text-ink text-sm m-0">
                    {i + 1}. {s.nazev}
                    {s.delka && <span className="font-body text-muted font-normal"> · {s.delka}</span>}
                  </h2>
                  {s.text?.trim() ? (
                    <p
                      className="font-body text-ink m-0 whitespace-pre-wrap leading-relaxed"
                      style={{ fontSize: velikostTextu }}
                    >
                      {s.text}
                    </p>
                  ) : (
                    <p className="font-body text-sm text-muted m-0">Bez textu.</p>
                  )}
                </article>
              ))
            )}
          </section>

          {/* VPRAVO LIDI. Já dole menší - hlavní je, co dělají ostatní. */}
          <section className="min-h-0 overflow-y-auto p-4 flex flex-col gap-3 bg-surface">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {ucastnici.length === 0 && (
                <p className="font-body text-sm text-muted m-0">
                  Zatím jste tu sám. Pošlete ostatním tento odkaz.
                </p>
              )}
              {ucastnici.map((u) => (
                <Dlazdice key={u.id} jmeno={u.jmeno} stream={u.stream} />
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <div className="relative rounded-card overflow-hidden bg-black/80 aspect-video">
                <video
                  ref={mojeVideo}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-pill bg-black/60 text-white font-heading text-[10px] px-2 py-0.5">
                  {jmeno || 'Já'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prepniMikrofon}
                  className={`flex-1 rounded-pill font-heading font-semibold text-xs px-3 py-2 border cursor-pointer ${
                    mikrofon
                      ? 'bg-brand-green text-black border-transparent'
                      : 'bg-surface text-danger border-danger'
                  }`}
                >
                  {mikrofon ? 'Mikrofon zapnutý' : 'Mikrofon vypnutý'}
                </button>
                <button
                  type="button"
                  onClick={prepniKameru}
                  className={`flex-1 rounded-pill font-heading font-semibold text-xs px-3 py-2 border cursor-pointer ${
                    kamera
                      ? 'bg-surface text-ink border-line'
                      : 'bg-surface text-danger border-danger'
                  }`}
                >
                  {kamera ? 'Kamera zapnutá' : 'Kamera vypnutá'}
                </button>
              </div>
              {/* Proč to stavíme: zvuk bez úprav prohlížeče, což Meet nedovolí. */}
              <p className="font-body text-[11px] text-muted m-0">
                Zvuk jde bez potlačení echa, redukce šumu a automatické hlasitosti — tedy tak, jak
                ho pouští mikrofon.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

/** Jedna dlaždice účastníka. Stream se přiřazuje přes ref, ne v JSX. */
function Dlazdice({ jmeno, stream }: { jmeno: string; stream: MediaStream | null }) {
  const video = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (video.current && video.current.srcObject !== stream) {
      video.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-card overflow-hidden bg-black/80 aspect-video">
      <video ref={video} autoPlay playsInline className="w-full h-full object-cover" />
      {!stream && (
        <span className="absolute inset-0 flex items-center justify-center font-body text-xs text-white/60">
          spojuji…
        </span>
      )}
      <span className="absolute bottom-1 left-1 rounded-pill bg-black/60 text-white font-heading text-[10px] px-2 py-0.5">
        {jmeno}
      </span>
    </div>
  );
}
