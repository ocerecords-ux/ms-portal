import { prisma } from '@/lib/db';
import { oznacMail, rozeberMailOPohybu, type ZpravaOPohybu } from '@/lib/bankaMail';
import { napojeniProUcet, ulozAZparuj, type PohybKUlozeni } from '@/lib/bankaServer';
import type { Currency } from '@prisma/client';

/**
 * PÁROVÁNÍ PLATEB Z UPOZORNĚNÍ BANKY (29. 9. 2026).
 *
 * Banka pošle na banka@mediaspace.cz e-mail při každé změně zůstatku. Portál
 * se do schránky přihlásí každé dvě minuty, přečte, co je nového, a pohyby
 * pustí úplně toutéž cestou jako stažený výpis - `ulozAZparuj`. Faktura je
 * tedy označená jako uhrazená do pár minut od připsání peněz a nikdo nic
 * nestahuje ani nikam neklikne.
 *
 * ZE SCHRÁNKY SE NIC NEMAŽE ANI NEOZNAČUJE, stejně jako u dokladů: pamatuje se
 * jen nejvyšší přečtené UID. Když se něco pokazí, e-maily v ní pořád jsou.
 *
 * NASTAVENÍ (proměnné prostředí na Vercelu)
 * BANKA_IMAP_HOST     — server schránky
 * BANKA_IMAP_PORT     — obvykle 993 (výchozí)
 * BANKA_IMAP_USER     — přihlašovací jméno, obvykle celá adresa
 * BANKA_IMAP_PASSWORD — heslo ke schránce
 * BANKA_IMAP_FOLDER   — složka, výchozí INBOX
 * BANKA_IMAP_ODESILATEL — část adresy odesílatele, která se musí shodovat
 *                   (výchozí „airbank.cz"). Pojistka, aby portál nezpracoval
 *                   e-mail, který někdo do schránky pošle sám.
 * Bez nich se kontrola tiše vypne a portál se chová jako dřív.
 */

/** Řádek v PostaStav, kde si portál pamatuje, kam ve schránce došel. */
const STAV_ID = 'banka-posta';

/** Kolik zpráv se přečte na jedno kolo. Víc se do minuty stejně nestihne. */
const ZPRAV_NA_KOLO = 40;

/** Co se u schránky s bankou počítá za neznámý účet. */
const NEURCENY = 'neurceny';

const ZDROJ = { institutionId: 'MAIL_UPOZORNENI', institutionName: 'Upozornění z banky' };

export type StavBankovniPosty = {
  nastaveno: boolean;
  posledniKontrolaAt: string | null;
  posledniChyba: string | null;
  nactenoCelkem: number;
};

export type VysledekKolaPosty = {
  precteno: number;
  nove: number;
  sparovano: number;
  navrhy: number;
  /** Zprávy, ve kterých nebyla rozpoznatelná částka - viz `posledniChyba`. */
  nerozpoznano: number;
  zbyva: boolean;
  /**
   * Proč se kolo nepovedlo. Chyba schránky se nevyhazuje ven (jedna
   * nedostupná schránka nemá shodit úlohu), ale MUSÍ být vidět: do 29. 9. 2026
   * vracela úloha při odmítnutém přihlášení `ok` a samé nuly, takže se tvářila,
   * že jen nic nepřišlo.
   */
  chyba: string | null;
};

export function jeBankovniPostaNastavena(): boolean {
  return Boolean(
    process.env.BANKA_IMAP_HOST && process.env.BANKA_IMAP_USER && process.env.BANKA_IMAP_PASSWORD,
  );
}

export async function nactiStavBankovniPosty(): Promise<StavBankovniPosty> {
  const stav = await prisma.postaStav.findUnique({ where: { id: STAV_ID } });
  return {
    nastaveno: jeBankovniPostaNastavena(),
    posledniKontrolaAt: stav?.posledniKontrolaAt?.toISOString() ?? null,
    posledniChyba: stav?.posledniChyba ?? null,
    nactenoCelkem: stav?.nactenoCelkem ?? 0,
  };
}

/**
 * Z knihoven si bereme jen to, co voláme - stejně jako u pošty s doklady.
 * Obě se načítají až za běhu a jejich typy se mezi verzemi mění; portál by pak
 * přestal jít sestavit kvůli něčemu, co s bankou vůbec nesouvisí.
 */
type ImapZprava = { uid: number; source?: Buffer };
type ImapKlient = {
  connect(): Promise<void>;
  getMailboxLock(slozka: string): Promise<{ release(): void }>;
  search(dotaz: unknown, volby?: unknown): Promise<number[] | false>;
  fetch(rozsah: unknown, dotaz: unknown, volby?: unknown): AsyncIterable<ImapZprava>;
  logout(): Promise<void>;
};
type RozebranaZprava = {
  from?: { text?: string };
  subject?: string;
  date?: Date;
  messageId?: string;
  text?: string;
  html?: string | false;
};

