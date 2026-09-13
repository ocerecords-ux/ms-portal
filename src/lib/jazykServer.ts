import { cookies } from 'next/headers';
import { jeJazyk, KLIC_JAZYKA, type Jazyk } from '@/lib/jazyk';

/**
 * Jazyk pro serverové komponenty (zadání 13. 9. 2026).
 *
 * Bere se z cookie, kterou nastavuje přepínač v liště. Díky tomu přijde
 * stránka ze serveru rovnou přeložená a nic po načtení nepřeskočí.
 */
export function nactiJazyk(): Jazyk {
  const hodnota = cookies().get(KLIC_JAZYKA)?.value;
  return jeJazyk(hodnota) ? hodnota : 'cs';
}
