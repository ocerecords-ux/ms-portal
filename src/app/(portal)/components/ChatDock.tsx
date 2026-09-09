'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationKind } from '@prisma/client';
import { MS_SMAJLICI, najdiSmajlika } from '@/lib/msSmajlici';
import { MsSmajlik } from './MsSmajlik';
import {
  CHAT_TABS,
  EMOJI,
  MAX_MESSAGE_LENGTH,
  RYCHLE_REAKCE,
  formatClock,
  formatDayLabel,
  formatFullTime,
  formatMessageTime,
  initials,
  stejnyDen,
  splitChatBody,
  type ChatConversation,
  type ChatMessage,
  type ChatReaction,
  type ChatTeamMember,
} from '@/lib/chat';
import {
  MAX_PRILOH,
  MAX_PRILOHA_BYTES,
  formatVelikost,
  jeObrazek,
  jeZvuk,
  type ChatPriloha,
} from '@/lib/chatPrilohy';
import { WaveformPlayer } from './WaveformPlayer';

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
    return <span className="text-[11px] font-body text-muted">Odesláno</span>;
  }
  return (
    <span className="text-[11px] font-body text-muted" title={`Zobrazeno: ${seenBy.join(', ')}`}>
      Zobrazeno {seenBy.length <= 2 ? `· ${seenBy.join(', ')}` : `· ${seenBy.length} lidem`}
    </span>
  );
}

/**
 * Oddelovac dnu ve vypisu (zprava uzivatele 8. 9. 2026: "chybi cas zobrazeni
 * zpravy"). Datum na jednom radku pres celou sirku, u kazde zpravy uz pak
 * staci hodiny a minuty.
 */
