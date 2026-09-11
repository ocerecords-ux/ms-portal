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

  // 2) E-mail na objednavky@mediaspace.cz - best effort, nezablokuje objednavku.
  try {
    const result = await sendOrderNotificationEmail({
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
  if (isAudiobook) {
    try {
      const caflouProjectId = noveIdProjektu();
      await prisma.projectMeta.create({
        data: {
          caflouProjectId,
          name: title,
          companyId,
          companyName: company.name,
          klientUserId: userId,
          pageCount,
          narrator: preferredNarrator,
          statusName: STAVY_PROJEKTU[0].nazev,
          priority: 'MEDIUM',
          zdroj: 'PORTAL',
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { caflouProjectId, caflouSyncStatus: 'OK' },
      });
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
