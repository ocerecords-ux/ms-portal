import { randomBytes } from 'crypto';

import { prisma } from '@/lib/db';
import { sendVyzvaHudbaEmail } from '@/lib/email';
import { zakladPortalu } from '@/lib/preposlechOdkaz';

/**
 * VÝZVA KLIENTOVI, ABY DODAL HUDBU (zadání 17. 10. 2026: „hudbu nevybírám
 * u firem Jan Melvil, Audiolibrix a Čti mi. V takových případech by měla jít
 * notifikace emailem na klienta s možností vložit hudbu a ta by se propsala
 * přímo do karty").
 *
 * ODKAZ JE BEZ PŘIHLAŠOVÁNÍ, stejně jako u podpisu smlouvy: hudbu u klienta
 * často řeší někdo, kdo v portálu účet nemá. Token vede vždycky jen na tenhle
 * jeden projekt a nikam jinam.
 */

export type StavVyzvy = {
  /** Prázdné, dokud výzva nevznikla - založí se až při prvním odeslání. */
  token: string | null;
  /** Komu výzva půjde. Prázdné jen tehdy, když projekt nemá kam poslat. */
  email: string | null;
  jmeno: string | null;
  odeslanoAt: string | null;
  vlozenoAt: string | null;
  vlozilJmeno: string | null;
  /** Kdy výzva odejde sama, když do té doby nic nepřijde. */
  odejdeAt: string | null;
  odkaz: string | null;
};

export function odkazNaVyzvu(token: string): string {
  return `${zakladPortalu()}/hudba/${encodeURIComponent(token)}`;
}

/**
 * Komu výzvu poslat. Nejdřív člověk vedený u projektu jako klient, pak
 * kontaktní e-mail firmy - ten bývá obecný, takže je až druhý v pořadí.
 */
async function prijemce(caflouProjectId: string): Promise<{ email: string; jmeno: string | null } | null> {
  const meta = (await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId },
      select: {
        klient: { select: { email: true, name: true } },
        company: { select: { contactEmail: true, contactName: true } },
      },
    })
    .catch(() => null)) as {
    klient: { email: string; name: string | null } | null;
    company: { contactEmail: string | null; contactName: string | null } | null;
  } | null;

  if (meta?.klient?.email) return { email: meta.klient.email, jmeno: meta.klient.name };
  if (meta?.company?.contactEmail) {
    return { email: meta.company.contactEmail, jmeno: meta.company.contactName };
  }
  return null;
}

/**
 * Založí výzvu, když ještě není. NEPOSÍLÁ ji - od založení k odeslání může
 * uběhnout i týden a token se mezitím hodí na to, aby se dal odkaz poslat
 * ručně.
 */
export async function zajistiVyzvu(caflouProjectId: string): Promise<string | null> {
  try {
    const uz = (await prisma.vyzvaHudba.findUnique({
      where: { caflouProjectId },
      select: { token: true },
    })) as { token: string } | null;
    if (uz) return uz.token;

    const komu = await prijemce(caflouProjectId);
    if (!komu) return null;

    const token = randomBytes(24).toString('base64url');
    await prisma.vyzvaHudba.create({
      data: { caflouProjectId, token, email: komu.email, jmeno: komu.jmeno },
    });
    return token;
  } catch (err) {
    console.error('Výzvu k hudbě se nepodařilo založit:', err);
    return null;
  }
}

/**
 * Odešle výzvu a zapíše kdy. Když už jednou odešla, pošle se znovu jen na
 * vyžádání (tlačítko „Poslat výzvu znovu") - sama se neopakuje, aby klientovi
 * nechodila každé ráno.
 */
/**
 * Vedle české věty chodí i KLÍČ do slovníku (dávka 7o): obrazovka si důvod
 * přeloží sama, server jazyk příjemce nezná - vzor z dávky 7l.
 */
export async function posliVyzvu(
  caflouProjectId: string,
  znovu = false,
): Promise<{ ok: true; email: string } | { ok: false; duvod: string; duvodKlic: string }> {
  const token = await zajistiVyzvu(caflouProjectId);
  if (!token) return { ok: false, duvod: 'Projekt nemá e-mail klienta ani kontakt firmy.', duvodKlic: 'hudbaVyzva.duvodBezKontaktu' };

  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { caflouProjectId } })
    .catch(() => null)) as {
    email: string;
    jmeno: string | null;
    odeslanoAt: Date | null;
    vlozenoAt: Date | null;
  } | null;
  if (!vyzva) return { ok: false, duvod: 'Výzva se nenašla.', duvodKlic: 'hudbaVyzva.duvodNenalezena' };
  if (vyzva.vlozenoAt) return { ok: false, duvod: 'Klient hudbu už vložil.', duvodKlic: 'hudbaVyzva.duvodUzVlozil' };
  if (vyzva.odeslanoAt && !znovu) return { ok: false, duvod: 'Výzva už odešla.', duvodKlic: 'hudbaVyzva.duvodUzOdesla' };

  const meta = (await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId },
      select: { name: true, company: { select: { name: true } }, companyName: true },
    })
    .catch(() => null)) as {
    name: string | null;
    company: { name: string } | null;
    companyName: string | null;
  } | null;

  const terminy = await prisma.studioBlock
    .findMany({
      where: { kind: 'NATACENI' as never, caflouProjectId },
      orderBy: { start: 'asc' },
      take: 1,
      select: { start: true },
    })
    .catch(() => []);

  const vysledek = await sendVyzvaHudbaEmail({
    to: vyzva.email,
    jmenoPrijemce: vyzva.jmeno,
    nazevProjektu: meta?.name ?? caflouProjectId,
    firma: meta?.company?.name ?? meta?.companyName ?? null,
    prvniFrekvence: (terminy as { start: Date }[])[0]?.start ?? null,
    odkaz: odkazNaVyzvu(token),
  });
  if (!vysledek.sent) return { ok: false, duvod: 'E-mail se nepodařilo odeslat.', duvodKlic: 'hudbaVyzva.duvodMailNeodesel' };

  await prisma.vyzvaHudba
    .update({ where: { caflouProjectId }, data: { odeslanoAt: new Date() } })
    .catch(() => undefined);
  return { ok: true, email: vyzva.email };
}

