import { prisma } from '@/lib/db';
import { stavySNotifikaci, type DruhNotifikace } from '@/lib/notifikaceFirmy';
import { vychoziVzor, type Vzor } from '@/lib/vzoryZprav';

/**
 * Čtení a ukládání vzorů zpráv (zadání 11. 9. 2026). Viz lib/vzoryZprav.ts,
 * kde jsou výchozí znění a proměnné - tady je jen práce s databází.
 *
 * Řádek existuje jen pro stav, který někdo upravil. Co uložené není, se bere
 * z výchozích textů, takže „Obnovit výchozí" znamená prostě řádek smazat.
 *
 * Od 14. 9. 2026 má každý řádek ještě DRUH (audiokniha / reklama) - jedno
 * znění pro obojí nešlo napsat tak, aby sedělo. Klíč je proto dvojice
 * druh + stav.
 */

export type VzorSeStavem = Vzor & {
  druh: DruhNotifikace;
  stav: string;
  upraveno: boolean;
  upravilJmeno: string | null;
};

type UlozenyVzor = {
  druh: string;
  stav: string;
  predmet: string | null;
  nadpis: string | null;
  text: string;
  upravilJmeno: string | null;
};

export async function nactiVzory(druh: DruhNotifikace = 'AUDIOKNIHA'): Promise<VzorSeStavem[]> {
  let ulozene: UlozenyVzor[] = [];
  try {
    ulozene = await prisma.vzorZpravy.findMany({ where: { druh } });
  } catch (err) {
    // Chybejici tabulka (jeste nedobehl `prisma db push`) nesmi shodit
    // odesilani zprav - pouziji se vychozi texty.
    console.error('Vzory zpráv se nepodařilo načíst:', err);
  }
  const podleStavu = new Map(ulozene.map((v) => [v.stav, v]));

  return stavySNotifikaci(druh).map((stav) => {
    const vychozi = vychoziVzor(stav, druh);
    const u = podleStavu.get(stav);
    return {
      druh,
      stav,
      predmet: u?.predmet || vychozi.predmet,
      nadpis: u?.nadpis ?? vychozi.nadpis,
      text: u?.text ?? vychozi.text,
      upraveno: Boolean(u),
      upravilJmeno: u?.upravilJmeno ?? null,
    };
  });
}

/** Vzor pro jeden stav - používá se při odesílání zprávy. */
export async function vzorProStav(stav: string, druh: DruhNotifikace = 'AUDIOKNIHA'): Promise<Vzor> {
  const vychozi = vychoziVzor(stav, druh);
  try {
    const u = await prisma.vzorZpravy.findUnique({ where: { druh_stav: { druh, stav } } });
    if (!u) return vychozi;
    return {
      predmet: u.predmet || vychozi.predmet,
      nadpis: u.nadpis ?? vychozi.nadpis,
      text: u.text ?? vychozi.text,
    };
  } catch (err) {
    console.error(`Vzor pro stav „${stav}" se nepodařilo načíst:`, err);
    return vychozi;
  }
}

export async function ulozVzor(
  stav: string,
  vzor: Vzor,
  upravilJmeno: string | null,
  druh: DruhNotifikace = 'AUDIOKNIHA',
): Promise<void> {
  await prisma.vzorZpravy.upsert({
    where: { druh_stav: { druh, stav } },
    create: { druh, stav, predmet: vzor.predmet, nadpis: vzor.nadpis, text: vzor.text, upravilJmeno },
    update: { predmet: vzor.predmet, nadpis: vzor.nadpis, text: vzor.text, upravilJmeno },
  });
}

/** Obnovení výchozího znění = smazání řádku. */
export async function obnovVychozi(stav: string, druh: DruhNotifikace = 'AUDIOKNIHA'): Promise<void> {
  await prisma.vzorZpravy.deleteMany({ where: { druh, stav } });
}
