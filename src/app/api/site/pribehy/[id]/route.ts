import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import {
  smazPribeh,
  smiPoslatPribeh,
  upravKoncept,
  vyridPribeh,
  vyvesPribehNaInstagram,
} from '@/lib/pribehyServer';
import { MAX_POPISEK } from '@/lib/pribehy';
import { adresaVUlozisti, overPrilohu } from '@/lib/storage';

/**
 * VYŘÍZENÍ PŘÍBĚHU (zadání 6. 10. 2026).
 *
 * PATCH vyvěsí nebo zamítne - smí jen ten, kdo má zaškrtnuté Schvaluje
 * a vyvěšuje příběhy. DELETE je stažení z fronty: autor může, dokud se nikdo
 * nerozhodl; schvalovatel kdykoli.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * Vyvěšení videa není hned hotové - Meta ho nejdřív zpracuje a portál na to
 * čeká (viz pockejNaZpracovani). Výchozích deset sekund na to nestačí.
 */
export const maxDuration = 60;

const schema = z.object({
  stav: z.enum(['VYVESENO', 'ZAMITNUTO', 'KONCEPT']),
  vzkaz: z.string().max(2000).optional(),
  /**
   * `pres: 'API'` znamená „vyvěs to ty" - portál příběh pošle na Instagram
   * sám. Bez toho je to jen poznámka, že to někdo vyvěsil rukou.
   */
  pres: z.enum(['API']).optional(),
  /** Úprava rozdělaného konceptu - text, podoba textu, případně jiný soubor. */
  popisek: z.string().max(MAX_POPISEK).optional(),
  textStyl: z.unknown().optional(),
  klic: z.string().trim().max(512).optional(),
  nazevSouboru: z.string().trim().max(255).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const kdo = { id: session.user.id, role: session.user.role };
  // Od 6. 10. 2026 se neschvaluje - vyvěsit smí každý, kdo smí posílat.
  if (!(await smiPoslatPribeh(kdo))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Neplatná volba.' }, { status: 400 });
  }

  /** Uložení rozdělaného konceptu - text, podoba textu, případně jiná fotka. */
  if (parsed.data.stav === 'KONCEPT') {
    const zmena: Parameters<typeof upravKoncept>[2] = {
      popisek: parsed.data.popisek,
      textStyl: parsed.data.textStyl,
    };
    if (parsed.data.klic) {
      // Vyměněná fotka: ověří se v úložišti, ne podle toho, co hlásí prohlížeč.
      const soubor = await overPrilohu(parsed.data.klic);
      const url = soubor ? adresaVUlozisti(parsed.data.klic) : null;
      if (!soubor || !url) {
        return NextResponse.json({ error: 'Soubor se do úložiště nedostal.' }, { status: 400 });
      }
      zmena.url = url;
      zmena.typSouboru = soubor.mime;
      zmena.velikost = soubor.size;
      if (parsed.data.nazevSouboru) zmena.nazevSouboru = parsed.data.nazevSouboru;
    }
    const koncept = await upravKoncept(kdo, params.id, zmena);
    if (!koncept) return NextResponse.json({ error: 'Koncept už upravit nejde.' }, { status: 409 });
    return NextResponse.json({ pribeh: koncept });
  }

  if (parsed.data.pres === 'API' && parsed.data.stav === 'VYVESENO') {
    const vysledek = await vyvesPribehNaInstagram(kdo, params.id);
    if (!vysledek.ok) return NextResponse.json({ error: vysledek.chyba }, { status: 502 });
    return NextResponse.json({ pribeh: vysledek.pribeh });
  }

  const pribeh = await vyridPribeh(kdo, params.id, parsed.data.stav, parsed.data.vzkaz ?? null);
  if (!pribeh) {
    return NextResponse.json({ error: 'Tenhle příběh už někdo vyřídil.' }, { status: 409 });
  }
  return NextResponse.json({ pribeh });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const ok = await smazPribeh({ id: session.user.id, role: session.user.role }, params.id);
  if (!ok) return NextResponse.json({ error: 'Příběh už stáhnout nejde.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
