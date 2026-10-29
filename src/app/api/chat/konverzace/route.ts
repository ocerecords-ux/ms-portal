import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canUseChat, loadConversations, loadTeam } from '@/lib/chatServer';
import { klicDvojice } from '@/lib/chat';
import { INTERNAL_ROLES, ROBOT_ROLES } from '@/lib/roles';
import { zkusDatabazi } from '@/lib/dbZnovu';
import { nactiStatusy } from '@/lib/statusyServer';
import { odpovedChyby } from '@/lib/chybyApi';

// Seznam konverzaci + zalozeni nove (zadani 8. 9. 2026).
export const dynamic = 'force-dynamic';

/**
 * Koho jde do konverzace pridat: tym Mediaspace a roboti (Bruno). Klient ani
 * herec chat nemaji. Stejny seznam vraci chatServer.loadTeam - musi sedet,
 * jinak je nekdo v nabidce, ale zalozeni konverzace s nim spadne.
 */
const CLENOVE_CHATU = [...INTERNAL_ROLES, ...ROBOT_ROLES];

const schema = z.discriminatedUnion('kind', [
  // Kanal k projektu z Caflou - zaklada se az ve chvili, kdy do nej nekdo
  // poprve napise. Kanalu je tim presne tolik, kolik se jich opravdu pouziva.
  z.object({
    kind: z.literal('PROJEKT'),
    caflouProjectId: z.string().trim().min(1),
    name: z.string().trim().min(1).max(120),
  }),
  z.object({ kind: z.literal('SOUKROMA'), userId: z.string().trim().min(1) }),
  z.object({
    kind: z.literal('SKUPINA'),
    name: z.string().trim().min(1, 'Skupina musí mít název.').max(60),
    userIds: z.array(z.string().trim().min(1)).min(1, 'Vyberte aspoň jednoho člověka.').max(30),
  }),
]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  try {
    // JEDEN OPAKOVANY POKUS. Supabase pooler ma v session modu patnact mist
    // a pri nasazeni byvaji chvili plna - seznam konverzaci pak spadne na
    // vterinovem zadrhelu, se kterym neni nic spatne. Stejny pristup uz
    // pouziva build (scripts/priprav-databazi.mjs).
    const [konverzace, tym] = await zkusDatabazi(() =>
      Promise.all([
        loadConversations(session.user.id, session.user.role),
        loadTeam(session.user.id),
      ]),
    );
    /**
     * STATUSY (zadání 25. 9. 2026). Počítají se tady, ne v loadConversations:
     * potřebují jeden seznam účtů za všechny rozhovory i celý tým, aby se
     * kalendář nečetl dokola pro každý řádek zvlášť.
     */
    const statusy = await nactiStatusy([
      session.user.id,
      ...tym.map((t) => t.id),
      ...konverzace.map((k) => k.protejsekId).filter((id): id is string => Boolean(id)),
    ]);

    return NextResponse.json({
      konverzace: konverzace.map((k) => ({
        ...k,
        status: k.protejsekId ? (statusy[k.protejsekId] ?? null) : null,
      })),
      tym: tym.map((t) => ({ ...t, status: statusy[t.id] ?? null })),
      /**
       * JÁ SÁM (zadání 21. 10. 2026: „nějak se chová divně označení").
       *
       * Seznam týmu je schválně BEZ MĚ - do nabídky pod zavináčem sám sebe
       * nikdo nepotřebuje. Jenže podle téhož seznamu se zmínky i zvýrazňují,
       * takže zmínka MĚ se jediná zobrazovala jako obyčejný text: Barbora
       * v „@Barbora Šíblová a @Ondřej Černý" viděla zvýrazněného jen Ondřeje.
       * Pro zvýraznění proto chodí jméno zvlášť.
       */
      ja: { id: session.user.id, label: session.user.name || session.user.email },
      mujStatus: statusy[session.user.id] ?? null,
    });
  } catch (err) {
    // Databaze bez tabulek chatu (jeste nedobehl `prisma db push`) nesmi
    // shodit stranku - panel se proste ukaze prazdny.
    //
    // ALE PRAZDNY PANEL NESMI VYPADAT JAKO "nic tu neni" (12. 9. 2026:
    // „zmizely nam z chatu skupiny, ktere jsme tam meli vytvorene").
    // Tichy catch delal z rozbite databaze prazdny seznam a nebylo poznat,
    // ze se neco pokazilo. Adminovi proto duvod rovnou posleme.
    console.error('GET /api/chat/konverzace selhalo:', err);
    const duvod = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      konverzace: [],
      tym: [],
      chyba: session.user.role === 'ADMIN' ? duvod.slice(0, 900) : 'Chat se teď nepodařilo načíst.',
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canUseChat(session.user.role)) {
    return odpovedChyby('chybaApi.bezOpravneni', 403);
  }
  const me = session.user.id;

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Neplatná data.' }, { status: 400 });
    }
    const data = parsed.data;

    if (data.kind === 'PROJEKT') {
      const existing = await prisma.conversation.findUnique({
        where: { caflouProjectId: data.caflouProjectId },
      });
      if (existing) {
        /**
         * ZAVŘENÝ KANÁL SE OTEVŘE ZPÁTKY (oprava 6. 10. 2026: „nejde otevřít
         * v chatu kanál Nástroje pro život").
         *
         * Když je kanál zavřený, v seznamu rozhovorů není - prohlížeč tedy
         * zkusí „založit nový", dostane odsud jeho id a otevře rozhovor,
         * který v seznamu pořád chybí. Na obrazovce zůstalo prázdné okno.
         * Klepnutí na kanál v záložce Projekty je jasný pokyn, že se v něm
         * má psát, takže ho tu rovnou vrátíme mezi otevřené.
         */
        if (existing.uzavrenoAt) {
          await prisma.conversation.update({
            where: { id: existing.id },
            data: { uzavrenoAt: null },
          });
        }
        return NextResponse.json({ id: existing.id });
      }
      const created = await prisma.conversation.create({
        data: {
          kind: 'PROJEKT',
          name: data.name,
          caflouProjectId: data.caflouProjectId,
          createdById: me,
          members: { create: { userId: me } },
        },
      });
      return NextResponse.json({ id: created.id }, { status: 201 });
    }

    if (data.kind === 'SOUKROMA') {
      if (data.userId === me) {
        return odpovedChyby('chybaApi.chatSamSeSebou', 400);
      }
      // Druhy clovek musi byt z tymu - jinak by sla zalozit konverzace s
      // klientem nebo hercem, kteri chat vubec nemaji.
      //
      // ROBOT SEM PATRI TAKY (oprava 23. 9. 2026: „nemůžu psát Brunovi přímo
      // do chatu"). Bruno v seznamu lidi byl, ale zalozeni konverzace ho
      // odmitalo - seznam roli tady zustal bez robotu. Viz chatServer.loadTeam.
      const druhy = await prisma.user.findFirst({
        where: { id: data.userId, active: true, role: { in: CLENOVE_CHATU } },
        select: { id: true },
      });
      if (!druhy) return odpovedChyby('chybaApi.clenTymuNeznamy', 400);

      /**
       * JEDEN ROZHOVOR NA DVOJICI (oprava 20. 10. 2026: „Peter má v chatu dvě
       * konverzace s jednou Helčou").
       *
       * Hledání „konverzace, kde jsou oba" bylo správně, ale ne atomicky: dva
       * požadavky ve stejnou chvíli (dvojklik, dvě zařízení, Bruno píšící
       * zrovna, když si člověk rozhovor otevře) nenašly nic obě a založily
       * dva. Rozhoduje proto KLÍČ DVOJICE s unikátním indexem - závoru drží
       * databáze, ne pořadí dotazů.
       *
       * Starší rozhovor klíč ještě nemá, tak se nejdřív hledá postaru a klíč
       * se mu doplní; teprve když není, zakládá se nový.
       */
      const klic = klicDvojice(me, druhy.id);

      const existing = await prisma.conversation.findFirst({
        where: {
          kind: 'SOUKROMA',
          AND: [{ members: { some: { userId: me } } }, { members: { some: { userId: druhy.id } } }],
        },
        select: { id: true, parKlic: true },
      });
      if (existing) {
        if (!existing.parKlic) {
          await prisma.conversation
            .update({ where: { id: existing.id }, data: { parKlic: klic } })
            .catch(() => undefined);
        }
        return NextResponse.json({ id: existing.id });
      }

      // Upsert podle klice: kdyz mezitim stihl rozhovor zalozit nekdo druhy,
      // vrati se jeho, ne druhy radek.
      const created = await prisma.conversation.upsert({
        where: { parKlic: klic },
        update: {},
        create: {
          kind: 'SOUKROMA',
          parKlic: klic,
          createdById: me,
          members: { create: [{ userId: me }, { userId: druhy.id }] },
        },
        select: { id: true },
      });
      return NextResponse.json({ id: created.id }, { status: 201 });
    }

    const clenove = await prisma.user.findMany({
      where: { id: { in: data.userIds }, active: true, role: { in: CLENOVE_CHATU } },
      select: { id: true },
    });
    const ids = Array.from(new Set([me, ...clenove.map((u) => u.id)]));
    const created = await prisma.conversation.create({
      data: {
        kind: 'SKUPINA',
        name: data.name,
        createdById: me,
        members: { create: ids.map((id) => ({ userId: id })) },
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/chat/konverzace selhalo:', err);
    return odpovedChyby('chybaApi.zalozeniNezdarilo', 500);
  }
}
