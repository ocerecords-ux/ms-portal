/**
 * UDÁLOSTI PŘEVZATÉ ZE STARÉHO GOOGLE KALENDÁŘE (zadání 20. 9. 2026).
 *
 * Jeden řádek = jedna událost tak, jak byla v Google kalendáři: datum, čas
 * od-do (v Praze), studio a PŮVODNÍ TEXT. Text se rozebírá při seedu
 * (src/lib/importGoogleKalendar.ts) - herec, projekt, zvukař, natáčení/střih.
 *
 * Seed je idempotentní: událost se založí jednou, oprava řádku ji přepíše
 * a smazaný řádek ji z portálu zase odebere. Ručně zapsaných událostí se
 * to netýká.
 */
export type RadekGoogle = { studio: string; datum: string; od: string; do: string; text: string };

export const GOOGLE_KALENDAR: RadekGoogle[] = [
  // ---- Brno I · týden 14.–20. 9. 2026 ----
  { studio: 'Brno I', datum: '2026-09-14', od: '06:00', do: '09:00', text: 'Strih (TI) annie bot' },
  { studio: 'Brno I', datum: '2026-09-14', od: '09:00', do: '13:00', text: 'Jiří Miroslav Valůšek – Vlakař (TI)' },
  { studio: 'Brno I', datum: '2026-09-14', od: '13:00', do: '18:00', text: 'Petr Štěpán – Krvavý cejch (TM)' },
  { studio: 'Brno I', datum: '2026-09-15', od: '10:00', do: '13:00', text: 'Jiří Miroslav Valůšek – Vlakař (R)' },
  { studio: 'Brno I', datum: '2026-09-15', od: '13:00', do: '17:00', text: '☎ Šárka Šildová – Poslední naživu (R)' },
  { studio: 'Brno I', datum: '2026-09-16', od: '09:00', do: '13:00', text: 'Šárka Šildová – Poslední naživu (R)' },
  { studio: 'Brno I', datum: '2026-09-16', od: '13:00', do: '17:00', text: '☎ Kateřina Jírů – Stojí za čekání (R)' },
  { studio: 'Brno I', datum: '2026-09-17', od: '05:00', do: '09:00', text: 'Strih (TI) kubánske tango' },
  { studio: 'Brno I', datum: '2026-09-17', od: '09:00', do: '13:00', text: 'Jiří Miroslav Valůšek – Vlakař (TI)' },
  { studio: 'Brno I', datum: '2026-09-17', od: '09:00', do: '13:00', text: 'Strih (TM) -Nástroje pro život' },
  { studio: 'Brno I', datum: '2026-09-17', od: '13:00', do: '17:00', text: 'Strih (TM) Kubánske tango' },
  { studio: 'Brno I', datum: '2026-09-18', od: '05:00', do: '09:00', text: 'Strih (TI) Kubánske tango' },
  { studio: 'Brno I', datum: '2026-09-18', od: '09:00', do: '13:00', text: 'Jiří Miroslav Valůšek – Vlakař (TI)' },
  { studio: 'Brno I', datum: '2026-09-18', od: '09:00', do: '13:00', text: 'Strih (TM) Kubánske tango' },
  { studio: 'Brno I', datum: '2026-09-18', od: '13:00', do: '17:00', text: 'Kateřina Jírů – Stojí za čekání (TM)' },

  // ---- Brno I · týden 21.–27. 9. 2026 ----
  { studio: 'Brno I', datum: '2026-09-21', od: '06:00', do: '14:00', text: 'Střih (TI)' },
  { studio: 'Brno I', datum: '2026-09-21', od: '09:00', do: '17:00', text: 'Střih (TM)' },
  { studio: 'Brno I', datum: '2026-09-22', od: '06:00', do: '14:00', text: 'Střih (TI)' },
  { studio: 'Brno I', datum: '2026-09-22', od: '09:00', do: '17:00', text: 'Střih (R)' },
  { studio: 'Brno I', datum: '2026-09-23', od: '05:00', do: '09:00', text: 'Střih (TI)' },
  { studio: 'Brno I', datum: '2026-09-23', od: '09:00', do: '13:00', text: 'Petr Štěpán - Krvavý cejch (TI)' },
  { studio: 'Brno I', datum: '2026-09-23', od: '13:00', do: '17:00', text: 'Střih (TM)' },
  { studio: 'Brno I', datum: '2026-09-24', od: '05:00', do: '13:00', text: 'Střih (TI)' },
  { studio: 'Brno I', datum: '2026-09-24', od: '09:00', do: '17:00', text: 'Střih (TM)' },
  { studio: 'Brno I', datum: '2026-09-25', od: '05:00', do: '13:00', text: 'Střih (TI)' },
  { studio: 'Brno I', datum: '2026-09-25', od: '09:00', do: '17:00', text: 'Střih (TM)' },

  // ---- Brno I · týden 5.–11. 10. 2026 ----
  { studio: 'Brno I', datum: '2026-10-05', od: '09:00', do: '17:00', text: 'Tomáš Žilinský – Kousek tebe' },

  // ---- Brno I · týden 12.–18. 10. 2026 ----
  { studio: 'Brno I', datum: '2026-10-16', od: '09:00', do: '13:00', text: 'Tomáš Žilinský – Kousek tebe' },
];
