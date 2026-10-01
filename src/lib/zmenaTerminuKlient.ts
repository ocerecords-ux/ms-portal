import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';
import { sendZmenaTerminuKlientoviEmail } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';
import type { Jazyk } from '@/lib/jazyk';

/**
 * ZMĚNA NATÁČECÍHO TERMÍNU — UPOZORNĚNÍ KLIENTOVI (zadání 1. 10. 2026: „jeste
 * dej klientovi moznost nastaveni notifikace pri zmene terminu nataceci
 * frekvence. Muze u sebe v profilu zaskrtnout").
 *
 * KOMU TO CHODÍ: jedinému člověku — tomu, kdo je u projektu napsaný jako klient
 * (ProjectMeta.klientUserId) — a jedině když si přepínač zapnul. Ne celé
 * klientské firmě: pod jednou firmou bývá víc oddělení a zapnutím upozornění by
 * se člověk dozvídal o zakázkách, které v portálu ani nevidí. Je to stejná
 * úvaha jako u dostavaDotocenoKlient, proto i stejný tvar kódu.
 *
 * KDY TO CHODÍ: při skutečném posunu (jiné studio nebo jiný čas) a při zrušení
 * frekvence. Ne při úpravě poznámky nebo výměně zvukaře — to klienta netýká
 * a dva maily o jednom termínu znamenají, že si přepínač vypne.
 *
 * Herci chodí vlastní upozornění zvlášť a vždycky (je to jeho termín, nemá to
 * přepínač) — viz api/kalendar/terminy/route.ts.
 *
 * Nic z toho nesmí shodit uložení termínu v kalendáři: produkce termín posunula
 * a to je hotová věc, i kdyby byl SMTP server zavřený. Proto je celé tělo
 * v try/catch a chyba jde jen do logu.
 */
export async function oznamKlientoviZmenuTerminu(vstup: {
  caflouProjectId: string | null;
  nazevProjektu: string;
  /** Termín, jak byl zapsaný dosud — hotový text v pásmu studia. */
  puvodne: string;
  /** Nový termín. U zrušení null. */
  nove: string | null;
}): Promise<void> {
  try {
    if (!vstup.caflouProjectId) return;

    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId: vstup.caflouProjectId },
      select: { klientUserId: true, name: true },
    });
    if (!projekt?.klientUserId) return;

    const klient = await prisma.user.findFirst({
      where: {
        id: projekt.klientUserId,
        active: true,
        role: 'CLIENT',
        dostavaZmenuTerminuKlient: true,
      },
      select: { id: true, name: true, email: true, jazyk: true },
    });
    if (!klient) return;

    const nazevProjektu = vstup.nazevProjektu || projekt.name || `Projekt ${vstup.caflouProjectId}`;

    // Zvoneček první: je to zápis do naší databáze, který nemůže skončit
    // u cizího SMTP serveru.
    await notify({
      userId: klient.id,
      kind: 'RECORDING_CHANGED',
      title: vstup.nove ? `${nazevProjektu}: změna termínu` : `${nazevProjektu}: termín zrušen`,
      body: vstup.nove ? `${vstup.puvodne} → ${vstup.nove}` : vstup.puvodne,
      url: '/projekty',
    });

    await sendZmenaTerminuKlientoviEmail({
      to: klient.email,
      jmenoKlienta: klient.name,
      nazevProjektu,
      puvodne: vstup.puvodne,
      nove: vstup.nove,
      odkazNaPortal: `${zakladPortalu()}/projekty`,
      jazyk: (klient.jazyk === 'en' ? 'en' : 'cs') as Jazyk,
    });
  } catch (err) {
    console.error('Upozorneni klientovi na zmenu terminu selhalo:', err);
  }
}
