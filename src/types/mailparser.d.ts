/**
 * mailparser si s sebou nenese popis typů a build kvůli tomu spadl
 * (12. 9. 2026: „Could not find a declaration file for module 'mailparser'").
 *
 * Balíček @types/mailparser by přibyl jen kvůli jedné funkci a musel by se
 * držet ve verzi s knihovnou. Tvar toho, co z něj bereme, si proto popisuje
 * postaServer.ts sám (typ RozebranaZprava) — tady stačí říct, že modul
 * existuje.
 */
declare module 'mailparser';
