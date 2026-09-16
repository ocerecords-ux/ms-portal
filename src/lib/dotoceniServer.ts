import { prisma } from '@/lib/db';
import { sendHerecDotocenEmail } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { prehodStavPodleDotoceni, vratStavPoOdskrtnuti } from '@/lib/dotoceniStavServer';
import { isRodnyListProjectType } from '@/lib/priceList';

/**
 * Dotočený herec na projektu — jedno místo pro tlačítko i pro Bruna
 * (zadání 16. 9. 2026: „ví Bruno, když někdo napíše do chatu dotočeno, že má
 * stisknout tlačítko Dotočeno?").
 *
 * Do teď to celé bydlelo v POST /api/projekty/[id]/herci-dotoceno, takže se
 * na to dalo dosáhnout jedině klikem v portálu. Bruno musí udělat PŘESNĚ
 * totéž co ten klik — zapsat dvojici projekt + herec, přehodit stav projektu,
 * když mají dotočeno všichni, a poslat zprávu Helče — jinak by vznikly dva
 * skoro stejné postupy, které se po první úpravě rozejdou.
 *
 * Kdo to potvrdil, se u záznamu drží textem i účtem, takže v kartě projektu
 * je vidět, jestli fajfku klikl člověk, nebo ji vyčetl Bruno z kanálu.
 */

export type KdoPotvrdil = { id: string; jmeno: string | null };

export type VysledekDotoceni = {
  dotoceno: true;
  dotocenoAt: string;
  stav: Awaited<ReturnType<typeof prehodStavPodleDotoceni>>;
  /** Herec fajfku měl už předtím - stav se nepřehazoval a zpráva neodešla. */
  uzMel: boolean;
  jmenoHerce: string;
};

/**
 * Zaškrtne hercovi dotočeno. Vrací `null`, když projekt nebo herec neexistuje.
 *
 * ZNOVU ZAŠKRTNOUT NEZNAMENÁ ZNOVU OZNÁMIT: když už fajfku má, jen se vrátí,
 * co je, a nikomu nic nechodí. V portálu to nehrozí (tlačítko se přepne na
 * „Zrušit dotočeno"), ale v chatu se „dotočeno" napíše klidně dvakrát.
 */
export async function oznacHerceDotoceno(
  caflouProjectId: string,
  userId: string,
  kdo: KdoPotvrdil,
): Promise<VysledekDotoceni | null> {
  const [projekt, herec, uzJe] = await Promise.all([
    prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: {
        name: true,
        companyName: true,
        projectType: true,
        company: { select: { name: true } },
      },
    }),
    prisma.user.findFirst({
      where: { id: userId, role: 'HEREC' },
      select: { id: true, name: true, email: true },
    }),
    prisma.herecDotocen.findUnique({
      where: { caflouProjectId_userId: { caflouProjectId, userId } },
      select: { dotocenoAt: true },
    }),
  ]);
  if (!projekt || !herec) return null;

  const jmenoHerce = herec.name || herec.email;

  if (uzJe) {
    return {
      dotoceno: true,
      dotocenoAt: uzJe.dotocenoAt.toISOString(),
      stav: null,
      uzMel: true,
      jmenoHerce,
    };
  }

  const zaznam = await prisma.herecDotocen.upsert({
    where: { caflouProjectId_userId: { caflouProjectId, userId } },
    create: {
      caflouProjectId,
      userId,
      potvrdilUserId: kdo.id,
      potvrdilJmeno: kdo.jmeno,
    },
    update: { dotocenoAt: new Date(), potvrdilUserId: kdo.id, potvrdilJmeno: kdo.jmeno },
  });

  const nazevProjektu = projekt.name || `Projekt ${caflouProjectId}`;

  // Reklama? Pak mlci uplne vsechno - viz /api/projekty/[id]/herci-dotoceno.
  const jeReklama = await isRodnyListProjectType(projekt.projectType);

  // Stav se prehodi PRED odeslanim zpravy o hercovi - kdyby to bylo naopak,
  // Helca by dostala mail driv, nez by se stav v portalu zmenil.
  const stav = await prehodStavPodleDotoceni(caflouProjectId, kdo, jeReklama);

  if (!jeReklama) {
    // Zprava je best effort - fajfka uz je v databazi a nesmi na ni cekat.
    void (async () => {
      try {
        const prijemci = (
          await prisma.user.findMany({
            where: { active: true, dostavaDotoceno: true },
            select: { email: true },
          })
        ).map((u) => u.email);

        if (prijemci.length === 0) {
          console.warn(
            `Dotoceno (${jmenoHerce}, ${nazevProjektu}): zpravu nema komu poslat - nikdo nema zaskrtnute "Dostava zpravy o dotoceni".`,
          );
          return;
        }

        const vysledek = await sendHerecDotocenEmail({
          prijemci,
          jmenoHerce,
          nazevProjektu,
          nazevFirmy: projekt.company?.name ?? projekt.companyName ?? null,
          potvrdil: kdo.jmeno,
          odkazNaProjekt: `${zakladPortalu()}/projekty/${encodeURIComponent(caflouProjectId)}`,
        });

        await zapisNotifikaci({
          caflouProjectId,
          stav: 'Dotočeno',
          popis: vysledek.sent
            ? `${jmenoHerce} má dotočeno — zpráva odešla.`
            : `${jmenoHerce} má dotočeno — zprávu se nepodařilo odeslat (${vysledek.reason ?? 'neznámý důvod'}).`,
          prijemci,
        });
      } catch (err) {
        console.error('Zprava o dotocenem herci selhala:', err);
      }
    })();
  }

  return {
    dotoceno: true,
    dotocenoAt: zaznam.dotocenoAt.toISOString(),
    stav,
    uzMel: false,
    jmenoHerce,
  };
}

/** Odškrtnutí. Zpráva o něm nikam nechodí - v praxi je to oprava překlepu. */
export async function zrusHerceDotoceno(
  caflouProjectId: string,
  userId: string,
  kdo: KdoPotvrdil,
) {
  await prisma.herecDotocen.deleteMany({ where: { caflouProjectId, userId } });
  return vratStavPoOdskrtnuti(caflouProjectId, kdo);
}
