import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePrice } from '@/lib/price';
import { adresaVUlozisti, klicZAdresyUloziste, overPrilohu, stahniZUloziste, uploadOrderAttachment } from '@/lib/storage';
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from '@/lib/email';
import { noveIdProjektu } from '@/lib/projektId';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { zalozKanalProjektu } from '@/lib/kanalProjektuServer';
import { zapisZalozeniProjektu } from '@/lib/projektLogServer';
import { nahrajSouborDoSlozky, vytvorSlozkuProjektu } from '@/lib/googleDrive';
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
  deadline: z.string().optional(),
  note: z.string().optional(),
  preferredNarrator: z.string().optional(),
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
    deadline: formData.get('deadline'),
    note: formData.get('note'),
    preferredNarrator: formData.get('preferredNarrator'),
    autorKnihy: formData.get('autorKnihy') ?? undefined,
    prekladatelKnihy: formData.get('prekladatelKnihy') ?? undefined,
    nakladatelstviKnihy: formData.get('nakladatelstviKnihy') ?? undefined,
    uvodKnihy: formData.get('uvodKnihy') ?? undefined,
    zaverKnihy: formData.get('zaverKnihy') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { kind, title, note } = parsed.data;
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
  if (isAudiobook && company.ratePerPage == null) {
    return NextResponse.json({ error: 'Vaší firmě zatím není nastavená sazba za normostranu.' }, { status: 400 });
  }

  const priceEstimate = isAudiobook ? calculatePrice(pageCount, company.ratePerPage ?? 0) : null;

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

  // 2) E-mail timu Mediaspace - best effort, nezablokuje objednavku.
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
          note || null,
          knihaUdaje.uvodKnihy ? `Úvod: ${knihaUdaje.uvodKnihy}` : null,
          knihaUdaje.zaverKnihy ? `Závěr: ${knihaUdaje.zaverKnihy}` : null,
        ]
          .filter(Boolean)
          .join('\n\n') || null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      requestedByName: orderingUser?.name ?? null,
      requestedByEmail: session.user.email,
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

  // 3) Zalozeni projektu V PORTALU (zadani 9. 9. 2026: "Caflou casem nebudeme
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
          /**
           * PŘÍLOHA DO SLOŽKY (zadání 22. 9. 2026: „když přijde objednávka
           * audioknihy a někdo vloží PDF, tak se sice udělá nová složka, ale
           * PDF se tam neuloží"). Soubor leží v našem úložišti - stáhne se
           * a nahraje do nové složky. Best effort: v úložišti zůstává
           * a odkaz v mailu na něj vede dál.
           */
          if (attachment) {
            const klicPrilohy = klicZAdresyUloziste(attachment.url);
            const soubor = klicPrilohy ? await stahniZUloziste(klicPrilohy) : null;
            if (!soubor) {
              console.error(`Přílohu objednávky „${attachment.name}" se nepodařilo stáhnout z úložiště pro Disk.`);
            } else {
              const nahrano = await nahrajSouborDoSlozky(vysledek.id, attachment.name, soubor.bytes, soubor.mime);
              if (!nahrano.ok) console.error(`Příloha „${attachment.name}" na Disk: ${nahrano.duvod}`);
            }
          }
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
