import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Veřejný klíč VAPID pro přihlášení k odběru upozornění (zadání 9. 9. 2026).
 *
 * Je to opravdu veřejná polovina dvojice - prohlížeč ji potřebuje, aby si
 * u push služby vyžádal odběr právě pro nás. Tajná zůstává jen ta druhá,
 * VAPID_PRIVATE_KEY, a ta portál nikdy neopouští.
 *
 * Přesto to chce přihlášení: nemá smysl vydávat cokoliv komukoliv, a když
 * upozornění nastavená nejsou, je lepší to rovnou říct, než nechat prohlížeč
 * selhat na nesrozumitelné chybě.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Nejste přihlášen.' }, { status: 401 });
  }

  const klic = process.env.VAPID_PUBLIC_KEY;
  if (!klic) {
    return NextResponse.json(
      { error: 'Upozornění zatím nejsou nastavená - portálu chybí klíče VAPID.' },
      { status: 503 },
    );
  }
  return NextResponse.json({ klic });
}
