import { redirect } from 'next/navigation';

/**
 * Vzory zpráv klientovi se od 28. 9. 2026 nastavují ozubeným kolem
 * v Projektech - viz lib/nastaveniSekci.ts. Adresa zůstává funkční kvůli
 * odkazům v administraci, v liště a v návodech.
 */
export default function VzoryZpravPage() {
  redirect('/admin/nastaveni/projekty');
}
