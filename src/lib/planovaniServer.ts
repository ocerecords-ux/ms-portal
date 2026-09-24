import { prisma } from '@/lib/db';
import { notifyMany } from '@/lib/notifications';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * ZVONEK O STAVU „PLÁNUJEME" (zadání 24. 9. 2026: „ten bude sloužit pro to,
 * aby Helča věděla, že už může plánovat s herci termíny, že je odsouhlasena
 * cena apod. V tomto stavu půjde notifikace přes zvoneček jen Helči").
 *
 * JEN ZVONEK, ŽÁDNÝ MAIL. Je to vnitřní pokyn mezi dvěma lidmi, ne zpráva
 * ven; mail by k tomu byl zbytečně velký kalibr.
 *
 * KOMU, SE ZAŠKRTÁVÁ NA KARTĚ UŽIVATELE (User.planovaniTerminu), ne podle
 * jména v kódu - až to jednou bude dělat někdo jiný, překlikne se to
 * v Uživatelích a nikdo nesahá do kódu. Když to nemá zaškrtnuté nikdo,
 * neodejde nic: lepší ticho než zpráva všem.
 *
 * NIKDY NEVYHAZUJE. Přehození stavu je to hlavní, co člověk dělá, a nesmí ho
 * shodit ani zdržet to, že se zrovna nepovedl zápis notifikace.
 */
export async function zvonekOPlanovani(
  caflouProjectId: string,
  nazevProjektu: string | null,
  nazevFirmy: string | null,
): Promise<void> {
  try {
    const prijemci = await prisma.user.findMany({
      where: { active: true, planovaniTerminu: true, role: { in: INTERNAL_ROLES as never } },
      select: { id: true },
    });
    if (prijemci.length === 0) return;

    await notifyMany(
      prijemci.map((u) => u.id),
      {
        kind: 'projekt-planujeme',
        title: `${nazevProjektu || `Projekt ${caflouProjectId}`}: můžeme plánovat`,
        body: `${nazevFirmy ? `${nazevFirmy} — ` : ''}cena je odsouhlasená, domluvte termíny s herci.`,
        url: `/projekty/${encodeURIComponent(caflouProjectId)}`,
      },
    );
  } catch (err) {
    console.error('Zvonek o stavu Planujeme selhal:', err);
  }
}
