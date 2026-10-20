import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { pristupKPreposlechu } from '@/lib/preposlechPristup';
import { STAV_PREPOSLECH_HOTOVO } from '@/lib/notifikaceFirmy';
import { posliNotifikaciKeStavu } from '@/lib/notifikaceProjektuServer';
import { oznamDokoncenyPreposlech } from '@/lib/brunoOznameni';
import { preklopNaOpravujeme } from '@/lib/opravujemeServer';
import { odpovedChyby } from '@/lib/chybyApi';

/**
 * Záznamy chyb z přeposlechu nahrávky (AudioTagger) — zadání 11. 9. 2026.
 *
 * ČÍST A ZAPSAT smí i klient — buď přihlášený u projektu své firmy, nebo
 * odkazem z mailu. Právě proto se přeposlech posílá: aby napsal, co mu vadí.
 * Poznámka od nepřihlášeného klienta se podepíše „Klient", protože z odkazu
 * se jméno poznat nedá.
 *
 * UPRAVIT A SMAZAT SVŮJ ZÁZNAM smí i klient (zadání 12. 9. 2026: „potřebuju,
 * ať mají ještě klienti možnost upravit nebo smazat chyby, v tomhle bych jim
 * úpravy povolil"). Cizí záznamy klient nechává být — přepsat poznámku
 * někoho jiného není oprava, ale zmatek. Tým Mediaspace může všechno.
 *
 * Kdo přišel odkazem z mailu, nemá účet, takže „svoje" jsou pro něj záznamy
 * bez účtu — tedy ty z toho odkazu. Odkaz patří jednomu projektu a sdílí ho
 * lidé z jedné firmy, takže si mezi sebou opravit poznámku můžou.
 *
 * ODŠKRTNOUT PŘEPOSLECHNUTO smí i klient (zadání 12. 9. 2026: „na straně
 * klienta není možnost označit jako přeposlechnuté, mělo by to být asi vy").
 * Je to jeho slovo, že nahrávku poslechl — my se to jen dozvíme. U záznamu
 * zůstává jméno, takže je vidět, kdo to odškrtl.
 *
 * HISTORIE. Každý zásah se zapisuje do PreposlechUdalost, ať je zpětně vidět,
 * kdo kdy co udělal — i u poznámky, která už byla smazaná.
 *
 * `[id]` je ID projektu; stopy se neukládají, záznam ukazuje na stopu jejím
 * pořadím a nese i její název — viz komentář u modelu v schema.prisma.
 */
export const dynamic = 'force-dynamic';

async function over(req: NextRequest, caflouProjectId: string, jenInterni: boolean) {
  const pristup = await pristupKPreposlechu(caflouProjectId, req.nextUrl.searchParams.get('k'));
  if (!pristup.ok) {
    return { chyba: NextResponse.json({ error: pristup.message }, { status: pristup.status }) };
  }
  if (jenInterni && !pristup.interni) {
    return { chyba: odpovedChyby('chybaApi.bezOpravneni', 403) };
  }
  return {
    userId: pristup.userId,
    interni: pristup.interni,
    jmeno: pristup.jmeno ?? (pristup.pres_odkaz ? 'Klient' : null),
  };
}

/** Řádek do historie. Nikdy nevyhazuje - historie nesmí shodit samotný zápis. */
async function zapisUdalost(
  caflouProjectId: string,
  typ: string,
  popis: string,
  kdo: string | null,
  /**
   * Náš krok, nebo klientův? (zadání 20. 10. 2026) Naše kroky zůstávají
   * v historii jen nám - viz komentář u `stav` níž.
   */
  interni: boolean,
  /** Které poznámky se to týkalo a jak vypadala PŘED tímhle krokem. */
  krok?: { chybaId?: string | null; snimek?: unknown },
) {
  await prisma.preposlechUdalost
    .create({
      data: {
        caflouProjectId,
        typ,
        popis,
        kdo,
        interni,
        chybaId: krok?.chybaId ?? null,
        snimek: (krok?.snimek as never) ?? undefined,
      },
    })
    .catch((err) => console.error('Zápis do historie přeposlechu selhal:', err));
}

/**
 * PŘEPOSLECH UZAVŘENÝ KLIENTEM (zadání 13. 10. 2026). Když klient stiskne
 * „Označit jako přeposlechnuté", přeposlech se zamkne: od té chvíle do něj
 * nikdo zvenčí nezapíše a odemknout ho můžeme jen my.
 *
 * KONTROLA JE TADY NA SERVERU, NE JEN V OKNĚ. Klient má odkaz z mailu často
 * pořád otevřený ve vedlejším panelu a schovaná tlačítka by ho nezastavila.
 */
