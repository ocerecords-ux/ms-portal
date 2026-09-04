import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculatePrice } from '@/lib/price';
import { uploadOrderAttachment } from '@/lib/storage';
import { sendOrderNotificationEmail } from '@/lib/email';
import { createCaflouProject } from '@/lib/caflou';

const orderSchema = z.object({
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
    title: formData.get('title'),
    pageCount: formData.get('pageCount'),
    deadline: formData.get('deadline'),
    note: formData.get('note'),
    preferredNarrator: formData.get('preferredNarrator'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }
  const { title, note } = parsed.data;
  const preferredNarrator = parsed.data.preferredNarrator?.trim() || null;
  const pageCount = parsed.data.pageCount ? parseInt(parsed.data.pageCount, 10) : null;
  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;

  const [company, orderingUser] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { caflouTag: true } }),
  ]);
  if (!company) {
    return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });
  }

  const priceEstimate = calculatePrice(pageCount, company.ratePerPage);

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
      title,
      pageCount,
      ratePerPageSnapshot: company.ratePerPage,
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
      companyName: company.name,
      title,
      pageCount,
      priceEstimate,
      deadline: deadline ? deadline.toLocaleDateString('cs-CZ') : null,
      note: note || null,
      attachmentUrl: attachment?.url ?? null,
      requestedByEmail: session.user.email,
    });
    if (result.sent) {
      await prisma.order.update({ where: { id: order.id }, data: { emailSentAt: new Date() } });
    }
  } catch (err) {
    console.error('Odeslání e-mailu o objednávce selhalo:', err);
  }

  // 3) Zalozeni projektu v Caflou (nazev, stitek OSOBY co objednala, pocet
  //    normostran) - take best effort. Stitek je zamerne u uzivatele, ne u
  //    firmy: rozlisuje v Caflou, ktery projekt patri ktere konkretni osobe,
  //    i kdyz vice lidi objednava pod stejnou firmou. Stav se uklada
  //    k objednavce pro dohledani v adminu.
  if (orderingUser?.caflouTag) {
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
