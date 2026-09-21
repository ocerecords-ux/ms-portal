import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import {
  dnesniDenPraha,
  minulyMesic,
  nactiNastaveniPrehledu,
  rozesliMesicniPrehledy,
} from '@/lib/mesicniPrehledServer';

/**
 * Měsíční rozeslání přehledu výkazů (zadání 15. 9. 2026). Vercel Cron to
 * pouští KAŽDÝ DEN (vercel.json) a tady se rozhodne, jestli už je den
 * nastavený v Přehledy → Zvukaři (zadání 21. 9. 2026: „abych mohl nastavit,
 * kdy jim to chodí"). Od toho dne dál se zkouší každý den - kdyby úloha jeden
 * den neproběhla, přehled odejde další den; co už odešlo, se neopakuje.
 *
 * KDO SEM SMÍ: úloha z Vercelu (nese `Authorization: Bearer CRON_SECRET`),
 * nebo přihlášené Žůžo-labůžo, když chce rozeslání spustit ručně. Když
 * CRON_SECRET nastavený není, pustí se jen ruční spuštění — otevřená adresa,
 * která rozesílá maily, je zbytečná díra.
 *
 * `?mesic=2026-08` dovolí doslat přehled za starší měsíc; bez něj se bere
 * měsíc minulý. Co už jednou odešlo, se neopakuje.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 'cron' = úloha z Vercelu, 'admin' = ruční spuštění, null = nikdo. */
async function kdoVola(req: NextRequest): Promise<'cron' | 'admin' | null> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi && req.headers.get('authorization') === `Bearer ${tajemstvi}`) return 'cron';
  return (await requireAdmin()) ? 'admin' : null;
}

async function spust(req: NextRequest) {
  const kdo = await kdoVola(req);
  if (!kdo) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const zadany = req.nextUrl.searchParams.get('mesic');
  const mesic = zadany && /^\d{4}-\d{2}$/.test(zadany) ? zadany : minulyMesic();

  // Úloha z Vercelu běží denně - před nastaveným dnem nic nedělá.
  if (kdo === 'cron' && !zadany) {
    const { den } = await nactiNastaveniPrehledu();
    if (dnesniDenPraha() < den) return NextResponse.json({ ok: true, ceka: true, den });
  }

  try {
    const vysledek = await rozesliMesicniPrehledy(mesic);
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Rozeslání měsíčních přehledů selhalo:', err);
    return NextResponse.json({ error: 'Rozeslání se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
