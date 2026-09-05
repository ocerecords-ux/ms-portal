import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePrice } from '@/lib/price';
import { uploadOrderAttachment } from '@/lib/storage';
import { sendOrderNotificationEmail } from '@/lib/email';
import { createCaflouProject } from '@/lib/caflou';

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
    prisma.user.findUnique({ where: { id: userId }, select: { caflouTag: true, name: true } }),
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

  let attachment: { url: string; name: string } | null = null;
  const file = formData.get('attachment');
  if (file instanceof File && file.size > 0) {
    attachment = await uploadOrderAttachment(file, companyId);
  }

  // 1) Objednavka a navazany projekt se ulozi VZDY - tohle je zdroj pravdy,
  //    nezavisly na tom, jestli se pozdeji povede e-mail nebo Caflou.
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

  // 3) Zalozeni projektu v Caflou (nazev, stitek OSOBY co objednala, pocet
  //    normostran) - take best effort, a zatim jen pro objednavky audioknihy
  //    (u reklamy normostrany/cena zatim nedavaji smysl - viz vyse). Stitek
  //    je zamerne u uzivatele, ne u firmy: rozlisuje v Caflou, ktery projekt
  //    patri ktere konkretni osobe, i kdyz vice lidi objednava pod stejnou
  //    firmou. Stav se uklada k objednavce pro dohledani v adminu.
  if (isAudiobook && orderingUser?.caflouTag) {
    const caflouResult = await createCaflouProject({
      projectName: title,
      clientTag: orderingUser.caflouTag,
      pageCount,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: caflouResult.ok
        ? { caflouProjectId: caflouResult.caflouProjectId, caflouSyncStatus: 'OK' }
        : { caflouSyncStatus: caflouResult.error === 'CAFLOU_NOT_CONFIGURED' ? 'SKIPPED' : 'ERROR', caflouSyncError: caflouResult.error },
    });
  }

  return NextResponse.json({ id: order.id }, { status: 201 });
}
