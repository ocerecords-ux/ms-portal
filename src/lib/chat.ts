import type { ConversationKind } from '@prisma/client';
import { MS_SMAJLICI, MS_SMAJLIK_REGEX, najdiSmajlika } from '@/lib/msSmajlici';
import type { ChatPriloha } from '@/lib/chatPrilohy';

/**
 * Chat pro tym Mediaspace (zadani 8. 9. 2026). Bez pristupu do databaze, aby
 * to sla pouzit i klientska komponenta panelu.
 */

export const CHAT_TABS: { kind: ConversationKind; label: string }[] = [
  // "Misto Kanalu to bude nazvano Projekty" (zadani 8. 9. 2026).
  { kind: 'PROJEKT', label: 'Projekty' },
  { kind: 'SOUKROMA', label: 'Soukromé' },
  { kind: 'SKUPINA', label: 'Skupiny' },
  // Dotazy klientu k projektum (zadani 11. 9. 2026) - klient je zaklada
  // tlacitkem "Zeptat se" u sveho projektu.
  { kind: 'DOTAZ', label: 'Dotazy' },
];

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Smajlici do zprav (zadani 8. 9. 2026). Zamerne kratky rucni vyber toho,
 * co se v pracovnim chatu opravdu pouziva - zadna knihovna navic; ta by se
 * do portalu tahala kvuli par ikonam.
 *
 * Od 9. 9. 2026 jsou v nabidce jako druha sada - prvni jsou vlastni
 * Mediaspace smajlici (viz lib/msSmajlici.ts). Bezne emoji tu zustavaji
 * schvalne: vlastni sada ma sestnact kousku a nema smysl v ni zastupovat
 * kazdou vlajecku nebo jidlo.
 */
export const EMOJI: string[] = [
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋',
  '😀', '😄', '😅', '😂', '🙂', '😉', '😍', '🤩',
  '🤔', '😐', '😬', '😢', '😮', '😴', '🤯', '🥳',
  '🔥', '✅', '❌', '⚠️', '❗', '❓', '💡', '⭐',
  '🎧', '🎙️', '🎬', '📚', '📅', '⏰', '💰', '🚀',
];

/**
 * Reakce smajlikem na jednu zpravu (zadani 9. 9. 2026). Do prohlizece se
 * neposilaji jednotlive radky z databaze, ale uz secteny prehled - kolik
 * lidi dalo ktery smajlik, jestli jsem mezi nimi ja a kdo to byl.
 */
export type ChatReaction = {
  /** Zkratka naseho smajlika (":ms-palec:") nebo primo emoji ("👍"). */
  code: string;
  count: number;
  /** Dal jsem tuhle reakci taky? Pak jde kliknutim odebrat. */
  mine: boolean;
  /** Jmena do bubliny pri najeti mysi. */
  kdo: string[];
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorLabel: string;
  /** Fotka autora - u uctu bez fotky null a vykresli se iniciály. */
  authorPhotoUrl: string | null;
  mine: boolean;
  /** Kolik odpovedi visi ve vlakne pod touhle zpravou. */
  replyCount: number;
  /** Kdo uz zpravu videl - jmena bez autora (zadani 8. 9. 2026). */
  seenBy: string[];
  /** Reakce na tuhle zpravu, serazene od nejcastejsi (zadani 9. 9. 2026). */
  reactions: ChatReaction[];
  /** Kdy byla zprava naposledy upravena; null = puvodni zneni. */
  editedAt: string | null;
  /** Prilohy zpravy - fotky, PDF, zvuk (zadani 9. 9. 2026). */
  prilohy: ChatPriloha[];
};

export type ChatTeamMember = { id: string; label: string; photoUrl: string | null };

