'use client';

/**
 * UŽ SE NEPOUŽÍVÁ (20. 9. 2026).
 *
 * Tenhle obal dřív odchytával tah prstem a dvěma prsty po touchpadu a podle
 * něj přepínal týden. Kalendář je teď JEDEN DLOUHÝ PÁS - vedle sebe leží tři
 * období a roluje je přímo prohlížeč (viz CalendarBrowser). Gesto tak nemá co
 * napodobovat: prst táhne pás sám, plynule a bez čekání na server.
 *
 * Soubor zůstal jen proto, aby nic nespadlo na starém importu. Klidně ho
 * smažte.
 */
export function PosunGestem({ children }: { onPosun?: (smer: -1 | 1) => void; children: React.ReactNode }) {
  return <>{children}</>;
}