/**
 * STAV VÝZVY DO KARTY PROJEKTU.
 *
 * Vrací se i tehdy, KDYŽ VÝZVA JEŠTĚ NEVZNIKLA (oprava 17. 10. 2026: „jak to,
 * že projekt nemá e-mail klienta, když ho má?"). Záznam se zakládá až při
 * prvním odeslání, takže se do té doby karta ptala prázdného záznamu a psala,
 * že projekt nemá e-mail - i u projektu, kde klient vyplněný byl. Adresáta si
 * proto dohledá sama, stejně jako to pak udělá odesílání.
 *
 * Zároveň spočítá, KDY VÝZVA ODEJDE: tři dny před první frekvencí (u firmy se
 * dá předstih změnit). Bez termínu natáčení se nedá říct kdy, a karta to pak
 * napíše obecně.
 */
export async function stavVyzvy(caflouProjectId: string): Promise<StavVyzvy | null> {
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { caflouProjectId } })
    .catch(() => null)) as {
    token: string;
    email: string;
    jmeno: string | null;
    odeslanoAt: Date | null;
    vlozenoAt: Date | null;
    vlozilJmeno: string | null;
  } | null;

  // Adresát z výzvy, a dokud není, tak ten, komu by právě teď odešla.
  const komu = vyzva
    ? { email: vyzva.email, jmeno: vyzva.jmeno }
    : await prijemce(caflouProjectId);

  return {
    token: vyzva?.token ?? null,
    email: komu?.email ?? null,
    jmeno: komu?.jmeno ?? null,
    odeslanoAt: vyzva?.odeslanoAt ? vyzva.odeslanoAt.toISOString() : null,
    vlozenoAt: vyzva?.vlozenoAt ? vyzva.vlozenoAt.toISOString() : null,
    vlozilJmeno: vyzva?.vlozilJmeno ?? null,
    odejdeAt: (await kdyVyzvaOdejde(caflouProjectId))?.toISOString() ?? null,
    odkaz: vyzva ? odkazNaVyzvu(vyzva.token) : null,
  };
}

/** Tři dny před první frekvencí; u firmy se dá předstih nastavit. */
async function kdyVyzvaOdejde(caflouProjectId: string): Promise<Date | null> {
  const [meta, termin] = await Promise.all([
    prisma.projectMeta
      .findUnique({
        where: { caflouProjectId },
        select: { company: { select: { hudbaPredstihDni: true } } },
      })
      .catch(() => null),
    prisma.studioBlock
      .findMany({
        where: { kind: 'NATACENI' as never, caflouProjectId },
        orderBy: { start: 'asc' },
        take: 1,
        select: { start: true },
      })
      .catch(() => []),
  ]);

  const prvni = (termin as { start: Date }[])[0]?.start;
  if (!prvni) return null;
  const dni = (meta as { company: { hudbaPredstihDni: number } | null } | null)?.company
    ?.hudbaPredstihDni;
  const kdy = new Date(prvni);
  kdy.setDate(kdy.getDate() - (dni && dni > 0 ? dni : 3));
  return kdy;
}

export type ProjektKVyzve = {
  caflouProjectId: string;
  nazevProjektu: string;
  firma: string | null;
  prvniFrekvence: string | null;
  vlozenoAt: string | null;
};

/** Co veřejná stránka o projektu ukáže. Nic víc se z tokenu dozvědět nedá. */
export async function projektPodleTokenu(token: string): Promise<ProjektKVyzve | null> {
  const vyzva = (await prisma.vyzvaHudba
    .findUnique({ where: { token }, select: { caflouProjectId: true, vlozenoAt: true } })
    .catch(() => null)) as { caflouProjectId: string; vlozenoAt: Date | null } | null;
  if (!vyzva) return null;

  const meta = (await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId: vyzva.caflouProjectId },
      select: { name: true, company: { select: { name: true } }, companyName: true },
    })
    .catch(() => null)) as {
    name: string | null;
    company: { name: string } | null;
    companyName: string | null;
  } | null;

  const terminy = await prisma.studioBlock
    .findMany({
      where: { kind: 'NATACENI' as never, caflouProjectId: vyzva.caflouProjectId },
      orderBy: { start: 'asc' },
      take: 1,
      select: { start: true },
    })
    .catch(() => []);

  return {
    caflouProjectId: vyzva.caflouProjectId,
    nazevProjektu: meta?.name ?? vyzva.caflouProjectId,
    firma: meta?.company?.name ?? meta?.companyName ?? null,
    prvniFrekvence: (terminy as { start: Date }[])[0]?.start?.toISOString() ?? null,
    vlozenoAt: vyzva.vlozenoAt ? vyzva.vlozenoAt.toISOString() : null,
  };
}

/** Zapíše, že klient hudbu vložil. Jméno je nepovinné - stránka ho jen nabízí. */
export async function oznacVlozeni(token: string, jmeno: string | null): Promise<void> {
  try {
    await prisma.vyzvaHudba.update({
      where: { token },
      data: {
        vlozenoAt: new Date(),
        ...(jmeno?.trim() ? { vlozilJmeno: jmeno.trim() } : {}),
      },
    });
  } catch (err) {
    console.error('Vložení hudby klientem se nepodařilo zapsat:', err);
  }
}