/** Srozumitelná hláška z chyby IMAPu. */
function popisChyby(err: unknown): string {
  const e = err as { message?: string; responseText?: string; serverResponseCode?: string; code?: string };
  const text = [e?.responseText, e?.serverResponseCode, e?.code].filter(Boolean).join(' ');
  if (/AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed/i.test(text)) {
    return 'Schránka odmítla přihlášení — zkontrolujte BANKA_IMAP_USER a BANKA_IMAP_PASSWORD.';
  }
  if (/NONEXISTENT|Mailbox doesn't exist|no such mailbox/i.test(text)) {
    return `Složka ${process.env.BANKA_IMAP_FOLDER || 'INBOX'} ve schránce není.`;
  }
  const zaklad = e?.message || 'Do schránky se nepodařilo přihlásit.';
  return (text ? `${zaklad} — ${text}` : zaklad).slice(0, 300);
}

/**
 * HTML na text. Upozornění chodí často jen v HTML a `mailparser` sice umí
 * `textAsHtml`, ale opačný směr ne. Stačí vyhodit značky a zalomit na místech,
 * kde e-mail dělá řádky - parser stejně hledá štítky, ne odstavce.
 */
function zHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|tr|td|th|li|h[1-6]|table)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;?/gi, '&')
    .replace(/&lt;?/gi, '<')
    .replace(/&gt;?/gi, '>')
    .replace(/&#(\d+);?/g, (_, kod) => String.fromCharCode(Number(kod)))
    .replace(/\n{3,}/g, '\n\n');
}

type PrectenaZprava = {
  uid: number;
  messageId: string;
  od: string;
  predmet: string;
  telo: string;
  kdy: Date;
};

/** Přihlásí se do schránky a vrátí dosud nepřečtené zprávy od banky. */
async function stahniZpravy(
  posledniUid: number,
): Promise<{ zpravy: PrectenaZprava[]; nejvyssiUid: number; zbyva: boolean }> {
  const { ImapFlow } = (await import('imapflow')) as unknown as {
    ImapFlow: new (volby: Record<string, unknown>) => ImapKlient;
  };
  const { simpleParser } = (await import('mailparser')) as unknown as {
    simpleParser: (zdroj: Buffer) => Promise<RozebranaZprava>;
  };

  const klient = new ImapFlow({
    host: String(process.env.BANKA_IMAP_HOST),
    port: Number(process.env.BANKA_IMAP_PORT || 993),
    secure: process.env.BANKA_IMAP_PORT === '143' ? false : true,
    auth: {
      user: String(process.env.BANKA_IMAP_USER),
      pass: String(process.env.BANKA_IMAP_PASSWORD),
    },
    // Bez tohohle sype knihovna do logu celou komunikaci včetně hlaviček.
    logger: false,
  });

  const zpravy: PrectenaZprava[] = [];
  let nejvyssiUid = posledniUid;
  let zbyva = false;

  await klient.connect();
  try {
    const zamek = await klient.getMailboxLock(process.env.BANKA_IMAP_FOLDER || 'INBOX');
    try {
      /**
       * PRVNÍ KOLO SE JEN ZOROLUJE NA KONEC. Schránka je na upozornění
       * vyhrazená, ale kdyby se zapnula později, nemá smysl dohánět platby
       * měsíc zpátky - od toho je nahrání výpisu. Portál si všímá až toho, co
       * přijde nově.
       */
      if (!posledniUid) {
        const vse = await klient.search({ all: true }, { uid: true });
        const nejvyssi = Array.isArray(vse) && vse.length > 0 ? Math.max(...vse) : 0;
        return { zpravy: [], nejvyssiUid: nejvyssi, zbyva: false };
      }

      const nalezene = await klient.search({ uid: `${posledniUid + 1}:*` }, { uid: true });
      const uidy = (Array.isArray(nalezene) ? nalezene : [])
        .filter((uid) => uid > posledniUid)
        .sort((a, b) => a - b);
      const vybrane = uidy.slice(0, ZPRAV_NA_KOLO);
      zbyva = uidy.length > vybrane.length;

      if (vybrane.length > 0) {
        for await (const zprava of klient.fetch(
          vybrane.join(','),
          { uid: true, source: true },
          { uid: true },
        )) {
          nejvyssiUid = Math.max(nejvyssiUid, zprava.uid);
          if (!zprava.source) continue;

          const rozebrana = await simpleParser(zprava.source);
          const telo =
            rozebrana.text?.trim() ||
            (typeof rozebrana.html === 'string' ? zHtml(rozebrana.html) : '') ||
            '';

          zpravy.push({
            uid: zprava.uid,
            messageId: rozebrana.messageId || `uid-${zprava.uid}`,
            od: rozebrana.from?.text ?? '',
            predmet: rozebrana.subject ?? '',
            telo,
            kdy: rozebrana.date ?? new Date(),
          });
        }
      }
    } finally {
      zamek.release();
    }
  } finally {
    await klient.logout().catch(() => undefined);
  }

  return { zpravy, nejvyssiUid, zbyva };
}

