import Obrazovka from '../../../doklady/moje-firmy/page';

/**
 * Záložka v Nastavení dokladů (28. 9. 2026). Vykresluje tutéž obrazovku,
 * která žije i na své původní adrese v Dokladech - obsah se nekopíruje.
 */
export const dynamic = 'force-dynamic';

export default function Zalozka() {
  return <Obrazovka />;
}
