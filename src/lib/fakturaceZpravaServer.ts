import { prisma } from '@/lib/db';
import { notifyMany, zaznamenejMail } from '@/lib/notifications';
import { sendSchvalenoKFakturaciEmail } from '@/lib/email';
import { jazykUzivatele } from '@/lib/jazykPrijemce';
import { INTERNAL_ROLES } from '@/lib/roles';

/**
 * ZPRÁVA, ŽE JE PROJEKT SCHVÁLENÝ K FAKTURACI (zadání Barbory Šíblové
 * 12. 10. 2026: „nastavit notifikaci při stavu projektu Schváleno - k
 * fakturaci na mě. Nejlépe email, nebo ať mi to píše Bruno. A pokud by mohl
 * do zprávy o projektu dát i proklik na projekt, tak by to bylo perfektní").
 *
 * MAIL I ZVONEK. Mail proto, že o tom má člověk vědět, i když zrovna není
 * v portálu - fakturuje se podle toho. Zvonek k tomu, protože kdo v portálu
 * je, nemá chodit pro odkaz do pošty. Obojí nese PROKLIK NA PROJEKT.
 *
 * KOMU, SE ZAŠKRTÁVÁ NA KARTĚ UŽIVATELE (User.fakturaceProjektu), ne podle
 * jména v kódu - stejné pravidlo jako u zvonku „Plánujeme". Když to nemá
 * zaškrtnuté nikdo, neodejde nic: lepší ticho než zpráva všem.
 *
 * NIKDY NEVYHAZUJE. Přehození stavu je to hlavní, co člověk dělá, a nesmí ho
 * shodit ani zdržet to, že zrovna nejede SMTP.
 */
export async function zpravaOSchvaleniKFakturaci(
  caflouProjectId: string,
  nazevProjektu: string | null,
  nazevFirmy: string | null,
): Promise<void> {
  try {
    const prijemci = (await prisma.user
      .findMany({
        where: { active: true, fakturaceProjektu: true, role: { in: INTERNAL_ROLES as never } },
        select: { id: true, email: true },
      })
      .catch(() => [])) as unknown as { id: string; email: string }[];
    if (prijemci.length === 0) return;

    const zaklad = (process.env.NEXTAUTH_URL || 'https://www.msportal.cz').replace(/\/$/, '');
    const odkaz = `${zaklad}/projekty/${encodeURIComponent(caflouProjectId)}`;
    const projekt = nazevProjektu || `Projekt ${caflouProjectId}`;

    const upozorneni = await notifyMany(
      prijemci.map((u) => u.id),
      {
        kind: 'projekt-k-fakturaci',
        title: `${projekt}: schváleno k fakturaci`,
        body: `${nazevFirmy ? `${nazevFirmy} — ` : ''}klient zakázku odsouhlasil, můžete fakturovat.`,
        // Zvonek vede do portálu, ne na celou adresu - viz lib/notifications.ts.
        url: `/projekty/${encodeURIComponent(caflouProjectId)}`,
      },
    );

    for (const u of prijemci) {
      if (!u.email?.trim()) continue;
      /**
       * VÝSLEDEK OD POŠTY SE ZAPÍŠE K UPOZORNĚNÍ (19. 10. 2026: „a prislo ji
       * to upozorneni?"). Dřív se zahodil a po pár hodinách zmizel i z logu
       * Vercelu, takže na otázku „odešel ten mail?" nešlo odpovědět.
       */
      const vysledek = await sendSchvalenoKFakturaciEmail({
        to: u.email.trim(),
        jazyk: await jazykUzivatele(u.id).catch(() => 'cs' as const),
        projekt,
        firma: nazevFirmy,
        odkaz,
      }).catch((err) => {
        console.error('Zpráva o schválení k fakturaci selhala:', err);
        return { sent: false as const, reason: err instanceof Error ? err.message : 'chyba odeslání' };
      });
      await zaznamenejMail(upozorneni[u.id], vysledek);
    }
  } catch (err) {
    console.error('Zprávu o schválení k fakturaci se nepodařilo poslat:', err);
  }
}
