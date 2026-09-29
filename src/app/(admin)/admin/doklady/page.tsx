import { redirect } from 'next/navigation';
import { smiDoBanky } from '@/lib/bankaPristup';
import { poradiZalozek } from '@/lib/zalozkyServer';
import { seradZalozky } from '@/lib/zalozky';
import { ZALOZKY_DOKLADU } from './zalozkyDokladu';

/**
 * Sekce Doklady začínala vždycky Nabídkami. Od 29. 9. 2026 se otevře ta
 * záložka, kterou si člověk dal v liště první - jinak by si ji přetáhl
 * dopředu a /admin/doklady by ho dál posílalo na Nabídky.
 */
export const dynamic = 'force-dynamic';

export default async function DokladyIndexPage() {
  const banka = await smiDoBanky();
  const dostupne = ZALOZKY_DOKLADU.filter((z) => z.klic !== 'banka' || banka);
  const prvni = seradZalozky(dostupne, await poradiZalozek('doklady'))[0];
  redirect(prvni?.href ?? '/admin/doklady/nabidky');
}