async function zamcenoProNej(caflouProjectId: string, kdo: { interni: boolean }): Promise<NextResponse | null> {
  if (kdo.interni) return null;
  const stav = await prisma.preposlechStav
    .findUnique({ where: { caflouProjectId }, select: { uzamceno: true } })
    .catch(() => null);
  if (!stav?.uzamceno) return null;
  return NextResponse.json(
    {
      error:
        'Přeposlech je uzavřený. Potřebujete-li ještě něco doplnit, napište nám a odemkneme vám ho.',
      uzamceno: true,
    },
    { status: 409 },
  );
}

/** Kdo smí sáhnout na jeden záznam - viz komentář nahoře. */
type Pristup = { userId: string | null; interni: boolean };
function smiUpravit(chyba: { createdByUserId: string | null }, kdo: Pristup): boolean {
  if (kdo.interni) return true;
  // Prihlaseny klient: jen co napsal sam. Odkazem z mailu: zaznamy bez uctu.
  return kdo.userId ? chyba.createdByUserId === kdo.userId : chyba.createdByUserId === null;
}

/**
 * KLIENT VIDÍ JEN SVOU STRANU PŘEPOSLECHU (zadání 20. 10. 2026: „když budeme
 * poslouchat některé knihy interně nebo si interně v portálu značit něco, tak
 * by to neměl vidět klient a neměla by jít na něj ani žádná notifikace
 * o ukončeném přeposlechu apod.").
 *
 * AudioTagger je jeden, ale slouží dvěma stranám. My si do něj píšeme, co se
 * má předělat, a odškrtáváme si, co máme hotové; klient píše, co mu vadí.
 * Do dneška viděli oba všechno - takže naše interní kontrola klientovi
 * ukázala seznam chyb v jeho knize, a naše odškrtnutí „přeposlechnuto" mu
 * rozsvítilo zelenou fajfku u zakázky, kterou ještě ani neslyšel.
 *
 * Od teď se to dělí podle toho, KDO ten zápis udělal: tým Mediaspace =
 * interní, klient (účtem i odkazem z mailu) = klientův. Klient dostane jen
 * svoje, my obojí - jedním filtrem rovnou v dotazu, aby se naše poznámky
 * nedostaly ven ani omylem v nějakém dalším poli odpovědi.
 */
