import { NextRequest, NextResponse } from 'next/server';
import { smiSpustitUlohu } from '@/lib/cronGuard';
import { posliUpozorneniNaTerminy } from '@/lib/terminyServer';
import { dotocenoUReklam } from '@/lib/reklamaDotocenoServer';
import { pripomenNepotvrzeneVybery } from '@/lib/nabidkyNaPotvrzeni';

/**
 * Denní hlídání blížících se termínů dokončení (zadání 18. 9. 2026). Pouští to
 * Vercel Cron - viz vercel.json.
 *
 * KDO SEM SMÍ: úloha z Vercelu (nese `Authorization: Bearer CRON_SECRET`), nebo
 * přihlášené Žůžo-labůžo, když to chce zkusit ručně. Stejně to má překlopení
 * stavů i měsíční přehled výkazů.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function spust(req: NextRequest) {
  if (!(await smiSpustitUlohu(req))) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  try {
    const vysledek = await posliUpozorneniNaTerminy();
    /**
     * Reklamy (zadání 23. 9. 2026): herci se po natáčení překlopí na dotočeno
     * sami a potichu - viz lib/reklamaDotocenoServer.ts. Nesmí to shodit
     * hlídání termínů, proto vlastní catch.
     */
    const reklamy = await dotocenoUReklam().catch((err) => {
      console.error('Dotoceno u reklam selhalo:', err);
      return { oznaceno: 0, zvazeno: 0 };
    });
    /**
     * VÝBĚRY HERCŮ, KTERÉ DNES PROPADNOU (16. 11. 2026) - připomínka tomu,
     * kdo nabídku založil, den před koncem držení. Viz
     * lib/nabidkyNaPotvrzeni.ts; vlastní catch ze stejného důvodu jako výš.
     */
    const vybery = await pripomenNepotvrzeneVybery().catch((err) => {
      console.error('Pripominka nepotvrzenych vyberu selhala:', err);
      return { pripomenuto: 0 };
    });
    return NextResponse.json({ ok: true, ...vysledek, reklamy, vybery });
  } catch (err) {
    console.error('Cron terminy selhal:', err);
    return NextResponse.json({ error: 'Hlídání termínů se nepodařilo.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return spust(req);
}

export async function POST(req: NextRequest) {
  return spust(req);
}
