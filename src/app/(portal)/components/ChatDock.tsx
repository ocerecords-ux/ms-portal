'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationKind } from '@prisma/client';
import {
  CHAT_TABS,
  EMOJI,
  MAX_MESSAGE_LENGTH,
  formatMessageTime,
  initials,
  splitMentions,
  type ChatConversation,
  type ChatMessage,
  type ChatTeamMember,
} from '@/lib/chat';

/**
 * Chat týmu (zadani 8. 9. 2026: "vytvor komunikacni kanal jako Slack pro tym...
 * Chat by se mohl odkryvat pod To do listem, stejne jako to do list jen ve
 * spodni casti na prave strane obrazovky").
 *
 * Tri zalozky: Projekty (kanal ke konkretni zakazce z Caflou), Soukromé a
 * Skupiny. Zamerne jednoduche - text, nic vic; "do budoucna na to udelame
 * samostatnou aplikaci".
 *
 * Nove zpravy se zjistuji dotazem kazdych 12 vterin, zadne websockety - pro
 * tym o par lidech to bohate staci a nic to nekomplikuje.
 */

const STORAGE_KEY = 'ms-portal-chat-otevreno';
const REFRESH_MS = 12000;

type ProjectOption = { id: string; label: string; name: string };

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.7-5a8.4 8.4 0 0 1-.7-3.4 8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.4z" />
    </svg>
  );
}

/**
 * Kolecko s fotkou, a kdyz fotka neni (nebo se nenacte), s inicialami.
 *
 * onError je tu naschval: v uctu muze zustat stara adresa do S3, ktere uz
 * nikdo neodpovi (uloziste na Vercelu nastavene neni a fotky se od te doby
 * ukladaji primo do databaze jako data: URL). Bez teto pojistky by na miste
 * fotky zustalo prazdne kolecko - takhle se aspon ukazou iniciály.
 */
function Avatar({ label, photoUrl, size = 28 }: { label: string; photoUrl: string | null; size?: number }) {
  const [selhalo, setSelhalo] = useState(false);

  if (photoUrl && !selhalo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setSelhalo(true)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-line bg-field"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="rounded-full shrink-0 bg-brand-purple/15 text-brand-purpleDark font-heading font-bold flex items-center justify-center"
      aria-hidden="true"
    >
      {initials(label)}
    </span>
  );
}

/**
 * "Zobrazeno" u vlastni zpravy (zadani 8. 9. 2026). Bere se z toho, kdy mel
 * kdo konverzaci naposledy otevrenou - stejny udaj, ze ktereho se pocitaji
 * neprectene. U kanalu k projektu to znamena "z tech, kdo tam kdy byli".
 */
function Zobrazeno({ seenBy }: { seenBy: string[] }) {
  if (seenBy.length === 0) {
    return <span className="block mt-0.5 text-[11px] font-body text-muted/70">Odesláno</span>;
  }
  return (
    <span
      className="block mt-0.5 text-[11px] font-body text-muted/80"
      title={`Zobrazeno: ${seenBy.join(', ')}`}
    >
      Zobrazeno {seenBy.length <= 2 ? `· ${seenBy.join(', ')}` : `· ${seenBy.length} lidem`}
    </span>
  );
}

