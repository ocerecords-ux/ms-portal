import { createHmac } from 'crypto';

/**
 * PŘEPOSÍLACÍ SERVER (TURN) PRO NÁŠ HOVOR (zadání 11. 10. 2026: „tak to udělej
 * na tom TURNu").
 *
 * PROČ TO VŮBEC JE: dva prohlížeče se zkusí najít napřímo. Na domácím wifi to
 * vyjde skoro vždycky, ale firemní sítě a část mobilních operátorů spojení
 * zvenčí nepustí - pak musí obraz a zvuk projít PŘES PROSTŘEDNÍKA. To je TURN.
 * Bez něj se zhruba jedno spojení z pěti nenaváže a vypadá to jako porouchaná
 * kamera. Tohle je ta chybějící pětina.
 *
 * ÚDAJE SE NEPOSÍLAJÍ DO STRÁNKY NATVRDO. Vydávají se až na vyžádání, pro
 * jednu místnost, a mají krátkou platnost (viz PLATNOST_HODIN) - kdyby odkaz
 * na pult odešel dál, nedá se z něj udělat volná přeposílačka.
 *
 * PODPOROVANÉ ZPŮSOBY, v tomhle pořadí:
 *
 *  1. CLOUDFLARE (doporučené, nastavuje se TURN_CF_KEY_ID + TURN_CF_TOKEN).
 *     Nic neběží u nás, platí se jen za přeposlaná data (řádově haléře za
 *     natáčení) a údaje si pro každé otevření pultu vyžádáme nové.
 *  2. VLASTNÍ SERVER S TAJEMSTVÍM (TURN_URL + TURN_SECRET) - obvyklé
 *     nastavení coturnu. Jméno a heslo se spočítají z času a tajemství, takže
 *     taky platí jen pár hodin a nikde se neskladují.
 *  3. PEVNÉ JMÉNO A HESLO (TURN_URL + TURN_USER + TURN_PASS) - nouzovka pro
 *     server, který jinak neumí.
 *
 * Když není nastavené nic, vrátí se jen STUN („tohle je moje adresa") a pult
 * funguje dál - jen na přísných sítích někomu nenaskočí obraz.
 */

/** Jak dlouho mají vydané údaje platit. Natáčení trvá hodiny, ne dny. */
const PLATNOST_HODIN = 6;

/**
 * STUN je ohláška vlastní adresy - zdarma a stačí na většinu spojení.
 * Dva různí poskytovatelé schválně: když jeden vypadne, zbude druhý.
 */
const STUN: RTCIceServer = {
  urls: [
    'stun:stun.cloudflare.com:3478',
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
};

/**
 * Vydané údaje si chvíli pamatujeme. Cloudflare se tak neptá při každém
 * otevření stránky a pult naskočí hned. Paměť je jen v běžícím procesu -
 * když ji Vercel zahodí, prostě se vyžádají znovu.
 */
let zapamatovane: { do: number; servery: RTCIceServer[] } | null = null;

export type IceOdpoved = {
  iceServers: RTCIceServer[];
  /** Je k dispozici přeposílání? Pult to říká člověku, ne aby to hádal z chyb. */
  preposilani: boolean;
};

export async function iceProPult(): Promise<IceOdpoved> {
  if (zapamatovane && zapamatovane.do > Date.now() + 60_000) {
    return { iceServers: zapamatovane.servery, preposilani: zapamatovane.servery.length > 1 };
  }

  const servery = await sestavServery();
  const preposilani = servery.length > 1;
  if (preposilani) {
    zapamatovane = { do: Date.now() + PLATNOST_HODIN * 3_600_000, servery };
  }
  return { iceServers: servery, preposilani };
}

async function sestavServery(): Promise<RTCIceServer[]> {
  const zCloudflare = await zCloudflareUdaje();
  if (zCloudflare) return zCloudflare;

  const adresy = (process.env.TURN_URL || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (adresy.length === 0) return [STUN];

  const tajemstvi = process.env.TURN_SECRET;
  if (tajemstvi) {
    /**
     * COTURN S TAJEMSTVÍM. Jméno je „platí do : k čemu" a heslo je otisk
     * toho jména spočítaný tajemstvím - server si ho spočítá taky a porovná.
     * Nic se nikde nezakládá a po pár hodinách to samo přestane platit.
     */
    const platiDo = Math.floor(Date.now() / 1000) + PLATNOST_HODIN * 3_600;
    const jmeno = `${platiDo}:pult`;
    const heslo = createHmac('sha1', tajemstvi).update(jmeno).digest('base64');
    return [STUN, { urls: adresy, username: jmeno, credential: heslo }];
  }

  const uzivatel = process.env.TURN_USER;
  const heslo = process.env.TURN_PASS;
  if (uzivatel && heslo) return [STUN, { urls: adresy, username: uzivatel, credential: heslo }];

  // Adresa bez přihlašovacích údajů by spojení jen zdržela - radši jen STUN.
  return [STUN];
}

/**
 * CLOUDFLARE. Pro každé vyžádání vydá vlastní jméno a heslo s omezenou
 * platností; my si je jen přepošleme do prohlížeče. Když se to nepovede,
 * vrátí se `null` a zkusí se další způsob - natáčení nesmí spadnout kvůli
 * tomu, že má někdo výpadek.
 */
async function zCloudflareUdaje(): Promise<RTCIceServer[] | null> {
  const klic = process.env.TURN_CF_KEY_ID;
  const token = process.env.TURN_CF_TOKEN;
  if (!klic || !token) return null;

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(klic)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: PLATNOST_HODIN * 3_600 }),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      console.error('Cloudflare TURN odmítl vydat údaje:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
    // Cloudflare vrací podle dokumentace pole; starší odpovědi uměly i jeden objekt.
    const seznam = Array.isArray(data.iceServers)
      ? data.iceServers
      : data.iceServers
        ? [data.iceServers]
        : [];
    const sUdaji = seznam.filter((s) => Boolean(s.username));
    if (sUdaji.length === 0) return null;
    return [STUN, ...sUdaji];
  } catch (err) {
    console.error('Cloudflare TURN se nepodařilo zavolat:', err);
    return null;
  }
}
