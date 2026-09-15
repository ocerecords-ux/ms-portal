import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePrice } from '@/lib/price';
import { uploadOrderAttachment } from '@/lib/storage';
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from '@/lib/email';
import { noveIdProjektu } from '@/lib/projektId';
import { STAVY_PROJEKTU } from '@/lib/stavyProjektu';
import { zapisZalozeniProjektu } from '@/lib/projektLogServer';
import { vytvorSlozkuProjektu } from '@/lib/googleDrive';
import { bezTitulu } from '@/lib/jmena';
import { notifyMany } from '@/lib/notifications';

// Druh objednavky (zadani 12. 9. 2026 - viz OrderKind ve schema.prisma).
// AUDIOBOOK je vychozi a zachovava puvodni chovani (normostrany, cena,
// Caflou projekt); AD je zatim jen zakladni ulozeni objednavky - zbytek
// (jaka pole presne, Caflou napojeni apod.) se upresni pozdeji.
const ORDER_KINDS = ['AUDIOBOOK', 'AD'] as const;

const orderSchema = z.object({
  kind: z.enum(ORDER_KINDS).default('AUDIOBOOK'),
  title: z.string().trim().min(1, 'Název je povinný.'),
  pageCount: z.string().optional(),
  deadline: z.string().optional(),
  note: z.string().optional(),
  preferredNarrator: z.string().optional(),
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
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { kind, title, note } = parsed.data;
  const isAudiobook = kind === 'AUDIOBOOK';
  const preferredNarrator = parsed.data.preferredNarrator?.trim() || null;
  const pageCount = isAudiobook && parsed.data.pageCount ? parseInt(parsed.data.pageCount, 10) : null;
  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;

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
  const file = formData.get('attachment');
  if (file instanceof File && file.size > 0) {
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
  let hlidaci: { id: string; email: string }[] = [];
  try {
    hlidaci = await prisma.user.findMany({
      where: { active: true, dostavaObjednavky: true },
      select: { id: true, email: true },
    });
    if (hlidaci.length === 0) {
      hlidaci = await prisma.user.findMany({
        where: { active: true, role: 'ADMIN' },
        select: { id: true, email: true },
      });
      console.warn(
        `Objednávka „${title}": nikdo nemá zaškrtnuté „Dostává objednávky", posílám všem adminům.`,
      );
    }
  } catch (err) {
    console.error('Seznam příjemců objednávky se nepodařilo načíst:', err);
  }

  try {
    const prijemci = hlidaci.map((u) => u.email);

    const result = await sendOrderNotificationEmail({
      prijemci,
      companyId,
      companyName: company.name,
      title,
      pageCount,
      priceEstimate,
      deadline: deadline ? deadline.toLocaleDateString('cs-CZ') : null,
      preferredNarrator,
      note: note || null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      requestedByName: orderingUser?.name ?? null,
      requestedByEmail: session.user.email,
    });
    if (result.sent) {
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
        else driveUrl = vysledek.url;
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
        await prisma.conversation
          .create({
            data: {
              kind: 'PROJEKT',
              name: title,
              caflouProjectId,
              createdById: zakladatel,
              members: { create: { userId: zakladatel } },
            },
          })
          .catch((err) => console.error('Kanál k objednávce se nepodařilo založit:', err));
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
