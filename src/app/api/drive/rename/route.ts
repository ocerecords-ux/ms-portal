import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, isWithinRoot, renameDriveItem } from '@/lib/googleDrive';
import { slozkaProUzivatele } from '@/lib/diskoveSlozkyServer';

// Prejmenovani souboru/slozky v sekci Nahravky (zadani 5. 9. 2026).
// Tenant izolace: korenova slozka se bere z firmy ze SESSION a prejmenovat
// jde jen polozku, ktera lezi uvnitr ni.
//
// ZAMERNE NEPOUZIVA korenProZadost (30. 9. 2026): ten pousti dovnitr i podle
// tokenu z mailu, ktery nikoho neprihlasuje. Cist tak smi kdokoliv s odkazem,
// ale prejmenovavat ne - tady musi byt clovek prihlaseny.
const schema = z.object({
  fileId: z.string().trim().min(5),
  name: z.string().trim().min(1, 'Název nesmí být prázdný.').max(300),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    // Prejmenovava se bud ve slozce firmy, nebo v pridelene slozce z portalu
    // (30. 9. 2026) - podle toho, co ma clovek prave otevrene.
    const slozkaId = req.nextUrl.searchParams.get('slozka');
    let rootId: string | null = null;
    if (slozkaId) {
      const slozka = await slozkaProUzivatele(session.user.id, slozkaId);
      if (!slozka) {
        return NextResponse.json({ error: 'K této složce nemáte přístup.' }, { status: 403 });
      }
      rootId = slozka.rootId;
    } else {
      if (!session.user.companyId) {
        return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
      }
      const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
      rootId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;
      if (!rootId) {
        return NextResponse.json({ error: 'Firmě není přiřazena složka na Google Disku.' }, { status: 404 });
      }
    }

    const token = await getAccessToken();
    if (!token) {
      return NextResponse.json({ error: 'Napojení na Google Disk zatím není nastavené.' }, { status: 503 });
    }

    const allowed = await isWithinRoot(parsed.data.fileId, rootId, token);
    if (!allowed) {
      return NextResponse.json({ error: 'K tomuto souboru nemáte přístup.' }, { status: 403 });
    }

    const renamed = await renameDriveItem(parsed.data.fileId, parsed.data.name, token);
    if (!renamed) {
      return NextResponse.json({ error: 'Přejmenování se nezdařilo.' }, { status: 502 });
    }
    return NextResponse.json(renamed);
  } catch (err) {
    console.error('POST /api/drive/rename selhalo:', err);
    return NextResponse.json({ error: 'Přejmenování se nezdařilo.' }, { status: 500 });
  }
}