export type ChatConversation = {
  id: string;
  kind: ConversationKind;
  label: string;
  /** Kolik zprav uzivatel jeste nevidel. */
  unread: number;
  lastMessageAt: string;
  /** U kanalu k projektu ID projektu v Caflou - podle nej se paruje na seznam. */
  caflouProjectId: string | null;
  /** Jmena ucastniku - u skupiny se ukazuji pod nazvem. */
  memberLabels: string[];
  /** ID clenu vcetne me - podle nich se predvyplni sprava skupiny. */
  memberIds: string[];
  /** Fotka do seznamu - u soukrome zpravy fotka druheho cloveka. */
  avatarUrl: string | null;
};

/**
 * Rozdeli text zpravy na kousky a oznaci zminky (@Jméno). Zminka se pozna
 * podle toho, ze za @ nasleduje jmeno nekoho z tymu - jmena mivaji mezeru,
 * takze samotny regulární výraz by nestačil (@Jan by ve "@Jan Novák"
 * skoncil u mezery). Delsi jmena se zkousi drive, at "@Jan Novák" nevyhraje
 * kratsi "@Jan".
 */
export function splitMentions(body: string, names: string[]): { text: string; mention: boolean }[] {
  const serazena = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const out: { text: string; mention: boolean }[] = [];
  let buffer = '';
  let i = 0;

  while (i < body.length) {
    if (body[i] === '@') {
      const zbytek = body.slice(i + 1);
      const jmeno = serazena.find((n) => zbytek.toLowerCase().startsWith(n.toLowerCase()));
      if (jmeno) {
        if (buffer) {
          out.push({ text: buffer, mention: false });
          buffer = '';
        }
        out.push({ text: `@${body.substr(i + 1, jmeno.length)}`, mention: true });
        i += 1 + jmeno.length;
        continue;
      }
    }
    buffer += body[i];
    i += 1;
  }
  if (buffer) out.push({ text: buffer, mention: false });
  return out;
}

/**
 * Kousek textu zpravy pripraveny k vykresleni. Bud obycejny text, zvyraznena
 * zminka, nebo Mediaspace smajlik (viz lib/msSmajlici.ts).
 */
export type ChatToken =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; value: string }
  | { kind: 'smajlik'; value: string }
  /** Zmínka projektu (#Název) - vykresluje se jako odkaz na jeho detail. */
  | { kind: 'projekt'; value: string; id: string };

/** Projekt, na který se dá ve zprávě odkázat mřížkou. */
export type ProjektZminka = { id: string; name: string };

/**
 * Rozdeli text na kousky a oznaci zminky projektu (#Nazev projektu) -
 * zadani 11. 9. 2026: "kdyz dam krizek a nazev projektu, tak se proklikneme
 * pak z chatu vsichni na dany projekt".
 *
 * Funguje stejne jako zminka cloveka: hleda se skutecny nazev ze seznamu
 * projektu, protoze nazvy mivaji mezery. Delsi nazvy se zkousi driv, at
 * "#MMB podzim" nevyhraje kratsi "#MMB".
 */
export function splitProjektyVTextu(
  body: string,
  projekty: ProjektZminka[],
): { text: string; projekt?: ProjektZminka }[] {
  const serazene = [...projekty].filter((p) => p.name).sort((a, b) => b.name.length - a.name.length);
  if (serazene.length === 0) return [{ text: body }];

  const out: { text: string; projekt?: ProjektZminka }[] = [];
  let buffer = '';
  let i = 0;

  while (i < body.length) {
    if (body[i] === '#') {
      const zbytek = body.slice(i + 1);
      const projekt = serazene.find((p) => zbytek.toLowerCase().startsWith(p.name.toLowerCase()));
      if (projekt) {
        if (buffer) {
          out.push({ text: buffer });
          buffer = '';
        }
        out.push({ text: `#${body.substr(i + 1, projekt.name.length)}`, projekt });
        i += 1 + projekt.name.length;
        continue;
      }
    }
    buffer += body[i];
    i += 1;
  }
  if (buffer) out.push({ text: buffer });
  return out;
}

