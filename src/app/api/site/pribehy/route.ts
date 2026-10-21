import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { odpovedChyby, odpovedChybyS } from '@/lib/chybyApi';
import { authOptions } from '@/lib/auth';
import {
  nactiPribehy,
  smiPoslatPribeh,
  vyvesPribehNaInstagram,
  zalozPribeh,
} from '@/lib/pribehyServer';
import { MAX_POPISEK, POVOLENE_TYPY, maxProTyp } from '@/lib/pribehy';
import { adresaVUlozisti, overPrilohu } from '@/lib/storage';

/**
 * FRONTA PŘÍBĚHŮ (zadání 6. 10. 2026).
 *
 * GET vrátí frontu - schvalovateli celou, ostatním jen jejich vlastní.
 * POST zapíše příběh K SOUBORU, KTERÝ UŽ LEŽÍ V ÚLOŽIŠTI: prohlížeč si
 * předtím vyžádal podepsanou adresu (/api/site/pribehy/podpis) a nahrál ho
 * tam sám. Velikost a typ se čtou z úložiště, ne z toho, co hlásí prohlížeč.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Vyvěšení jde rovnou z téhle routy a u videa se čeká na zpracování. */
export const maxDuration = 60;

const schema = z.object({
  klic: z.string().trim().min(1).max(512),
  nazevSouboru: z.string().trim().min(1).max(255),
  popisek: z.string().max(MAX_POPISEK).optional(),
  /** Podoba textu - drží se jen u konceptu, viz lib/pribehText.ts. */
  textStyl: z.unknown().optional(),
  /**
   * KONCEPT se jen uloží. Bez něj jde příběh rovnou na Instagram - od
   * 6. 10. 2026 se neschvaluje („nemusíme to nechávat schvalovat, všichni
   * z týmu by měli mít možnost to tam dát").
   */
  stav: z.enum(['KONCEPT', 'HNED']).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const kdo = { id: session.user.id, role: session.user.role };
  return NextResponse.json({ pribehy: await nactiPribehy(kdo) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const kdo = { id: session.user.id, role: session.user.role };
  if (!(await smiPoslatPribeh(kdo))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return odpovedChyby('chybaApi.neplatnyPribeh', 400);
  }
  const { klic, nazevSouboru, popisek } = parsed.data;

  // Ověření v úložišti, ne důvěra prohlížeči: klíč mohl zůstat nenahraný.
  const soubor = await overPrilohu(klic);
  if (!soubor) {
    return odpovedChyby('chybaApi.souborNedoselZnovu', 400);
  }
  if (!POVOLENE_TYPY.includes(soubor.mime)) {
    return odpovedChyby('chybaApi.instagramTypy', 400);
  }
  const strop = maxProTyp(soubor.mime);
  if (soubor.size > strop) {
    // Celé MB schválně - číslo bez desetinné čárky se čte stejně v obou
    // jazycích a routa neví, kdo se ptá (dávka 7q).
    return odpovedChybyS(
      'chybaApi.souborMocVelky',
      { kolik: `${Math.floor(strop / (1024 * 1024))} MB` },
      400,
    );
  }
  const url = adresaVUlozisti(klic);
  if (!url) {
    return odpovedChyby('chybaApi.uloznisteNedostupne', 503);
  }

  const jeKoncept = parsed.data.stav === 'KONCEPT';
  const pribeh = await zalozPribeh(kdo, {
    url,
    nazevSouboru,
    typSouboru: soubor.mime,
    velikost: soubor.size,
    popisek: (popisek ?? '').trim(),
    textStyl: parsed.data.textStyl,
    stav: jeKoncept ? 'KONCEPT' : 'CEKA',
  });
  if (jeKoncept) return NextResponse.json({ pribeh });

  /**
   * ROVNOU VEN. Když Instagram odmítne, příběh ZŮSTÁVÁ v Čeká i s důvodem
   * a dá se zkusit znovu - zahodit něco, co už je nahrané, by bylo horší.
   */
  const vysledek = await vyvesPribehNaInstagram(kdo, pribeh.id);
  if (!vysledek.ok) {
    return NextResponse.json({ pribeh, chyba: vysledek.chyba }, { status: 207 });
  }
  return NextResponse.json({ pribeh: vysledek.pribeh });
}
