import webpush from 'web-push';
import { prisma } from '@/lib/db';

/**
 * Odesílání upozornění na nové zprávy (zadání 9. 9. 2026 k aplikaci MS Chat).
 *
 * JAK TO CHODÍ
 * Prohlížeč si u své push služby (Google, Apple, Mozilla) vyžádá odběr a jeho
 * adresu pošle sem; my ji uložíme k uživateli. Když přijde nová zpráva,
 * odešleme na tu adresu zašifrovaný balíček a službu poprosíme, ať ho doručí.
 * Že jsme to my, se prokazuje dvojicí klíčů VAPID.
 *
 * NASTAVENÍ
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY a VAPID_SUBJECT (e-mail ve tvaru
 * mailto:...). Dvojici klíčů si vyrobíte jednou:
 *
 *     npx web-push generate-vapid-keys
 *
 * Bez nich se upozornění prostě neodesílají a chat funguje dál - stejně jako
 * když někdo upozornění nepovolí.
 *
 * MRTVÉ ODBĚRY
 * Když služba odpoví 404 nebo 410, zařízení už odběr nemá (odinstalovaná
 * aplikace, smazaná data). Takový odběr se rovnou maže, jinak by se na něj
 * tlouklo donekonečna.
 */

let nastaveno: boolean | null = null;

function pripravWebpush(): boolean {
  if (nastaveno !== null) return nastaveno;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    nastaveno = false;
    return false;
  }
  try {
    webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:portal@msportal.cz', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    nastaveno = true;
  } catch (err) {
    console.error('VAPID klíče nejsou platné, upozornění se posílat nebudou:', err);
    nastaveno = false;
  }
  return nastaveno;
}

/** Je odesílání upozornění vůbec nastavené? Používá i /api/health. */
export function jePushNastaveno(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushZprava = {
  titulek: string;
  text: string;
  /** Kam se má po kliknutí skočit. */
  odkaz: string;
  /**
   * Značka pro sloučení: nová zpráva ze stejné konverzace přepíše tu
   * předchozí, aby se na zamčené obrazovce nekupil sloupec upozornění.
   */
  znacka?: string;
};

/**
 * Pošle upozornění všem zařízením daných uživatelů.
 *
 * Nikdy nevyhazuje - upozornění je doplněk, ne důvod, proč by mělo selhat
 * odeslání zprávy. Chyby se jen zapíšou do logu.
 */
export async function posliPush(userIds: string[], zprava: PushZprava): Promise<void> {
  const prijemci = [...new Set(userIds)].filter(Boolean);
  if (prijemci.length === 0 || !pripravWebpush()) return;

  try {
    const odbery = await prisma.pushOdber.findMany({
      where: { userId: { in: prijemci } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (odbery.length === 0) return;

    const balicek = JSON.stringify(zprava);
    const mrtve: string[] = [];

    await Promise.all(
      odbery.map(async (o) => {
        try {
          await webpush.sendNotification(
            { endpoint: o.endpoint, keys: { p256dh: o.p256dh, auth: o.auth } },
            balicek,
            { TTL: 60 * 60 * 12 },
          );
        } catch (err) {
          const stav = (err as { statusCode?: number })?.statusCode;
          if (stav === 404 || stav === 410) mrtve.push(o.id);
          else console.error('Upozornění se nepodařilo odeslat:', stav ?? err);
        }
      }),
    );

    if (mrtve.length > 0) {
      await prisma.pushOdber.deleteMany({ where: { id: { in: mrtve } } });
    }
  } catch (err) {
    console.error('posliPush selhalo:', err);
  }
}
