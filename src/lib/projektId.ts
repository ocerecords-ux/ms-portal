/**
 * ID nového projektu.
 *
 * Sloupec se pořád jmenuje `caflouProjectId` — na tohle ID se odkazují
 * doklady, výkazy, rozpočty i rodné listy a přejmenovat ho by znamenalo sáhnout
 * na všechny ty vazby kvůli názvu. Od odpojení Caflou (11. 9. 2026) si ale
 * čísla vyrábíme sami.
 *
 * Bereme čas v milisekundách: je to rostoucí, jedinečné i při dvou projektech
 * za sebou a na první pohled se pozná od pětimístných čísel z Caflou.
 */
export function noveIdProjektu(): string {
  return String(Date.now());
}
