import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { MAX_PRILOH, MAX_PRILOHA_BYTES } from '@/lib/chatPrilohy';
import { overPrilohu } from '@/lib/storage';
import { posliPush } from '@/lib/pushServer';
import { canUseChat, shrnReakce, userLabel } from '@/lib/chatServer';
import { odkazNaFotku } from '@/lib/fotky';
import { komuPoslatUpozorneni, zminenyTym } from '@/lib/chatUpozorneniServer';
import { notify } from '@/lib/notifications';
import { CHYBI_NAZEV, CHYBI_PRIJEMCE, jeUkol, nazevUkolu } from '@/lib/ukolyZChatu';

// Zpravy jedne konverzace (zadani 8. 9. 2026). Otevreni konverzace zaroven
// znamena "precteno" - proto se pri GET posouva lastReadAt.
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    // Prazdne telo je v poradku, kdyz jsou u zpravy prilohy - poslat samotnou
    // fotku bez komentare je bezna vec (zadani 9. 9. 2026).
    body: z.string().trim().max(MAX_MESSAGE_LENGTH, 'Zpráva je moc dlouhá.'),
    /** Odpoved ve vlakne - ID zpravy, pod kterou ma viset. */
    parentId: z.string().trim().min(1).optional(),
    prilohy: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(300),
          name: z.string().trim().min(1).max(255),
          mime: z.string().trim().max(160).optional(),
        }),
      )
      .max(MAX_PRILOH, `Nejvýš ${MAX_PRILOH} přílohy k jedné zprávě.`)
      .optional(),
    /**
     * ÚKOL Z CHATU (zadání 18. 9. 2026). Posílá se jen termín - komu úkol
     * patří, si portál odvodí sám ze zprávy a z konverzace (viz
     * lib/ukolyZChatu.ts a `zalozUkolZeZpravy` níž). Prohlížeč to sice ukazuje
     * dopředu, ale rozhodnout o tom musí server: jinak by šlo poslat úkol
     * komukoliv.
     */
    ukol: z
      .object({
        /** YYYY-MM-DD, nebo nic - úkol bez termínu je v pořádku. */
        termin: z.string().trim().min(8).max(10).nullable().optional(),
      })
      .optional(),
  })
  .refine((v) => v.body.length > 0 || (v.prilohy?.length ?? 0) > 0, {
    message: 'Zpráva je prázdná.',
    path: ['body'],
  });

/**
 * Smi tenhle uzivatel do teto konverzace? Kanal k projektu je pro cely tym,
 * soukroma a skupinova jen pro cleny - kontroluje se pri kazdem pozadavku,
 * nikdy se nespolehame na to, co posle prohlizec.
 */
async function nactiPristupnou(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!conversation) return null;
  if (conversation.kind !== 'PROJEKT' && !conversation.members.some((m) => m.userId === userId)) {
    return null;
  }
  return conversation;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const conversation = await nactiPristupnou(params.id, me);
    if (!conversation) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

    // ?vlakno=<id> vrati zpravu a odpovedi pod ni; jinak hlavni proud, tedy
    // jen zpravy bez rodice (zadani 8. 9. 2026: odpovedi ve vlakne).
    const vlakno = req.nextUrl.searchParams.get('vlakno');
    // Cteni zprav a zapis "precteno" jsou na sobe nezavisle, takze jdou do
    // databaze najednou. Za sebou to byla jedna zbytecna cesta tam a zpet
    // navic pri kazdem otevreni konverzace (oprava 10. 9. 2026: "v MS chatu
    // se strasne dlouho nacitaji zpravy").
    const [zpravy] = await Promise.all([
      prisma.message.findMany({
      where: vlakno
        ? { conversationId: conversation.id, OR: [{ id: vlakno }, { parentId: vlakno }] }
        : { conversationId: conversation.id, parentId: null },
      orderBy: { createdAt: 'desc' },
      // ŠEDESÁT, NE DVĚ STĚ (oprava 12. 9. 2026: „pořád je u chatu obecně
      // problém, že trvá, než se načte konverzace"). Ke každé zprávě se
      // dotahuje autor, přílohy, reakce a počet odpovědí - u dvou set zpráv
      // to byla většina času požadavku, a přitom se do panelu vejde pár
      // posledních. Starší zůstávají v databázi a jsou vidět ve vyhledávání.
      take: 60,
      include: {
        user: { select: { id: true, name: true, email: true, maFotku: true } },
        _count: { select: { replies: true } },
        // Reakce se nactou rovnou se zpravami (zadani 9. 9. 2026) - je jich
        // par kusu na zpravu, takze zvlastni dotaz by byl zbytecny.
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, mime: true, size: true },
        },
        reactions: {
          orderBy: { createdAt: 'asc' },
          select: {
            code: true,
            userId: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      }),
      // Otevrel jsem si ji, takze je precteno. U kanalu k projektu tim zaroven
      // vznikne radek clenstvi, ktery drzi stav precteni.
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: me } },
        update: { lastReadAt: new Date() },
        create: { conversationId: conversation.id, userId: me },
      }),
    ]);


    // "Zobrazeno": kdo mel konverzaci otevrenou uz potom, co zprava prisla.
    // Bere se z lastReadAt clena - stejneho udaje, ze ktereho se pocitaji
    // neprectene, takze nic dalsiho se nikam neuklada.
    const ostatniClenove = conversation.members.filter((m) => m.userId !== me);

    return NextResponse.json({
      zpravy: zpravy.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        authorId: m.userId,
        authorLabel: userLabel(m.user),
        authorPhotoUrl: odkazNaFotku(m.userId, m.user.maFotku),
        mine: m.userId === me,
        replyCount: m._count.replies,
        seenBy: ostatniClenove
          .filter((clen) => clen.lastReadAt >= m.createdAt)
          .map((clen) => userLabel(clen.user)),
        reactions: shrnReakce(m.reactions, me),
        editedAt: m.editedAt ? m.editedAt.toISOString() : null,
        prilohy: m.attachments,
      })),
    });
  } catch (err) {
    console.error('GET /api/chat/konverzace/[id]/zpravy selhalo:', err);
    return NextResponse.json({ error: 'Zprávy se nepodařilo načíst.' }, { status: 500 });
  }
}

