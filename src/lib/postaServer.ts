import type { Currency, PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getRateForCurrency } from '@/lib/cnb';
import { CURRENCIES, parseMoneyToMinor } from '@/lib/doklady';
import { uploadExpenseBuffer } from '@/lib/storage';
import { prectiDoklad } from '@/lib/uctenkaServer';
import type { PrectenaUctenka } from '@/lib/uctenka';
import {
  CTENI_NA_JEDNO_KOLO,
  MAX_PRILOHA_BYTES,
  MIN_PRILOHA_BYTES,
  POVOLENE_TYPY_PRILOH,
  ZPRAV_NA_JEDNO_KOLO,
  type StavPosty,
  type VysledekKontroly,
} from '@/lib/posta';

/**
 * Doklady z e-mailové schránky (zadání 12. 9. 2026).
 *
 * JAK TO CHODÍ
 * Na uctarna@mediaspace.cz chodí faktury herců, za nájem i od dodavatelů.
 * Portál se do schránky přihlásí přes IMAP, vytáhne přílohy, které vypadají
 * jako doklad, a z každé udělá výdaj ve stavu NEZAŘAZENÝ. Účetní ho pak
 * v záložce Nezařazené překontroluje, doplní kategorii a zařadí.
 *
 * ZE SCHRÁNKY SE NIC NEMAŽE ANI NEOZNAČUJE. Portál si jen pamatuje nejvyšší
 * přečtené UID (PostaStav) — schránka zůstává přesně taková, jakou ji účetní
 * zná, a když se něco pokazí, nic není ztracené.
 *
 * ČTENÍ ÚDAJŮ JE AŽ DRUHÝ KROK. Nejdřív se doklady rychle založí, teprve pak
 * se po dávkách posílají modelu ke čtení. Kdyby se čtení dělalo rovnou při
 * stahování, jedna nepřečtená faktura by zdržela celou schránku — a hlavně
 * by se do minuty nestihlo víc než pár zpráv.
 *
 * NASTAVENÍ (proměnné prostředí na Vercelu)
 * IMAP_HOST      — server schránky, např. imap.forpsi.com
 * IMAP_PORT      — obvykle 993 (výchozí)
 * IMAP_USER      — přihlašovací jméno, obvykle celá adresa
 * IMAP_PASSWORD  — heslo ke schránce
 * IMAP_FOLDER    — složka, výchozí INBOX (hodí se mít zvlášť, třeba "Doklady")
 * Bez nich se kontrola pošty tiše vypne a portál se chová jako dřív.
 */

const PRVNI_KOLO_DNU = 14;

/**
 * Z knihoven si bereme jen to, co opravdu voláme.
 *
 * Vlastní popis typů (ne ten z balíčku) proto, že obě knihovny se načítají až
 * za běhu a jejich typy se mezi verzemi mění - portál by pak přestal jít
 * sestavit kvůli něčemu, co s doklady vůbec nesouvisí.
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
  attachments?: {
    filename?: string;
    contentType?: string;
    content?: Buffer;
    related?: boolean;
  }[];
};

export function jePostaNastavena(): boolean {
  return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);
}

/** Stav pro hlavičku Výdajů: kdy se naposled koukalo a kolik toho čeká. */
export async function nactiStavPosty(): Promise<StavPosty> {
  const [stav, nezarazeno, bezNavrhu] = await Promise.all([
    prisma.postaStav.findUnique({ where: { id: 'posta' } }),
    prisma.expense.count({ where: { stav: 'NEZARAZENY' } }),
    prisma.expense.count({ where: { stav: 'NEZARAZENY', navrhJson: null } }),
  ]);
  return {
    nastaveno: jePostaNastavena(),
    posledniKontrolaAt: stav?.posledniKontrolaAt?.toISOString() ?? null,
    posledniChyba: stav?.posledniChyba ?? null,
    nezarazeno,
    bezNavrhu,
  };
}

type NalezenaPriloha = {
  klic: string;
  nazev: string;
  typ: string;
  data: Buffer;
  od: string | null;
  predmet: string | null;
  kdy: Date;
};

