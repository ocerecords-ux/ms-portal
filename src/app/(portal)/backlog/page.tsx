import { redirect } from 'next/navigation';

/**
 * Backlog se přestěhoval do Přehledů (21. 9. 2026: „backlog dejme do
 * Přehledů"). Stará adresa zůstává kvůli uloženým odkazům a záložkám.
 */
export default function BacklogPage() {
  redirect('/prehledy/backlog');
}
