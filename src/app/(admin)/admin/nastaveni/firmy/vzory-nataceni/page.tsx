import Obrazovka from '../../../vzory-nataceni/page';

/**
 * Záložka v Nastavení firem (28. 9. 2026). Vykresluje tutéž obrazovku, která
 * žije i na své původní adrese - obsah se nekopíruje, jen se ukazuje uvnitř
 * záložek, aby se z nich člověk neproklikával pryč.
 */
export const dynamic = 'force-dynamic';

export default function Zalozka() {
  return <Obrazovka />;
}
