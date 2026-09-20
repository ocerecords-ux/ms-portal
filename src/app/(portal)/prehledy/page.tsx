import { redirect } from 'next/navigation';
import { ZALOZKY_PREHLEDU } from './zalozky';

/**
 * Přehledy nemají rozcestník - první záložka je rovnou obsah (zadání
 * 20. 9. 2026: „z něj pak uděláme záložku, ne toto").
 */
export default function PrehledyPage() {
  redirect(ZALOZKY_PREHLEDU[0].href);
}
