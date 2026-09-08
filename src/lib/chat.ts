import type { ConversationKind } from '@prisma/client';

/**
 * Chat pro tym Mediaspace (zadani 8. 9. 2026). Bez pristupu do databaze, aby
 * to sla pouzit i klientska komponenta panelu.
 */

export const CHAT_TABS: { kind: ConversationKind; label: string }[] = [
  // "Misto Kanalu to bude nazvano Projekty" (zadani 8. 9. 2026).
  { kind: 'PROJEKT', label: 'Projekty' },
  { kind: 'SOUKROMA', label: 'Soukromé' },
  { kind: 'SKUPINA', label: 'Skupiny' },
];

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Smajlici do zprav (zadani 8. 9. 2026). Zamerne kratky rucni vyber toho,
 * co se v pracovnim chatu opravdu pouziva - zadna knihovna navic; ta by se
 * do portalu tahala kvuli par ikonam.
 */
export const EMOJI: string[] = [
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋',
  '😀', '😄', '😅', '😂', '🙂', '😉', '😍', '🤩',
  '🤔', '😐', '😬', '😢', '😮', '😴', '🤯', '🥳',
  '🔥', '✅', '❌', '⚠️', '❗', '❓', '💡', '⭐',
  '🎧', '🎙️', '🎬', '📚', '📅', '⏰', '💰', '🚀',
];

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

/** Iniciály pro kolečko, když u účtu není fotka. */
export function initials(label: string): string {
  const slova = label.trim().split(/\s+/).filter(Boolean);
  if (slova.length === 0) return '?';
  if (slova.length === 1) return slova[0].slice(0, 2).toUpperCase();
  return (slova[0].charAt(0) + slova[1].charAt(0)).toUpperCase();
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