function DenOddelovac({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-heading font-semibold text-muted uppercase tracking-wide bg-surface border border-line rounded-pill px-2.5 py-0.5">
        {formatDayLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Autor a cas nad zpravou. Cas je videt vzdy, cely datum je v napovede. */
function Hlavicka({ jmeno, iso, editedAt }: { jmeno: string; iso: string; editedAt?: string | null }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[12px] font-heading font-semibold text-ink">{jmeno}</span>
      <time
        dateTime={iso}
        title={formatFullTime(iso)}
        className="text-[11px] font-body text-muted tabular-nums"
      >
        {formatClock(iso)}
      </time>
      {editedAt && (
        // Upravena zprava to musi priznat, jinak by slo nenapadne prepsat, co
        // uz nekdo cetl (zadani 9. 9. 2026).
        <span className="text-[11px] font-body text-muted italic" title={`Upraveno ${formatFullTime(editedAt)}`}>
          upraveno
        </span>
      )}
    </span>
  );
}

/** Text zpravy se zvyraznenymi zminkami (@Jméno) a Mediaspace smajliky. */
function Telo({ body, jmena, mine }: { body: string; jmena: string[]; mine: boolean }) {
  return (
    <>
      {splitChatBody(body, jmena).map((cast, index) => {
        if (cast.kind === 'mention') {
          return (
            <strong
              key={index}
              className={`font-heading font-semibold rounded px-0.5 ${
                mine ? 'bg-white/25 text-white' : 'bg-brand-purple/15 text-brand-purpleDark'
              }`}
            >
              {cast.value}
            </strong>
          );
        }
        if (cast.kind === 'smajlik') return <MsSmajlik key={index} code={cast.value} />;
        return <span key={index}>{cast.value}</span>;
      })}
    </>
  );
}

/**
 * Psací pole chatu.
 *
 * Od 9. 9. 2026 to NENÍ obyčejné <textarea>, ale editovatelný blok (zpráva
 * uživatele: „mně se to právě nelíbí, když je tam ta zkratka"). Do textarey
 * se obrázek vložit nedá, takže tam po výběru smajlíka zůstala viset zkratka
 * `:ms-palec:` a člověk psal do něčeho jiného, než co pak odešlo. Tady se
 * smajlík vykreslí rovnou při psaní.
 *
 * Ven i dovnitř se ale pořád předává OBYČEJNÝ TEXT se zkratkami - okolní
 * komponenta o žádném HTML neví a zprávy se ukládají stejně jako dřív (viz
 * lib/msSmajlici.ts). Tenhle blok je jen jiný způsob zobrazení.
 *
 * Pole se plní z `hodnota` jen tehdy, když se liší od toho, co jsme naposledy
 * sami poslali ven - jinak by se při každém stisku klávesy přepsal obsah
 * a kurzor by skákal na konec.
 */
function Psatko({
  hodnota,
  zmena,
  odeslat,
  sending,
  placeholder,
  nabidka,
  vyber,
  popisek = 'Poslat',
  onZrusit,
  autoFocus = false,
  prilohy,
  onPridejPrilohy,
  onOdeberPrilohu,
}: {
  hodnota: string;
  zmena: (v: string) => void;
  odeslat: (e: React.FormEvent) => void;
  sending: boolean;
  placeholder: string;
  nabidka: ChatTeamMember[];
  vyber: (clovek: ChatTeamMember) => void;
  /** Popisek odesilaciho tlacitka - pri uprave zpravy je to "Uložit". */
  popisek?: string;
  /** Kdyz je zadane, vedle tlacitka pribude Zrušit (uprava zpravy). */
  onZrusit?: () => void;
  /** Kurzor rovnou v poli - pri uprave chce clovek psat hned. */
  autoFocus?: boolean;
  /** Vybrane, jeste neodeslane prilohy. Kdyz chybi, sponka se nevykresli. */
  prilohy?: File[];
  onPridejPrilohy?: (soubory: File[]) => void;
  onOdeberPrilohu?: (index: number) => void;
}) {
  const [smajlici, setSmajlici] = useState(false);
  const poleRef = useRef<HTMLDivElement | null>(null);
  /** Text, který jsme naposledy poslali ven - podle něj se pozná cizí změna. */
  const posledni = useRef(hodnota);

  /** Obsah pole zpátky na text se zkratkami. */
  const naText = useCallback((el: HTMLElement): string => {
    let out = '';
    const projdi = (uzel: Node) => {
      uzel.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          out += n.textContent ?? '';
          return;
        }
        if (!(n instanceof HTMLElement)) return;
        if (n.dataset.code) {
          out += n.dataset.code;
          return;
        }
        if (n.tagName === 'BR') {
          out += '\n';
          return;
        }
        // Prohlížeč při Shift+Enter zabaluje řádky do <div>; každý další
        // takový blok je nový řádek.
        if ((n.tagName === 'DIV' || n.tagName === 'P') && out && !out.endsWith('\n')) out += '\n';
        projdi(n);
      });
    };
    projdi(el);
    // Nezlomitelné mezery používáme jen kvůli kurzoru, ven patří obyčejné.
    return out.replace(/ /g, ' ');
  }, []);

  /** Jeden smajlík jako needitovatelný kousek obsahu. */
  const smajlikUzel = useCallback((code: string): HTMLElement | null => {
    const s = najdiSmajlika(code);
    if (!s) return null;
    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.dataset.code = code;
    span.title = s.label;
    span.className = 'inline-block align-[-0.22em]';
    span.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="${s.label}">${s.svg}</svg>`;
    return span;
  }, []);

  /** Naplní pole podle textu (jen při změně zvenčí - odeslání, výběr zmínky). */
  useEffect(() => {
    const pole = poleRef.current;
    if (!pole || hodnota === posledni.current) return;

    pole.textContent = '';
    for (const cast of splitChatBody(hodnota, [])) {
      if (cast.kind === 'smajlik') {
        const uzel = smajlikUzel(cast.value);
        if (uzel) {
          pole.appendChild(uzel);
          continue;
        }
      }
      pole.appendChild(document.createTextNode(cast.value));
    }
    posledni.current = hodnota;

    // Kurzor na konec, ať se dá rovnou psát dál.
    if (document.activeElement === pole) {
      const rozsah = document.createRange();
      rozsah.selectNodeContents(pole);
      rozsah.collapse(false);
      const vyber = window.getSelection();
      vyber?.removeAllRanges();
      vyber?.addRange(rozsah);
    }
  }, [hodnota, smajlikUzel]);

  // Pri uprave zpravy chce clovek psat hned - kurzor rovnou na konec textu.
  useEffect(() => {
    if (!autoFocus) return;
    const pole = poleRef.current;
    if (!pole) return;
    pole.focus();
    const rozsah = document.createRange();
    rozsah.selectNodeContents(pole);
    rozsah.collapse(false);
    const vyberTextu = window.getSelection();
    vyberTextu?.removeAllRanges();
    vyberTextu?.addRange(rozsah);
  }, [autoFocus]);

  function posliVen() {
    const pole = poleRef.current;
    if (!pole) return;
    const text = naText(pole).slice(0, MAX_MESSAGE_LENGTH);
    posledni.current = text;
    zmena(text);
  }

  /** Vloží smajlíka tam, kde je kurzor (ne na konec - to by lidi štvalo). */
  function vlozSmajlika(code: string) {
    const pole = poleRef.current;
    const uzel = smajlikUzel(code);
    if (!pole || !uzel) return;

    pole.focus();
    const vyberTextu = window.getSelection();
    let rozsah: Range;
    if (vyberTextu && vyberTextu.rangeCount > 0 && pole.contains(vyberTextu.anchorNode)) {
      rozsah = vyberTextu.getRangeAt(0);
      rozsah.deleteContents();
    } else {
      rozsah = document.createRange();
      rozsah.selectNodeContents(pole);
      rozsah.collapse(false);
    }

    rozsah.insertNode(uzel);
    // Mezera za smajlíkem, aby za ním šlo psát a kurzor nezůstal "uvnitř".
    const mezera = document.createTextNode(' ');
    uzel.parentNode?.insertBefore(mezera, uzel.nextSibling);
    rozsah.setStartAfter(mezera);
    rozsah.collapse(true);
    vyberTextu?.removeAllRanges();
    vyberTextu?.addRange(rozsah);

    posliVen();
    setSmajlici(false);
  }

  return (
    // Psatko je pres celou sirku a ovladani je az POD nim (zprava uzivatele
    // 9. 9. 2026: "to okno chatu bych roztahl do stran, vznikne tam vic mista
    // a smajliky a odeslat bych dal az pod nej"). Drive to byl jeden radek
    // [smajlik][pole][Poslat], takze pole prichazelo o par desitek pixelu
    // z obou stran.
    // Pretazeni souboru se neresi tady, ale na celem panelu chatu - prouzek
    // s psatkem je na to moc mala plocha a lidi soubor pousteji do vypisu
    // zprav (zprava uzivatele 9. 9. 2026: "jde to pres sponku, ale nejde
    // drag and drop"). Viz ChatDock niz.
    <form onSubmit={odeslat} className="relative border-t border-line bg-surface p-3 flex flex-col gap-2">
      {smajlici && (
        <div className="absolute left-3 right-3 bottom-full mb-1 bg-surface border border-line rounded-lg shadow-lg p-2 z-10 max-h-64 overflow-y-auto">
          {/* Naše vlastní sada je první - viz lib/msSmajlici.ts. */}
          <p className="text-[10px] font-heading font-semibold text-muted uppercase tracking-wide m-0 mb-1.5 px-0.5">
            Mediaspace
          </p>
          <div className="grid grid-cols-8 gap-1">
            {MS_SMAJLICI.map((s) => (
              <button
                key={s.code}
                type="button"
                title={s.label}
                aria-label={s.label}
                onClick={() => vlozSmajlika(s.code)}
                className="rounded hover:bg-field py-1.5 flex items-center justify-center"
              >
                <MsSmajlik code={s.code} size={22} />
              </button>
            ))}
          </div>

          <p className="text-[10px] font-heading font-semibold text-muted uppercase tracking-wide m-0 mt-3 mb-1.5 px-0.5">
            Běžné
          </p>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  const pole = poleRef.current;
                  if (pole) {
                    pole.focus();
                    document.execCommand('insertText', false, e);
                    posliVen();
                  }
                  setSmajlici(false);
                }}
                className="text-lg leading-none rounded hover:bg-field py-1"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
      {nabidka.length > 0 && (
        <div className="absolute left-3 right-3 bottom-full mb-1 max-h-40 overflow-y-auto bg-surface border border-line rounded-lg shadow-lg py-1 z-10">
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
      <div className="relative w-full">
        {!hodnota && (
          <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-body text-muted select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={poleRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          onInput={posliVen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              odeslat(e as unknown as React.FormEvent);
            }
          }}
          onPaste={(e) => {
            // Vkládáme jen čistý text - jinak by se do pole dostalo cizí
            // formátování z Wordu nebo z webu.
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            posliVen();
          }}
          className="min-h-[150px] max-h-[45vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-field px-3 py-2.5 text-sm font-body text-ink outline-none focus:border-brand-purple"
        />
      </div>

      {prilohy && prilohy.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {prilohy.map((soubor, index) => (
            <span
              key={`${soubor.name}-${index}`}
              className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg border border-line bg-field pl-2 pr-1 py-1"
            >
              <span className="text-[11px] font-heading text-ink truncate">{soubor.name}</span>
              <span className="text-[11px] font-body text-muted shrink-0">{formatVelikost(soubor.size)}</span>
              <button
                type="button"
                onClick={() => onOdeberPrilohu?.(index)}
                title={`Odebrat ${soubor.name}`}
                aria-label={`Odebrat ${soubor.name}`}
                className="shrink-0 w-4 h-4 leading-none text-muted hover:text-danger"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {onPridejPrilohy && (
          <label
            title="Připojit soubor"
            className="shrink-0 w-9 h-9 rounded-lg border border-line bg-surface text-muted hover:text-brand-purple hover:border-brand-purple transition-colors flex items-center justify-center cursor-pointer"
          >
            {/* Sponka. Zamerne obycejny vyber souboru - nahravani hlasu
                v chatu nebude nikdy (zadani 9. 9. 2026), takze tu neni a
                nebude zadne tlacitko s mikrofonem. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.67 3.67 0 0 1 5.18 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.6-2.59l8.5-8.49" />
            </svg>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const vybrane: File[] = e.target.files ? Array.from(e.target.files) : [];
                if (vybrane.length > 0) onPridejPrilohy(vybrane);
                // Ať jde tentýž soubor vybrat znovu, když ho člověk odebere.
                e.target.value = '';
              }}
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setSmajlici((v) => !v)}
          title="Smajlíci"
          aria-label="Smajlíci"
          className="shrink-0 w-9 h-9 rounded-lg border border-line bg-surface text-muted hover:text-brand-purple hover:border-brand-purple transition-colors flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          </svg>
        </button>
        <span className="text-[11px] font-body text-muted select-none hidden sm:inline">
          Enter odešle, Shift+Enter zalomí řádek
        </span>
        {onZrusit && (
          <button
            type="button"
            onClick={onZrusit}
            className="ml-auto shrink-0 text-sm font-heading font-semibold text-muted hover:text-ink"
          >
            Zrušit
          </button>
        )}
        <button
          type="submit"
          disabled={sending || (!hodnota.trim() && (prilohy?.length ?? 0) === 0)}
          className={`shrink-0 bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 disabled:opacity-50 ${
            onZrusit ? '' : 'ml-auto'
          }`}
        >
          {popisek}
        </button>
      </div>
    </form>
  );
}

/** Jeden znak reakce - bud nas smajlik podle zkratky, nebo bezne emoji. */
function ZnakReakce({ code, size = 15 }: { code: string; size?: number }) {
  if (code.startsWith(':ms-')) return <MsSmajlik code={code} size={size} />;
  return <span style={{ fontSize: size }} className="leading-none">{code}</span>;
}

/**
 * Reakce pod zpravou (zadani 9. 9. 2026: "jeste bych tam pridal reakce
 * smajlikama na text - myslim na konkretni zpravu").
 *
 * Odznak = jeden smajlik a pocet lidi, kteri ho dali. Kliknuti prepina: kdyz
 * uz jsem reakci dal, znovu ji odeberu. Moje reakce je videt na prvni pohled
 * (fialovy ramecek), kdo dal kterou, ukaze bublina pri najeti mysi.
 *
 * "+" otevre kratkou nabidku toho, co se v pracovnim chatu opravdu pouziva -
 * cely vyber emoji je v psatku, sem by se nevesel a ani by k nicemu nebyl.
 */
function Reakce({
  reactions,
  onToggle,
}: {
  reactions: ChatReaction[];
  onToggle: (code: string) => void;
}) {
  const [otevreno, setOtevreno] = useState(false);

  return (
    <span className="relative mt-1 flex items-center gap-1 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.code}
          type="button"
          onClick={() => onToggle(r.code)}
          title={r.kdo.join(', ')}
          aria-pressed={r.mine}
          className={`inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 leading-none transition-colors ${
            r.mine
              ? 'border-brand-purple bg-tint text-brand-purple'
              : 'border-line bg-surface text-muted hover:border-brand-purple'
          }`}
        >
          <ZnakReakce code={r.code} />
          <span className="text-[11px] font-heading font-semibold tabular-nums">{r.count}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setOtevreno((v) => !v)}
        title="Přidat reakci"
        aria-label="Přidat reakci"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-line bg-surface text-muted hover:text-brand-purple hover:border-brand-purple transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" />
        </svg>
      </button>

      {otevreno && (
        <span className="absolute left-0 bottom-full mb-1 z-20 bg-surface border border-line rounded-lg shadow-lg p-1 flex items-center gap-0.5">
          {RYCHLE_REAKCE.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                onToggle(code);
                setOtevreno(false);
              }}
              className="rounded p-1 hover:bg-field flex items-center justify-center"
            >
              <ZnakReakce code={code} size={20} />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * Prilohy pod zpravou (zadani 9. 9. 2026). Obrazek se ukaze rovnou, ostatni
 * jako karta s nazvem a velikosti.
 *
 * Odkaz vede na /api/chat/prilohy/[id], ne primo do uloziste: portal nejdriv
 * overi, ze uzivatel do te konverzace smi, a teprve pak vyda kratkodoby
 * podepsany odkaz. Trvala verejna adresa by znamenala, ze staci link poslat
 * dal - a v chatu muzou byt klientske materialy.
 */
/**
 * Zvukova priloha - waveforma a prehravani primo v bubline (zadani
 * 9. 9. 2026: "slo by tu prilohu prehrat, kdyz je to zvuk, jako to mame
 * v Nahravkach"). Je to tentyz prehravac jako tam.
 *
 * Prehravac se nasadi az po kliknuti na Prehrat. Kresleni waveformy totiz
 * potrebuje stahnout cely soubor - a kanal, kde visi deset spotu, by jinak
 * pri otevreni stahl vsechny naraz. Po kliknuti se rovnou prehrava, takze
 * to uzivatele nestoji nic navic.
 */
function ZvukovaPriloha({ priloha, odkaz }: { priloha: ChatPriloha; odkaz: string }) {
  const [spustit, setSpustit] = useState(false);

  return (
    <span className="block rounded-lg border border-line bg-surface px-2.5 py-2 max-w-[320px]">
      <span className="flex items-center gap-2">
        {!spustit && (
          <button
            type="button"
            onClick={() => setSpustit(true)}
            title={`Přehrát ${priloha.name}`}
            aria-label={`Přehrát ${priloha.name}`}
            className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-brand-green text-onAccent hover:brightness-95 transition-[filter]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M7 5v14l11-7z" />
            </svg>
          </button>
        )}
        <span className="min-w-0">
          <span className="block text-[12px] font-heading font-semibold text-ink truncate">{priloha.name}</span>
          <span className="block text-[11px] font-body text-muted">{formatVelikost(priloha.size)}</span>
        </span>
      </span>
      {spustit && <WaveformPlayer src={odkaz} autoPlay />}
    </span>
  );
}

function Prilohy({ prilohy }: { prilohy: ChatPriloha[] }) {
  if (prilohy.length === 0) return null;

  return (
    <span className="mt-1 flex flex-col gap-1.5">
      {prilohy.map((p) => {
        const odkaz = `/api/chat/prilohy/${p.id}`;
        if (jeZvuk(p.mime)) {
          return <ZvukovaPriloha key={p.id} priloha={p} odkaz={odkaz} />;
        }
        if (jeObrazek(p.mime)) {
          return (
            <a
              key={p.id}
              href={odkaz}
              target="_blank"
              rel="noreferrer"
              title={`${p.name} (${formatVelikost(p.size)})`}
              className="block rounded-card overflow-hidden border border-line max-w-[280px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={odkaz} alt={p.name} className="block w-full max-h-[240px] object-cover" />
            </a>
          );
        }
        return (
          <a
            key={p.id}
            href={odkaz}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 max-w-[280px] rounded-lg border border-line bg-surface px-2.5 py-2 no-underline hover:border-brand-purple transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-brand-purple">
              <path d="M14 3v5h5" />
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            </svg>
            <span className="min-w-0">
              <span className="block text-[12px] font-heading font-semibold text-ink truncate">{p.name}</span>
              <span className="block text-[11px] font-body text-muted">{formatVelikost(p.size)}</span>
            </span>
          </a>
        );
      })}
    </span>
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
  // Vybrane, jeste neodeslane prilohy (zadani 9. 9. 2026). Nahravaji se az
  // pri odeslani - kdyz clovek soubor zase odebere, nic zbytecne neputuje.
  const [prilohyHlavni, setPrilohyHlavni] = useState<File[]>([]);
  const [prilohyVlakno, setPrilohyVlakno] = useState<File[]>([]);
  // Pretazeni souboru plati pro CELY panel chatu, ne jen pro prouzek
  // s psatkem - do toho se tezko trefit a lidi soubor pousteji doprostred
  // vypisu zprav (zprava uzivatele 9. 9. 2026). Pocitadlo, ne true/false:
  // dragleave chodi i pri prejezdu pres vnorene prvky, takze s prostym
  // prepinacem by ramecek probliskaval.
  const [tahnouSoubory, setTahnouSoubory] = useState(0);

  /** Kam soubor patri: kdyz je otevrene vlakno, tak do nej. */
  function pridejPrilohy(soubory: File[]) {
    if (soubory.length === 0) return;
    if (vlaknoId) setPrilohyVlakno((c) => [...c, ...soubory].slice(0, MAX_PRILOH));
    else setPrilohyHlavni((c) => [...c, ...soubory].slice(0, MAX_PRILOH));
  }

  // Uprava vlastni odeslane zpravy (zadani 9. 9. 2026). Upravuje se vzdy jen
  // jedna zprava naraz - na miste bubliny se objevi tentyz editor jako dole,
  // takze smajlici i zminky funguji stejne.
  const [upravovanaId, setUpravovanaId] = useState<string | null>(null);
  const [upravaText, setUpravaText] = useState('');
  const [upravaChyba, setUpravaChyba] = useState<string | null>(null);

  function zacniUpravu(m: ChatMessage) {
    setUpravovanaId(m.id);
    setUpravaText(m.body);
    setUpravaChyba(null);
  }

  function zrusUpravu() {
    setUpravovanaId(null);
    setUpravaText('');
    setUpravaChyba(null);
  }

  async function ulozUpravu(e: React.FormEvent) {
    e.preventDefault();
    const id = upravovanaId;
    const text = upravaText.trim();
    if (!id || !text || sending) return;

    setSending(true);
    setUpravaChyba(null);
    try {
      const res = await fetch(`/api/chat/zpravy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpravaChyba(data?.error || 'Zprávu se nepodařilo upravit.');
        return;
      }
      const uprav = (seznam: ChatMessage[]) =>
        seznam.map((m) => (m.id === id ? { ...m, body: data.body, editedAt: data.editedAt } : m));
      setMessages(uprav);
      setVlakno(uprav);
      zrusUpravu();
    } catch (err) {
      console.error('Úprava zprávy selhala:', err);
      setUpravaChyba('Zprávu se nepodařilo upravit.');
    } finally {
      setSending(false);
    }
  }

  /**
   * Prepnuti reakce na zprave (zadani 9. 9. 2026). Server vrati cely secteny
   * prehled reakci te zpravy, takze si ho jen prepiseme - a to v obou
   * seznamech, protoze tataz zprava muze byt zaroven v hlavnim proudu
   * i v otevrenem vlaknu.
   *
   * Kdyz to selze, nechame stav byt: nejblizsi obnoveni zprav ho stejne
   * srovna podle databaze, takze nema smysl uzivatele budit hlaskou.
   */
  async function prepniReakci(messageId: string, code: string) {
    try {
      const res = await fetch(`/api/chat/zpravy/${messageId}/reakce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const reactions: ChatReaction[] = Array.isArray(data?.reactions) ? data.reactions : [];
      const uprav = (seznam: ChatMessage[]) =>
        seznam.map((m) => (m.id === messageId ? { ...m, reactions } : m));
      setMessages(uprav);
      setVlakno(uprav);
    } catch (err) {
      console.error('Reakci se nepodařilo uložit:', err);
    }
  }
  // Naseptavac zminek: kdyz se v rozepsanem textu objevi "@", nabidne lidi.
  const [zminkyPro, setZminkyPro] = useState<'hlavni' | 'vlakno' | null>(null);
  const [zminkaHledani, setZminkaHledani] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vlastni tmavy rezim chatu (zadani 8. 9. 2026) uz tu neni. Od 9. 9. 2026
  // se prepina tmavy rezim celeho portalu z horni listy, takze zvlast pro
  // chat by to byl druhy prepinac na tutez vec (zprava uzivatele 9. 9. 2026:
  // "u chatu ten dark mode nedava smysl, kdyz se to da menit z hlavni listy").
  // Chat se ted ridi motivem portalu jako vsechno ostatni.

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

  /**
   * Nahrani priloh do uloziste. Soubor jde z prohlizece PRIMO tam, na
   * podepsanou adresu - pres portal by neprosel, funkce na Vercelu maji strop
   * na velikost pozadavku kolem 4,5 MB a my posilame zvuk a fotky.
   *
   * Vraci popis priloh pro ulozeni u zpravy, nebo null, kdyz to nevyslo -
   * v tom pripade uz je duvod vypsany v chybe a zprava se neodesle, at
   * uzivatel nema pocit, ze fotka odesla.
   */
  async function nahrajPrilohy(soubory: File[]): Promise<{ key: string; name: string; mime: string }[] | null> {
    const hotove: { key: string; name: string; mime: string }[] = [];
    for (const soubor of soubory) {
      if (soubor.size > MAX_PRILOHA_BYTES) {
        setError(`Příloha ${soubor.name} je moc velká (nejvýš ${formatVelikost(MAX_PRILOHA_BYTES)}).`);
        return null;
      }
      const mime = soubor.type || 'application/octet-stream';
      const podpis = await fetch('/api/chat/prilohy/podpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: soubor.name, mime, size: soubor.size }),
      });
      const data = await podpis.json().catch(() => ({}));
      if (!podpis.ok) {
        setError(data?.error || 'Přílohu se nepodařilo připravit.');
        return null;
      }
      // Prohlizec posila soubor primo do uloziste, tedy na cizi adresu.
      // Kdyz uloziste nema povolene pozadavky z msportal.cz (nastaveni CORS
      // u bucketu), fetch spadne uz na tomhle - a "Failed to fetch" nikomu
      // nic nerekne. Proto vlastni hlaska (9. 9. 2026).
      let nahrani: Response;
      try {
        nahrani = await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: soubor,
        });
      } catch (err) {
        console.error('Nahrání přílohy do úložiště selhalo:', err);
        setError(
          `Přílohu ${soubor.name} se nepodařilo nahrát - úložiště odmítlo požadavek z portálu. ` +
            'Nejspíš mu chybí povolení pro www.msportal.cz (nastavení CORS u bucketu).',
        );
        return null;
      }
      if (!nahrani.ok) {
        setError(`Přílohu ${soubor.name} se nepodařilo nahrát (${nahrani.status}).`);
        return null;
      }
      hotove.push({ key: data.key, name: soubor.name, mime });
    }
    return hotove;
  }

  async function odesli(e: React.FormEvent, doVlakna = false) {
    e.preventDefault();
    const text = (doVlakna ? vlaknoDraft : draft).trim();
    const soubory = doVlakna ? prilohyVlakno : prilohyHlavni;
    // Samotna fotka bez textu je v poradku - prazdna zprava bez priloh ne.
    if (!openId || sending) return;
    if (!text && soubory.length === 0) return;
    if (doVlakna && !vlaknoId) return;
    setSending(true);
    setError(null);
    try {
      const prilohy = soubory.length > 0 ? await nahrajPrilohy(soubory) : [];
      if (prilohy === null) return;

      const res: Response = await fetch(`/api/chat/konverzace/${openId}/zpravy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          doVlakna ? { body: text, parentId: vlaknoId, prilohy } : { body: text, prilohy },
        ),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Zprávu se nepodařilo odeslat.');
        return;
      }
      if (doVlakna) {
        setVlaknoDraft('');
        setPrilohyVlakno([]);
        setVlakno((current) => [...current, data as ChatMessage]);
        void nactiZpravy(openId);
      } else {
        setDraft('');
        setPrilohyHlavni([]);
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
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-4 text-center">
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
        onDragEnter={(e: React.DragEvent<HTMLDivElement>) => {
          if (!openId || !e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setTahnouSoubory((n) => n + 1);
        }}
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
          if (!openId || !e.dataTransfer.types.includes('Files')) return;
          // Bez tohohle prohlizec soubor proste otevre misto vlozeni.
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={() => setTahnouSoubory((n) => Math.max(0, n - 1))}
        onDrop={(e: React.DragEvent<HTMLDivElement>) => {
          if (!openId) return;
          e.preventDefault();
          setTahnouSoubory(0);
          pridejPrilohy(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`relative max-w-[96vw] h-[72vh] bg-surface border border-r-0 shadow-xl flex flex-col overflow-hidden transition-[width] ${
          vlaknoId ? 'w-[1180px]' : 'w-[760px]'
        } ${tahnouSoubory > 0 ? 'border-brand-purple' : 'border-line'}`}
      >
        {/* Pres cely panel, at je videt, ze se soubor pusti kamkoliv. Vrstva
            nesmi brat udalosti mysi, jinak by drop spadl na ni a nedoputoval
            k panelu (pointer-events-none). */}
        {tahnouSoubory > 0 && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-brand-purple/15 backdrop-blur-[1px]">
            <span className="rounded-card border-2 border-dashed border-brand-purple bg-surface px-6 py-4 font-heading font-semibold text-sm text-brand-purple shadow-lg">
              Pusťte soubor sem
            </span>
          </div>
        )}
        <div className="bg-brand-purple text-brand-green px-4 py-2.5 flex items-center justify-between gap-3">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wide m-0">MS chat</h2>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="text-xs font-heading font-semibold text-brand-green/90 hover:text-white whitespace-nowrap"
            >
              {neprectene > 0 ? `${neprectene} nových` : 'skrýt'} ›
            </button>
          </span>
        </div>

        {error && <p className="text-xs text-danger bg-dangerTint px-4 py-2 m-0">{error}</p>}

        <div className="flex-1 min-h-0 flex">
          {/* --- Levy sloupec: zalozky a seznam ---------------------------- */}
          <div
            className={`w-[220px] shrink-0 border-r border-line bg-paper flex-col min-h-0 ${
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
                <p className="text-xs text-danger m-0 px-1">{projektyChyba}</p>
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
                        aktivni ? 'bg-tint text-brand-purpleDark' : 'hover:bg-field text-ink'
                      }`}
                    >
                      <span className="font-heading text-sm truncate">
                        <span className="text-muted">#</span> {k.label}
                      </span>
                      {(k.conversation?.unread ?? 0) > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
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
                      c.id === openId ? 'bg-tint' : 'hover:bg-field'
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
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-onAccent text-[10px] font-heading font-bold leading-[18px] text-center">
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
                  <div className="px-4 py-2.5 border-b border-line bg-surface flex items-center gap-2">
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

                  {/* Vypis zprav ma vlastni jemne fialovy podklad - na bilem
                      pozadi splyvaly bile bubliny s okolim (zprava uzivatele
                      8. 9. 2026: "cele je to takove bile, sterilni"). */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-surfaceSoft">
                    {messages.length === 0 && (
                      <p className="text-sm font-body text-muted m-0">Zatím tu nikdo nic nenapsal.</p>
                    )}
                    {messages.map((m, index) => (
                      <div key={m.id} className="flex flex-col gap-3">
                        {(index === 0 || !stejnyDen(m.createdAt, messages[index - 1].createdAt)) && (
                          <DenOddelovac iso={m.createdAt} />
                        )}
                      <div className="flex items-start gap-2">
                        <Avatar label={m.authorLabel} photoUrl={m.authorPhotoUrl} size={28} />
                        <div className="min-w-0">
                          <Hlavicka jmeno={m.mine ? 'Já' : m.authorLabel} iso={m.createdAt} editedAt={m.editedAt} />
                          {upravovanaId === m.id ? (
                            <div className="mt-1 rounded-card border border-brand-purple overflow-hidden bg-surface">
                              <Psatko
                                hodnota={upravaText}
                                zmena={setUpravaText}
                                odeslat={ulozUpravu}
                                sending={sending}
                                placeholder="Upravit zprávu…"
                                nabidka={[]}
                                vyber={() => {}}
                                popisek="Uložit"
                                onZrusit={zrusUpravu}
                                autoFocus
                              />
                              {upravaChyba && (
                                <p className="text-[11px] font-body text-danger px-3 pb-2 m-0">{upravaChyba}</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <p
                                className={`mt-0.5 mb-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words shadow-sm ${
                                  m.mine
                                    ? 'bg-brand-purple text-white'
                                    : 'bg-surface border border-line text-ink'
                                }`}
                              >
                                <Telo body={m.body} jmena={jmenaTymu} mine={m.mine} />
                              </p>
                              <Prilohy prilohy={m.prilohy ?? []} />
                              <Reakce
                                reactions={m.reactions ?? []}
                                onToggle={(code) => prepniReakci(m.id, code)}
                              />
                            </>
                          )}
                          {/* Zobrazeno i odkaz do vlakna na jednom radku -
                              samostatny radek na odpoved zabiral moc mista
                              (zprava uzivatele 8. 9. 2026). */}
                          <span className="mt-0.5 flex items-center gap-2 flex-wrap">
                            {m.mine && (
                              <>
                                <Zobrazeno seenBy={m.seenBy} />
                                <span className="text-[11px] text-muted/40">·</span>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setVlaknoId(m.id)}
                              className={`text-[11px] font-heading font-semibold hover:underline ${
                                vlaknoId === m.id ? 'text-brand-purpleDark underline' : 'text-brand-purple'
                              }`}
                            >
                              {m.replyCount > 0
                                ? `${m.replyCount} ${m.replyCount === 1 ? 'odpověď' : m.replyCount < 5 ? 'odpovědi' : 'odpovědí'} ›`
                                : 'Odpovědět'}
                            </button>
                            {/* Upravit smi jen autor - i na serveru (zadani
                                9. 9. 2026: "bylo by super upravovat me
                                odeslane zpravy, kdyz se treba spletu"). */}
                            {m.mine && upravovanaId !== m.id && (
                              <>
                                <span className="text-[11px] text-muted/40">·</span>
                                <button
                                  type="button"
                                  onClick={() => zacniUpravu(m)}
                                  className="text-[11px] font-heading font-semibold text-muted hover:text-brand-purple"
                                >
                                  Upravit
                                </button>
                              </>
                            )}
                          </span>
                        </div>
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
                    prilohy={prilohyHlavni}
                    onPridejPrilohy={(soubory) =>
                      setPrilohyHlavni((c) => [...c, ...soubory].slice(0, MAX_PRILOH))
                    }
                    onOdeberPrilohu={(index) =>
                      setPrilohyHlavni((c) => c.filter((_, i) => i !== index))
                    }
                  />
                </div>

                {/* Treti sloupec: vlakno vedle zpravy, jako u Slacku. */}
                {vlaknoId && (
                  <div className="w-full md:w-[340px] shrink-0 border-l border-line flex flex-col min-h-0">
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

                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3 bg-surfaceSoft">
                      {vlakno.map((m, index) => (
                        <div key={m.id} className={`flex items-start gap-2 ${index === 0 ? '' : 'pl-3'}`}>
                          <Avatar label={m.authorLabel} photoUrl={m.authorPhotoUrl} size={index === 0 ? 26 : 22} />
                          <div className="min-w-0">
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-[12px] font-heading font-semibold text-ink">
                                {m.mine ? 'Já' : m.authorLabel}
                              </span>
                              <time
                                dateTime={m.createdAt}
                                title={formatFullTime(m.createdAt)}
                                className="text-[11px] font-body text-muted tabular-nums"
                              >
                                {formatMessageTime(m.createdAt)}
                              </time>
                              {m.editedAt && (
                                <span
                                  className="text-[11px] font-body text-muted italic"
                                  title={`Upraveno ${formatFullTime(m.editedAt)}`}
                                >
                                  upraveno
                                </span>
                              )}
                              {m.mine && upravovanaId !== m.id && (
                                <button
                                  type="button"
                                  onClick={() => zacniUpravu(m)}
                                  className="text-[11px] font-heading font-semibold text-muted hover:text-brand-purple"
                                >
                                  Upravit
                                </button>
                              )}
                            </span>
                            {upravovanaId === m.id ? (
                              <div className="mt-1 rounded-card border border-brand-purple overflow-hidden bg-surface">
                                <Psatko
                                  hodnota={upravaText}
                                  zmena={setUpravaText}
                                  odeslat={ulozUpravu}
                                  sending={sending}
                                  placeholder="Upravit zprávu…"
                                  nabidka={[]}
                                  vyber={() => {}}
                                  popisek="Uložit"
                                  onZrusit={zrusUpravu}
                                  autoFocus
                                />
                                {upravaChyba && (
                                  <p className="text-[11px] font-body text-danger px-3 pb-2 m-0">{upravaChyba}</p>
                                )}
                              </div>
                            ) : (
                              <>
                                <p
                                  className={`mt-0.5 mb-0 rounded-card px-3 py-2 text-sm font-body whitespace-pre-wrap break-words shadow-sm ${
                                    m.mine ? 'bg-brand-purple text-white' : 'bg-surface border border-line text-ink'
                                  }`}
                                >
                                  <Telo body={m.body} jmena={jmenaTymu} mine={m.mine} />
                                </p>
                                <Prilohy prilohy={m.prilohy ?? []} />
                                <Reakce
                                  reactions={m.reactions ?? []}
                                  onToggle={(code) => prepniReakci(m.id, code)}
                                />
                              </>
                            )}
                            {m.mine && (
                              <span className="block mt-0.5">
                                <Zobrazeno seenBy={m.seenBy} />
                              </span>
                            )}
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
                      prilohy={prilohyVlakno}
                      onPridejPrilohy={(soubory) =>
                        setPrilohyVlakno((c) => [...c, ...soubory].slice(0, MAX_PRILOH))
                      }
                      onOdeberPrilohu={(index) =>
                        setPrilohyVlakno((c) => c.filter((_, i) => i !== index))
                      }
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
