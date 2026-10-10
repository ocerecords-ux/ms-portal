import { zabalZip, type SouborDoZipu } from '@/lib/zipZapis';
import {
  rozeberList,
  type ListNataceni,
  type PodkladyTextu,
  type VystupProText,
} from '@/lib/nataceniText';

/**
 * NATÁČECÍ LIST JAKO .DOCX (zadání 30. 9. 2026: „chci ať to vypadá na disku,
 * jako v tom náhledu").
 *
 * PROČ NE HTML. Do teď se na Disk posílalo totéž HTML, které se ukazuje
 * v náhledu, a Google si z něj měl udělat dokument. Dvakrát po sobě z toho
 * vznikl PRÁZDNÝ dokument bez názvu: nahrání prošlo, převod ne. Převod
 * z .docx je proti tomu ta cesta, kterou Disk umí nejlíp - je to formát
 * Wordu, ne odhadování, co která značka v HTML znamená.
 *
 * Náhled v portálu zůstává HTML (vykresluje se v prohlížeči) a obě podoby
 * sázejí TATÁŽ data z `rozeberList`, takže se nemůžou rozejít v obsahu.
 *
 * Soubor se skládá ručně - .docx je ZIP s několika XML soubory a portál kvůli
 * tomu nemá co tahat další závislost (viz zipZapis.ts).
 */

/** Barvy značky bez mřížky - tak je chce WordprocessingML. */
const FIALOVA = '6B2AF0';
const ZELENA = '1FDF67';
const INKOUST = '201A33';
const SEDA = '6B6880';
const LINKA = 'E3E0EC';
const BILA = 'FFFFFF';

/**
 * A4 na výšku, okraje 2 cm. Míry ve Wordu jsou ve dvacetinách bodu (twip):
 * 11906 × 16838 je A4, 1134 twipů jsou 2 cm.
 */
const SIRKA_STRANY = 11906;
const OKRAJ = 1134;
const SIRKA_TEXTU = SIRKA_STRANY - 2 * OKRAJ;
/** Kolik z hlavičky zabere logo. Zbytek je text. */
const SLOUPEC_LOGA = 2200;

function xml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type StylRunu = {
  /** Velikost v bodech. */
  velikost: number;
  barva: string;
  tucne?: boolean;
  /** Rozpal písmen v bodech - „NATÁČECÍ LIST" nad názvem projektu. */
  rozpal?: number;
};

/**
 * Jeden kus textu. Řádky uvnitř odstavce se oddělují `<w:br/>`; mezery na
 * začátku řádku drží `xml:space="preserve"`, takže odsazený scénář zůstane
 * odsazený i v dokumentu (v HTML to dělá white-space:pre-wrap).
 */
function run(text: string, styl: StylRunu): string {
  const rPr =
    `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>` +
    (styl.tucne ? '<w:b/>' : '') +
    `<w:color w:val="${styl.barva}"/><w:sz w:val="${Math.round(styl.velikost * 2)}"/>` +
    `<w:szCs w:val="${Math.round(styl.velikost * 2)}"/>` +
    (styl.rozpal ? `<w:spacing w:val="${Math.round(styl.rozpal * 20)}"/>` : '') +
    `</w:rPr>`;

  const kusy = text.split('\n');
  const telo = kusy
    .map((radek, i) => (i === 0 ? '' : '<w:br/>') + `<w:t xml:space="preserve">${xml(radek)}</w:t>`)
    .join('');
  return `<w:r>${rPr}${telo}</w:r>`;
}

type StylOdstavce = {
  /** Mezera nad a pod odstavcem v bodech. */
  nad?: number;
  pod?: number;
  vpravo?: boolean;
  /** Linka nad odstavcem - dělí spoty a odděluje patičku. */
  linkaNad?: boolean;
  /** Zarážka vpravo - patička má vlevo značku a vpravo název projektu. */
  zarazkaVpravo?: boolean;
};

