import { prisma } from '@/lib/db';
import { odkazNaPrehrani } from '@/lib/dropbox';
import { prectiMetadataZeCtecky, type Ctecka } from '@/lib/metadataHudby';
import { uploadObalHudbyBuffer } from '@/lib/storage';

/**
 * DOPLNĚNÍ ÚDAJŮ U STARŠÍCH SKLADEB (17. 10. 2026: „tady se nepropisují autor
 * a název skladby. v metadatech přitom jsou. taky i obrázek").
 *
 * Skladby vložené dřív, než portál uměl číst metadata, mají jen název odvozený
 * ze jména souboru. Znovu je nahrávat kvůli tomu nemá smysl - padesát
 * megabajtů po lince jen proto, aby se přečetlo pár set bajtů štítku.
 *
 * ČTE SE JEN ZAČÁTEK SOUBORU, A TO PŘES `Range`. Dropbox vydá dočasnou adresu
 * a z ní se stáhnou jen ty kousky, které štítek opravdu obsahují - u WAVu se
 * přeskakuje po hlavičkách bloků, ne po zvuku. Z padesátimegového souboru se
 * tak přenese pár set kilobajtů.
 *
 * NEPŘEPISUJE, CO UŽ JE VYPLNĚNÉ. Název a autor se mění jen tehdy, když chybí
 * nebo když je název jen jménem souboru; cokoliv, co už v kartě stojí, zůstává.
 */

/** Nad tohle se do souboru nekouká - štítek takhle hluboko nebývá. */
const STROP_CTENI = 6 * 1024 * 1024;

/** Obal větší než tohle do úložiště neposíláme. */
const STROP_OBALU = 4 * 1024 * 1024;

function ctenizOdkazu(url: string, velikost: number): Ctecka {
  return {
    size: velikost,
    async cti(od, do_) {
      const konec = Math.min(do_, velikost);
      if (od >= konec) return new Uint8Array(0);
      const res = await fetch(url, { headers: { Range: `bytes=${od}-${konec - 1}` } });
      // 206 = server opravdu poslal jen ten kousek. Cokoliv jiného znamená,
      // že by se táhl celý soubor - to radši ne, viz `umiPoCastech` níž.
      if (res.status !== 206) {
        await res.body?.cancel().catch(() => undefined);
        return new Uint8Array(0);
      }
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/**
 * UMÍ TEN ODKAZ POSÍLAT SOUBOR PO ČÁSTECH?
 *
 * Celá tahle funkce stojí na tom, že se z padesátimegového WAVu stáhne jen
 * začátek. Kdyby Dropbox hlavičku `Range` ignoroval, odpověděl by celým
 * souborem - a tahat ho na server kvůli štítku je přesně to, čemu se vyhýbáme.
 * Ptá se proto napřed na šestnáct bajtů a odpověď, která by byla celá, hned
 * zahodí.
 */
async function umiPoCastech(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-15' } });
    const ok = res.status === 206;
    if (!ok) await res.body?.cancel().catch(() => undefined);
    else await res.arrayBuffer();
    return ok;
  } catch {
    return false;
  }
}

export type VysledekDoplneni = {
  zmeneno: boolean;
  nazev: string | null;
  autor: string | null;
  obal: boolean;
  duvod?: string;
};

export async function doplnMetadataSkladby(id: string): Promise<VysledekDoplneni> {
  const prazdny: VysledekDoplneni = { zmeneno: false, nazev: null, autor: null, obal: false };

  const zaznam = (await prisma.hudbaProjektu
    .findUnique({
      where: { id },
      select: { cesta: true, nazev: true, autor: true, obalKlic: true, velikost: true },
    })
    .catch(() => null)) as {
    cesta: string;
    nazev: string;
    autor: string | null;
    obalKlic: string | null;
    velikost: number;
  } | null;
  if (!zaznam) return { ...prazdny, duvod: 'Skladba se nenašla.' };

  const odkaz = await odkazNaPrehrani(zaznam.cesta);
  if (!odkaz) return { ...prazdny, duvod: 'Dropbox soubor nevydal.' };

  if (!(await umiPoCastech(odkaz))) {
    return { ...prazdny, duvod: 'Soubor nejde číst po částech.' };
  }

  const jmenoSouboru = zaznam.cesta.split('/').pop() ?? zaznam.nazev;
  const velikost = zaznam.velikost > 0 ? zaznam.velikost : STROP_CTENI;

  let udaje;
  try {
    udaje = await prectiMetadataZeCtecky(
      ctenizOdkazu(odkaz, Math.min(velikost, STROP_CTENI)),
      jmenoSouboru,
    );
  } catch (err) {
    console.error('Metadata skladby se nepodařilo dočíst:', err);
    return { ...prazdny, duvod: 'Soubor se nepodařilo přečíst.' };
  }

  // Obal do úložiště, jen když tam ještě žádný není.
  let obalKlic: string | null = null;
  if (!zaznam.obalKlic && udaje.obal && udaje.obal.bajty.length <= STROP_OBALU) {
    obalKlic = await uploadObalHudbyBuffer(Buffer.from(udaje.obal.bajty), udaje.obal.mime);
  }

  /**
   * Název se přepisuje jen tehdy, když to dosud bylo jméno souboru. Jakmile
   * ho někdo vložil se štítkem, je jeho - přepsat ho zpátky by znamenalo, že
   * se karta sama od sebe změní pod rukama.
   */
  const nazevBylZeSouboru = zaznam.nazev === jmenoSouboru.replace(/\.[^.]+$/, '');
  const novyNazev = nazevBylZeSouboru && udaje.nazev !== zaznam.nazev ? udaje.nazev : null;
  const novyAutor = !zaznam.autor && udaje.autor ? udaje.autor : null;

  const data: { nazev?: string; autor?: string; obalKlic?: string; metadataCtenaAt: Date } = {
    metadataCtenaAt: new Date(),
  };
  if (novyNazev) data.nazev = novyNazev;
  if (novyAutor) data.autor = novyAutor;
  if (obalKlic) data.obalKlic = obalKlic;

  await prisma.hudbaProjektu.update({ where: { id }, data }).catch((err) => {
    console.error('Doplněná metadata se nepodařilo uložit:', err);
  });

  return {
    zmeneno: Boolean(novyNazev || novyAutor || obalKlic),
    nazev: novyNazev,
    autor: novyAutor,
    obal: Boolean(obalKlic),
  };
}