/** Jméno odesílatele bez adresy: z „Jan Novák <jan@…>" udělá „Jan Novák". */
function jmenoOdesilatele(od: string | null): string | null {
  if (!od) return null;
  const bezAdresy = od.replace(/<[^>]*>/g, '').replace(/"/g, '').trim();
  return (bezAdresy || od).slice(0, 200);
}

/**
 * Přílohy, které mají šanci být dokladem.
 *
 * Vyhazuje se podpisové logo (malý obrázek vložený do těla) a všechno, co
 * není PDF ani fotka — docx ani zip účetní stejně do dokladů nedá.
 */
function vyberPrilohy(zprava: RozebranaZprava): { nazev: string; typ: string; data: Buffer }[] {
  const vysledek: { nazev: string; typ: string; data: Buffer }[] = [];
  for (const priloha of zprava.attachments ?? []) {
    const data = priloha.content;
    if (!data || !Buffer.isBuffer(data)) continue;
    const typ = (priloha.contentType || '').toLowerCase().split(';')[0].trim();
    if (!POVOLENE_TYPY_PRILOH.includes(typ)) continue;
    if (priloha.related) continue; // obrázek vložený do těla = podpis
    if (typ !== 'application/pdf' && data.byteLength < MIN_PRILOHA_BYTES) continue;
    if (data.byteLength > MAX_PRILOHA_BYTES) continue;
    vysledek.push({ nazev: priloha.filename || 'doklad', typ, data });
    if (vysledek.length >= 5) break;
  }
  return vysledek;
}

/** Přihlásí se do schránky a vrátí přílohy z dosud nepřečtených zpráv. */
async function stahniPrilohy(
  posledniUid: number,
): Promise<{ prilohy: NalezenaPriloha[]; nejvyssiUid: number; zbyva: boolean }> {
  const { ImapFlow } = (await import('imapflow')) as unknown as {
    ImapFlow: new (volby: Record<string, unknown>) => ImapKlient;
  };
  const { simpleParser } = (await import('mailparser')) as unknown as {
    simpleParser: (zdroj: Buffer) => Promise<RozebranaZprava>;
  };

  const klient = new ImapFlow({
    host: String(process.env.IMAP_HOST),
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_PORT === '143' ? false : true,
    auth: { user: String(process.env.IMAP_USER), pass: String(process.env.IMAP_PASSWORD) },
    // Bez tohohle sype knihovna do logu celou komunikaci včetně hlaviček zpráv.
    logger: false,
  });

  const prilohy: NalezenaPriloha[] = [];
  let nejvyssiUid = posledniUid;
  let zbyva = false;

  await klient.connect();
  try {
    const zamek = await klient.getMailboxLock(process.env.IMAP_FOLDER || 'INBOX');
    try {
      // Poprvé se nebere celá historie schránky - jen poslední dva týdny.
      // Jinak by se při zapnutí funkce do Výdajů vysypaly roky dokladů.
      const nalezene = posledniUid
        ? await klient.search({ uid: `${posledniUid + 1}:*` }, { uid: true })
        : await klient.search(
            { since: new Date(Date.now() - PRVNI_KOLO_DNU * 24 * 60 * 60 * 1000) },
            { uid: true },
          );

      const uidy = (Array.isArray(nalezene) ? nalezene : [])
        .filter((uid) => uid > posledniUid)
        .sort((a, b) => a - b);
      const vybrane = uidy.slice(0, ZPRAV_NA_JEDNO_KOLO);
      zbyva = uidy.length > vybrane.length;

      if (vybrane.length > 0) {
        for await (const zprava of klient.fetch(
          vybrane.join(','),
          { uid: true, source: true },
          { uid: true },
        )) {
          const zdroj = zprava.source;
          if (!zdroj) continue;
          const rozebrana = await simpleParser(zdroj);
          const od = rozebrana.from?.text ?? null;
          const predmet = rozebrana.subject ?? null;
          const kdy = rozebrana.date ?? new Date();
          const zaklad = rozebrana.messageId || `uid-${zprava.uid}`;

          vyberPrilohy(rozebrana).forEach((priloha, poradi) => {
            prilohy.push({
              klic: `${zaklad}#${poradi}`.slice(0, 300),
              nazev: priloha.nazev,
              typ: priloha.typ,
              data: priloha.data,
              od,
              predmet,
              kdy,
            });
          });

          nejvyssiUid = Math.max(nejvyssiUid, zprava.uid);
        }
      }
    } finally {
      zamek.release();
    }
  } finally {
    await klient.logout().catch(() => undefined);
  }

  return { prilohy, nejvyssiUid, zbyva };
}

/** Z každé přílohy udělá nezařazený výdaj. Co už v portálu je, přeskočí. */
async function zalozDoklady(prilohy: NalezenaPriloha[]): Promise<number> {
  let zalozeno = 0;

  for (const priloha of prilohy) {
    const uz = await prisma.expense.findFirst({ where: { mailKlic: priloha.klic }, select: { id: true } });
    if (uz) continue;

    const ulozena = await uploadExpenseBuffer(priloha.data, priloha.nazev, priloha.typ);
    const prilohaOk = ulozena && 'url' in ulozena ? ulozena : null;

    try {
      await prisma.expense.create({
        data: {
          stav: 'NEZARAZENY',
          zdroj: 'MAIL',
          mailKlic: priloha.klic,
          mailOd: priloha.od?.slice(0, 300) ?? null,
          mailPredmet: priloha.predmet?.slice(0, 300) ?? null,
          mailPrijatoAt: priloha.kdy,
          // Než se doklad přečte, ať je v seznamu poznat aspoň podle čeho přišel.
          description: (priloha.predmet || priloha.nazev).slice(0, 300),
          supplierName: jmenoOdesilatele(priloha.od),
          issueDate: priloha.kdy,
          paid: false,
          attachmentUrl: prilohaOk?.url ?? null,
          attachmentName: prilohaOk?.name ?? null,
          note: prilohaOk
            ? null
            : 'Přílohu se nepodařilo uložit (nejspíš je moc velká). Doklad najdete v e-mailu.',
        },
      });
      zalozeno += 1;
    } catch (err) {
      // Dvakrát tentýž klíč = zprávu jsme už zpracovali; cokoliv jiného patří do logu.
      const zprava = err instanceof Error ? err.message : '';
      if (!zprava.includes('Unique constraint')) {
        console.error('Doklad z pošty se nepodařilo založit:', zprava);
      }
    }
  }

  return zalozeno;
}

/** Vytáhne uloženou přílohu zpátky - z databáze (data URL) i z úložiště. */
async function nactiPrilohu(url: string): Promise<{ data: Buffer; typ: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const carka = url.indexOf(',');
      if (carka < 0) return null;
      const typ = url.slice(5, carka).split(';')[0] || 'application/pdf';
      return { data: Buffer.from(url.slice(carka + 1), 'base64'), typ };
    }
    const odpoved = await fetch(url);
    if (!odpoved.ok) return null;
    const typ = (odpoved.headers.get('content-type') || 'application/pdf').split(';')[0];
    return { data: Buffer.from(await odpoved.arrayBuffer()), typ };
  } catch {
    return null;
  }
}

