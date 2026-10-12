import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { KLIC_FIRMY } from '@/lib/naseFirmy';

/**
 * NAŠE FIRMY - serverová část (zadání 12. 10. 2026). Co která funkce dělá,
 * je popsané u lib/naseFirmy.ts.
 */

export type NaseFirma = { id: string; name: string; isDefault: boolean };

/**
 * KTERÉ NAŠE FIRMY TENHLE ČLOVĚK VIDÍ. Omezení se zaškrtává na kartě
 * uživatele (User.viditelneFirmy); PRÁZDNÉ ZNAMENÁ VŠECHNY - účty založené
 * dřív tím o nic nepřišly.
 *
 * Když by omezení nesedělo na žádnou existující firmu (někdo ji mezitím
 * smazal), vrátí se všechny: prázdná administrace bez vysvětlení je horší
 * než vidět o jednu firmu víc.
 */
export async function dostupneFirmy(userId: string | null | undefined): Promise<NaseFirma[]> {
  const vsechny = (await prisma.issuerCompany
    .findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    })
    .catch(() => [])) as unknown as NaseFirma[];
  if (!userId || vsechny.length <= 1) return vsechny;

  const ucet = (await prisma.user
    .findUnique({ where: { id: userId }, select: { viditelneFirmy: true } })
    .catch(() => null)) as unknown as { viditelneFirmy: string[] } | null;
  const povolene = ucet?.viditelneFirmy ?? [];
  if (povolene.length === 0) return vsechny;

  const vybrane = vsechny.filter((f) => povolene.includes(f.id));
  return vybrane.length > 0 ? vybrane : vsechny;
}

/**
 * VYBRANÁ FIRMA Z PŘEPÍNAČE. Bere se z cookie, kterou nastavuje přepínač
 * v liště Dokladů - stránka tak přijde ze serveru rovnou odfiltrovaná.
 *
 * Vrací `null` pro „všechny firmy". Když je dostupná jediná firma, vrátí se
 * ta: s jednou firmou nemá „všechny" co znamenat a přepínač se nekreslí.
 */
export function vybranaFirma(dostupne: NaseFirma[]): string | null {
  if (dostupne.length === 1) return dostupne[0].id;
  const hodnota = cookies().get(KLIC_FIRMY)?.value ?? '';
  return dostupne.some((f) => f.id === hodnota) ? hodnota : null;
}

/**
 * Podmínka do `where` u dokladů. Prázdný objekt = bez omezení.
 *
 * Návratový typ je schválně jedno `{ issuerCompanyId?: string }`, ne sjednocení
 * dvou tvarů: sjednocení se do Prisma `where` rozsypává, jakmile se rozprostře
 * vedle dalších podmínek.
 */
export function filtrFirmy(firma: string | null): { issuerCompanyId?: string } {
  return firma ? { issuerCompanyId: firma } : {};
}

/**
 * POD KTEROU NAŠI FIRMU PATŘÍ TENHLE KLIENT. Prázdné pole na kartě klienta
 * znamená firmu označenou jako výchozí.
 */
export async function firmaKlienta(companyId: string | null | undefined): Promise<string | null> {
  if (companyId) {
    const klient = (await prisma.company
      .findUnique({ where: { id: companyId }, select: { vydavatelId: true } })
      .catch(() => null)) as unknown as { vydavatelId: string | null } | null;
    if (klient?.vydavatelId) return klient.vydavatelId;
  }
  return vychoziFirma();
}

/**
 * POD KTEROU NAŠI FIRMU PATŘÍ TAHLE ZAKÁZKA - přes klienta, ke kterému je
 * projekt navázaný. Starší projekty mívají u sebe jen NÁZEV firmy (přenos
 * z Caflou), proto se hledá i podle něj; stejné pravidlo jako jinde v portálu.
 */
export async function firmaProjektu(caflouProjectId: string | null | undefined): Promise<string | null> {
  const id = (caflouProjectId ?? '').trim();
  if (!id) return vychoziFirma();

  const meta = (await prisma.projectMeta
    .findUnique({
      where: { caflouProjectId: id },
      select: { companyId: true, companyName: true },
    })
    .catch(() => null)) as unknown as { companyId: string | null; companyName: string | null } | null;

  if (meta?.companyId) return firmaKlienta(meta.companyId);

  if (meta?.companyName) {
    const podleJmena = (await prisma.company
      .findFirst({
        where: { name: { equals: meta.companyName, mode: 'insensitive' }, type: 'KLIENT' },
        select: { vydavatelId: true },
      })
      .catch(() => null)) as unknown as { vydavatelId: string | null } | null;
    if (podleJmena?.vydavatelId) return podleJmena.vydavatelId;
  }

  return vychoziFirma();
}

/** Firma označená jako výchozí; když žádná není, první aktivní. */
export async function vychoziFirma(): Promise<string | null> {
  const firma = (await prisma.issuerCompany
    .findFirst({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    .catch(() => null)) as unknown as { id: string } | null;
  return firma?.id ?? null;
}

/**
 * POD KTEROU NAŠI FIRMU SE MÁ VYSTAVIT NOVÝ DOKLAD (12. 10. 2026).
 *
 * Pořadí je dané tím, co o dokladu víme nejjistěji:
 *  1. firma vybraná výslovně v adrese (`?vydavatel=`) - člověk si ji vybral,
 *  2. KLIENT, kterému se vystavuje - to je pravidlo, podle kterého se
 *     účetnictví dělí (viz lib/naseFirmy.ts),
 *  3. zakázka, ze které doklad vzniká - dohledá klienta přes projekt,
 *  4. firma zapnutá v přepínači v liště Dokladů,
 *  5. firma označená jako výchozí.
 */
export async function firmaProNovyDoklad(opts: {
  vydavatel?: string | null;
  companyId?: string | null;
  caflouProjectId?: string | null;
  /** Firma z přepínače; předává se, aby se cookie nečetla dvakrát. */
  zPrepinace?: string | null;
}): Promise<string | null> {
  if (opts.vydavatel) return opts.vydavatel;

  if (opts.companyId) {
    const klient = (await prisma.company
      .findUnique({ where: { id: opts.companyId }, select: { vydavatelId: true } })
      .catch(() => null)) as unknown as { vydavatelId: string | null } | null;
    if (klient?.vydavatelId) return klient.vydavatelId;
  }

  if (opts.caflouProjectId) {
    const meta = (await prisma.projectMeta
      .findUnique({ where: { caflouProjectId: opts.caflouProjectId }, select: { companyId: true } })
      .catch(() => null)) as unknown as { companyId: string | null } | null;
    if (meta?.companyId) {
      const klient = (await prisma.company
        .findUnique({ where: { id: meta.companyId }, select: { vydavatelId: true } })
        .catch(() => null)) as unknown as { vydavatelId: string | null } | null;
      if (klient?.vydavatelId) return klient.vydavatelId;
    }
  }

  if (opts.zPrepinace) return opts.zPrepinace;
  return vychoziFirma();
}
