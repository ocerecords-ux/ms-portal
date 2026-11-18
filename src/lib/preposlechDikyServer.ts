import { prisma } from '@/lib/db';
import { casSlovy, celkovyCasProjektu } from '@/lib/delkaNahravkyServer';
import { sendPreposlechDikyEmail } from '@/lib/email';
import { STAV_PREPOSLECH_HOTOVO } from '@/lib/notifikaceFirmy';
import { dosadZnacky } from '@/lib/oznameni';
import { jeZapnuto, zneni } from '@/lib/oznameniServer';
import { urlPodnetu, zajistiOdkaz } from '@/lib/preposlechOdkaz';

/**
 * PODĚKOVÁNÍ ZA KONTROLNÍ POSLECH (zadání 18. 11. 2026).
 *
 * KDY: ve chvíli, kdy přeposlech odklepne někdo ZVENČÍ. Ne při překlopení
 * stavu projektu - „Dokončeno - ke schválení" znamená jen to, že je na disku
 * poslední várka tracků, a poslouchat se teprve začne (upřesnění téhož dne).
 * A ne při našem interním odškrtnutí - děkovat sami sobě nedává smysl.
 *
 * KOMU: tomu jedinému člověku, který na tlačítko sáhl. Klientovi chodí zvlášť
 * zpráva ze Vzorů zpráv („pouštíme se do finálních oprav") - a když je to
 * tatáž adresa, tohle poděkování se vynechá, aby nepřišly dva maily naráz.
 */

/** Adresy, kterým už odchází zpráva ke stavu „Přeposlech dokončen". */
async function komuUzChodi(caflouProjectId: string): Promise<Set<string>> {
  const adresy = new Set<string>();
  try {
    const projekt = await prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { companyId: true, klient: { select: { email: true } } },
    });
    if (projekt?.klient?.email) adresy.add(projekt.klient.email.trim().toLowerCase());
    if (projekt?.companyId) {
      const ulozene = await prisma.notifikaceFirmy
        .findUnique({
          where: { companyId_stav: { companyId: projekt.companyId, stav: STAV_PREPOSLECH_HOTOVO } },
          select: { klientiEmaily: true },
        })
        .catch(() => null);
      for (const e of ulozene?.klientiEmaily ?? []) {
        const cista = e.trim().toLowerCase();
        if (cista) adresy.add(cista);
      }
    }
  } catch (err) {
    console.error('Seznam adres u stavu se nepodařilo načíst:', err);
  }
  return adresy;
}

export async function posliPodekovaniZaPreposlech(
  caflouProjectId: string,
  /** Kdo odklepl - posluchač z odkazu, nebo náš účet. */
  kdo: { posluchacId?: string | null; userId?: string | null; jmeno?: string | null },
): Promise<boolean> {
  try {
    if (!(await jeZapnuto('PREPOSLECH_DIKY'))) return false;

    const stav = await prisma.preposlechStav.findUnique({
      where: { caflouProjectId },
      select: { dikyOdeslanoAt: true },
    });
    // Odškrtnutí zpátky a znovu zprávu neopakuje.
    if (stav?.dikyOdeslanoAt) return false;

    let email: string | null = null;
    let jmeno = kdo.jmeno ?? null;
    if (kdo.posluchacId) {
      const p = await prisma.preposlechPosluchac.findUnique({
        where: { id: kdo.posluchacId },
        select: { email: true, jmeno: true },
      });
      email = p?.email ?? null;
      jmeno = jmeno || p?.jmeno || null;
    } else if (kdo.userId) {
      const u = await prisma.user.findUnique({
        where: { id: kdo.userId },
        select: { email: true, name: true },
      });
      email = u?.email ?? null;
      jmeno = jmeno || u?.name || null;
    }
    if (!email) return false;

    // Dva maily s poděkováním během jedné vteřiny jsou horší než žádný.
    const uzChodi = await komuUzChodi(caflouProjectId);
    if (uzChodi.has(email.trim().toLowerCase())) return false;

    const [projekt, delka, pocetStop] = await Promise.all([
      prisma.projectMeta.findUnique({ where: { caflouProjectId }, select: { name: true } }),
      celkovyCasProjektu(caflouProjectId),
      prisma.preposlechStav
        .findUnique({ where: { caflouProjectId }, select: { pocetStop: true } })
        .then((s) => s?.pocetStop ?? 0)
        .catch(() => 0),
    ]);

    const hodnoty = {
      projekt: projekt?.name || 'audioknihy',
      jmeno: jmeno || '',
      celkovycas: delka ? casSlovy(delka) : '',
      pocetstop: String(pocetStop || ''),
    };
    const t = await zneni('PREPOSLECH_DIKY');
    const token = await zajistiOdkaz(caflouProjectId);

    const vysledek = await sendPreposlechDikyEmail({
      to: email,
      predmet: dosadZnacky(t.predmet, hodnoty),
      nadpis: dosadZnacky(t.nadpis, hodnoty),
      text: dosadZnacky(t.text, hodnoty),
      celkovyCas: delka ? casSlovy(delka) : null,
      pocetStop: pocetStop || 0,
      odkazPodnet: token ? urlPodnetu(token) : null,
    });
    if (!vysledek.sent) return false;

    await prisma.preposlechStav
      .update({ where: { caflouProjectId }, data: { dikyOdeslanoAt: new Date() } })
      .catch(() => undefined);

    await prisma.preposlechUdalost
      .create({
        data: {
          caflouProjectId,
          typ: 'DIKY',
          popis: `Poděkování za kontrolní poslech odešlo na ${email}.`,
          kdo: 'Portál',
          interni: true,
        },
      })
      .catch(() => undefined);
    return true;
  } catch (err) {
    console.error('posliPodekovaniZaPreposlech selhalo:', err);
    return false;
  }
}
