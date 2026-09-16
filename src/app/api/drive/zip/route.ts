import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getFolderInfo, isWithinRoot, listFolder } from '@/lib/googleDrive';
import { korenProZadost } from '@/lib/drivePristup';
import { hlavickyZipu, zipStream } from '@/lib/zip';

// "Stáhnout vše" jako jeden opravdový ZIP (zadani 5. 9. 2026 - u tlacitka
// chybelo skutecne stazeni; puvodni reseni spoustelo N samostatnych stazeni,
// coz prohlizec hlasil jako vyskakovaci okna).
//
// ZIP se sklada za behu a rovnou streamuje ven - nic se neuklada na disk ani
// nedrzi v pameti, takze projdou i velke nahravky. Soubory se do archivu
// ukladaji bez komprese (metoda "store"): mp3/wav uz komprimovane jsou, takze
// by komprese jen zdrzovala a nic neusetrila.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel: delsi nahravky potrebuji vic nez vychozich 10 s.
export const maxDuration = 300;

/** Nad tuhle velikost uz ma smysl posilat klienta na Google Disk. */
const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

// ZIP zapisovac bydli od 16. 9. 2026 v lib/zip.ts - pujcuji si ho i doklady
// (prilohy za mesic), a dve kopie by se po prvni oprave rozesly.

// --- Route -----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get('folderId');
  if (!folderId) {
    return NextResponse.json({ error: 'Chybí ID složky.' }, { status: 400 });
  }

  // Prihlaseny klient, nebo token z mailu - viz lib/drivePristup.ts.
  const koren = await korenProZadost(req);
  if ('chyba' in koren) {
    return NextResponse.json({ error: koren.chyba }, { status: koren.status });
  }
  const rootId = koren.rootId;

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Napojení na Google Disk zatím není nastavené.' }, { status: 503 });
  }

  // Tenant izolace stejne jako u vypisu a stahovani jednotlivych souboru.
  const allowed = folderId === rootId || (await isWithinRoot(folderId, rootId, token));
  if (!allowed) {
    return NextResponse.json({ error: 'K této složce nemáte přístup.' }, { status: 403 });
  }

  const [info, items] = await Promise.all([getFolderInfo(folderId, token), listFolder(folderId, token)]);

  // Do ZIPu jdou jen skutecne nahrane soubory z teto slozky. Podslozky se
  // nebalí (klient si je otevre a stahne zvlast) a Google Dokumenty nemaji
  // velikost ani primy obsah - ty se stahuji jednotlive pres export.
  const files = items.filter((i) => !i.isFolder && i.size && Number(i.size) > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: 'V této složce nejsou žádné soubory ke stažení.' }, { status: 404 });
  }

  const totalBytes = files.reduce((sum, f) => sum + Number(f.size ?? 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error:
          'Složka je na jeden ZIP moc velká (víc než 3 GB). Otevřete ji prosím tlačítkem „Odkaz na složku" přímo na Google Disku a stáhněte ji odtamtud.',
      },
      { status: 413 },
    );
  }

  // Prohlizec stahuje ZIP prostym prechodem na tuhle adresu - pripadnou chybu
  // by pak zobrazil jako holy JSON. Klient se proto nejdriv zepta s probe=1 a
  // teprve kdyz je vsechno v poradku, spusti skutecne stahovani.
  if (req.nextUrl.searchParams.get('probe') === '1') {
    return NextResponse.json({ ok: true, count: files.length, totalBytes });
  }

  const stream = zipStream(
    files.map((file) => ({
      nazev: file.name,
      datum: new Date(file.modifiedTime),
      nacti: async () => {
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        );
        if (!driveRes.ok || !driveRes.body) {
          throw new Error(`Stažení souboru ${file.name} z Disku selhalo (${driveRes.status}).`);
        }
        return driveRes.body;
      },
    })),
  );

  const folderName = info?.name || 'nahravky';
  return new NextResponse(stream, { headers: hlavickyZipu(`${folderName}.zip`) });
}
