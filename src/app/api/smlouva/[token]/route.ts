import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  documentHash,
  podepisZaNas,
  posliPodepsanouSmlouvu,
  signatureContext,
  validSignatureImage,
} from '@/lib/contractsServer';

// Podpis (nebo odmitnuti) protistranou. VEREJNY endpoint - smlouva se hleda
// vyhradne podle tokenu z odkazu, zadne ID z adresy se nikam nepropisuje.
// Zadny overovaci kod se nezadava: identitu nese jednorazovy odkaz poslany
// na e-mail podepisujiciho (zadani 8. 9. 2026).
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const telo = await req.json().catch(() => ({}));
    const akce = telo?.action;

    const contract = await prisma.contract.findUnique({
      where: { accessToken: params.token },
      include: { signatures: true },
    });
    if (!contract) return NextResponse.json({ error: 'Smlouva nenalezena.' }, { status: 404 });
    if (contract.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Tuhle smlouvu druhá strana zrušila.' }, { status: 409 });
    }
    if (contract.status === 'SIGNED') {
      return NextResponse.json({ error: 'Smlouva je už podepsaná.' }, { status: 409 });
    }

    if (akce === 'reject') {
      const duvod = typeof telo?.reason === 'string' ? telo.reason.trim().slice(0, 1000) : '';
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectedReason: duvod || null },
      });
      return NextResponse.json({ ok: true });
    }

    if (akce !== 'sign') {
      return NextResponse.json({ error: 'Neznámá akce.' }, { status: 400 });
    }

    if (!validSignatureImage(telo?.imageData)) {
      return NextResponse.json({ error: 'Chybí podpis — podepište se do rámečku.' }, { status: 400 });
    }
    if (contract.signatures.some((s) => s.role === 'PROTISTRANA')) {
      return NextResponse.json({ error: 'Smlouva už je z vaší strany podepsaná.' }, { status: 409 });
    }

    const jmeno = typeof telo?.name === 'string' && telo.name.trim() ? telo.name.trim().slice(0, 200) : contract.signerName;
    const hash = documentHash(contract.body);
    const ctx = signatureContext(req.headers);

    /**
     * NÁŠ PODPIS MUSÍ BÝT NA MÍSTĚ DŘÍV (oprava 15. 9. 2026: „a hlavně není
     * v tu chvíli podepsaná"). Od 15. 9. se připojuje už při odeslání, tohle
     * je pojistka pro smlouvy odeslané dřív a pro případ, že se to tehdy
     * nepovedlo - jinak by herec podepsal a dostal PDF, kde z naší strany
     * podpis chybí.
     */
    const nasPodpis = contract.signatures.some((s) => s.role === 'MEDIASPACE')
      ? true
      : Boolean(await podepisZaNas(contract.id, ctx));

    /**
     * ODKLIKAVANI JEDNOTLIVYCH STRANEK UZ NENI (zadani 15. 9. 2026: „pojdme
     * u tech smluv obecne zrusit to podepisovani kazde strany zvlast. Nechme
     * to zpet jen na jeden souhlas"). Puvodne se muselo projit a odklepnout
     * kazdou stranku zvlast, jako to ma Signi; pro herce to byla jen prace
     * navic. Zustava jeden souhlas pod celym dokumentem - ten se uklada
     * s casem, IP adresou a otiskem textu, takze dukazni hodnota je stejna.
     */

    await prisma.$transaction(async (tx) => {
      await tx.contractSignature.create({
        data: {
          contractId: contract.id,
          role: 'PROTISTRANA',
          name: jmeno,
          email: contract.signerEmail,
          imageData: telo.imageData,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          documentHash: hash,
        },
      });
      await tx.contract.update({
        where: { id: contract.id },
        data: {
          bodyHash: contract.bodyHash ?? hash,
          ...(nasPodpis ? { status: 'SIGNED', completedAt: new Date() } : {}),
        },
      });
    });

    /**
     * MAIL S ODKAZEM I PDF ODCHÁZÍ HNED PO PODPISU (zadání 15. 9. 2026:
     * „potřebuju, ať po tom, co herec smlouvu podepíše, ať mu přijde rovnou
     * odkaz i samotné PDF podepsané smlouvy do mailu").
     *
     * Dřív se čekalo, až bude smlouva podepsaná z obou stran - když u nás
     * podpis chyběl, herec nedostal nic. Teď se posílá vždycky; co v PDF je,
     * to je v něm vidět.
     *
     * Až po transakci a bez vyhození: podpis už je uložený, mail ho nesmí
     * shodit.
     */
    await posliPodepsanouSmlouvu(contract.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/smlouva/[token] selhalo:', err);
    const message = err instanceof Error ? err.message : 'Neznámá chyba.';
    return NextResponse.json({ error: `Podpis se nepodařilo uložit (${message}).` }, { status: 500 });
  }
}