/** Částka bez DPH: buď je na dokladu přímo, nebo se dopočítá z celkové. */
function zakladDane(uctenka: PrectenaUctenka, sazba: number): number | null {
  const bezDph = uctenka.castkaBezDph ? parseMoneyToMinor(uctenka.castkaBezDph) : 0;
  if (bezDph > 0) return bezDph;
  const sDph = uctenka.castkaSDph ? parseMoneyToMinor(uctenka.castkaSDph) : 0;
  if (sDph > 0) return Math.round(sDph / (1 + sazba / 100));
  return null;
}

/**
 * Pošle pár nepřečtených dokladů modelu a doplní, co z nich přečetl.
 *
 * Přepisují se jen pole, která u dokladu nic neříkají - popis z předmětu
 * zprávy a jméno odesílatele. Co už účetní stihla opravit, zůstává.
 */
async function doplnNavrhy(limit: number): Promise<number> {
  const cekaji = await prisma.expense.findMany({
    where: { stav: 'NEZARAZENY', navrhJson: null, attachmentUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let precteno = 0;

  for (const doklad of cekaji) {
    const soubor = doklad.attachmentUrl ? await nactiPrilohu(doklad.attachmentUrl) : null;
    if (!soubor) {
      await prisma.expense.update({
        where: { id: doklad.id },
        data: { navrhJson: JSON.stringify({ chyba: 'Přílohu se nepodařilo načíst.' }) },
      });
      continue;
    }

    const kontext = [doklad.mailOd ? `Od: ${doklad.mailOd}` : null, doklad.mailPredmet ? `Předmět: ${doklad.mailPredmet}` : null]
      .filter(Boolean)
      .join('\n');
    const vysledek = await prectiDoklad(soubor.data, soubor.typ, kontext || null);

    if (vysledek.stav !== 'ok') {
      await prisma.expense.update({
        where: { id: doklad.id },
        data: {
          navrhJson: JSON.stringify({
            chyba: vysledek.stav === 'vypnuto' ? 'Čtení dokladů není nastavené.' : vysledek.zprava,
          }),
        },
      });
      continue;
    }

    const u = vysledek.uctenka;
    const sazba = u.sazbaDph ?? doklad.vatRate;
    const zaklad = zakladDane(u, sazba);
    const mena = (u.mena && (CURRENCIES as readonly string[]).includes(u.mena) ? u.mena : doklad.currency) as Currency;
    const datum = u.datum ? new Date(`${u.datum}T00:00:00.000Z`) : doklad.issueDate;
    const kurz = await getRateForCurrency(mena, datum);

    await prisma.expense.update({
      where: { id: doklad.id },
      data: {
        navrhJson: JSON.stringify(u),
        number: u.cislo ?? doklad.number,
        supplierName: u.dodavatel ?? doklad.supplierName,
        description: u.popis ?? doklad.description,
        issueDate: datum,
        currency: mena,
        vatRate: sazba,
        ...(zaklad !== null ? { amountExVatMinor: zaklad } : {}),
        ...(u.zpusobUhrady ? { paymentMethod: u.zpusobUhrady as PaymentMethod } : {}),
        ...(kurz ? { exchangeRate: kurz.rate, exchangeRateDate: new Date(`${kurz.date}T00:00:00.000Z`) } : {}),
      },
    });
    precteno += 1;
  }

  return precteno;
}

/**
 * Jedno kolo: podívat se do schránky a přečíst pár dokladů.
 *
 * Nikdy nevyhazuje — účetní má vidět, co se nepovedlo, ne bílou stránku.
 * Chyba se uloží i do PostaStav, aby bylo poznat, že schránka nechodí,
 * i když se zrovna nikdo nedívá.
 */
export async function zkontrolujPostu(): Promise<VysledekKontroly> {
  if (!jePostaNastavena()) {
    return { zalozeno: 0, precteno: 0, zbyva: false, chyba: 'Schránka s doklady zatím není nastavená.' };
  }

  const stav = await prisma.postaStav.upsert({
    where: { id: 'posta' },
    create: { id: 'posta' },
    update: {},
  });

  let zalozeno = 0;
  let zbyva = false;
  let chyba: string | null = null;

  try {
    const { prilohy, nejvyssiUid, zbyva: jesteNeco } = await stahniPrilohy(stav.posledniUid);
    zalozeno = await zalozDoklady(prilohy);
    zbyva = jesteNeco;

    await prisma.postaStav.update({
      where: { id: 'posta' },
      data: {
        posledniUid: nejvyssiUid,
        posledniKontrolaAt: new Date(),
        posledniChyba: null,
        nactenoCelkem: { increment: zalozeno },
      },
    });
  } catch (err) {
    // Do hlášky nikdy nepatří heslo ani obsah zprávy - jen co se stalo.
    chyba = err instanceof Error ? err.message.slice(0, 300) : 'Do schránky se nepodařilo přihlásit.';
    console.error('Kontrola pošty selhala:', chyba);
    await prisma.postaStav.update({
      where: { id: 'posta' },
      data: { posledniKontrolaAt: new Date(), posledniChyba: chyba },
    });
  }

  // Číst se dá i tehdy, když se do schránky zrovna nešlo přihlásit - doklady
  // z minula na přečtení čekají dál.
  const precteno = await doplnNavrhy(CTENI_NA_JEDNO_KOLO);

  return { zalozeno, precteno, zbyva, chyba };
}
