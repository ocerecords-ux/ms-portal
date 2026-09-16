import { prisma } from '@/lib/db';
import { sendHerecDotocenEmail, sendHerecDotocenKlientoviEmail } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';
import { notify } from '@/lib/notifications';
import { zapisNotifikaci } from '@/lib/projektLogServer';
import { INTERNAL_ROLES } from '@/lib/roles';
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
  /** Stav projektu po přeskoku. `null`, když se nepřehazoval (herec fajfku už měl). */
  stav: Awaited<ReturnType<typeof prehodStavPodleDotoceni>> | null;
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
        // Klient projektu - jemu se posila zprava, kdyz si ji zapnul
        // (zadani 16. 9. 2026). Je to TENTYZ sloupec, podle ktereho klient
        // projekt vubec vidi v portalu, takze se upozorneni nemuze dostat
        // k nikomu, kdo o projektu nema vedet.
        klientUserId: true,
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
        /**
         * DVA RUZNE OKRUHY PRIJEMCU (zadani 16. 9. 2026: „potrebuji mit
         * moznost nastavit u konkretnich klientu, aby jim chodily notifikace
         * o tom, ze jsme dotocili s konkretnim hercem").
         *
         * My: kdo ma na karte zaskrtnute „Dostava zpravy o dotoceni" - vidi
         * vsechny projekty, dostane interni mail s odkazem do detailu.
         *
         * Klient: jen ten jeden clovek, ktery je u projektu napsany jako
         * klient, a jen kdyz si to zapnul. Dostane jinou zpravu - do detailu
         * projektu se stejne nedostane a kdo to odskrtl, mu nic nerika.
         */
        const [prijemci, klient] = await Promise.all([
          prisma.user
            .findMany({
              where: { active: true, dostavaDotoceno: true, role: { in: INTERNAL_ROLES } },
              select: { email: true },
            })
            .then((lide) => lide.map((u) => u.email)),
          projekt.klientUserId
            ? prisma.user.findFirst({
                where: {
                  id: projekt.klientUserId,
                  active: true,
                  role: 'CLIENT',
                  dostavaDotocenoKlient: true,
                },
                select: { id: true, name: true, email: true },
              })
            : Promise.resolve(null),
        ]);

        if (klient) {
          // Presne totez, co dela tlacitko „Poslat klientovi znovu" - jedna
          // funkce, aby se ta dve odeslani nerozesla (viz nize).
          await posliKlientovi({
            klient,
            jmenoHerce,
            nazevProjektu,
          });
        }

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
          prijemci: klient ? [...prijemci, klient.email] : prijemci,
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

/** Jedno odeslani klientovi - mail i zvonecek. Pouziva ho fajfka i „poslat znovu". */
async function posliKlientovi(vstup: {
  klient: { id: string; name: string | null; email: string };
  jmenoHerce: string;
  nazevProjektu: string;
}) {
  // Zvonecek prvni: je to zapis do nasi databaze, ktery nemuze skoncit
  // u ciziho SMTP serveru.
  await notify({
    userId: vstup.klient.id,
    kind: 'dotoceno-klient',
    title: `${vstup.nazevProjektu}: dotočeno`,
    body: `Herec ${vstup.jmenoHerce} má dotočeno.`,
    url: '/projekty',
  });

  try {
    await sendHerecDotocenKlientoviEmail({
      to: vstup.klient.email,
      jmenoKlienta: vstup.klient.name,
      jmenoHerce: vstup.jmenoHerce,
      nazevProjektu: vstup.nazevProjektu,
      odkazNaPortal: `${zakladPortalu()}/projekty`,
    });
  } catch (err) {
    console.error('Zprava klientovi o dotocenem herci selhala:', err);
  }
}

export type VysledekKlientovi =
  | { poslano: true; jmenoKlienta: string }
  | {
      poslano: false;
      duvod: 'neznamy-projekt' | 'neni-dotoceno' | 'bez-klienta' | 'nema-zapnuto' | 'reklama';
    };

/**
 * POSLAT KLIENTOVI ZNOVU (zadani 16. 9. 2026: „a muzeme ted poslat Radce
 * zpetne info o tom, ze je dotoceno s Lubosem Ondrackem?").
 *
 * Fajfka se schvalne neoznamuje dvakrat - v chatu se „dotoceno" napise klidne
 * dvakrat a klient by dostal dva stejne maily. Kdyz ale upozorneni vzniklo az
 * potom, co se dotocilo, je potreba ho poslat dodatecne. Jde to jedine odsud,
 * a jedine k hercum, kteri fajfku OPRAVDU maji - nedela to z toho zpusob, jak
 * klientovi oznamit neco, co se nestalo.
 *
 * Nic se tim neprepisuje: datum dotoceni, stav projektu ani nase interni
 * zpravy se nehnou. Odejde jen ten jeden mail a zvonecek.
 */
export async function poslatKlientoviZnovu(
  caflouProjectId: string,
  userId: string,
): Promise<VysledekKlientovi> {
  const [projekt, herec, fajfka] = await Promise.all([
    prisma.projectMeta.findUnique({
      where: { caflouProjectId },
      select: { name: true, projectType: true, klientUserId: true },
    }),
    prisma.user.findFirst({
      where: { id: userId, role: 'HEREC' },
      select: { name: true, email: true },
    }),
    prisma.herecDotocen.findUnique({
      where: { caflouProjectId_userId: { caflouProjectId, userId } },
      select: { dotocenoAt: true },
    }),
  ]);

  if (!projekt || !herec) return { poslano: false, duvod: 'neznamy-projekt' };
  if (!fajfka) return { poslano: false, duvod: 'neni-dotoceno' };
  if (await isRodnyListProjectType(projekt.projectType)) {
    return { poslano: false, duvod: 'reklama' };
  }
  if (!projekt.klientUserId) return { poslano: false, duvod: 'bez-klienta' };

  const klient = await prisma.user.findFirst({
    where: { id: projekt.klientUserId, active: true, role: 'CLIENT' },
    select: { id: true, name: true, email: true, dostavaDotocenoKlient: true },
  });
  if (!klient) return { poslano: false, duvod: 'bez-klienta' };
  if (!klient.dostavaDotocenoKlient) return { poslano: false, duvod: 'nema-zapnuto' };

  await posliKlientovi({
    klient,
    jmenoHerce: herec.name || herec.email,
    nazevProjektu: projekt.name || `Projekt ${caflouProjectId}`,
  });

  return { poslano: true, jmenoKlienta: klient.name || klient.email };
}