function odstavec(obsah: string, styl: StylOdstavce = {}): string {
  const pPr =
    `<w:pPr>` +
    (styl.linkaNad
      ? `<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="${LINKA}"/></w:pBdr>`
      : '') +
    (styl.zarazkaVpravo ? `<w:tabs><w:tab w:val="right" w:pos="${SIRKA_TEXTU}"/></w:tabs>` : '') +
    `<w:spacing w:before="${Math.round((styl.nad ?? 0) * 20)}" w:after="${Math.round(
      (styl.pod ?? 0) * 20,
    )}" w:line="264" w:lineRule="auto"/>` +
    (styl.vpravo ? '<w:jc w:val="right"/>' : '') +
    `</w:pPr>`;
  return `<w:p>${pPr}${obsah}</w:p>`;
}

/** Odstavce z prostého textu - prázdný řádek dělá nový odstavec, jako v náhledu. */
function odstavceZTextu(text: string): string {
  const casti = text.split(/\n{2,}/).filter((c) => c.trim() !== '');
  if (casti.length === 0) return '';
  return casti
    .map((cast) => odstavec(run(cast, { velikost: 11, barva: INKOUST }), { pod: 8 }))
    .join('');
}

/**
 * Buňka hlavičky. Fialová výplň je na buňce, ne na tabulce - tak to čte Word
 * i Disk. Okraje buňky se nastavují v twipech.
 */
function bunka(obsah: string, opts: { sirka: number; vypln: string; vpravo?: boolean }): string {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${opts.sirka}" w:type="dxa"/>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="${opts.vypln}"/>` +
    `<w:tcMar><w:top w:w="320" w:type="dxa"/><w:bottom w:w="320" w:type="dxa"/>` +
    `<w:left w:w="${opts.vpravo ? 120 : 360}" w:type="dxa"/><w:right w:w="${
      opts.vpravo ? 360 : 120
    }" w:type="dxa"/></w:tcMar>` +
    `<w:vAlign w:val="center"/></w:tcPr>${obsah}</w:tc>`
  );
}

/** Fialový pruh se jménem projektu a zelenou linkou pod ním. */
function hlavicka(podklady: PodkladyTextu, logo: ObrazekVDokumentu | null): string {
  const sirkaTextu = SIRKA_TEXTU - SLOUPEC_LOGA;

  const vlevo =
    odstavec(run('NATÁČECÍ LIST', { velikost: 8, barva: ZELENA, tucne: true, rozpal: 1.6 })) +
    odstavec(run(podklady.projekt, { velikost: 19, barva: BILA, tucne: true }), { nad: 4 });

  const vpravo = odstavec(logo ? obrazek(logo) : '', { vpravo: true });

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${SIRKA_TEXTU}" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="none" w:sz="0"/><w:left w:val="none" w:sz="0"/>` +
    `<w:bottom w:val="none" w:sz="0"/><w:right w:val="none" w:sz="0"/>` +
    `<w:insideH w:val="none" w:sz="0"/><w:insideV w:val="none" w:sz="0"/></w:tblBorders>` +
    `<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${sirkaTextu}"/><w:gridCol w:w="${SLOUPEC_LOGA}"/></w:tblGrid>` +
    `<w:tr>${bunka(vlevo, { sirka: sirkaTextu, vypln: FIALOVA })}${bunka(vpravo, {
      sirka: SLOUPEC_LOGA,
      vypln: FIALOVA,
      vpravo: true,
    })}</w:tr>` +
    // Zelená linka pod pruhem. Word má nejmenší výšku řádku, proto je v buňce
    // prázdný odstavec s drobným písmem a pevnou výškou.
    `<w:tr><w:trPr><w:trHeight w:val="60" w:hRule="exact"/></w:trPr>` +
    `<w:tc><w:tcPr><w:tcW w:w="${SIRKA_TEXTU}" w:type="dxa"/><w:gridSpan w:val="2"/>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="${ZELENA}"/>` +
    `<w:tcMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="60" w:lineRule="exact"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t></w:t></w:r></w:p></w:tc></w:tr>` +
    `</w:tbl>`
  );
}

