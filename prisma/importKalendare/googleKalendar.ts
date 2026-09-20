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
/** `doDatum` jen u události přes půlnoc. */
export type RadekGoogle = { studio: string; datum: string; od: string; do: string; doDatum?: string; text: string };

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

  // ---- Brno II · týden 21.–27. 9. 2026 ----
  { studio: 'Brno II', datum: '2026-09-21', od: '09:00', do: '13:00', text: 'Šárka Šildová – Poslední naživu (R)' },
  { studio: 'Brno II', datum: '2026-09-21', od: '13:00', do: '17:00', text: 'Strih (R)' },
  // Na screenshotu jen useknuty kratky zaznam kolem 14:00 - cas i konec textu jsou odhad.
  { studio: 'Brno II', datum: '2026-09-21', od: '14:00', do: '14:15', text: '☎ Míma Krajčová – CASTING' },
  { studio: 'Brno II', datum: '2026-09-22', od: '09:00', do: '13:00', text: 'Šárka Šildová – Poslední naživu (TM)' },
  { studio: 'Brno II', datum: '2026-09-22', od: '13:00', do: '17:00', text: 'Střih (TM)' },
  { studio: 'Brno II', datum: '2026-09-23', od: '13:00', do: '17:00', text: 'Střih (R)' },
  { studio: 'Brno II', datum: '2026-09-24', od: '10:30', do: '14:30', text: 'Střih (R)' },
  { studio: 'Brno II', datum: '2026-09-24', od: '14:30', do: '18:30', text: '☎ Tomáš Žilinský - Kousek tebe (R)' },
  { studio: 'Brno II', datum: '2026-09-25', od: '09:00', do: '17:00', text: 'Střih (R)' },

  // ---- Brno II · týden 28. 9.–4. 10. 2026 ----
  { studio: 'Brno II', datum: '2026-09-30', od: '15:00', do: '18:00', text: '☎ Martin Sláma – Galerie Hodonín (P)' },

  // ---- Praha · týden 14.–20. 9. 2026 ----
  { studio: 'Praha', datum: '2026-09-14', od: '10:00', do: '14:00', text: '☎ Matouš Ruml – Doma na cestách (O)' },
  { studio: 'Praha', datum: '2026-09-14', od: '12:00', do: '15:00', text: '✈️ Strih (Matej) Kuchari smrti' },
  { studio: 'Praha', datum: '2026-09-14', od: '14:00', do: '18:00', text: '📝 Linda Bartošová – Pod tlakem krásy (O)' },
  { studio: 'Praha', datum: '2026-09-15', od: '10:00', do: '14:00', text: 'Střih (Dan) Nástroje pro život' },
  { studio: 'Praha', datum: '2026-09-15', od: '12:00', do: '15:00', text: '✈️ Strih (Matej) Kuchari smrti_CUT' },
  { studio: 'Praha', datum: '2026-09-16', od: '09:00', do: '13:00', text: 'Strih (O) Vlakař' },
  { studio: 'Praha', datum: '2026-09-16', od: '10:00', do: '14:00', text: 'Matouš Ruml – Doma na cestách (Dan)' },
  { studio: 'Praha', datum: '2026-09-17', od: '09:00', do: '12:00', text: '✈️ Strih (Matej) Vlakař_CUT' },
  { studio: 'Praha', datum: '2026-09-17', od: '10:00', do: '15:00', text: 'Strih (O) doma na cestách_cut' },
  { studio: 'Praha', datum: '2026-09-17', od: '10:00', do: '14:00', text: 'Matouš Ruml – Doma na cestách (Dan)' },
  { studio: 'Praha', datum: '2026-09-18', od: '09:00', do: '13:00', text: 'Linda Bartošová – Pod tlakem krásy (O)' },
  { studio: 'Praha', datum: '2026-09-18', od: '13:00', do: '15:00', text: 'Střih (O) nástroje pro život' },
  { studio: 'Praha', datum: '2026-09-19', od: '10:00', do: '18:00', text: 'Strih (Jonas) Vlakař' },
  { studio: 'Praha', datum: '2026-09-20', od: '10:00', do: '16:00', text: 'Tereza Jarčevská – Nástroje pro život (Jonas)' },
  { studio: 'Praha', datum: '2026-09-20', od: '12:00', do: '18:00', text: 'Strih (O) Kubánske tango' },

  // ---- Praha · týden 21.–27. 9. 2026 ----
  { studio: 'Praha', datum: '2026-09-21', od: '10:00', do: '14:00', text: 'Matouš Ruml – Doma na cestách (O)' },
  { studio: 'Praha', datum: '2026-09-21', od: '12:00', do: '15:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-09-21', od: '14:00', do: '16:00', text: 'Strih (O)' },
  { studio: 'Praha', datum: '2026-09-21', od: '14:30', do: '15:30', text: '☎ CASTING Nicole Tisotová (O)' },
  { studio: 'Praha', datum: '2026-09-22', od: '09:00', do: '15:00', text: 'Strih (O)' },
  { studio: 'Praha', datum: '2026-09-22', od: '12:00', do: '15:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-09-22', od: '13:00', do: '17:00', text: 'Zbyšek Horák – Kuchaři smrti (O)' },
  { studio: 'Praha', datum: '2026-09-23', od: '09:00', do: '15:00', text: 'Tereza Jarčevská – Nástroje pro život (Jonas)' },
  { studio: 'Praha', datum: '2026-09-23', od: '09:00', do: '12:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-09-23', od: '15:00', do: '19:00', text: '‼️ 📝 Jan Maxián – Už letím (O)' },
  { studio: 'Praha', datum: '2026-09-24', od: '09:00', do: '15:00', text: 'Strih (O)' },
  // Na screenshotu jen useknuty kratky zaznam kolem 10:30 - cas je odhad.
  { studio: 'Praha', datum: '2026-09-24', od: '10:30', do: '10:45', text: '☎ CASTING Stano Čaban' },
  { studio: 'Praha', datum: '2026-09-25', od: '09:00', do: '15:00', text: 'Strih (O)' },
  { studio: 'Praha', datum: '2026-09-25', od: '09:00', do: '12:00', text: '✈️ Strih (Matej)' },

  // ---- Praha · týden 28. 9.–4. 10. 2026 ----
  { studio: 'Praha', datum: '2026-09-28', od: '08:00', do: '12:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-09-28', od: '10:00', do: '14:00', text: 'Linda Bartošová – Pod tlakem krásy (Jonas)' },
  { studio: 'Praha', datum: '2026-09-29', od: '10:00', do: '14:00', text: '📝 Jan Maxián – Už letím' },
  { studio: 'Praha', datum: '2026-09-29', od: '12:00', do: '15:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-09-29', od: '14:00', do: '18:00', text: '☎ Jozef Hruškoci – Stojí za čekání' },
  { studio: 'Praha', datum: '2026-09-30', od: '09:00', do: '13:00', text: '☎ Martina Černá – Kousek tebe' },
  { studio: 'Praha', datum: '2026-09-30', od: '12:00', do: '15:00', text: '✈️ Strih (Matej)' },
  { studio: 'Praha', datum: '2026-10-01', od: '09:00', do: '13:00', text: 'Jozef Hruškoci – Stojí za čekání' },
  { studio: 'Praha', datum: '2026-10-01', od: '13:00', do: '17:00', text: 'Martina Černá - Kousek tebe' },
  { studio: 'Praha', datum: '2026-10-02', od: '09:00', do: '13:00', text: 'Linda Bartošová – Pod tlakem krásy' },

  // ---- Praha · týden 5.–11. 10. 2026 ----
  { studio: 'Praha', datum: '2026-10-07', od: '13:00', do: '15:00', text: 'Linda Bartošová – Pod tlakem krásy' },
  { studio: 'Praha', datum: '2026-10-07', od: '15:00', do: '19:00', text: '📝 Jan Maxián – Už letím (O)' },
  { studio: 'Praha', datum: '2026-10-09', od: '09:00', do: '13:00', text: '📝 Ondřej Novák – Už letím' },
  { studio: 'Praha', datum: '2026-10-09', od: '13:00', do: '17:00', text: 'Linda Bartošová – Pod tlakem krásy' },

  // ---- Praha · týden 12.–18. 10. 2026 ----
  { studio: 'Praha', datum: '2026-10-12', od: '08:00', do: '12:00', text: '☎ Richard Wágner – Game changer (O)' },
  { studio: 'Praha', datum: '2026-10-14', od: '08:00', do: '12:00', text: 'Richard Wágner – Game changer (O)' },
  { studio: 'Praha', datum: '2026-10-14', od: '15:00', do: '19:00', text: '📝 Jan Maxián – Už letím (Jonas)' },
  { studio: 'Praha', datum: '2026-10-15', od: '08:00', do: '12:00', text: 'Richard Wágner – Game changer (O)' },
  { studio: 'Praha', datum: '2026-10-15', od: '14:00', do: '17:00', text: 'Jitka Ježková – Tajná mise Salamandr' },
  { studio: 'Praha', datum: '2026-10-16', od: '08:00', do: '12:00', text: 'Richard Wágner – Game changer (O)' },
  { studio: 'Praha', datum: '2026-10-16', od: '12:00', do: '16:00', text: 'Linda Bartošová – Pod tlakem krásy' },
  { studio: 'Praha', datum: '2026-10-16', od: '16:00', do: '18:00', text: '📝 Klára Cibulková – Už letím' },

  // ---- Praha · týden 19.–25. 10. 2026 ----
  { studio: 'Praha', datum: '2026-10-19', od: '08:00', do: '14:00', text: 'Richard Wágner – Game changer (Dan)' },
  { studio: 'Praha', datum: '2026-10-20', od: '08:00', do: '14:00', text: 'Richard Wágner – Game changer (O)' },
  { studio: 'Praha', datum: '2026-10-21', od: '09:00', do: '13:00', text: 'Martina Černá – Kousek tebe' },
  { studio: 'Praha', datum: '2026-10-21', od: '13:00', do: '17:00', text: '☎ Klára Cibulková – Retrokrimi' },
  { studio: 'Praha', datum: '2026-10-22', od: '09:00', do: '13:00', text: 'Klára Cibulková – Retrokrimi' },
  { studio: 'Praha', datum: '2026-10-23', od: '09:00', do: '13:00', text: 'Martina Černá – Kousek tebe' },

  // ---- Praha · týden 26. 10.–1. 11. 2026 ----
  { studio: 'Praha', datum: '2026-10-26', od: '13:00', do: '17:00', text: '☎ Robin Ferro– Tajná mise Salamandr' },
  { studio: 'Praha', datum: '2026-10-27', od: '09:00', do: '13:00', text: 'Robin Ferro– Tajná mise Salamandr' },
];
