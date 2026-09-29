import { NextRequest, NextResponse } from 'next/server';
import { smiDoBanky } from '@/lib/bankaPristup';
import { jeUlohaZVercelu } from '@/lib/cronGuard';
import { jeBankovniPostaNastavena, zkontrolujBankovniPostu } from '@/lib/bankaMailServer';

/**
 * PÁROVÁNÍ PLATEB Z UPOZORNĚNÍ BANKY (29. 9. 2026).
 *
 * Pouští to Vercel Cron každé dvě minuty - viz vercel.json. Tím se párování
 * blíží reálnému času: faktura je označená jako uhrazená dřív, než si někdo
 * všimne, že peníze přišly.
 *
 * Kdo sem smí: úloha z Vercelu s CRON_SECRET, nebo ručně ten, kdo na banku
 * vůbec vidí. Stejně to má stahování pohybů vedle.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function smiSem(req: NextRequest): Promise<boolean> {
  const tajemstvi = process.env.CRON_SECRET;
  if (tajemstvi) {
    if (req.headers.get('authorization') === `Bearer ${tajemstvi}`) return true;
  } else if (jeUlohaZVercelu(req)) {
    // Jak se uloha z Vercelu pozna, vi jen lib/cronGuard.ts (29. 9. 2026).
    return true;
  }
  return smiDoBanky();
}

export async function GET(req: NextRequest) {
  if (!(await smiSem(req))) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  // Bez přístupu do schránky se nic neděje - ať úloha neplní log chybami,
  // než se nastaví.
  if (!jeBankovniPostaNastavena()) {
    return NextResponse.json({ ok: true, preskoceno: 'Schránka s upozorněními není nastavená.' });
  }

  try {
    const vysledek = await zkontrolujBankovniPostu();
    // Chyba schránky nesmí projít jako „ok" - viz komentář u VysledekKolaPosty.
    return NextResponse.json({ ok: !vysledek.chyba, ...vysledek }, { status: vysledek.chyba ? 502 : 200 });
  } catch (err) {
    console.error('Cron banka-posta selhal:', err);
    return NextResponse.json({ error: 'Kontrola schránky se nepodařila.' }, { status: 500 });
  }
}