export type ObrazekVDokumentu = {
  data: Buffer;
  /** Rozměry v pixelech - kvůli poměru stran. */
  sirkaPx: number;
  vyskaPx: number;
};

/** Obrázek v odstavci. Míry se ve Wordu udávají v EMU (914 400 na palec). */
function obrazek(logo: ObrazekVDokumentu): string {
  const vyskaCm = 1.5;
  const EMU_NA_CM = 360000;
  const vyska = Math.round(vyskaCm * EMU_NA_CM);
  const sirka = Math.round((vyska * logo.sirkaPx) / Math.max(1, logo.vyskaPx));

  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${sirka}" cy="${vyska}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="Mediaspace"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="1" name="Mediaspace"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rId5"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${sirka}" cy="${vyska}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/** Rozměry PNG z hlavičky IHDR - čtyři bajty šířka, čtyři výška, hned za podpisem. */
export function rozmeryPng(data: Buffer): { sirkaPx: number; vyskaPx: number } | null {
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) return null;
  return { sirkaPx: data.readUInt32BE(16), vyskaPx: data.readUInt32BE(20) };
}

function telo(list: ListNataceni, podklady: PodkladyTextu, logo: ObrazekVDokumentu | null): string {
  const casti: string[] = [hlavicka(podklady, logo)];

  casti.push(
    odstavec(run(`Poslední úprava: ${podklady.upraveno}`, { velikost: 8.5, barva: SEDA }), {
      nad: 7,
      vpravo: true,
    }),
  );

  if (list.uvod) casti.push(odstavceZTextu(list.uvod));

  for (const spot of list.spoty) {
    casti.push(
      odstavec(run(spot.nazev, { velikost: 13, barva: INKOUST, tucne: true }), {
        nad: 20,
        pod: spot.popis ? 2 : 8,
        linkaNad: true,
      }),
    );
    if (spot.popis) {
      casti.push(
        odstavec(run(spot.popis, { velikost: 9, barva: FIALOVA, tucne: true, rozpal: 0.4 }), {
          pod: 8,
        }),
      );
    }
    casti.push(odstavceZTextu(spot.telo));
  }

  // Patička - vlevo značka, vpravo název projektu, oboje pod linkou.
  casti.push(
    odstavec(
      run('Mediaspace', { velikost: 9, barva: FIALOVA, tucne: true }) +
        '<w:r><w:tab/></w:r>' +
        run(podklady.projekt, { velikost: 8, barva: SEDA }),
      { nad: 22, linkaNad: true, zarazkaVpravo: true },
    ),
  );

  return casti.join('');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/**
 * Natáčecí list jako .docx. `logo` je nepovinné - když se obrázek nepodaří
 * sehnat, vyrobí se list bez něj. Prázdný dokument kvůli chybějícímu logu by
 * byl horší než list bez loga.
 */
export function docxNataceciTextu(
  vzor: { uvod?: string | null; blok: string },
  podklady: PodkladyTextu,
  vystupy: VystupProText[],
  logo: ObrazekVDokumentu | null = null,
): Buffer {
  const list = rozeberList(vzor, podklady, vystupy);

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${telo(list, podklady, logo)}<w:sectPr><w:pgSz w:w="${SIRKA_STRANY}" w:h="16838"/><w:pgMar w:top="${OKRAJ}" w:right="${OKRAJ}" w:bottom="${OKRAJ}" w:left="${OKRAJ}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
    logo
      ? '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>'
      : ''
  }</Relationships>`;

  const soubory: SouborDoZipu[] = [
    { nazev: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf-8') },
    { nazev: '_rels/.rels', data: Buffer.from(RELS, 'utf-8') },
    { nazev: 'word/document.xml', data: Buffer.from(document, 'utf-8') },
    { nazev: 'word/_rels/document.xml.rels', data: Buffer.from(documentRels, 'utf-8') },
  ];
  if (logo) soubory.push({ nazev: 'word/media/logo.png', data: logo.data });

  return zabalZip(soubory);
}
