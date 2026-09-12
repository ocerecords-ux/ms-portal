'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Upozornění na nové zprávy (zadání 9. 9. 2026, rozšířeno 12. 9. 2026:
 * „pojďme přidat detailnější nastavení notifikací v chatu, ať si nastaví
 * každý sám individuálně").
 *
 * Zvonek v hlavičce chatu otevře panel, kde jsou dvě různé věci pod sebou:
 *
 * 1. UPOZORNĚNÍ V TOMHLE PROHLÍŽEČI - povolení, které patří zařízení. Ukazuje
 *    tři stavy: vypnuto, zapnuto a zakázáno prohlížečem; v posledním případě
 *    se z portálu nedá nic dělat a člověk to musí povolit v prohlížeči.
 *    POZOR NA IPHONE: Apple pouští upozornění jen aplikacím přidaným na
 *    plochu, v samotném Safari tlačítko nic nesvede - proto se tam rovnou
 *    vysvětlí proč, místo aby povolení tiše selhalo.
 *
 * 2. KDY UPOZORŇOVAT - nastavení ÚČTU, platí na všech zařízeních. Zvlášť pro
 *    rozhovory a zvlášť pro kanály projektu: když mi někdo píše přímo, chci
 *    vědět o každé zprávě; v kanálu projektu často jen o tom, když se řeším
 *    já. Bez toho lidé vypnou upozornění úplně a utečou jim i věci, které se
 *    jich týkají.
 */

type Stav = 'nezname' | 'nepodporovano' | 'vypnuto' | 'zapnuto' | 'zakazano' | 'jenVAplikaci';
type Rezim = 'VSE' | 'ZMINKY' | 'NIC';

type Nastaveni = {
  zpravy: Rezim;
  skupiny: Rezim;
  kanaly: Rezim;
  tichoOd: number | null;
  tichoDo: number | null;
};

/**
 * Jedna skupina do seznamu „Jednotlivé skupiny" (zadání 12. 9. 2026:
 * „potřeboval bych ještě upravovat notifikace zvlášť na soukromé zprávy
 * a na individuální skupiny"). Prázdné `upozorneni` znamená „řídí se
 * nastavením skupin".
 */
export type SkupinaProUpozorneni = { id: string; label: string; upozorneni: Rezim | null };

const REZIMY: { hodnota: Rezim; popisek: string }[] = [
  { hodnota: 'VSE', popisek: 'Vše' },
  { hodnota: 'ZMINKY', popisek: 'Jen zmínky' },
  { hodnota: 'NIC', popisek: 'Nic' },
];

/**
 * Klíč z API chodí v base64url, prohlížeč ho chce jako syrové bajty.
 *
 * Vrací se ArrayBuffer, ne Uint8Array: novější TypeScript rozlišuje, nad
 * jakou pamětí pole leží, a subscribe() chce právě tenhle tvar.
 */
function naBajty(base64url: string): ArrayBuffer {
  const doplneni = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + doplneni).replace(/-/g, '+').replace(/_/g, '/');
  const syrove = atob(base64);
  const pole = new Uint8Array(syrove.length);
  for (let i = 0; i < syrove.length; i += 1) pole[i] = syrove.charCodeAt(i);
  return pole.buffer;
}

function jeIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function vAplikaci(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function UpozorneniChatu({
  skupiny = [],
  onZmenaSkupiny,
}: {
  skupiny?: SkupinaProUpozorneni[];
  onZmenaSkupiny?: (id: string, rezim: Rezim | null) => void;
} = {}) {
  const [stav, setStav] = useState<Stav>('nezname');
  const [pracuje, setPracuje] = useState(false);
  const [otevreno, setOtevreno] = useState(false);
  const [nastaveni, setNastaveni] = useState<Nastaveni | null>(null);
  const obal = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // iPhone mimo aplikaci na ploše push vůbec nenabízí - řekněme proč.
      setStav(jeIOS() && !vAplikaci() ? 'jenVAplikaci' : 'nepodporovano');
      return;
    }
    if (Notification.permission === 'denied') {
      setStav('zakazano');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((odber) => setStav(odber ? 'zapnuto' : 'vypnuto'))
      .catch(() => setStav('vypnuto'));
  }, []);

  // Nastaveni uctu se nacte az pri prvnim otevreni panelu - vetsina lidi ho
  // neotevre nikdy a chat se kvuli tomu nema zdrzovat.
  useEffect(() => {
    if (!otevreno || nastaveni) return;
    let zivy = true;
    fetch('/api/chat/upozorneni')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (zivy && d) setNastaveni(d as Nastaveni);
      })
      .catch(() => undefined);
    return () => {
      zivy = false;
    };
  }, [otevreno, nastaveni]);

  // Klepnuti vedle panel zavre.
  useEffect(() => {
    if (!otevreno) return;
    function mimo(e: MouseEvent) {
      if (obal.current && !obal.current.contains(e.target as Node)) setOtevreno(false);
    }
    document.addEventListener('mousedown', mimo);
    return () => document.removeEventListener('mousedown', mimo);
  }, [otevreno]);

  const uloz = useCallback(async (zmena: Partial<Nastaveni>) => {
    // Prepne se hned, aby prepinac nelagoval; kdyz ulozeni selze, vrati se to
    // pri pristim otevreni panelu.
    setNastaveni((soucasne) => (soucasne ? { ...soucasne, ...zmena } : soucasne));
    try {
      await fetch('/api/chat/upozorneni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zmena),
      });
    } catch {
      // Nastaveni upozorneni neni nic, kvuli cemu by mel clovek videt chybu.
    }
  }, []);

  const zapni = useCallback(async () => {
    setPracuje(true);
    try {
      const povoleni = await Notification.requestPermission();
      if (povoleni !== 'granted') {
        setStav(povoleni === 'denied' ? 'zakazano' : 'vypnuto');
        return;
      }

      const odpoved = await fetch('/api/push/klic');
      const data = await odpoved.json().catch(() => ({}));
      if (!odpoved.ok || !data?.klic) {
        console.error('Klíč pro upozornění se nepodařilo načíst:', data?.error);
        setStav('vypnuto');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const odber = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: naBajty(data.klic),
      });

      const json = odber.toJSON();
      const ulozeno = await fetch('/api/push/odber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: odber.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          zarizeni: navigator.userAgent.slice(0, 300),
        }),
      });
      setStav(ulozeno.ok ? 'zapnuto' : 'vypnuto');
    } catch (err) {
      console.error('Upozornění se nepodařilo zapnout:', err);
      setStav('vypnuto');
    } finally {
      setPracuje(false);
    }
  }, []);

  const vypni = useCallback(async () => {
    setPracuje(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const odber = await reg.pushManager.getSubscription();
      if (odber) {
        await fetch('/api/push/odber', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: odber.endpoint }),
        }).catch(() => undefined);
        await odber.unsubscribe().catch(() => undefined);
      }
      setStav('vypnuto');
    } finally {
      setPracuje(false);
    }
  }, []);

  if (stav === 'nezname') return null;

  const nefunkcni = stav === 'zakazano' || stav === 'jenVAplikaci';
  const zapnuto = stav === 'zapnuto';

  return (
    <div className="relative" ref={obal}>
      <button
        type="button"
        onClick={() => setOtevreno((o) => !o)}
        title="Nastavení upozornění"
        aria-label="Nastavení upozornění"
        aria-expanded={otevreno}
        className={`leading-none transition-colors ${
          zapnuto ? 'text-brand-green' : 'text-brand-green/60 hover:text-brand-green'
        }`}
      >
        {zapnuto ? <ZvonekZapnuty /> : <ZvonekVypnuty />}
      </button>

      {otevreno && (
        <div className="absolute right-0 top-full mt-2 z-40 w-[290px] rounded-card border border-line bg-surface shadow-xl p-4 flex flex-col gap-4 text-ink normal-case tracking-normal">
          <div>
            <p className="m-0 font-heading font-semibold text-xs uppercase tracking-wide text-muted">
              V tomhle prohlížeči
            </p>
            {stav === 'nepodporovano' ? (
              <p className="m-0 mt-1.5 text-xs font-body text-muted">
                Tenhle prohlížeč upozornění neumí. Nastavení níž platí i tak — projeví se tam, kde
                upozornění zapnutá máte.
              </p>
            ) : nefunkcni ? (
              <p className="m-0 mt-1.5 text-xs font-body text-muted">
                {stav === 'zakazano'
                  ? 'Upozornění máte zakázaná v nastavení prohlížeče — povolit se dají jen tam.'
                  : 'Na iPhonu chodí upozornění jen aplikaci přidané na plochu. Přidejte si MS Chat na plochu a zapněte je tam.'}
              </p>
            ) : (
              <button
                type="button"
                disabled={pracuje}
                onClick={() => void (zapnuto ? vypni() : zapni())}
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs font-heading font-semibold transition-colors disabled:opacity-50 ${
                  zapnuto
                    ? 'border-line text-muted hover:text-ink'
                    : 'border-brand-purple text-brand-purple hover:bg-tint'
                }`}
              >
                {pracuje ? 'Moment…' : zapnuto ? 'Vypnout upozornění' : 'Zapnout upozornění'}
              </button>
            )}
          </div>

          <div className="border-t border-line pt-3.5 flex flex-col gap-3.5">
            <p className="m-0 font-heading font-semibold text-xs uppercase tracking-wide text-muted">
              Kdy upozorňovat
            </p>

            {!nastaveni ? (
              <p className="m-0 text-xs font-body text-muted">Načítám…</p>
            ) : (
              <>
                <Prepinac
                  popisek="Soukromé zprávy"
                  hodnota={nastaveni.zpravy}
                  onZmena={(v) => void uloz({ zpravy: v })}
                />
                <Prepinac
                  popisek="Skupiny"
                  hodnota={nastaveni.skupiny}
                  onZmena={(v) => void uloz({ skupiny: v })}
                />
                <Prepinac
                  popisek="Kanály projektů"
                  hodnota={nastaveni.kanaly}
                  onZmena={(v) => void uloz({ kanaly: v })}
                />

                {/* JEDNOTLIVÉ SKUPINY (zadání 12. 9. 2026). Jedna ukecaná
                    skupina nemá nutit člověka ztlumit všechny - proto si
                    každá může říct svoje. „Podle skupin" je výchozí a vrací
                    ji zpátky pod obecné nastavení. */}
                {skupiny.length > 0 && onZmenaSkupiny && (
                  <div className="border-t border-line pt-3">
                    <p className="m-0 mb-2 font-heading font-semibold text-[11px] uppercase tracking-wide text-muted">
                      Jednotlivé skupiny
                    </p>
                    <div className="flex flex-col gap-2.5 max-h-[210px] overflow-y-auto pr-1">
                      {skupiny.map((s) => (
                        <div key={s.id}>
                          <span className="block text-xs font-heading text-ink truncate" title={s.label}>
                            {s.label}
                          </span>
                          <div className="mt-1 flex rounded-lg border border-line overflow-hidden">
                            {([{ hodnota: null, popisek: 'Podle skupin' }, ...REZIMY] as {
                              hodnota: Rezim | null;
                              popisek: string;
                            }[]).map((r) => (
                              <button
                                key={r.hodnota ?? 'vychozi'}
                                type="button"
                                onClick={() => onZmenaSkupiny(s.id, r.hodnota)}
                                aria-pressed={s.upozorneni === r.hodnota}
                                className={`flex-1 px-1.5 py-1 text-[10px] font-heading font-semibold transition-colors ${
                                  s.upozorneni === r.hodnota
                                    ? 'bg-brand-purple text-white'
                                    : 'bg-surface text-muted hover:text-ink hover:bg-field'
                                }`}
                              >
                                {r.popisek}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-heading text-ink">Noční klid</span>
                    <button
                      type="button"
                      onClick={() =>
                        void uloz(
                          nastaveni.tichoOd === null
                            ? { tichoOd: 20, tichoDo: 8 }
                            : { tichoOd: null, tichoDo: null },
                        )
                      }
                      className="text-[11px] font-heading font-semibold text-brand-purple hover:underline"
                    >
                      {nastaveni.tichoOd === null ? 'Zapnout' : 'Vypnout'}
                    </button>
                  </div>
                  {nastaveni.tichoOd !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Hodina
                        hodnota={nastaveni.tichoOd}
                        onZmena={(v) => void uloz({ tichoOd: v })}
                      />
                      <span className="text-xs text-muted">–</span>
                      <Hodina
                        hodnota={nastaveni.tichoDo ?? 8}
                        onZmena={(v) => void uloz({ tichoDo: v })}
                      />
                      <span className="text-[11px] font-body text-muted">nechodí nic</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="m-0 text-[11px] font-body text-muted leading-snug">
              Platí pro všechna vaše zařízení. Zprávy chodí dál a počítají se jako nepřečtené — jen
              nezazvoní. Jednotlivý kanál projektu se dá ztlumit u něj samotného.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Prepinac({
  popisek,
  hodnota,
  onZmena,
}: {
  popisek: string;
  hodnota: Rezim;
  onZmena: (v: Rezim) => void;
}) {
  return (
    <div>
      <span className="text-xs font-heading text-ink">{popisek}</span>
      <div className="mt-1.5 flex rounded-lg border border-line overflow-hidden">
        {REZIMY.map((r) => (
          <button
            key={r.hodnota}
            type="button"
            onClick={() => onZmena(r.hodnota)}
            aria-pressed={hodnota === r.hodnota}
            className={`flex-1 px-2 py-1.5 text-[11px] font-heading font-semibold transition-colors ${
              hodnota === r.hodnota
                ? 'bg-brand-purple text-white'
                : 'bg-surface text-muted hover:text-ink hover:bg-field'
            }`}
          >
            {r.popisek}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hodina({ hodnota, onZmena }: { hodnota: number; onZmena: (v: number) => void }) {
  return (
    <select
      value={hodnota}
      onChange={(e) => onZmena(Number(e.target.value))}
      className="rounded-lg border border-line bg-field px-2 py-1 text-xs font-heading text-ink outline-none"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  );
}

function ZvonekZapnuty() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22zm7-5.4v-5a7 7 0 0 0-5.3-6.8V4a1.7 1.7 0 1 0-3.4 0v.8A7 7 0 0 0 5 11.6v5l-1.6 1.6v.8h17.2v-.8z" />
    </svg>
  );
}

function ZvonekVypnuty() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
      <path d="M18 15.6v-4a6 6 0 0 0-12 0v4L4.6 17v.7h14.8V17z" />
      <path d="M10.2 20.4a2 2 0 0 0 3.6 0" />
      <path d="M4 3.5 20 20" />
    </svg>
  );
}
