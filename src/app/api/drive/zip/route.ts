import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractDriveFolderId, getAccessToken, getFolderInfo, isWithinRoot, listFolder } from '@/lib/googleDrive';

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

// --- ZIP zapisovac (bez zavislosti, metoda "store") ------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc: number, chunk: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < chunk.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ chunk[i]) & 0xff];
  }
  return c >>> 0;
}

/** Cas v ZIPu se drzi ve starem DOS formatu (2 bajty datum, 2 bajty cas). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

type Written = {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

function u8(length: number): { buf: Uint8Array; view: DataView } {
  const buf = new Uint8Array(length);
  return { buf, view: new DataView(buf.buffer) };
}

function localHeader(nameBytes: Uint8Array, time: number, date: number): Uint8Array {
  const { buf, view } = u8(30 + nameBytes.length);
  view.setUint32(0, 0x04034b50, true); // podpis
  view.setUint16(4, 20, true); // potrebna verze
  view.setUint16(6, 0x0808, true); // bit 3 = velikosti az za daty, bit 11 = UTF-8 nazvy
  view.setUint16(8, 0, true); // metoda: store
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, 0, true); // CRC doplnime v data descriptoru
  view.setUint32(18, 0, true);
  view.setUint32(22, 0, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  buf.set(nameBytes, 30);
  return buf;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const { buf, view } = u8(16);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return buf;
}

function centralDirectory(entries: Written[], startOffset: number): Uint8Array {
  const parts: Uint8Array[] = [];
  let size = 0;
  for (const e of entries) {
    const { buf, view } = u8(46 + e.nameBytes.length);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true); // verze zapisovace
    view.setUint16(6, 20, true); // potrebna verze
    view.setUint16(8, 0x0808, true);
    view.setUint16(10, 0, true); // store
    view.setUint16(12, e.time, true);
    view.setUint16(14, e.date, true);
    view.setUint32(16, e.crc, true);
    view.setUint32(20, e.size, true);
    view.setUint32(24, e.size, true);
    view.setUint16(28, e.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, e.offset, true);
    buf.set(e.nameBytes, 46);
    parts.push(buf);
    size += buf.length;
  }

  const { buf: end, view: endView } = u8(22);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, size, true);
  endView.setUint32(16, startOffset, true);
  endView.setUint16(20, 0, true);
  parts.push(end);

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Nazvy v archivu musí být unikátní - Disk klidně povolí dva stejné. */
function uniqueName(used: Set<string>, name: string): string {
  const clean = name.normalize('NFC').replace(/[/\\]/g, '-');
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

// --- Route -----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.companyId) {
    return NextResponse.json({ error: 'Nejste přihlášen k žádné firmě.' }, { status: 401 });
  }

  const folderId = req.nextUrl.searchParams.get('folderId');
  if (!folderId) {
    return NextResponse.json({ error: 'Chybí ID složky.' }, { status: 400 });
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

  const encoder = new TextEncoder();
  const used = new Set<string>();
  const plan = files.map((f) => ({ ...f, zipName: uniqueName(used, f.name) }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const entries: Written[] = [];
        let offset = 0;

        for (const file of plan) {
          const nameBytes = encoder.encode(file.zipName);
          const modified = new Date(file.modifiedTime);
          const { time, date } = dosDateTime(Number.isNaN(modified.getTime()) ? new Date() : modified);

          const header = localHeader(nameBytes, time, date);
          controller.enqueue(header);
          const entryOffset = offset;
          offset += header.length;

          const driveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
          );
          if (!driveRes.ok || !driveRes.body) {
            throw new Error(`Stažení souboru ${file.name} z Disku selhalo (${driveRes.status}).`);
          }

          let crc = 0xffffffff;
          let size = 0;
          const reader = driveRes.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            crc = crc32Update(crc, value);
            size += value.length;
            controller.enqueue(value);
          }
          crc = (crc ^ 0xffffffff) >>> 0;
          offset += size;

          const descriptor = dataDescriptor(crc, size);
          controller.enqueue(descriptor);
          offset += descriptor.length;

          entries.push({ nameBytes, crc, size, offset: entryOffset, time, date });
        }

        controller.enqueue(centralDirectory(entries, offset));
        controller.close();
      } catch (err) {
        console.error('Sestaveni ZIPu selhalo:', err);
        controller.error(err);
      }
    },
  });

  const folderName = (info?.name || 'nahravky').normalize('NFC');
  const zipName = `${folderName}.zip`;
  const asciiFallback = zipName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      'Cache-Control': 'no-store',
    },
  });
}