/** Text zpravy se zvyraznenymi zminkami (@Jméno). */
function Telo({ body, jmena, mine }: { body: string; jmena: string[]; mine: boolean }) {
  return (
    <>
      {splitMentions(body, jmena).map((cast, index) =>
        cast.mention ? (
          <strong
            key={index}
            className={`font-heading font-semibold rounded px-0.5 ${
              mine ? 'bg-white/25 text-white' : 'bg-brand-purple/15 text-brand-purpleDark'
            }`}
          >
            {cast.text}
          </strong>
        ) : (
          <span key={index}>{cast.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Psaci pole s nabidkou zminek. Enter odesila, Shift+Enter dela novy radek.
 * Nabidka se ukaze jen kdyz je rozepsana zminka - vybere se kliknutim.
 */
function Psatko({
  hodnota,
  zmena,
  odeslat,
  sending,
  placeholder,
  nabidka,
  vyber,
}: {
  hodnota: string;
  zmena: (v: string) => void;
  odeslat: (e: React.FormEvent) => void;
  sending: boolean;
  placeholder: string;
  nabidka: ChatTeamMember[];
  vyber: (clovek: ChatTeamMember) => void;
}) {
  const [smajlici, setSmajlici] = useState(false);

  return (
    <form onSubmit={odeslat} className="relative border-t border-line p-3 flex items-end gap-2">
      {smajlici && (
        <div className="absolute left-3 right-3 bottom-full mb-1 bg-white border border-line rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1 z-10">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                zmena(`${hodnota}${e}`);
                setSmajlici(false);
              }}
              className="text-lg leading-none rounded hover:bg-field py-1"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      {nabidka.length > 0 && (
        <div className="absolute left-3 right-3 bottom-full mb-1 max-h-40 overflow-y-auto bg-white border border-line rounded-lg shadow-lg py-1 z-10">
          {nabidka.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => vyber(u)}
              className="w-full text-left px-3 py-1.5 text-sm font-body text-ink hover:bg-field flex items-center gap-2"
            >
              <Avatar label={u.label} photoUrl={u.photoUrl} size={22} />
              <span className="truncate">{u.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setSmajlici((v) => !v)}
        title="Smajlíci"
        aria-label="Smajlíci"
        className="shrink-0 w-9 h-9 rounded-lg border border-line text-muted hover:text-brand-purple hover:border-brand-purple transition-colors flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" />
        </svg>
      </button>
      <textarea
        value={hodnota}
        onChange={(e) => zmena(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            odeslat(e as unknown as React.FormEvent);
          }
        }}
        rows={2}
        placeholder={placeholder}
        className="flex-1 resize-none rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
      />
      <button
        type="submit"
        disabled={sending || !hodnota.trim()}
        className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2.5 disabled:opacity-50"
      >
        Poslat
      </button>
    </form>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d={direction === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

export function ChatDock() {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<ConversationKind>('PROJEKT');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [team, setTeam] = useState<ChatTeamMember[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  // Otevrene vlakno (zadani 8. 9. 2026) - ID zpravy, pod kterou se odpovida.
  const [vlaknoId, setVlaknoId] = useState<string | null>(null);
  const [vlakno, setVlakno] = useState<ChatMessage[]>([]);
  const [vlaknoDraft, setVlaknoDraft] = useState('');
  // Naseptavac zminek: kdyz se v rozepsanem textu objevi "@", nabidne lidi.
  const [zminkyPro, setZminkyPro] = useState<'hlavni' | 'vlakno' | null>(null);
  const [zminkaHledani, setZminkaHledani] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zakladani noveho: projekt / clovek / skupina
  const [novy, setNovy] = useState(false);
  const [projekty, setProjekty] = useState<ProjectOption[] | null>(null);
  const [projektyChyba, setProjektyChyba] = useState<string | null>(null);
  const [nazevSkupiny, setNazevSkupiny] = useState('');
  const [vybraniLide, setVybraniLide] = useState<string[]>([]);

  const konecRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setExpanded(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // soukrome okno / zakazane uloziste - nevadi
    }
  }, []);

  function toggle() {
    setExpanded((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // nevadi
      }
      return next;
    });
  }

  const nactiKonverzace = useCallback(async () => {
    try {
      const res: Response = await fetch('/api/chat/konverzace');
      if (!res.ok) return;
      const data: any = await res.json().catch(() => ({}));
      setConversations(Array.isArray(data?.konverzace) ? data.konverzace : []);
      setTeam(Array.isArray(data?.tym) ? data.tym : []);
    } catch {
      // vypadek site - zkusi se zas za chvili
    }
  }, []);

  const nactiVlakno = useCallback(async (conversationId: string, messageId: string) => {
    try {
      const res: Response = await fetch(
        `/api/chat/konverzace/${conversationId}/zpravy?vlakno=${encodeURIComponent(messageId)}`,
      );
      if (!res.ok) return;
      const data: any = await res.json().catch(() => ({}));
      setVlakno(Array.isArray(data?.zpravy) ? data.zpravy : []);
    } catch {
      // nevadi, zkusi se znovu
    }
  }, []);

  const nactiZpravy = useCallback(async (conversationId: string) => {
    try {
      const res: Response = await fetch(`/api/chat/konverzace/${conversationId}/zpravy`);
      if (!res.ok) return;
      const data: any = await res.json().catch(() => ({}));
      setMessages(Array.isArray(data?.zpravy) ? data.zpravy : []);
    } catch {
      // nevadi, zkusi se znovu
    }
  }, []);

  // Seznam konverzaci drzime aktualni i zabaleny - jinak by na ikonce nebylo
  // videt, ze prisla nova zprava.
  useEffect(() => {
    void nactiKonverzace();
    const timer = setInterval(() => {
      void nactiKonverzace();
      if (openId) void nactiZpravy(openId);
      if (openId && vlaknoId) void nactiVlakno(openId, vlaknoId);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [nactiKonverzace, nactiZpravy, nactiVlakno, openId, vlaknoId]);

  useEffect(() => {
    if (openId) void nactiZpravy(openId);
    else setMessages([]);
    setVlaknoId(null);
  }, [openId, nactiZpravy]);

  useEffect(() => {
    if (openId && vlaknoId) void nactiVlakno(openId, vlaknoId);
    else setVlakno([]);
  }, [openId, vlaknoId, nactiVlakno]);

  // Kanaly se nabizeji rovnou podle aktivnich projektu (zprava uzivatele
  // 8. 9. 2026: "kanaly by se mely vytvorit z existujicich aktivnich
  // projektu"), takze se seznam nacita hned po otevreni zalozky.
  useEffect(() => {
    if (tab === 'PROJEKT') void nactiProjekty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    konecRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, openId]);

  const neprectene = conversations.reduce((sum, c) => sum + c.unread, 0);
  const vZalozce = conversations.filter((c) => c.kind === tab);
  const otevrena = conversations.find((c) => c.id === openId) ?? null;

  /**
   * Kanaly k projektum. Neni to seznam zalozenych konverzaci, ale seznam
   * AKTIVNICH PROJEKTU - kanal ma kazdy z nich, at uz v nem nekdo psal, nebo
   * ne. Konverzace v databazi vznikne az s prvni zpravou, takze nezustavaji
   * stovky prazdnych kanalu a seznam se sam sroubuje, jak projekty pribyvaji
   * a konci. Kanal k projektu, ktery uz aktivni neni, ale zpravy v nem jsou,
   * se pripoji na konec - aby se historie neztratila.
   */
  const kanaly: { key: string; label: string; conversation: ChatConversation | null; caflouProjectId: string; name: string }[] =
    (projekty ?? []).map((p) => ({
      key: p.id,
      label: p.label,
      conversation: conversations.find((c) => c.caflouProjectId === p.id) ?? null,
      caflouProjectId: p.id,
      name: p.name,
    }));
  for (const c of vZalozce) {
    if (tab !== 'PROJEKT') break;
    if (c.caflouProjectId && kanaly.some((k) => k.caflouProjectId === c.caflouProjectId)) continue;
    kanaly.push({
      key: c.id,
      label: c.label,
      conversation: c,
      caflouProjectId: c.caflouProjectId ?? '',
      name: c.label,
    });
  }

  async function otevriNovou(telo: Record<string, unknown>) {
    setError(null);
    try {
      const res: Response = await fetch('/api/chat/konverzace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telo),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Nepodařilo se to otevřít.');
        return;
      }
      setNovy(false);
      setNazevSkupiny('');
      setVybraniLide([]);
      await nactiKonverzace();
      if (data?.id) setOpenId(String(data.id));
    } catch {
      setError('Nepodařilo se to otevřít.');
    }
  }

  async function nactiProjekty() {
    if (projekty !== null) return;
    setProjektyChyba(null);
    try {
      const res: Response = await fetch('/api/chat/projekty');
      const data: any = await res.json().catch(() => ({}));
      setProjekty(Array.isArray(data?.projekty) ? data.projekty : []);
      if (data?.chyba) setProjektyChyba(String(data.chyba));
    } catch {
      setProjekty([]);
      setProjektyChyba('Projekty se nepodařilo načíst z Caflou.');
    }
  }

  async function odesli(e: React.FormEvent, doVlakna = false) {
    e.preventDefault();
    const text = (doVlakna ? vlaknoDraft : draft).trim();
    if (!openId || !text || sending) return;
    if (doVlakna && !vlaknoId) return;
    setSending(true);
    setError(null);
    try {
      const res: Response = await fetch(`/api/chat/konverzace/${openId}/zpravy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doVlakna ? { body: text, parentId: vlaknoId } : { body: text }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Zprávu se nepodařilo odeslat.');
        return;
      }
      if (doVlakna) {
        setVlaknoDraft('');
        setVlakno((current) => [...current, data as ChatMessage]);
        void nactiZpravy(openId);
      } else {
        setDraft('');
        setMessages((current) => [...current, data as ChatMessage]);
      }
      setZminkyPro(null);
      void nactiKonverzace();
    } catch {
      setError('Zprávu se nepodařilo odeslat.');
    } finally {
      setSending(false);
    }
  }

  /**
   * Hlida rozepsany text a kdyz konci rozepsanou zminkou (@ a za nim zatim
   * zadna mezera), otevre nabidku lidi. Vybrany clovek se do textu doplni
   * i s mezerou, at se da rovnou psat dal.
   */
  function sledujZminku(text: string, kde: 'hlavni' | 'vlakno') {
    // Zminka se pozna jen na zacatku slova a jen dokud za @ neni mezera -
    // jinak by nabidka vyskakovala i uprostred bezne vety a v e-mailovych
    // adresach. Cele jmeno vc. prijmeni doplni az vyber ze seznamu.
    const match = /(?:^|\s)@([\p{L}]{0,20})$/u.exec(text);
    if (match) {
      setZminkyPro(kde);
      setZminkaHledani(match[1].toLowerCase());
    } else {
      setZminkyPro(null);
    }
  }

  function doplnZminku(clovek: ChatTeamMember) {
    const uprav = (text: string) => text.replace(/@[\p{L}]{0,20}$/u, `@${clovek.label} `);
    if (zminkyPro === 'vlakno') setVlaknoDraft((t) => uprav(t));
    else setDraft((t) => uprav(t));
    setZminkyPro(null);
  }

  const jmenaTymu = team.map((u) => u.label);
  const nabidkaZminek = team.filter((u) => u.label.toLowerCase().includes(zminkaHledani));

  // --- Zabaleno: jen ikonka na hrane obrazovky ---------------------------
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Zobrazit MS chat"
        aria-label="Zobrazit MS chat"
        className="fixed right-0 bottom-6 z-40 flex flex-col items-center gap-2 bg-brand-purple hover:bg-brand-purpleDeep rounded-l-card shadow-lg px-2.5 py-3 text-brand-green transition-colors"
      >
        <Chevron direction="left" />
        <span className="relative">
          <ChatIcon />
          {neprectene > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-green text-ink text-[10px] font-heading font-bold leading-4 text-center">
              {neprectene}
            </span>
          )}
        </span>
        <span className="text-[10px] font-heading font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          MS chat
        </span>
      </button>
    );
  }

  // --- Rozbaleno ---------------------------------------------------------
  // Spodni polovina prave hrany - Ukoly maji horni. Vysky obou panelu jsou
  // zastropovane, at na sebe nelezou ani na nizsim okne (zprava uzivatele
  // 8. 9. 2026: "prekryva to to do list, kdyz tam mam vice ukolu").
  return (
    <aside className="fixed right-0 bottom-6 z-40 flex items-stretch">
      {/* Stejny siroky pruh na zavreni jako u Ukolu - do male sipky se spatne
          trefuje (zadani 8. 9. 2026). */}
      <button
        type="button"
        onClick={toggle}
        title="Skrýt MS chat"
        aria-label="Skrýt MS chat"
        className="w-8 shrink-0 rounded-l-card border border-r-0 border-line bg-field text-muted hover:bg-brand-purple hover:text-white transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Chevron direction="right" />
        <span className="text-[10px] font-heading font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
          Skrýt
        </span>
        <Chevron direction="right" />
      </button>

      {/* Rozvrzeni jako Slack (zadani 8. 9. 2026): vlevo seznam, vpravo
          samotny chat. Na uzkem okne se leva cast schova a zustane jen to,
          co je zrovna otevrene. */}
      <div
        className={`max-w-[92vw] h-[50vh] bg-white border border-r-0 border-line shadow-xl flex flex-col overflow-hidden transition-[width] ${
          vlaknoId ? 'w-[900px]' : 'w-[620px]'
        }`}
      >
        <div className="bg-brand-purple text-brand-green px-4 py-2.5 flex items-center justify-between gap-3">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">MS chat</h2>
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-heading font-semibold text-brand-green/90 hover:text-white whitespace-nowrap"
          >
            {neprectene > 0 ? `${neprectene} nových` : 'skrýt'} ›
          </button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-4 py-2 m-0">{error}</p>}

        <div className="flex-1 min-h-0 flex">
          {/* --- Levy sloupec: zalozky a seznam ---------------------------- */}
          <div
            className={`w-[220px] shrink-0 border-r border-line flex-col min-h-0 ${
              vlaknoId ? 'hidden lg:flex' : otevrena ? 'hidden sm:flex' : 'flex'
            }`}
          >
            <div className="flex items-center gap-1 px-2 pt-2">
              {CHAT_TABS.map((t) => (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => {
                    setTab(t.kind);
                    setNovy(false);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-heading font-semibold rounded-pill transition-colors ${
                    tab === t.kind ? 'bg-brand-purple text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
              {tab === 'PROJEKT' && projekty === null && (
                <p className="text-sm font-body text-muted m-0 px-1">Načítám projekty…</p>
              )}
              {tab === 'PROJEKT' && projektyChyba && (
                <p className="text-xs text-red-600 m-0 px-1">{projektyChyba}</p>
              )}
              {tab === 'PROJEKT' &&
                kanaly.map((k) => {
                  const aktivni = k.conversation?.id === openId;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() =>
                        k.conversation
                          ? setOpenId(k.conversation.id)
                          : void otevriNovou({ kind: 'PROJEKT', caflouProjectId: k.caflouProjectId, name: k.name })
                      }
                      className={`text-left rounded-lg px-2.5 py-1.5 transition-colors flex items-center justify-between gap-2 ${
                        aktivni ? 'bg-[#F1ECFF] text-brand-purpleDark' : 'hover:bg-field text-ink'
                      }`}
                    >
                      <span className="font-heading text-sm truncate">
                        <span className="text-muted">#</span> {k.label}
                      </span>
                      {(k.conversation?.unread ?? 0) > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-ink text-[10px] font-heading font-bold leading-[18px] text-center">
                          {k.conversation?.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              {tab === 'PROJEKT' && projekty !== null && kanaly.length === 0 && (
                <p className="text-sm font-body text-muted m-0 px-1">Žádné rozpracované projekty.</p>
              )}

              {tab !== 'PROJEKT' && vZalozce.length === 0 && !novy && (
                <p className="text-sm font-body text-muted m-0 px-1">
                  {tab === 'SOUKROMA' ? 'Zatím si s nikým nepíšete.' : 'Zatím tu není žádná skupina.'}
                </p>
              )}
              {tab !== 'PROJEKT' &&
                vZalozce.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setOpenId(c.id)}
                    className={`text-left rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-2 ${
                      c.id === openId ? 'bg-[#F1ECFF]' : 'hover:bg-field'
                    }`}
                  >
                    <Avatar label={c.label} photoUrl={c.avatarUrl} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-sm text-ink truncate">{c.label}</span>
                      {c.kind === 'SKUPINA' && c.memberLabels.length > 0 && (
                        <span className="block text-[11px] font-body text-muted truncate">
                          {c.memberLabels.join(', ')}
                        </span>
                      )}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-ink text-[10px] font-heading font-bold leading-[18px] text-center">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))}

              {novy && tab === 'SOUKROMA' && (
                <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
                  {team.length === 0 && <p className="text-xs text-muted m-0 px-1">Nikdo další tu zatím není.</p>}
                  {team.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => otevriNovou({ kind: 'SOUKROMA', userId: u.id })}
                      className="text-left rounded-lg px-2.5 py-1.5 text-sm font-body text-ink hover:bg-field flex items-center gap-2"
                    >
                      <Avatar label={u.label} photoUrl={u.photoUrl} size={24} />
                      <span className="truncate">{u.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {novy && tab === 'SKUPINA' && (
                <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
                  <input
                    value={nazevSkupiny}
                    onChange={(e) => setNazevSkupiny(e.target.value)}
                    placeholder="Název skupiny"
                    className="rounded-lg border border-line bg-field px-3 py-2 text-sm font-body text-ink outline-none focus:border-brand-purple"
                  />
                  {team.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm font-body text-ink px-1">
                      <input
                        type="checkbox"
                        checked={vybraniLide.includes(u.id)}
                        onChange={(e) =>
                          setVybraniLide((current) =>
                            e.target.checked ? [...current, u.id] : current.filter((id) => id !== u.id),
                          )
                        }
                      />
                      <Avatar label={u.label} photoUrl={u.photoUrl} size={22} />
                      <span className="truncate">{u.label}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={!nazevSkupiny.trim() || vybraniLide.length === 0}
                    onClick={() => otevriNovou({ kind: 'SKUPINA', name: nazevSkupiny.trim(), userIds: vybraniLide })}
                    className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    Založit skupinu
                  </button>
                </div>
              )}
            </div>

            {/* Kanaly k projektum se nezakladaji rucne - berou se z aktivnich
                projektu, takze tlacitko dava smysl jen u zbylych dvou zalozek. */}
            {tab !== 'PROJEKT' && (
              <div className="border-t border-line p-2">
                <button
                  type="button"
                  onClick={() => setNovy((v) => !v)}
                  className="w-full font-heading font-semibold text-xs rounded-lg border border-line px-3 py-2 text-brand-purple hover:border-brand-purple transition-colors"
                >
                  {novy ? 'Zrušit' : tab === 'SOUKROMA' ? '+ Napsat někomu' : '+ Nová skupina'}
                </button>
              </div>
            )}
          </div>

          {/* --- Pravy sloupec: samotny chat ------------------------------- */}
          <div className="flex-1 min-w-0 flex">
            {!otevrena ? (
              <p className="m-auto text-sm font-body text-muted px-6 text-center">
                Vyberte vlevo projekt nebo člověka.
              </p>
            ) : (
              <>
                {/* Prostredni sloupec: samotna konverzace. Pri otevrenem
                    vlakne zustava videt (zadani 8. 9. 2026: "at se otevre
                    v dalsim okne napravo od te zpravy") - jen na uzkem okne
                    ustoupi, aby na vlakno vubec zbylo misto. */}
                <div className={`flex-1 min-w-0 flex flex-col ${vlaknoId ? 'hidden md:flex' : 'flex'}`}>
                  <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(null)}
                      title="Zpět na seznam"
                      className="sm:hidden text-muted hover:text-brand-purple"
                    >
                      <Chevron direction="left" />
                    </button>
                    {otevrena.kind !== 'PROJEKT' && (
                      <Avatar label={otevrena.label} photoUrl={otevrena.avatarUrl} size={26} />
                    )}
                    <span className="font-heading font-semibold text-sm text-ink truncate">
                      {otevrena.kind === 'PROJEKT' ? `# ${otevrena.label}` : otevrena.label}
                    </span>
                    {otevrena.kind === 'SKUPINA' && otevrena.memberLabels.length > 0 && (
                      <span className="text-[11px] font-body text-muted truncate hidden sm:block">
                        {otevrena.memberLabels.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                    {messages.length === 0 && (
                      <p className="text-sm font-body text-muted m-0">Zatím tu nikdo nic nenapsal.</p>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className="flex items-start gap-2">
                        <Avatar label={m.authorLabel} photoUrl={m.authorPhotoUrl} size={28} />
                        <div className="min-w-0">
                          <span className="text-[11px] font-heading text-muted">
                            {m.mine ? 'Já' : m.authorLabel} · {formatMessageTime(m.createdAt)}
                          </span>
                          <p
                            className={`mt-0.5 mb-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words ${
                              m.mine ? 'bg-brand-purple text-white' : 'bg-field text-ink'
                            }`}
                          >
                            <Telo body={m.body} jmena={jmenaTymu} mine={m.mine} />
                          </p>
                          {m.mine && <Zobrazeno seenBy={m.seenBy} />}
                          <button
                            type="button"
                            onClick={() => setVlaknoId(m.id)}
                            className={`mt-1 text-[11px] font-heading font-semibold hover:underline ${
                              vlaknoId === m.id ? 'text-brand-purpleDark underline' : 'text-brand-purple'
                            }`}
                          >
                            {m.replyCount > 0
                              ? `${m.replyCount} ${m.replyCount === 1 ? 'odpověď' : m.replyCount < 5 ? 'odpovědi' : 'odpovědí'} ›`
                              : 'Odpovědět ve vlákně'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div ref={konecRef} />
                  </div>

                  <Psatko
                    hodnota={draft}
                    zmena={(v) => {
                      setDraft(v);
                      sledujZminku(v, 'hlavni');
                    }}
                    odeslat={(e) => odesli(e, false)}
                    sending={sending}
                    placeholder="Napište zprávu… (@ zmíní kolegu)"
                    nabidka={zminkyPro === 'hlavni' ? nabidkaZminek : []}
                    vyber={doplnZminku}
                  />
                </div>

                {/* Treti sloupec: vlakno vedle zpravy, jako u Slacku. */}
                {vlaknoId && (
                  <div className="w-full md:w-[300px] shrink-0 border-l border-line flex flex-col min-h-0">
                    <div className="px-3 py-2.5 border-b border-line flex items-center justify-between gap-2 bg-field">
                      <span className="font-heading font-semibold text-sm text-ink">Vlákno</span>
                      <button
                        type="button"
                        onClick={() => setVlaknoId(null)}
                        title="Zavřít vlákno"
                        aria-label="Zavřít vlákno"
                        className="text-muted hover:text-brand-purple text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
                      {vlakno.map((m, index) => (
                        <div key={m.id} className={`flex items-start gap-2 ${index === 0 ? '' : 'pl-3'}`}>
                          <Avatar label={m.authorLabel} photoUrl={m.authorPhotoUrl} size={index === 0 ? 26 : 22} />
                          <div className="min-w-0">
                            <span className="text-[11px] font-heading text-muted">
                              {m.mine ? 'Já' : m.authorLabel} · {formatMessageTime(m.createdAt)}
                            </span>
                            <p
                              className={`mt-0.5 mb-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words ${
                                m.mine ? 'bg-brand-purple text-white' : 'bg-white border border-line text-ink'
                              }`}
                            >
                              <Telo body={m.body} jmena={jmenaTymu} mine={m.mine} />
                            </p>
                            {m.mine && <Zobrazeno seenBy={m.seenBy} />}
                          </div>
                        </div>
                      ))}
                      {vlakno.length <= 1 && (
                        <p className="text-sm font-body text-muted m-0 pl-3">Zatím bez odpovědí.</p>
                      )}
                    </div>

                    <Psatko
                      hodnota={vlaknoDraft}
                      zmena={(v) => {
                        setVlaknoDraft(v);
                        sledujZminku(v, 'vlakno');
                      }}
                      odeslat={(e) => odesli(e, true)}
                      sending={sending}
                      placeholder="Odpovědět…"
                      nabidka={zminkyPro === 'vlakno' ? nabidkaZminek : []}
                      vyber={doplnZminku}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
