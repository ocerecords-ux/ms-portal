import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { podkladyNataceciTextu } from '@/lib/nataceniTextServer';
import { Pult } from './Pult';

/**
 * NAŠE NATÁČECÍ PROSTŘEDÍ (zadání 11. 10. 2026: „nešlo by ještě obrndovat
 * nějak to prostředí pro natáčení? Abychom měli otevřený přímo na levo text
 * z výstupů a v pravo okna účastníků?").
 *
 * VLEVO TEXT, VPRAVO LIDI. Přesně tohle v Meetu nejde: Google svoji stránku
 * do našeho rámečku vložit nedovolí, takže „text vedle obrazu" znamená mít
 * hovor vlastní. Text se bere z VÝSTUPŮ projektu - z týchž dat jako natáčecí
 * list, ať se obrazovka a dokument nikdy nerozejdou.
 *
 * ZKUŠEBNA, NE PROVOZ (rozhodnutí 11. 10. 2026: „Zatím ale nechme běžný provoz
 * na Google Meet. Překlopíme to, až to bude dávat smysl"). Odkaz sem se
 * v pozvánkách neposílá; otevírá se ručně z karty Hosté na natáčení.
 *
 * VEŘEJNÁ STRÁNKA BEZ PŘIHLÁŠENÍ - chrání ji náhodný token místnosti, stejně
 * jako čekárnu. Herec ani klient u nás účet nemají.
 */
export const dynamic = 'force-dynamic';

/**
 * KUDY SE PROHLÍŽEČE NAJDOU. STUN je ohláška „tohle je moje adresa" -
 * stačí na většinu sítí a je zdarma.
 *
 * TURN (PŘEPOSÍLÁNÍ) ZATÍM NEMÁME. Přibližně jedno spojení z pěti - firemní
 * sítě, některé mobilní operátoři - se naprímo nenaskládá a bez přeposlání
 * neprojde. Proto se adresa če čte z proměnných prostředí: až bude pult ostře,
 * připojí se TURN bez zásahu do kódu.
 */
function kudyNaSebe(): RTCIceServer[] {
  const servery: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turn = process.env.TURN_URL;
  if (turn) {
    servery.push({
      urls: turn.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USER || undefined,
      credential: process.env.TURN_PASS || undefined,
    });
  }
  return servery;
}

export default async function PultNataceni({ params }: { params: { token: string } }) {
  const blok = await prisma.studioBlock
    .findUnique({
      where: { pultToken: params.token },
      select: {
        start: true,
        end: true,
        title: true,
        actorName: true,
        projectName: true,
        caflouProjectId: true,
        studio: { select: { name: true, timezone: true } },
      },
    })
    .catch(() => null);

  if (!blok) notFound();

  /**
   * Text ze VÝSTUPŮ. Když se nepodaří načíst (projekt bez výstupů), pult se
   * stejně otevře - hovor je to hlavní a prázdný panel je lepší než rozbitá
   * stránka v okamžiku, kdy už se čeká na natáčení.
   */
  const podklad = blok.caflouProjectId
    ? await podkladyNataceciTextu(blok.caflouProjectId).catch(() => null)
    : null;

  const spoty =
    podklad && podklad.ok
      ? podklad.vystupy.map((v) => ({
          nazev: v.nazev,
          delka: v.delka,
          text: v.text ?? null,
        }))
      : [];

  return (
    <Pult
      token={params.token}
      nazevProjektu={blok.projectName?.trim() || blok.title}
      herec={blok.actorName}
      studio={blok.studio?.name ?? null}
      zacatek={blok.start.toISOString()}
      konec={blok.end.toISOString()}
      pasmo={blok.studio?.timezone || 'Europe/Prague'}
      uvod={podklad && podklad.ok ? podklad.vzor.uvod : null}
      spoty={spoty}
      iceServers={kudyNaSebe()}
    />
  );
}
