import { NextRequest, NextResponse } from 'next/server';
import { nazvySluzeb, sluzbaPodleKlice } from '@/lib/sluzbyReklamy';
import {
  popisVystupuObjednavky,
  VYCHOZI_NAZEV_VYSTUPU,
  type VystupObjednavky,
} from '@/lib/vystupy';
import { zalozVystupyZObjednavky } from '@/lib/vystupyServer';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePrice } from '@/lib/price';
import { adresaVUlozisti, overPrilohu, uploadOrderAttachment } from '@/lib/storage';
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from '@/lib/email';
import { noveIdProjektu } from '@/lib/projektId';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { nazevProjektuVelky } from '@/lib/nazevProjektu';
import { zalozKanalProjektu } from '@/lib/kanalProjektuServer';
import { zapisZalozeniProjektu } from '@/lib/projektLogServer';
import { vytvorSlozkuProjektu } from '@/lib/googleDrive';
import { nahrajPrilohuObjednavkyNaDisk } from '@/lib/prilohaObjednavkyServer';
import { zakladPortalu } from '@/lib/preposlechOdkaz';
import { bezTitulu } from '@/lib/jmena';
import { notifyMany } from '@/lib/notifications';
import { vidiCenuObjednavky } from '@/lib/roles';
import type { Role } from '@prisma/client';

// Druh objednavky (zadani 12. 9. 2026 - viz OrderKind ve schema.prisma).
// AUDIOBOOK je vychozi a zachovava puvodni chovani (normostrany, cena,
// Caflou projekt); AD je zatim jen zakladni ulozeni objednavky - zbytek
// (jaka pole presne, Caflou napojeni apod.) se upresni pozdeji.
// Příloha se po uložení ještě kopíruje do složky projektu na Disku
// (22. 9. 2026) - u velkého PDF to chvíli trvá.
export const maxDuration = 120;

const ORDER_KINDS = ['AUDIOBOOK', 'AD'] as const;

