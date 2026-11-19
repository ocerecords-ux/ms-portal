import { prisma } from '@/lib/db';
import { najdiFormat } from '@/lib/socialni';
import { zalozPrispevek, upravPrispevek } from '@/lib/socialniServer';
import { navrhZeVstupu, platnoZNavrhu } from '@/lib/emaSite';

/**
 * CO UŽ NÁM BĚŽELO NA SÍTÍCH + ZALOŽENÍ PŘÍSPĚVKU (zadání 19. 11. 2026).
 *
 * Čtení Instagramu jde přes tentýž připojený účet, jakým se krmí tabule ve
 * studiích (lib/instagramServer.ts). Tady se ale berou POPISKY, ne obrázky -
 * Ema potřebuje vědět, o čem jsme psali, aby to neopakovala.
 *
 * Výsledek se drží v paměti instance na deset minut. Instagram má limity a
 * tahle věta se do zadání vejde při každém úkolu.
 */

const API = 'https://graph.instagram.com';
const VERZE = 'v23.0';
const CACHE_MS = 10 * 60_000;

let pamet: { text: string; kdy: number } | null = null;

export async function coBezeloNaSitich(limit = 8): Promise<string> {
  if (pamet && Date.now() - pamet.kdy < CACHE_MS) return pamet.text;
  try {
    const ucet = await prisma.instagramUcet.findUnique({ where: { id: 'hlavni' } }).catch(() => null);
    if (!ucet) return '';

    const pole = 'caption,permalink,timestamp,media_type';
    const res = await fetch(
      `${API}/${VERZE}/me/media?fields=${pole}&limit=${limit}&access_token=${encodeURIComponent(ucet.token)}`,
      { cache: 'no-store' },
    ).catch(() => null);
    if (!res?.ok) return '';

    const data = (await res.json().catch(() => null)) as {
      data?: { caption?: string; permalink?: string; timestamp?: string }[];
    } | null;
    const polozky = data?.data ?? [];
    if (polozky.length === 0) return '';

    const text = polozky
      .map((p) => {
        const kdy = p.timestamp ? p.timestamp.slice(0, 10) : '';
        const popis = (p.caption ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
        return `- ${kdy}: ${popis || '(bez popisku)'}`;
      })
      .join('\n');
    pamet = { text, kdy: Date.now() };
    return text;
  } catch (err) {
    console.error('Cteni Instagramu pro Emu selhalo:', err);
    return '';
  }
}

/**
 * Založí rozpracovaný příspěvek v sekci Sítě pod účtem toho, kdo úkol zadal
 * (příspěvky jsou osobní - viz lib/socialniServer.ts).
 */
export async function zalozNavrhEmy(
  autorId: string,
  vstup: Record<string, unknown>,
): Promise<string> {
  const navrh = navrhZeVstupu(vstup);
  const format = najdiFormat(navrh.format);
  const prispevek = await zalozPrispevek(autorId, {
    nazev: navrh.nazev,
    format: format.klic,
    platno: platnoZNavrhu(navrh),
  });
  await upravPrispevek(autorId, prispevek.id, {
    popisek: navrh.popisek,
    hashtagy: navrh.hashtagy,
  }).catch(() => undefined);

  return `Hotovo - příspěvek „${navrh.nazev}" (${format.nazev}) leží rozpracovaný v Sítích. Grafiku dodělá člověk v editoru.`;
}
