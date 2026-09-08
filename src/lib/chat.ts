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

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorLabel: string;
  mine: boolean;
};

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
};

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
