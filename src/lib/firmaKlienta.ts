/**
 * PŘEPÍNÁNÍ MEZI FIRMAMI U JEDNOHO ÚČTU (zadání 15. 10. 2026: „máme jednoho
 * klienta, který by potřeboval přepínat mezi firmami Audiolibrix a Čti mi!.
 * Přihlašoval by se jen tímto mailem").
 *
 * PROČ JEN COOKIE A JEDNO MÍSTO V auth.ts. Celý portál se rozhoduje podle
 * `session.user.companyId` - projekty, objednávky, doklady, nahrávky, dotazy.
 * Kdyby se firma vybírala v každé obrazovce zvlášť, musely by se předělat
 * všechny; takhle se vymění na jednom místě a zbytek portálu se chová přesně
 * tak, jako kdyby ten člověk k té firmě patřil. Je to stejný postup jako
 * u náhledového účtu, který si podle cookie půjčuje roli (lib/nahledRole.ts).
 *
 * COOKIE SAMA NIC NEOTEVÍRÁ. Server ji vždycky porovná se seznamem firem
 * u účtu (`companyId` + `dalsiFirmy`). Kdyby si ji někdo přepsal na cizí
 * firmu, nestane se nic - spadne to zpátky na domovskou.
 */

/** Jméno cookie s vybranou firmou. Čte ji server (viz lib/auth.ts). */
export const FIRMA_COOKIE = 'ms-firma';

/**
 * Smí tenhle účet vystupovat za tuhle firmu? Prázdná volba i cizí firma
 * končí na domovské - nikdy na „žádné firmě", to by klientovi zhaslo půl
 * portálu.
 */
export function povolenaFirma(
  volba: string | null | undefined,
  domovska: string | null,
  dalsi: string[],
): string | null {
  if (!volba) return domovska;
  const povolene = [domovska, ...dalsi].filter(Boolean) as string[];
  return povolene.includes(volba) ? volba : domovska;
}