/**
 * Založí úkol ze zprávy, která začíná „@úkol" (zadání 18. 9. 2026).
 *
 * KOMU, O TOM ROZHODUJE SERVER:
 * - v soukromé konverzaci ten druhý („osoba automaticky, komu píšu"),
 * - jinde ten, koho zadavatel označil @jménem - a když nikoho, úkol nevznikne
 *   a člověk se to dozví, místo aby zpráva tiše spadla do prázdna.
 *
 * NIKDY NEVYHAZUJE do odesílání zprávy: zpráva už je v tu chvíli uložená
 * a nesmí o ni nikdo přijít jen proto, že se nepovedl úkol. Vrací se, co se
 * stalo, aby to mohl chat říct nahlas.
 */
async function zalozUkolZeZpravy(vstup: {
  text: string;
  termin?: string | null;
  conversationId: string;
  kind: string;
  clenove: string[];
  zadalId: string;
  zadalJmeno: string;
}): Promise<{ ok: true; komu: string } | { ok: false; duvod: string }> {
  try {
    // Soukroma konverzace ma prave dva cleny - ten druhy je prijemce.
    const druhy =
      vstup.kind === 'SOUKROMA' ? vstup.clenove.find((id) => id !== vstup.zadalId) ?? null : null;
    const zmineni = druhy ? [] : await zminenyTym(vstup.text, vstup.zadalId);
    const komuId = druhy ?? zmineni[0] ?? null;
    if (!komuId) return { ok: false, duvod: CHYBI_PRIJEMCE };

    const komu = await prisma.user.findFirst({
      where: { id: komuId, active: true },
      select: { id: true, name: true, email: true },
    });
    if (!komu) return { ok: false, duvod: CHYBI_PRIJEMCE };

    const nazev = nazevUkolu(vstup.text, komu.name);
    if (!nazev) return { ok: false, duvod: CHYBI_NAZEV };

    let dueDate: Date | null = null;
    if (vstup.termin) {
      const den = new Date(`${vstup.termin}T00:00:00.000Z`);
      if (!Number.isNaN(den.getTime())) dueDate = den;
    }

    const posledni = await prisma.task.findFirst({
      where: { userId: komu.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    await prisma.task.create({
      data: {
        userId: komu.id,
        title: nazev.slice(0, 300),
        dueDate,
        sortOrder: (posledni?.sortOrder ?? 0) + 10,
        zadalJmeno: vstup.zadalJmeno,
        // Zadavatel si úkol uvidí v „Zadal jsem" a dozví se, až bude
        // splněný (21. 9. 2026).
        zadalId: vstup.zadalId,
        zdrojKonverzaceId: vstup.conversationId,
      },
    });

    // Zvonek: ukol je na rozdil od zpravy zavazek - o tom se clovek dozvedet
    // musi, i kdyz ma chat zrovna zabaleny.
    await notify({
      userId: komu.id,
      kind: 'ukol-z-chatu',
      title: `Nový úkol od ${vstup.zadalJmeno}`,
      body: dueDate ? `${nazev} — do ${new Intl.DateTimeFormat('cs-CZ').format(dueDate)}` : nazev,
      url: `/chat?konverzace=${vstup.conversationId}`,
    });

    return { ok: true, komu: userLabel(komu) };
  } catch (err) {
    console.error('Založení úkolu z chatu selhalo:', err);
    return { ok: false, duvod: 'Úkol se nepodařilo založit.' };
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const me = session.user.id;

  try {
    const conversation = await nactiPristupnou(params.id, me);
    if (!conversation) return NextResponse.json({ error: 'Konverzace nenalezena.' }, { status: 404 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }

    // Odpovidat jde jen na zpravu z teze konverzace, a nikdy na odpoved -
    // vlakna zustavaji jednourovnova, stejne jako u Slacku.
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      const parent = await prisma.message.findFirst({
        where: { id: parsed.data.parentId, conversationId: conversation.id, parentId: null },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: 'Vlákno se nenašlo.' }, { status: 400 });
      parentId = parent.id;
    }

    // Prilohy uz lezi v uloziti (prohlizec je tam poslal pres podepsanou
    // adresu, viz /api/chat/prilohy/podpis). Tady se jen overi, ze tam
    // opravdu jsou a jak jsou velke - prohlizec hlasi velikost sam, takze na
    // jeho udaj se nespolehame. Co se neoveri, se proste nepripoji; zprava
    // odejde tak jako tak, at o napsany text nikdo neprijde.
    const prilohy: { key: string; name: string; mime: string; size: number }[] = [];
    for (const p of parsed.data.prilohy ?? []) {
      const overena = await overPrilohu(p.key);
      if (!overena || overena.size <= 0 || overena.size > MAX_PRILOHA_BYTES) {
        console.error('Priloha se neoverila, preskakuji:', p.key);
        continue;
      }
      prilohy.push({
        key: p.key,
        name: p.name,
        mime: p.mime || overena.mime,
        size: overena.size,
      });
    }

    if (!parsed.data.body && prilohy.length === 0) {
      return NextResponse.json({ error: 'Přílohu se nepodařilo nahrát.' }, { status: 400 });
    }

    // VŠECHNO, CO NA SOBĚ NEZÁVISÍ, JDE DO DATABÁZE NAJEDNOU (oprava
    // 12. 9. 2026: „i když chci něco odeslat, tak tam je latence tak 3 s").
    //
    // Dřív se čekalo popořadě: ulož zprávu → zjisti, komu cinknout (tři
    // dotazy) → posuň čas poslední zprávy a přečteno (dva zápisy). Šest cest
    // do databáze za sebou, každá přes pooler — a člověk se mezitím díval na
    // nehybné tlačítko. Komu poslat upozornění přitom závisí jen na TEXTU,
    // ne na uložené zprávě, takže to může běžet zároveň.
    //
    // Čas si určujeme sami a stejný dáváme všem třem zápisům; jinak by šel
    // čas poslední zprávy odvodit až z vrácené zprávy a řadilo by se to zas
    // popořadě.
    const ted = new Date();
    const vsichni = conversation.members.map((m) => m.userId).filter((id) => id !== me);

    /**
     * ZMÍNKA DOJDE I TOMU, KDO V KANÁLU JEŠTĚ NEBYL (oprava 14. 9. 2026:
     * „pořád nám nefunguje to označování uživatelů v chatu").
     *
     * Řádek členství vzniká až otevřením kanálu, takže kolega, který si
     * kanál projektu nikdy neotevřel, nebyl mezi příjemci a zmínka mu
     * nemohla cinknout — přitom kanály projektů vidí celý tým. Zmínka ho
     * proto do kanálu rovnou přihlásí.
     *
     * Jen u kanálů a dotazů: do soukromé zprávy ani do skupiny nikoho
     * přizvat nemůžeme, tam je členství pozvánka, ne zvyk.
     */
    const zmineni = await zminenyTym(parsed.data.body ?? '', me);
    const doKanalu =
      conversation.kind === 'PROJEKT' || conversation.kind === 'DOTAZ'
        ? zmineni.filter((id) => !vsichni.includes(id))
        : [];
    if (doKanalu.length > 0) {
      await prisma.conversationMember
        .createMany({
          data: doKanalu.map((userId) => ({ conversationId: conversation.id, userId })),
          skipDuplicates: true,
        })
        .catch(() => undefined);
    }
    const kandidati = Array.from(new Set([...vsichni, ...doKanalu]));

    const [message, prijemci] = await Promise.all([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: me,
          body: parsed.data.body,
          parentId,
          createdAt: ted,
          attachments: { create: prilohy },
        },
        include: {
          user: { select: { id: true, name: true, email: true, maFotku: true } },
          attachments: { select: { id: true, name: true, mime: true, size: true } },
        },
      }),
      // Kdo o tom chce doopravdy vedet - kazdy si to nastavuje sam
      // (zadani 12. 9. 2026), viz lib/chatUpozorneniServer.ts. Zprava se
      // dorucuje vsem tak jako tak; tohle rozhoduje jen o tom, komu to cinkne.
      //
      // Kanal k projektu je pro cely tym, ale upozorneni se posilaji jen tem,
      // kdo v nem opravdu jsou (radek clenstvi vznika otevrenim konverzace) -
      // jinak by kazda zprava v kazdem kanalu budila cely Mediaspace.
      komuPoslatUpozorneni(kandidati, {
        conversationId: conversation.id,
        druh: conversation.kind,
        body: parsed.data.body ?? '',
        parentId,
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: ted },
      }),
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: me } },
        update: { lastReadAt: ted },
        create: { conversationId: conversation.id, userId: me, lastReadAt: ted },
      }),
    ]);

    // Push az po ulozeni a bez cekani na vysledek - kdyz selze, zprava uz je
    // davno v databazi a nikdo o ni neprijde.
    if (prijemci.length > 0) {
      const kdo = userLabel(message.user);
      const nahled = parsed.data.body
        ? parsed.data.body.replace(/:ms-[a-z-]+:/g, '').trim().slice(0, 140)
        : `Poslal(a) ${prilohy.length === 1 ? 'přílohu' : 'přílohy'}`;
      void posliPush(prijemci, {
        titulek: conversation.kind === 'PROJEKT' ? `# ${conversation.name ?? 'Projekt'}` : kdo,
        text: conversation.kind === 'PROJEKT' ? `${kdo}: ${nahled}` : nahled,
        odkaz: `/chat?konverzace=${conversation.id}`,
        // Nova zprava z teze konverzace prepise predchozi upozorneni.
        znacka: `chat-${conversation.id}`,
      });

      /**
       * ZMÍNKA POD ZVONEK NEJDE (zadání 17. 9. 2026: „do zvonečku na horní
       * liště by neměly chodit notifikace zmínky z chatu").
       *
       * Od 14. 9. 2026 tu zmínka zakládala i řádek pod zvonkem, aby se
       * neztratila tomu, kdo prohlížeči nepovolil upozornění. V praxi z toho
       * byl zvonek plný chatu - a chat na sebe upozorňuje sám: odznakem
       * u doku, počítadlem nepřečtených u konverzace a pushem.
       *
       * Staré řádky, které takhle vznikly, se pod zvonkem neukazují - viz
       * lib/notifications.ts.
       */
    }

    /**
     * ÚKOL (zadání 18. 9. 2026) - až po uložení zprávy. Zpráva zůstává
     * v chatu tak jako tak; když se úkol nepovede, vrátí se důvod a chat ho
     * ukáže pod polem, ať to člověk ví hned a může to opravit.
     */
    let ukol: { komu: string } | { chyba: string } | null = null;
    if (parsed.data.ukol && jeUkol(parsed.data.body ?? '')) {
      const vysledek = await zalozUkolZeZpravy({
        text: parsed.data.body ?? '',
        termin: parsed.data.ukol.termin ?? null,
        conversationId: conversation.id,
        kind: conversation.kind,
        clenove: conversation.members.map((m) => m.userId),
        zadalId: me,
        zadalJmeno: userLabel(message.user),
      });
      ukol = vysledek.ok ? { komu: vysledek.komu } : { chyba: vysledek.duvod };
    }

    return NextResponse.json(
      {
        id: message.id,
        body: message.body,
        ukol,
        createdAt: message.createdAt.toISOString(),
        authorId: message.userId,
        authorLabel: userLabel(message.user),
        authorPhotoUrl: odkazNaFotku(message.userId, message.user.maFotku),
        mine: true,
        replyCount: 0,
        // Prave odeslanou zpravu jeste nikdo videt nemohl.
        seenBy: [],
        reactions: [],
        editedAt: null,
        prilohy: message.attachments,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/chat/konverzace/[id]/zpravy selhalo:', err);
    return NextResponse.json({ error: 'Zprávu se nepodařilo odeslat.' }, { status: 500 });
  }
}
