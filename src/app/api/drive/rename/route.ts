import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, isWithinRoot, renameDriveItem } from '@/lib/googleDrive';

// Prejmenovani souboru/slozky v sekci Nahravky (zadani 5. 9. 2026).
// Tenant izolace: korenova slozka se bere z firmy ze SESSION a prejmenovat
// jde jen polozku, ktera lezi uvnitr ni.
const schema = z.object({
  fileId: z.string().trim().min(5),
  name: z.string().trim().min(1, 'Název nesmí být prázdný.').max(300),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.companyId) {
      return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { id: session.user.companyId } });
    const rootId = company?.driveFolderUrl ? extractDriveFolderId(company.driveFolderUrl) : null;
    if (!rootId) {
      return NextResponse.json({ error: 'Firmě není přiřazena složka na Google Disku.' }, { status: 404 });
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