const orderSchema = z.object({
  kind: z.enum(ORDER_KINDS).default('AUDIOBOOK'),
  title: z.string().trim().min(1, 'Název je povinný.'),
  pageCount: z.string().optional(),
  // Cena od klienta (23. 9. 2026) - jen u firem, ktere si ji navrhuji samy
  // (Company.cenuUrcujeKlient). U ostatnich se ignoruje a pocita se ze sazby.
  price: z.string().optional(),
  deadline: z.string().optional(),
  note: z.string().optional(),
  preferredNarrator: z.string().optional(),
  /** Klíče služeb u reklamy - viz lib/sluzbyReklamy.ts. Souhrn za celou objednávku. */
  sluzby: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  /**
   * VÝSTUPY OBJEDNÁVKY (zadání 26. 9. 2026) - co se má vyrobit, po kusech.
   * Přijde jako JSON z formuláře; u audioknihy se neposílá.
   */
  vystupy: z
    .array(
      z.object({
        nazev: z.string().trim().max(200).default(''),
        delkaSekund: z.number().int().positive().max(36000).nullable().default(null),
        sluzby: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
        downcuty: z.array(z.number().int().positive().max(36000)).max(12).default([]),
      }),
    )
    .max(20)
    .optional(),
  // Úvod a závěr audioknihy (zadání 22. 9. 2026, Audiotéka).
  autorKnihy: z.string().trim().max(300).optional(),
  prekladatelKnihy: z.string().trim().max(300).optional(),
  nakladatelstviKnihy: z.string().trim().max(300).optional(),
  uvodKnihy: z.string().trim().max(3000).optional(),
  zaverKnihy: z.string().trim().max(3000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
  }
  // Tenant izolace: companyId a userId bereme VYHRADNE ze session.
  const companyId = session.user.companyId;
  const userId = session.user.id;

  const formData = await req.formData();
  const parsed = orderSchema.safeParse({
    kind: formData.get('kind') || undefined,
    title: formData.get('title'),
    pageCount: formData.get('pageCount'),
    price: formData.get('price') ?? undefined,
    deadline: formData.get('deadline'),
    note: formData.get('note'),
    preferredNarrator: formData.get('preferredNarrator'),
    autorKnihy: formData.get('autorKnihy') ?? undefined,
    prekladatelKnihy: formData.get('prekladatelKnihy') ?? undefined,
    nakladatelstviKnihy: formData.get('nakladatelstviKnihy') ?? undefined,
    uvodKnihy: formData.get('uvodKnihy') ?? undefined,
    zaverKnihy: formData.get('zaverKnihy') ?? undefined,
    // Co si klient u reklamy objednal (25. 9. 2026) - může jich být víc.
    sluzby: formData.getAll('sluzby').map((s) => String(s)),
    // Výstupy objednávky (26. 9. 2026) - formulář je posílá jako JSON.
    vystupy: (() => {
      const syrove = formData.get('vystupy');
      if (!syrove) return undefined;
      try {
        const data = JSON.parse(String(syrove));
        return Array.isArray(data) ? data : undefined;
      } catch {
        return undefined;
      }
    })(),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { kind, note } = parsed.data;
  /**
   * SLUŽBY U REKLAMY (zadání 25. 9. 2026). Bere se jen to, co číselník zná -
   * co přijde odjinud, se zahodí, ať se do projektu nedostane nesmysl.
   */
  const sluzbyKlice = (parsed.data.sluzby ?? []).filter((k) => Boolean(sluzbaPodleKlice(k)));
  /**
   * VÝSTUPY OBJEDNÁVKY (26. 9. 2026). Stejné síto jako u služeb - projde jen
   * to, co číselník zná. Řádek bez názvu dostane pořadové číslo, ať se v
   * projektu pozná; prázdný seznam znamená, že objednávka přišla postaru.
   */
  const vystupyObjednavky: VystupObjednavky[] = (parsed.data.vystupy ?? []).map((v, i) => ({
    nazev: v.nazev.trim() || (i === 0 ? VYCHOZI_NAZEV_VYSTUPU : `Spot ${i + 1}`),
    delkaSekund: v.delkaSekund,
    sluzby: v.sluzby.filter((k) => Boolean(sluzbaPodleKlice(k))),
    downcuty: Array.from(new Set<number>(v.downcuty)).sort((a, b) => b - a),
  }));
  // Název projektu i objednávky držíme velkými (zadání 22. 9. 2026).
  const title = nazevProjektuVelky(parsed.data.title);
  const isAudiobook = kind === 'AUDIOBOOK';
  const preferredNarrator = parsed.data.preferredNarrator?.trim() || null;
  const pageCount = isAudiobook && parsed.data.pageCount ? parseInt(parsed.data.pageCount, 10) : null;
  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  const knihaUdaje = {
    autorKnihy: (isAudiobook && parsed.data.autorKnihy) || null,
    prekladatelKnihy: (isAudiobook && parsed.data.prekladatelKnihy) || null,
    nakladatelstviKnihy: (isAudiobook && parsed.data.nakladatelstviKnihy) || null,
    uvodKnihy: (isAudiobook && parsed.data.uvodKnihy) || null,
    zaverKnihy: (isAudiobook && parsed.data.zaverKnihy) || null,
  };

  const [company, orderingUser] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (!company) {
    return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });
  }
  // ratePerPage/normostrany davaji smysl jen u objednavky audioknihy - u
  // reklamy (kind AD) se cena zatim nepocita (zadani 12. 9. 2026: "zbytek si
  // vyspecifikujeme později").
  // Firma, ktera si cenu navrhuje sama (zadani 23. 9. 2026 - Albatros),
  // sazbu za normostranu vubec nepotrebuje.
  if (isAudiobook && company.ratePerPage == null && !company.cenuUrcujeKlient) {
    return NextResponse.json({ error: 'Vaší firmě zatím není nastavená sazba za normostranu.' }, { status: 400 });
  }

  const cenaOdKlienta = (() => {
    const raw = (parsed.data.price ?? '').replace(/\s/g, '').replace(',', '.');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  })();
  const priceEstimate = !isAudiobook
    ? null
    : company.cenuUrcujeKlient
      ? cenaOdKlienta
      : calculatePrice(pageCount, company.ratePerPage ?? 0);

  // Priloha objednavky. Kdyz uloziste souboru neni nastavene (coz je k
  // 9. 9. 2026 na produkci porad pripad), uploadOrderAttachment vrati null -
  // a driv se s tim dal nic nedelalo: objednavka se ulozila bez souboru a
  // klient videl jen "odeslano". Podklady tak tise mizely. Objednavka se
  // ulozi porad (je to zdroj pravdy a o vypsana data nikdo prijit nesmi),
  // ale ted se to aspon zapise do logu a REKNE ODESILATELI.
  let attachment: { url: string; name: string } | null = null;
  let prilohaSelhala: string | null = null;

  /**
   * PŘÍLOHA UŽ V ÚLOŽIŠTI LEŽÍ (oprava 16. 9. 2026: „klientovi se nepodařilo
   * odeslat objednávku").
   *
   * Prohlížeč ji tam pošle sám na podepsanou adresu (/api/orders/priloha/podpis)
   * a sem přijde jen klíč. Soubor tak neprochází portálem a nenaráží na strop
   * velikosti požadavku, o který se stodevítistránkové PDF dvakrát rozbilo.
   *
   * Že soubor opravdu leží v úložišti, se OVĚŘUJE - prohlížeč hlásí, co chce,
   * a objednávka nesmí odkazovat na nic.
   */
  const attachmentKey = String(formData.get('attachmentKey') ?? '').trim();
  const attachmentName = String(formData.get('attachmentName') ?? '').trim();
  const file = formData.get('attachment');

  if (attachmentKey) {
    const overeno = await overPrilohu(attachmentKey);
    const url = overeno ? adresaVUlozisti(attachmentKey) : null;
    if (url) {
      attachment = { url, name: attachmentName || 'příloha' };
    } else {
      console.error(
        `Priloha objednavky nedorazila do uloziste (firma ${companyId}, klic "${attachmentKey}").`,
      );
      prilohaSelhala = attachmentName || 'příloha';
    }
  } else if (file instanceof File && file.size > 0) {
    // Zaloha pro starsi formulare a male soubory - jde porad pres portal.
    attachment = await uploadOrderAttachment(file, companyId);
    if (!attachment) {
      console.error(
        `Prilohu objednavky se nepodarilo ulozit (firma ${companyId}, soubor "${file.name}", ` +
          `${file.size} B). Uloziste souboru neni nastavene nebo selhalo.`,
      );
      prilohaSelhala = file.name;
    }
  }

  // 1) Objednavka a navazany projekt se ulozi VZDY - tohle je zdroj pravdy,
  //    nezavisly na tom, jestli se pozdeji povede e-mail.
  const order = await prisma.order.create({
    data: {
      companyId,
      createdByUserId: userId,
      kind,
      title,
      pageCount,
      ratePerPageSnapshot: isAudiobook ? company.ratePerPage : null,
      priceEstimate,
      deadline,
      note: note || null,
      preferredNarrator,
      sluzby: sluzbyKlice,
      vystupy: vystupyObjednavky.length > 0 ? vystupyObjednavky : undefined,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      ...knihaUdaje,
      project: {
        create: {
          companyId,
          name: title,
          status: 'Nové',
          narrator: preferredNarrator,
        },
      },
    },
  });

  // 2) Zalozeni projektu V PORTALU (zadani 9. 9. 2026: "Caflou casem nebudeme
  //    potrebovat a projekty budeme zakladat na MS portalu"; odpojeno
  //    11. 9. 2026). Zatim jen pro objednavky audioknihy - u reklamy
  //    normostrany ani cena zatim nedavaji smysl, viz vyse.
  //
  //    Best effort: projekt navic nesmi shodit prijatou objednavku. Slozka na
  //    Disku se tady nezaklada - projekt zatim nikdo nepotvrdil a prazdnych
  //    slozek by pribyvalo; zaklada se az pri zalozeni projektu produkci.
  let idProjektu: string | null = null;
  if (isAudiobook) {
    try {
      const caflouProjectId = noveIdProjektu();

      /**
       * MANAZER (zadani 15. 9. 2026: „manazer projektu u audioknih je vzdy
       * Karolina"). Bere se z priznaku na uctu, ne ze jmena v kodu - az to
       * jednou bude nekdo jiny, prekliknete to na karte uzivatele.
       */
      const vedouci = await prisma.user.findFirst({
        where: { active: true, vychoziManazerAudioknih: true },
        select: { id: true },
      });

      /**
       * TYP PROJEKTU (zadani 15. 9. 2026: „rovnou pridej typ projektu").
       * Bere se polozka ceniku zaskrtnuta v Cenicich jako typ pro objednane
       * audioknihy - bez typu se projektu nespocita rozpocet. V ProjectMeta
       * se uklada nazev polozky, stejne jako kdyz typ vybere clovek.
       */
      const typProjektu = await prisma.priceListItem.findFirst({
        where: { active: true, proObjednavkyAudioknih: true },
        select: { name: true },
      });

      /**
       * HERCI (zadani 15. 9. 2026: „herce nemuzeme vybrat konkretniho? A kdyz
       * neni, tak text?"). Klient vybira ze seznamu hercu, ale do objednavky
       * se to ulozi jako jmena oddelena carkami. Co sedi na ucet herce, navaze
       * se na projekt doopravdy; co nesedi (herec, ktereho v portalu nemame),
       * zustane textem v poli „herec z Caflou" jako preni klienta.
       */
      const jmena = (preferredNarrator ?? '')
        .split(',')
        .map((j) => j.trim())
        .filter(Boolean);
      const klic = (t: string) =>
        t
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      const ucty = jmena.length
        ? await prisma.user.findMany({
            where: { role: 'HEREC', active: true },
            select: { id: true, name: true, code: true },
          })
        : [];
      const herciIds: string[] = [];
      const zbylaJmena: string[] = [];
      for (const jmeno of jmena) {
        const shoda = ucty.find(
          (u) => klic(bezTitulu(u.name) || '') === klic(jmeno) || u.code === jmeno,
        );
        if (shoda && !herciIds.includes(shoda.id)) herciIds.push(shoda.id);
        else if (!shoda) zbylaJmena.push(jmeno);
      }

      /**
       * SLOZKA NA DISKU (zadani 15. 9. 2026: „mela by se zalozit slozka podle
       * nazvu"). Vznika ve slozce firmy a pojmenuje se podle objednavky.
       * Kdyz firma svou slozku vyplnenou nema nebo Disk odmitne, projekt se
       * zalozi bez odkazu - prijit kvuli Disku o objednavku by bylo horsi.
       */
      let driveUrl: string | null = null;
      if (company.driveFolderUrl) {
        const vysledek = await vytvorSlozkuProjektu(company.driveFolderUrl, title);
        if ('chyba' in vysledek) console.error(`Složka projektu „${title}": ${vysledek.chyba}`);
        else {
          driveUrl = vysledek.url;
        }
      }

      await prisma.projectMeta.create({
        data: {
          caflouProjectId,
          name: title,
          companyId,
          companyName: company.name,
          klientUserId: userId,
          managerUserId: vedouci?.id ?? null,
          projectType: typProjektu?.name ?? null,
          pageCount,
          // Hlavni herec = prvni v seznamu, stejne jako u rucne zalozeneho
          // projektu.
          actorUserId: herciIds[0] ?? null,
          ...(herciIds.length > 0 ? { herci: { connect: herciIds.map((id) => ({ id })) } } : {}),
          narrator: zbylaJmena.length > 0 ? zbylaJmena.join(', ') : null,
          driveUrl,
          statusName: STAVY_PROJEKTU[0].nazev,
          priority: 'MEDIUM',
          zdroj: 'PORTAL',
          // Úvod a závěr z objednávky (22. 9. 2026) - v detailu jdou upravit.
          // Požadované datum z objednávky = datum dokončení projektu
          // (22. 9. 2026: „v projektu se nastavilo 22. 9., mělo se propsat
          // 17. 11."). Den se drží jako půlnoc UTC, stejně jako v detailu.
          endDate: parsed.data.deadline && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.deadline)
            ? new Date(`${parsed.data.deadline}T00:00:00.000Z`)
            : null,
          uvodKnihy: knihaUdaje.uvodKnihy,
          zaverKnihy: knihaUdaje.zaverKnihy,
        },
      });
      idProjektu = caflouProjectId;
      await prisma.order.update({
        where: { id: order.id },
        data: { caflouProjectId, caflouSyncStatus: 'OK' },
      });

      /**
       * VÝSTUPY Z OBJEDNÁVKY (zadání 26. 9. 2026). Zakládají se jako NÁVRH -
       * produkce je v záložce Výstupy potvrdí nebo upraví (rozhodnutí téhož
       * dne: „klient navrhne, produkce potvrdí"). Typ se bere z typu
       * projektu; podle něj se pak pozná, ke kterému výstupu se dělá rodný
       * list.
       */
      if (vystupyObjednavky.length > 0) {
        await zalozVystupyZObjednavky(caflouProjectId, vystupyObjednavky, typProjektu?.name ?? null);
      }

      /**
       * NABÍDKA ROVNOU Z OBJEDNÁVKY (zadání 25. 9. 2026: „potřebuji, aby se
       * rovnou z objednávek audioknih z portálu, co přijdou od klienta,
       * vygenerovala nabídka"). Jedna položka „Natáčení a postprodukce
       * audioknihy" a cena z objednávky; doklad je rozpracovaný, takže
       * klientovi nic neodejde, dokud ho někdo neodešle.
       */
      try {
        const { zalozNabidkuZObjednavky } = await import('@/lib/nabidkaZObjednavky');
        await zalozNabidkuZObjednavky(caflouProjectId, title);
      } catch (err) {
        console.error('Nabidku z objednavky se nepodarilo zalozit:', err);
      }

      /**
       * PŘÍLOHA DO SLOŽKY PROJEKTU (zadání 22. 9. 2026). Až teď, když projekt
       * i složka existují; výsledek (nebo důvod selhání) se zapíše
       * k objednávce a je vidět v detailu projektu.
       */
      if (attachment && driveUrl) {
        await nahrajPrilohuObjednavkyNaDisk(order.id);
      }

      /**
       * KANAL V CHATU (zadani 15. 9. 2026: „mela by se zalozit slozka podle
       * nazvu a kanal"). Kanaly projektu vidi cely tym; clenem je od zacatku
       * manazer, aby mu v nem chodila upozorneni bez toho, ze by ho musel
       * nejdriv otevrit.
       */
      const zakladatel = vedouci?.id ?? null;
      if (zakladatel) {
        await zalozKanalProjektu({
          caflouProjectId,
          nazev: title,
          zakladatelId: zakladatel,
          managerUserId: zakladatel,
        });
      }

      void zapisZalozeniProjektu(caflouProjectId, title, {
        id: userId,
        jmeno: orderingUser?.name ?? session.user.email,
      }).catch(() => undefined);
    } catch (err) {
      console.error('Projekt k objednavce se nepodarilo zalozit:', err);
      await prisma.order
        .update({
          where: { id: order.id },
          data: {
            caflouSyncStatus: 'ERROR',
            caflouSyncError: err instanceof Error ? err.message.slice(0, 300) : 'Neznámá chyba.',
          },
        })
        .catch(() => undefined);
    }
  }

  // 3) E-mail timu Mediaspace - AZ TED, KDYZ PROJEKT EXISTUJE (zadani
  //    23. 9. 2026: „tlacitko otevrit firmu bych zmenil na Otevrit
  //    v projektech a dostal se na detail toho projektu"). Odkaz do projektu
  //    jinak neni na co navazat - driv se mail posilal driv, nez projekt
  //    vznikl.
  //
  //    Best effort: neodeslany mail nikdy neshodi prijatou objednavku.
  //
  //    Komu presne, se od 14. 9. 2026 ridi zaskrtnutkem "Dostava objednavky"
  //    na karte uzivatele (zadani: "jednotlive adresy uzivatelu tymu, ktere
  //    si nastavim na webu v portalu"), ne promennou prostredi. Nacita se to
  //    az tady a ne v e-mailove vrstve, aby lib/email.ts nesahal do databaze.
  /**
   * Komu objednavka jde. Zaskrtnuti „Dostava objednavky" na karte uzivatele;
   * kdyz to nema nikdo, vezmou se vsichni Zuzo-labuzo, at objednavka nespadne
   * do prazdna (zadani 15. 9. 2026: „ten mail objednavky@mediaspace.cz bych
   * nakonec vynechal a neposilal" - spolecna schranka uz nikde neni).
   */
  let hlidaci: { id: string; email: string; role: Role }[] = [];
  try {
    hlidaci = await prisma.user.findMany({
      where: { active: true, dostavaObjednavky: true },
      // Role rozhoduje, jestli se v mailu ukaze predbezna cena (zadani
      // 16. 9. 2026) - viz vidiCenuObjednavky v lib/roles.ts.
      select: { id: true, email: true, role: true },
    });
    if (hlidaci.length === 0) {
      hlidaci = await prisma.user.findMany({
        where: { active: true, role: 'ADMIN' },
        select: { id: true, email: true, role: true },
      });
      console.warn(
        `Objednávka „${title}": nikdo nemá zaškrtnuté „Dostává objednávky", posílám všem adminům.`,
      );
    }
  } catch (err) {
    console.error('Seznam příjemců objednávky se nepodařilo načíst:', err);
  }

  try {
    /**
     * DVA MAILY, NE JEDEN (zadani 16. 9. 2026: „Helca, ktera ma pristup
     * Produkce, by nemela videt cenu. Jen normostrany").
     *
     * Do ted sla objednavka vsem jednou zpravou vcetne predbezne ceny. Jedna
     * zprava ale nejde rozdelit podle toho, kdo ji cte - komu cena nepatri,
     * musi dostat jinou. Obsah je jinak uplne stejny: rozsah, termin, herec,
     * poznamka i priloha zustavaji, vypadne jedina radka.
     */
    const sCenou = hlidaci.filter((u) => vidiCenuObjednavky(u.role)).map((u) => u.email);
    const bezCeny = hlidaci.filter((u) => !vidiCenuObjednavky(u.role)).map((u) => u.email);

    const spolecne = {
      companyId,
      companyName: company.name,
      title,
      pageCount,
      priceEstimate,
      deadline: deadline ? deadline.toLocaleDateString('cs-CZ') : null,
      preferredNarrator,
      // Úvod a závěr audioknihy jdou týmu do mailu k poznámce (22. 9. 2026).
      note:
        [
          // Co si klient u reklamy objednal - do mailu hned nahoru (25. 9. 2026).
          // Co se má vyrobit - po výstupech, když je klient vyplnil
          // (26. 9. 2026); jinak souhrn služeb jako dřív.
          vystupyObjednavky.length > 0
            ? `Co vyrobit:\n${vystupyObjednavky
                .map((v) => `• ${popisVystupuObjednavky(v, nazvySluzeb(v.sluzby))}`)
                .join('\n')}`
            : sluzbyKlice.length > 0
              ? `Objednané služby: ${nazvySluzeb(sluzbyKlice).join(', ')}`
              : null,
          note || null,
          knihaUdaje.uvodKnihy ? `Úvod: ${knihaUdaje.uvodKnihy}` : null,
          knihaUdaje.zaverKnihy ? `Závěr: ${knihaUdaje.zaverKnihy}` : null,
        ]
          .filter(Boolean)
          .join('\n\n') || null,
      // Odkaz přes portál, ne rovnou do úložiště - to je soukromé a přímý
      // odkaz končil „Access denied" (22. 9. 2026).
      attachmentUrl: attachment ? `${zakladPortalu()}/api/orders/${order.id}/priloha` : null,
      attachmentName: attachment?.name ?? null,
      requestedByName: orderingUser?.name ?? null,
      requestedByEmail: session.user.email,
      // Tlacitko v mailu vede do projektu (23. 9. 2026); kdyz projekt
      // nevznikl, zustane v nem puvodni odkaz na firmu v administraci.
      projectId: idProjektu,
    };

    const vysledky = await Promise.all([
      sCenou.length
        ? sendOrderNotificationEmail({ ...spolecne, prijemci: sCenou })
        : Promise.resolve({ sent: false as const }),
      bezCeny.length
        ? sendOrderNotificationEmail({ ...spolecne, prijemci: bezCeny, bezCeny: true })
        : Promise.resolve({ sent: false as const }),
    ]);

    if (vysledky.some((v) => v.sent)) {
      await prisma.order.update({ where: { id: order.id }, data: { emailSentAt: new Date() } });
    }
  } catch (err) {
    console.error('Odeslání e-mailu o objednávce selhalo:', err);
  }


  // 2b) Potvrzeni klientovi (zadani 5. 9. 2026) - opet best effort, aby
  //     neodeslany e-mail nikdy neshodil samotnou objednavku.
  try {
    await sendOrderConfirmationEmail({
      to: session.user.email,
      name: orderingUser?.name ?? null,
      isAudiobook,
      title,
      companyName: company.name,
      pageCount,
      priceEstimate,
      deadline: deadline ? deadline.toLocaleDateString('cs-CZ') : null,
      preferredNarrator,
      note: note || null,
      attachmentName: attachment?.name ?? null,
    });
  } catch (err) {
    console.error('Odeslání potvrzení objednávky klientovi selhalo:', err);
  }

  /**
   * Zvonecek v liste (zadani 15. 9. 2026: „mailem i zvoneckem"). Mail se da
   * prehlednout mezi stovkou jinych; zvonek pocka, nez clovek portal otevre,
   * a vede rovnou do zalozeneho projektu.
   */
  void notifyMany(
    hlidaci.map((u) => u.id),
    {
      kind: 'objednavka',
      title: isAudiobook ? `Nová objednávka audioknihy — ${title}` : `Nová objednávka — ${title}`,
      body: [
        company.name,
        pageCount ? `${pageCount} NS` : null,
        deadline ? `do ${deadline.toLocaleDateString('cs-CZ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      url: idProjektu ? `/projekty/${idProjektu}` : '/projekty',
    },
  ).catch(() => undefined);

  return NextResponse.json(
    {
      id: order.id,
      // Formulare tuhle hlasku vypisou, at je jasne, ze soubor nedorazil a
      // ma se poslat jinak.
      varovani: prilohaSelhala
        ? `Objednávka je uložená, ale přílohu ${prilohaSelhala} se nepodařilo uložit. Pošlete ji prosím e-mailem.`
        : undefined,
    },
    { status: 201 },
  );
}
