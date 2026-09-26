/**
 * NATÁČECÍ TEXT (zadání 26. 9. 2026: „v rámci těch výstupů bych pracoval
 * i s textem. Že bychom měli nějaké vzory pro natáčení, kde by bylo jasně
 * označené, jak se spot jmenuje a jakou má délku a pro jakou licenci.
 * Ukládalo by se to do editovatelného dokumentu na disku ve složce projektu").
 *
 * JEDEN DOKUMENT ZA PROJEKT, SPOTY POD SEBOU (rozhodnutí téhož dne). V natáčecí
 * den je otevřený jeden list a jede se spot po spotu; každý má vlastní hlavičku
 * s názvem, délkou a licencí a pod ní místo na text.
 *
 * TENHLE SOUBOR JE BEZ PRISMY - skládá jen text. Vyrobení dokumentu a jeho
 * uložení na Disk řeší nataceniTextServer.ts.
 */

/** Co se dá do vzoru napsat jako proměnná. */
export const PROMENNE_NATACENI = [
  { klic: 'projekt', popis: 'Název projektu' },
  { klic: 'klient', popis: 'Název firmy klienta' },
  { klic: 'datum', popis: 'Dnešní datum' },
  { klic: 'spot', popis: 'Název výstupu (jen v bloku spotu)' },
  { klic: 'delka', popis: 'Délka spotu - 30s, 1:30 (jen v bloku spotu)' },
  { klic: 'licence', popis: 'Licence výstupu - Rádio, Online (jen v bloku spotu)' },
  { klic: 'poradi', popis: 'Pořadové číslo spotu v dokumentu' },
] as const;

/** Výchozí podoba vzoru - ta, kterou seed založí, když žádný není. */
export const VYCHOZI_VZOR_NATACENI = {
  nazev: 'Natáčecí list',
  uvod: `NATÁČECÍ LIST
{{projekt}} — {{klient}}
Datum: {{datum}}`,
  blok: `{{poradi}}. {{spot}}  ·  {{delka}}  ·  {{licence}}

[text spotu]`,
};

export type VystupProText = {
  nazev: string;
  delka: string;
  licence: string;
};

export type PodkladyTextu = {
  projekt: string;
  klient: string;
  datum: string;
};

/**
 * Dosadí proměnné. Co vzor nepoužije, se zahodí; co v datech není, zmizí
 * i se svou značkou - v listu má zůstat prázdné místo, ne „{{delka}}".
 */
export function dosad(sablona: string, hodnoty: Record<string, string>): string {
  return sablona.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, klic: string) => hodnoty[klic] ?? '');
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Celý dokument jako HTML. Google Disk si z HTML udělá běžný dokument, do
 * kterého jde rovnou psát - proto ne PDF: rodný list se čte, natáčecí text se
 * píše.
 *
 * Prázdný řádek ve vzoru = nový odstavec, jednoduchý řádek zůstane řádkem.
 * Hlavička spotu se tiskne tučně a odděluje čarou, ať je při čtení z obrazovky
 * poznat, kde jeden spot končí.
 */
export function sestavHtmlNataceni(
  vzor: { uvod?: string | null; blok: string },
  podklady: PodkladyTextu,
  vystupy: VystupProText[],
): string {
  const spolecne = {
    projekt: podklady.projekt,
    klient: podklady.klient,
    datum: podklady.datum,
  };

  const casti: string[] = [];

  if (vzor.uvod?.trim()) {
    casti.push(`<div class="uvod">${odstavce(dosad(vzor.uvod, spolecne))}</div>`);
  }

  vystupy.forEach((v, i) => {
    const text = dosad(vzor.blok, {
      ...spolecne,
      spot: v.nazev,
      delka: v.delka,
      licence: v.licence,
      poradi: String(i + 1),
    });
    casti.push(`<div class="spot">${odstavce(text)}</div>`);
  });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(podklady.projekt)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; }
  .uvod { font-weight: bold; margin-bottom: 24pt; }
  .spot { margin-bottom: 28pt; padding-top: 8pt; border-top: 1px solid #999; }
  .spot p:first-child { font-weight: bold; }
</style>
</head><body>${casti.join('\n')}</body></html>`;
}

/** Prázdný řádek dělá odstavec, jednoduchý zalomení. */
function odstavce(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((odstavec) => `<p>${escapeHtml(odstavec).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Název souboru na Disku - „Natáčecí text — Strabag jaro". */
export function nazevDokumentu(nazevProjektu: string, poradi: number): string {
  const zaklad = `Natáčecí text — ${nazevProjektu.trim() || 'projekt'}`;
  return poradi > 1 ? `${zaklad} (${poradi})` : zaklad;
}
