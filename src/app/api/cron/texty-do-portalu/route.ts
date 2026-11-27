import { NextRequest, NextResponse } from 'next/server';

import { odpovedChyby } from '@/lib/chybyApi';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { preneseTextyDoPortalu } from '@/lib/textVPortaluServer';

/**
 * PŘENOS TEXTŮ Z DISKU DO PORTÁLU (zadání 27. 11. 2026). Po dávkách, ať se
 * vejde do času funkce; za pár běhů má portál texty všech aktivních projektů
 * u sebe a dál už jen hlídá, jestli na Disku nepřibyla novější verze.
 *
 * Pouští to Vercel Cron (viz vercel.json), ručně ji smí spustit přihlášené
 * Žůžo-labůžo - a z toho je i první naplnění: zmáčkne se několikrát za sebou
 * a je hotovo.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  try {
    const kolik = Number(req.nextUrl.searchParams.get('kolik') ?? '');
    const vysledek = await preneseTextyDoPortalu(Number.isFinite(kolik) && kolik > 0 ? kolik : 6);
    return NextResponse.json({ ok: true, ...vysledek });
  } catch (err) {
    console.error('Přenos textů do portálu selhal:', err);
    return odpovedChyby('chybaApi.ulohaNepodarila', 500);
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