/**
 * Rozdeli telo zpravy na zminky a smajliky naraz (zadani 9. 9. 2026).
 *
 * Nejdriv se vytahnou zminky (uz kvuli jmenum s mezerou, viz splitMentions
 * vyse) a teprve v obycejnem textu se hledaji zkratky smajliku. Diky tomu
 * nemuze zkratka rozbit jmeno a naopak.
 *
 * Zkratka, kterou v sade nenajdeme, zustava textem - stare zpravy se tak
 * nikdy nezmeni v prazdne misto, kdyz se sada prekresli.
 */
export function splitChatBody(body: string, names: string[], projekty: ProjektZminka[] = []): ChatToken[] {
  const out: ChatToken[] = [];

  for (const cast of splitMentions(body, names)) {
    if (cast.mention) {
      out.push({ kind: 'mention', value: cast.text });
      continue;
    }
    for (const castProjektu of splitProjektyVTextu(cast.text, projekty)) {
      if (castProjektu.projekt) {
        out.push({ kind: 'projekt', value: castProjektu.text, id: castProjektu.projekt.id });
        continue;
      }
      for (const kousek of castProjektu.text.split(MS_SMAJLIK_REGEX)) {
        if (!kousek) continue;
        if (najdiSmajlika(kousek)) out.push({ kind: 'smajlik', value: kousek });
        else out.push({ kind: 'text', value: kousek });
      }
    }
  }

  return out;
}

/** Iniciály pro kolečko, když u účtu není fotka. */
export function initials(label: string): string {
  const slova = label.trim().split(/\s+/).filter(Boolean);
  if (slova.length === 0) return '?';
  if (slova.length === 1) return slova[0].slice(0, 2).toUpperCase();
  return (slova[0].charAt(0) + slova[1].charAt(0)).toUpperCase();
}

/** Jsou obe zpravy ze stejneho dne? Podle toho se do vypisu vklada oddelovac. */
export function stejnyDen(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return false;
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

/** "Dnes" / "Včera" / "pondělí 3. 9." - popisek oddelovace dnu ve vypisu. */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const den = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const rozdil = (den(new Date()) - den(date)) / (24 * 60 * 60 * 1000);
  if (rozdil === 0) return 'Dnes';
  if (rozdil === 1) return 'Včera';
  if (rozdil < 7) {
    const dvt = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(date);
    return `${dvt} ${new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(date)}`;
  }
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
}

/** Jen hodina a minuta - cas u konkretni zpravy. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Cely datum a cas - do bublinove napovedy nad casem zpravy. */
export function formatFullTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "dnes 14:32" / "včera 9:05" / "3. 9. 14:32" - kratky cas u zpravy. */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const cas = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' }).format(date);

  const den = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dnes = den(new Date());
  const rozdil = (dnes - den(date)) / (24 * 60 * 60 * 1000);
  if (rozdil === 0) return `dnes ${cas}`;
  if (rozdil === 1) return `včera ${cas}`;
  return `${new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(date)} ${cas}`;
}


/* ---------------------------------------------------------------------------
   Reakce na zpravu (zadani 9. 9. 2026)
--------------------------------------------------------------------------- */

/**
 * Co se nabizi po kliknuti na "+" u zpravy. Zamerne kratky vyber - v panelu
 * chatu neni misto na celou tabulku emoji a v praxi se stejne pouziva par
 * kousku. Prvni jsou nase vlastni, pak bezna.
 */
export const RYCHLE_REAKCE: string[] = [
  ':ms-palec:',
  ':ms-hotovo:',
  ':ms-smich:',
  ':ms-srdce:',
  ':ms-ohen:',
  ':ms-premyslim:',
  ':ms-pozor:',
  ':ms-palec-dolu:',
];

/**
 * Smi se tenhle kod ulozit jako reakce? Kontroluje se na serveru, aby se do
 * databaze nedostalo nic, co neni v nabidce - "code" chodi z prohlizece.
 */
export function jePlatnaReakce(code: string): boolean {
  return MS_SMAJLICI.some((s) => s.code === code) || EMOJI.includes(code);
}
