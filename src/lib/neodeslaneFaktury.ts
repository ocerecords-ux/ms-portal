import { prisma } from '@/lib/db';

/**
 * NEODESLANÁ FAKTURA (zadání 29. 10. 2026: „když se stane, že se neodešle
 * z nějakého důvodu faktura, tak by to mělo nějak zařvat").
 *
 * Faktura, která se nepodařilo odeslat, si u sebe nese DŮVOD. Dokud tam je,
 * svítí červeně — v seznamu Faktur, v jejím detailu i u projektu. Zmizí to
 * samo, jakmile faktura odejde; ručně se červená nikde neodklikává, aby se
 * nestalo, že si někdo odklepne výstrahu a faktura dál leží.
 *
 * PROČ TO NESTAČILO MÍT V LOGU. Automatická faktura u reklam se vystavuje
 * a posílá bez toho, aby u toho kdokoli od nás byl (spustí ji klient, když
 * schválí spot). Když neodešla, dozvěděl se to zvonek — a ten se dá týden
 * nerozbalit. Nevyfakturovaná zakázka se pak najde až při uzávěrce.
 *
 * KDO TO VIDÍ: kdo má na kartě zaškrtnuté „Vidí Banku". Stejné pravidlo jako
 * u značek dokladů u projektu (viz lib/dokladyUProjektu.tsx) a ze stejného
 * důvodu: je to tatáž dvojice a tatáž věc — peníze zakázky.
 */

/** Důvod se krátí - do pruhu patří věta, ne celý výpis chyby. */
const NEJVIC_ZNAKU = 400;

export async function zapisChybuOdeslani(invoiceId: string, duvod: string): Promise<void> {
  const text = (duvod || '').trim().slice(0, NEJVIC_ZNAKU) || 'Fakturu se nepodařilo odeslat.';
  await prisma.invoice
    .update({
      where: { id: invoiceId },
      data: { chybaOdeslani: text, chybaOdeslaniAt: new Date() },
    })
    .catch((err) => {
      // Zápis výstrahy nesmí shodit odesílání - to už selhalo samo o sobě.
      console.error(`Chybu odeslání faktury ${invoiceId} se nepodařilo zapsat:`, err);
    });
}

/** Faktura odešla - červená u ní nemá co dělat. */
export async function smazChybuOdeslani(invoiceId: string): Promise<void> {
  await prisma.invoice
    .update({ where: { id: invoiceId }, data: { chybaOdeslani: null, chybaOdeslaniAt: null } })
    .catch(() => undefined);
}

export type NeodeslanaFaktura = {
  id: string;
  cislo: string;
  odberatel: string;
  projekt: string | null;
  duvod: string;
  kdy: Date | null;
};

/**
 * Faktury, které někde uvázly. Stornované se nepočítají - u nich už je po
 * všem a červený pruh by jen strašil.
 *
 * Filtr naší firmy se předává z přepínače v liště Dokladů; bez něj se ukážou
 * všechny.
 */
export async function neodeslaneFaktury(
  jenFirma: { issuerCompanyId?: string } = {},
): Promise<NeodeslanaFaktura[]> {
  const radky = await prisma.invoice
    .findMany({
      where: { ...jenFirma, chybaOdeslani: { not: null }, status: { not: 'CANCELLED' } },
      orderBy: { chybaOdeslaniAt: 'desc' },
      take: 20,
      select: {
        id: true,
        number: true,
        projectName: true,
        chybaOdeslani: true,
        chybaOdeslaniAt: true,
        company: { select: { name: true } },
      },
    })
    .catch(() => []);

  return radky.map((f) => ({
    id: f.id,
    cislo: f.number,
    odberatel: f.company?.name ?? '',
    projekt: f.projectName,
    duvod: f.chybaOdeslani ?? '',
    kdy: f.chybaOdeslaniAt,
  }));
}
