import { prisma } from '@/lib/db';
import { projektyBezHudby } from '@/lib/hudbaKnihovnaServer';
import { notifyMany } from '@/lib/notifications';
import { posliVyzvu } from '@/lib/vyzvaHudbaServer';

/**
 * UPOZORNĚNÍ, ŽE K AUDIOKNIZE CHYBÍ HUDBA (zadání 17. 10. 2026: „potřebuju
 * nastavit, aby když u audioknihy nebude hudba a bude se blížit termín první
 * frekvence, tak to upozorní mě, že je třeba ji k projektu dodat. A nastavme
 * jen u audioknih").
 *
 * Tři dny předem, jednou. Značka ProjectMeta.hudbaUpozornenoAt hlídá, aby
 * zvonek nezvonil každé ráno znovu; vyprázdní se, jakmile projekt hudbu
 * dostane - kdyby se mu zase odebrala, upozornění přijde znovu.
 *
 * U FIREM, KDE HUDBU VYBÍRÁ KLIENT, se neupozorňujeme my, ale odchází výzva
 * klientovi (zadání 17. 10. 2026: „na klienta by to mělo jít taky tři dny
 * před první frekvencí"). Jedna úloha, dvě cesty - stejný předstih.
 */

/** Kolik dní předem se ozveme. Stejné číslo pro nás i pro klienta. */
export const PREDSTIH_DNI = 3;

export async function pripomenChybejiciHudbu(): Promise<{
  upozorneno: number;
  vyzev: number;
  preskoceno: number;
}> {
  const chybi = await projektyBezHudby();
  const naRade = chybi.filter((p) => p.zaDni !== null && p.zaDni <= PREDSTIH_DNI && p.zaDni >= 0);
  if (naRade.length === 0) return { upozorneno: 0, vyzev: 0, preskoceno: 0 };

  // Kdo už upozornění dostal. Čte se naráz, ne u každého projektu zvlášť.
  const znacky = (await prisma.projectMeta
    .findMany({
      where: { caflouProjectId: { in: naRade.map((p) => p.id) } },
      select: { caflouProjectId: true, hudbaUpozornenoAt: true },
    })
    .catch(() => [])) as { caflouProjectId: string; hudbaUpozornenoAt: Date | null }[];
  const uzVime = new Set(
    znacky.filter((z) => z.hudbaUpozornenoAt).map((z) => z.caflouProjectId),
  );

  // Komu zvoní zvoneček: Žůžo-labůžo a produkce - hudbu k audioknize vybírají
  // oni, ne zvukaři.
  const tym = (await prisma.user
    .findMany({
      where: { active: true, role: { in: ['ADMIN', 'PRODUKCE'] } },
      select: { id: true },
    })
    .catch(() => [])) as { id: string }[];

  let upozorneno = 0;
  let vyzev = 0;
  let preskoceno = 0;

  for (const projekt of naRade) {
    if (uzVime.has(projekt.id)) {
      preskoceno += 1;
      continue;
    }

    if (projekt.vyzvaPujdeSama) {
      // Výzva se posílá jen jednou sama; posliVyzvu si odeslané pohlídá.
      const vysledek = await posliVyzvu(projekt.id);
      if (vysledek.ok) vyzev += 1;
      else preskoceno += 1;
    } else {
      /**
       * Zvoneček nám. U firmy, která si hudbu dodává sama, to ale NENÍ výzva
       * k výběru hudby - projekt je jen starší než to zaškrtávátko, takže
       * výzva sama neodejde a někdo ji musí poslat ručně (17. 10. 2026).
       */
      await notifyMany(
        tym.map((u) => u.id),
        {
          kind: 'hudba-chybi',
          title: projekt.hudbuDodavaKlient
            ? `K audioknize ${projekt.nazev} nedorazila hudba od klienta`
            : `K audioknize ${projekt.nazev} chybí hudba`,
          body: projekt.hudbuDodavaKlient
            ? `První frekvence je ${popisDne(projekt.zaDni ?? 0)}. Hudbu dodává klient — pošlete mu výzvu z karty projektu.`
            : `První frekvence je ${popisDne(projekt.zaDni ?? 0)}. Vyberte hudbu a vložte ji do karty projektu.`,
          url: `/projekty/${projekt.id}`,
        },
      );
      upozorneno += 1;
    }

    await prisma.projectMeta
      .update({ where: { caflouProjectId: projekt.id }, data: { hudbaUpozornenoAt: new Date() } })
      .catch(() => undefined);
  }

  return { upozorneno, vyzev, preskoceno };
}

function popisDne(zaDni: number): string {
  if (zaDni <= 0) return 'dnes';
  if (zaDni === 1) return 'zítra';
  return `za ${zaDni} dny`;
}

/**
 * CHYBĚJÍCÍ HUDBA DO PŘEHLEDU MÉHO DNE (zadání 17. 10. 2026: „zvoneček
 * v portálu, ale i v přehledu mého dne").
 *
 * Zvoneček zazvoní jednou, přehled dne naopak musí stav ukazovat pokaždé -
 * dokud hudba nepřijde, je to pořád nedodělek. Proto se tu značka
 * hudbaUpozornenoAt neřeší.
 *
 * Vidí to jen ti, kdo hudbu vybírají - Žůžo-labůžo a produkce; zvukaři a herci
 * mají v přehledu svoje natáčení a tohle by jim tam jen překáželo.
 */
export async function chybejiciHudbaDoPrehledu(userId: string): Promise<string[]> {
  try {
    const clovek = (await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })) as { role: string } | null;
    if (!clovek || (clovek.role !== 'ADMIN' && clovek.role !== 'PRODUKCE')) return [];

    const chybi = await projektyBezHudby();
    return chybi
      .filter((p) => p.zaDni !== null && p.zaDni <= PREDSTIH_DNI && p.zaDni >= 0)
      .slice(0, 5)
      .map((p) =>
        p.hudbuDodavaKlient
          ? `${p.nazev} — hudbu dodává klient a zatím nedorazila${p.vyzvaPujdeSama ? '' : ', výzvu je potřeba poslat ručně'} (první frekvence ${popisDne(p.zaDni ?? 0)})`
          : `${p.nazev} — chybí hudba, první frekvence ${popisDne(p.zaDni ?? 0)}`,
      );
  } catch (err) {
    console.error('Chybějící hudbu do přehledu dne se nepodařilo načíst:', err);
    return [];
  }
}