async function stav(caflouProjectId: string, kdo?: Pristup) {
  // Prazdno = bez filtru (nas clovek vidi obe strany).
  const jenKlientovo = kdo?.interni ? {} : { interni: false };
  const [chyby, preposlech, historie] = await Promise.all([
    prisma.preposlechChyba.findMany({
      where: { caflouProjectId, ...jenKlientovo },
      orderBy: [{ trackIndex: 'asc' }, { localTime: 'asc' }],
      take: 2000,
    }),
    prisma.preposlechStav.findUnique({ where: { caflouProjectId } }),
    prisma.preposlechUdalost.findMany({
      where: { caflouProjectId, ...jenKlientovo },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  // Zamčený přeposlech je pro klienta jen ke čtení - tužka ani křížek se
  // u záznamů vůbec neukážou (13. 10. 2026).
  const zamceno = Boolean(preposlech?.uzamceno);
  const smiPsat = Boolean(kdo) && (kdo!.interni || !zamceno);

  /**
   * PŘEPOSLECHNUTO MÁ DVĚ ODŠKRTÁVÁTKA (20. 10. 2026). Klientovo je jeho
   * slovo („mám přeposlechnuto"), naše je naše práce. Klient vidí jen svoje,
   * v našem okně se sčítají - odškrtnuté je odškrtnuté, ať to byl kdokoliv.
   */
  const naseHotovo = Boolean(kdo?.interni) && Boolean(preposlech?.interniReviewed);
  const klientHotovo = Boolean(preposlech?.reviewed);
  const kdyHotovo = klientHotovo ? preposlech?.reviewedAt : naseHotovo ? preposlech?.interniReviewedAt : null;

  return {
    reviewed: klientHotovo || naseHotovo,
    reviewedByName: klientHotovo
      ? (preposlech?.reviewedByName ?? null)
      : naseHotovo
        ? (preposlech?.interniReviewedByName ?? null)
        : null,
    reviewedAt: kdyHotovo ? kdyHotovo.toISOString() : null,
    uzamceno: zamceno,
    uzamcenoKym: preposlech?.uzamcenoKym ?? null,
    uzamcenoAt: preposlech?.uzamcenoAt ? preposlech.uzamcenoAt.toISOString() : null,
    chyby: chyby.map((ch) => ({
      id: ch.id,
      trackIndex: ch.trackIndex,
      trackName: ch.trackName,
      localTime: ch.localTime,
      pdfPage: ch.pdfPage,
      zvyrazneni: (ch.zvyrazneni as unknown as Zvyrazneni | null) ?? null,
      description: ch.description,
      createdByName: ch.createdByName,
      createdAt: ch.createdAt.toISOString(),
      // At okno vi, u ktereho zaznamu ma ukazat tuzku a krizek.
      muzuUpravit: smiPsat ? smiUpravit(ch, kdo!) : false,
    })),
    historie: historie.map((u) => ({
      id: u.id,
      typ: u.typ,
      popis: u.popis,
      kdo: u.kdo,
      kdy: u.createdAt.toISOString(),
      /**
       * Da se tenhle krok vratit? Jen kroky nad poznamkou, jen jednou
       * a jen tomu, kdo na tu poznamku smi (zadani 12. 9. 2026).
       */
      muzuVratit: Boolean(
        smiPsat &&
          kdo &&
          !u.vracenoAt &&
          ['PRIDANA', 'UPRAVENA', 'SMAZANA'].includes(u.typ) &&
          u.chybaId &&
          smiUpravit({ createdByUserId: (u.snimek as { createdByUserId?: string | null } | null)?.createdByUserId ?? null }, kdo),
      ),
    })),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;
  return NextResponse.json(await stav(params.id, pristup));
}

/**
 * Zvyrazneny usek textu (zadani 11. 9. 2026). Ramecky jsou zlomky sirky
 * a vysky strany, proto strop 1 - v pixelech by zvyrazneni sedelo jen pri
 * te sirce okna, ve ktere vzniklo.
 */
const zvyrazneniSchema = z.object({
  strana: z.number().int().min(1).max(10000),
  text: z.string().max(2000),
  ramecky: z
    .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]))
    .max(200),
});

type Zvyrazneni = { strana: number; ramecky: [number, number, number, number][]; text: string };

const novaChyba = z.object({
  trackIndex: z.number().int().min(1).max(999),
  trackName: z.string().trim().min(1).max(300),
  localTime: z.number().min(0).max(24 * 3600),
  pdfPage: z.number().int().min(1).max(10000).nullable().optional(),
  zvyrazneni: zvyrazneniSchema.nullable().optional(),
  description: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;
  const zamek = await zamcenoProNej(params.id, pristup);
  if (zamek) return zamek;

  const parsed = novaChyba.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const vytvorena = await prisma.preposlechChyba.create({
    data: {
      caflouProjectId: params.id,
      ...parsed.data,
      pdfPage: parsed.data.pdfPage ?? null,
      zvyrazneni: parsed.data.zvyrazneni ?? undefined,
      createdByUserId: pristup.userId,
      createdByName: pristup.jmeno,
      // Nase poznamka zustava u nas (20. 10. 2026) - viz komentar u `stav`.
      interni: pristup.interni,
    },
  });

  await zapisUdalost(
    params.id,
    'PRIDANA',
    `Přidal(a) poznámku u stopy ${parsed.data.trackIndex}.`,
    pristup.jmeno,
    pristup.interni,
    // Pred pridanim nebylo co vracet - snimek nese jen to, kdo poznamku
    // zalozil, aby se dalo overit, kdo ji smi zase odebrat.
    { chybaId: vytvorena.id, snimek: { createdByUserId: pristup.userId } },
  );

  return NextResponse.json(await stav(params.id, pristup));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;

  const telo = await req.json().catch(() => ({}));
  const reviewed = Boolean((telo as { reviewed?: unknown })?.reviewed);
  const predtim = await prisma.preposlechStav
    .findUnique({
      where: { caflouProjectId: params.id },
      select: { reviewed: true, uzamceno: true, interniReviewed: true },
    })
    .catch(() => null);

  // Zamčený přeposlech odškrtne zpátky jen někdo od nás - klient už se k němu
  // nedostane, o to tady celou dobu jde (13. 10. 2026).
  const zamek = await zamcenoProNej(params.id, pristup);
  if (zamek) return zamek;

  /**
   * ZAMYKÁ JEN KLIENT. Když přeposlechnuto odškrtneme my z portálu, nic se
   * nezamyká - interní přeposlech si vedeme sami a nepotřebujeme se odemykat.
   * Odškrtnutí zpátky (reviewed=false) zámek vždycky uvolní; je to naše
   * „odemknout klientovi".
   */
  const zamknout = reviewed && !pristup.interni;
  const ted = new Date();

  /**
   * NAŠE ODŠKRTNUTÍ JDE DO NAŠEHO POLE (zadání 20. 10. 2026: interní
   * přeposlech „by neměl vidět klient"). `reviewed` je klientovo slovo -
   * podle něj se mu v přehledu rozsvítí zelená fajfka a podle něj mu odejde
   * zpráva o dokončeném přeposlechu. Když si knihu přeposlechneme my,
   * je to naše práce a do jeho pole nepatří.
   *
   * ODŠKRTNUTÍ ZPÁTKY MAŽE OBOJÍ. Je to naše „odemknout klientovi" (13. 10.
   * 2026) a zároveň jediná cesta, jak vrátit nahrávku k přeposlechu - kdyby
   * sahalo jen na naše pole, zůstal by klientovi zámek i fajfka a nikdo by
   * je už nesundal.
   */
  const zapis = pristup.interni
    ? {
        interniReviewed: reviewed,
        interniReviewedAt: reviewed ? ted : null,
        interniReviewedByName: reviewed ? pristup.jmeno : null,
        ...(reviewed
          ? {}
          : {
              reviewed: false,
              reviewedAt: null,
              reviewedByName: null,
              uzamceno: false,
              uzamcenoAt: null,
              uzamcenoKym: null,
            }),
      }
    : {
        reviewed,
        reviewedAt: reviewed ? ted : null,
        reviewedByName: reviewed ? pristup.jmeno : null,
        uzamceno: zamknout,
        uzamcenoAt: zamknout ? ted : null,
        uzamcenoKym: zamknout ? pristup.jmeno : null,
      };

  await prisma.preposlechStav.upsert({
    where: { caflouProjectId: params.id },
    create: { caflouProjectId: params.id, ...zapis },
    update: zapis,
  });

  /**
   * Náš krok vidíme jen my - KROMĚ TOHO, KTERÝ SE DOTKNE KLIENTA. Když mu
   * odemkneme uzavřený přeposlech nebo mu sundáme jeho fajfku, musí v historii
   * vidět, co se stalo; zámek, který zmizí bez vysvětlení, je horší než zámek.
   */
  const dotykaSeKlienta = !reviewed && Boolean(predtim?.reviewed || predtim?.uzamceno);

  await zapisUdalost(
    params.id,
    reviewed ? 'PREPOSLECHNUTO' : 'ZNOVU',
    reviewed
      ? zamknout
        ? 'Označil(a) nahrávku jako přeposlechnutou a uzavřel(a) přeposlech.'
        : 'Označil(a) nahrávku jako přeposlechnutou.'
      : predtim?.uzamceno
        ? 'Odemkl(a) přeposlech a vrátil(a) nahrávku k přeposlechu.'
        : 'Vrátil(a) nahrávku k přeposlechu.',
    pristup.jmeno,
    pristup.interni && !dotykaSeKlienta,
  );

  /**
   * BRUNO TO OHLÁSÍ V KANÁLU PROJEKTU (zadání 21. 9. 2026: „potřebujeme dostat
   * notifikaci do kanálu projektu do chatu od Bruna o tom, že klient dokončil
   * přeposlech"). Jen při skutečném přepnutí na hotovo, ne při opakovaném
   * kliknutí.
   */
  const poprve = reviewed && !(pristup.interni ? predtim?.interniReviewed : predtim?.reviewed);
  if (poprve) {
    await oznamDokoncenyPreposlech(params.id, pristup.jmeno, !pristup.interni);
    /**
     * A KLIENTOVI ODEJDE ZPRÁVA (zadání 25. 9. 2026: „klientům u audioknih by
     * měla přijít notifikace, že je dokončen přeposlech a že se pouštíme do
     * finálních oprav"). Posílá se stejnou cestou jako zprávy ke stavům -
     * znění se bere ze Vzorů zpráv a u reklamní firmy neodejde vůbec.
     * Nesmí to shodit samotné označení, proto bez čekání na chybu.
     */
    /**
     * JEN KDYŽ PŘEPOSLECH DOKONČIL KLIENT (upřesnění 13. 10. 2026: „u projektů,
     * které přeposloucháváme my interně, tzn. z portálu, by neměl chodit email
     * nikam"). Zpráva říká klientovi, že se pouštíme do oprav - když si
     * nahrávku odškrtneme my sami, nemá komu chodit a jen mate.
     */
    if (!pristup.interni) {
      await posliNotifikaciKeStavu(params.id, STAV_PREPOSLECH_HOTOVO).catch((err) =>
        console.error('Zprava klientovi o dokoncenem preposlechu selhala:', err),
      );
    }

    /**
     * A PROJEKT SE PŘEKLOPÍ NA „OPRAVUJEME" (zadání 27. 9. 2026). Až TEĎ,
     * po odeslání zprávy o dokončeném přeposlechu: z „Opravujeme" už
     * klientovi nic nechodí, takže obrácené pořadí by tu jednu zprávu
     * spolklo. Od téhle chvíle projekt nespadá pod denní překlápění na
     * „Čekáme na opravy" - čeká se na nás, ne na klienta.
     */
    /**
     * U INTERNÍHO PŘEPOSLECHU JEN Z ODEVZDANÉ ZAKÁZKY (20. 10. 2026). Stav
     * „Opravujeme" klient vidí - a u knihy, kterou si interně kontrolujeme
     * ještě před odevzdáním, by mu portál posunul zakázku, o které nic neví.
     * Když ale projekt u klienta už je („Dokončeno - ke schválení", „Čekáme
     * na opravy"), platí to původní: upomínky „čekáme na opravy" skončí,
     * protože se čeká na nás. Klientovo odškrtnutí posouvá stav vždycky.
     */
    await preklopNaOpravujeme(params.id, pristup.jmeno, pristup.interni);
  }

  return NextResponse.json(await stav(params.id, pristup));
}

/** Úprava znění záznamu (zadání 12. 9. 2026). Mění se jen text poznámky. */
const upravaChyby = z.object({
  chyba: z.string().min(1).max(100),
  description: z.string().trim().min(1).max(4000),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;
  const zamek = await zamcenoProNej(params.id, pristup);
  if (zamek) return zamek;

  const parsed = upravaChyby.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
  }

  const chyba = await prisma.preposlechChyba.findFirst({
    where: { id: parsed.data.chyba, caflouProjectId: params.id },
    select: { id: true, createdByUserId: true, description: true },
  });
  if (!chyba) return odpovedChyby('preposlechApi.zaznamNenalezen', 404);
  if (!smiUpravit(chyba, pristup)) {
    return odpovedChyby('preposlechApi.upravitJenVlastni', 403);
  }

  await prisma.preposlechChyba.update({
    where: { id: chyba.id },
    data: { description: parsed.data.description },
  });

  await zapisUdalost(params.id, 'UPRAVENA', 'Upravil(a) znění poznámky.', pristup.jmeno, pristup.interni, {
    chybaId: chyba.id,
    snimek: { createdByUserId: chyba.createdByUserId, description: chyba.description },
  });

  return NextResponse.json(await stav(params.id, pristup));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const pristup = await over(req, params.id, false);
  if ('chyba' in pristup) return pristup.chyba;
  const zamek = await zamcenoProNej(params.id, pristup);
  if (zamek) return zamek;

  const chybaId = req.nextUrl.searchParams.get('chyba');
  if (!chybaId) return odpovedChyby('preposlechApi.chybiIdZaznamu', 400);

  const chyba = await prisma.preposlechChyba.findFirst({
    where: { id: chybaId, caflouProjectId: params.id },
  });
  if (!chyba) return NextResponse.json(await stav(params.id, pristup));
  if (!smiUpravit(chyba, pristup)) {
    return odpovedChyby('preposlechApi.smazatJenVlastni', 403);
  }

  await prisma.preposlechChyba.delete({ where: { id: chyba.id } });

  await zapisUdalost(params.id, 'SMAZANA', 'Smazal(a) poznámku.', pristup.jmeno, pristup.interni, {
    chybaId: chyba.id,
    // Cely zaznam - z nej se poznamka da postavit zpatky.
    snimek: {
      createdByUserId: chyba.createdByUserId,
      createdByName: chyba.createdByName,
      // Ci poznamka to byla (20. 10. 2026) - at ji vraceni postavi zpatky
      // na tu stranu, kde byla.
      interni: chyba.interni,
      trackIndex: chyba.trackIndex,
      trackName: chyba.trackName,
      localTime: chyba.localTime,
      pdfPage: chyba.pdfPage,
      zvyrazneni: chyba.zvyrazneni,
      description: chyba.description,
    },
  });

  return NextResponse.json(await stav(params.id, pristup));
}