/** Z rozebraného e-mailu udělá záznam, kterému rozumí párování. */
function naZaznam(zprava: PrectenaZprava, pohyb: ZpravaOPohybu): PohybKUlozeni {
  const kousky = [
    pohyb.zprava,
    pohyb.variabilniSymbol ? `VS: ${pohyb.variabilniSymbol}` : null,
    pohyb.specifickySymbol ? `SS: ${pohyb.specifickySymbol}` : null,
  ].filter(Boolean);

  return {
    externalId: oznacMail(zprava.messageId),
    // Datum z hlavičky e-mailu: banka ho posílá v okamžiku zaúčtování, takže
    // sedí na den připsání. Přesnější údaj v textu obvykle není.
    bookedAt: zprava.kdy,
    amountMinor: pohyb.castkaMinor,
    currency: pohyb.mena as Currency,
    variableSymbol: pohyb.variabilniSymbol,
    counterpartyName: pohyb.protistrana,
    counterpartyAccount: pohyb.protiucet,
    reference: kousky.join(' · ') || pohyb.zprava || null,
  };
}

/**
 * Jedno kolo: přečíst schránku, pohyby uložit a spárovat.
 *
 * Nerozpoznané zprávy se nezahazují potichu - spočítají se a předmět té
 * poslední se uloží do `posledniChyba`, ať je na kartě účtu vidět, že něco
 * přišlo a portál si s tím neporadil. Podle toho se pak dá čtení doladit.
 */
export async function zkontrolujBankovniPostu(): Promise<VysledekKolaPosty> {
  const prazdne: VysledekKolaPosty = {
    precteno: 0,
    nove: 0,
    sparovano: 0,
    navrhy: 0,
    nerozpoznano: 0,
    zbyva: false,
    chyba: null,
  };
  if (!jeBankovniPostaNastavena()) return prazdne;

  const stav = await prisma.postaStav.upsert({
    where: { id: STAV_ID },
    update: {},
    create: { id: STAV_ID },
  });

  let precteno: Awaited<ReturnType<typeof stahniZpravy>>;
  try {
    precteno = await stahniZpravy(stav.posledniUid);
  } catch (err) {
    const chyba = popisChyby(err);
    await prisma.postaStav.update({
      where: { id: STAV_ID },
      data: { posledniKontrolaAt: new Date(), posledniChyba: chyba },
    });
    console.error('Schránka s upozorněními z banky:', chyba);
    return { ...prazdne, chyba };
  }

  const odesilatel = (process.env.BANKA_IMAP_ODESILATEL || 'airbank.cz').toLowerCase();
  const odBanky = precteno.zpravy.filter((z) => z.od.toLowerCase().includes(odesilatel));

  const podleUctu = new Map<string, { zprava: PrectenaZprava; pohyb: ZpravaOPohybu }[]>();
  let nerozpoznano = 0;
  let posledniNerozpoznany: string | null = null;

  for (const zprava of odBanky) {
    const pohyb = rozeberMailOPohybu(zprava.predmet, zprava.telo);
    if (!pohyb) {
      nerozpoznano += 1;
      posledniNerozpoznany = zprava.predmet.slice(0, 200);
      continue;
    }
    const ucet = pohyb.ucet ?? NEURCENY;
    const seznam = podleUctu.get(ucet) ?? [];
    seznam.push({ zprava, pohyb });
    podleUctu.set(ucet, seznam);
  }

  const vysledek: VysledekKolaPosty = {
    precteno: odBanky.length,
    nove: 0,
    sparovano: 0,
    navrhy: 0,
    nerozpoznano,
    zbyva: precteno.zbyva,
    chyba: null,
  };

  for (const [ucet, polozky] of podleUctu) {
    const napojeni = await napojeniProUcet(ucet, ucet === NEURCENY ? 'Upozornění z banky' : null, ZDROJ);
    const ulozeno = await ulozAZparuj(
      napojeni.id,
      napojeni.issuerCompanyId,
      polozky.map((p) => naZaznam(p.zprava, p.pohyb)),
    );
    vysledek.nove += ulozeno.nove;
    vysledek.sparovano += ulozeno.sparovano;
    vysledek.navrhy += ulozeno.navrhy;

    await prisma.bankConnection.update({
      where: { id: napojeni.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
  }

  await prisma.postaStav.update({
    where: { id: STAV_ID },
    data: {
      posledniUid: Math.max(stav.posledniUid, precteno.nejvyssiUid),
      posledniKontrolaAt: new Date(),
      nactenoCelkem: { increment: vysledek.nove },
      posledniChyba: posledniNerozpoznany
        ? `Zprávě „${posledniNerozpoznany}" portál nerozuměl — nenašel v ní částku.`
        : null,
    },
  });

  return vysledek;
}
