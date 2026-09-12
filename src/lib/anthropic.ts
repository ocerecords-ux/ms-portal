/**
 * Společné hlavičky pro volání Anthropic API (12. 9. 2026).
 *
 * PROČ TO TU JE: klíč v portálu je vydaný pro celou organizaci, ne pro jeden
 * pracovní prostor. Takový klíč API odmítne s hláškou
 *
 *   „This API key is not scoped to a workspace, so this request must include
 *    the anthropic-workspace-id header…"
 *
 * a protože se odpověď nikde neukazovala, vypadalo to, že Bruno prostě mlčí
 * (12. 9. 2026: „Bruno nekomunikuje"). Totéž potichu shazovalo i čtení
 * dokladů z fotky.
 *
 * ANTHROPIC_WORKSPACE_ID — ID pracovního prostoru z konzole Anthropicu.
 * Když je vyplněné, přiloží se; když ne, hlavička se nepošle a klíč vázaný
 * na jeden prostor funguje jako dřív.
 */
export function anthropicHlavicky(klic: string): Record<string, string> {
  const prostor = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return {
    'content-type': 'application/json',
    'x-api-key': klic,
    'anthropic-version': '2023-06-01',
    ...(prostor ? { 'anthropic-workspace-id': prostor } : {}),
  };
}
