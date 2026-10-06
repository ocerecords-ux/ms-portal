import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bonusZObratu, mujPodilNaObratu, nactiBonusyObratu } from '@/lib/bonusObratuServer';
import { koruny, nazevMesicePalubovky } from '@/lib/palubovka';
import { nactiJazyk } from '@/lib/jazykServer';
import { prelozit, prelozitS } from '@/lib/jazyk';
import { GrafBonusu } from './GrafBonusu';
import { PodilyTymu } from './PodilyTymu';

/**
 * BONUSY - PODÍL NA OBRATU (zadání 6. 10. 2026: „potřebuju dát Peterovi
 * a Karolíně do Přehledů záložku Moje bonusy, kde uvidí aktuálně částku bez
 * dph. Každý z nich má jiný podíl na obratu", upřesnění týž den: „ten obrat
 * se musí počítat za každý měsíc… ne celkový" a „měl bych mít možnost upravit
 * ta procenta a získat nějaké grafy a přehledy za minulé měsíce").
 *
 * POČÍTÁ SE PO MĚSÍCÍCH. Velké číslo nahoře je bonus za rozjetý měsíc, pod
 * ním graf a tabulka všech měsíců vybraného roku. Roční součet je vedle jako
 * doplněk, ne jako hlavní číslo - vyplácí se po měsících.
 *
 * ZÁKLAD JE TENTÝŽ, CO UKAZUJE PALUBOVKA: vystavené faktury podle data
 * vystavení, v korunách BEZ DPH a přepočtené kurzem uloženým u dokladu.
 * Jiný základ by znamenal dvě čísla, o kterých se dá hádat.
 *
 * Procento je na kartě uživatele a Žůžo-labůžo ho přepíše i tady dole; kdo
 * žádné nemá, tomu se záložka vůbec neukáže.
 */
export const dynamic = 'force-dynamic';

export default async function MojeBonusyPage({ searchParams }: { searchParams?: { rok?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const jeSpravce = session.user.role === 'ADMIN';
  const muj = await mujPodilNaObratu(session.user.id);
  // Kdo nemá podíl a není Žůžo-labůžo, tomu tahle záložka nepatří.
  if (muj === null && !jeSpravce) redirect('/prehledy');

  const jazyk = nactiJazyk();
  const data = await nactiBonusyObratu(Number(searchParams?.rok) || undefined);
  const procento = (p: number) => `${p.toLocaleString(jazyk === 'en' ? 'en-GB' : 'cs-CZ')} %`;

  /**
   * Který měsíc je ten „aktuální": u letoška ten rozjetý, u staršího roku
   * poslední, ve kterém se něco vyfakturovalo. Prázdný rok spadne na prosinec.
   */
  const posledniSObratem = [...data.mesice].reverse().find((m) => m.obrat > 0)?.mesic;
  const mesicCislo = data.rozjetyMesic ?? posledniSObratem ?? data.mesice.length;
  const mesic = data.mesice.find((m) => m.mesic === mesicCislo) ?? { mesic: mesicCislo, obrat: 0 };
  const mesicNazev = nazevMesicePalubovky(mesicCislo - 1, jazyk);

  const rada = data.mesice.map((m) => ({
    mesic: m.mesic,
    bonus: muj !== null ? bonusZObratu(m.obrat, muj) : m.obrat,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Přepínač roku - přehledy za minulé měsíce (6. 10. 2026). */}
      {data.roky.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {data.roky.map((r) => (
            <Link
              key={r}
              href={`/prehledy/moje-bonusy?rok=${r}`}
              className={`rounded-pill px-3 py-1 text-sm font-heading font-semibold no-underline border transition-colors tabular-nums ${
                r === data.rok
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-surface text-ink border-line hover:border-brand-purple'
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      )}

      {muj !== null && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Dlazdice
              nazev={prelozitS(jazyk, 'bonusObratu.bonusZaMesic', { mesic: mesicNazev })}
              hodnota={koruny(bonusZObratu(mesic.obrat, muj), jazyk)}
              vyrazna
            />
            <Dlazdice
              nazev={prelozitS(jazyk, 'bonusObratu.obratMesice', { mesic: mesicNazev })}
              hodnota={koruny(mesic.obrat, jazyk)}
            />
            <Dlazdice nazev={prelozit(jazyk, 'bonusObratu.mujPodil')} hodnota={procento(muj)} />
            <Dlazdice
              nazev={prelozitS(jazyk, 'bonusObratu.celkemRok', { rok: data.rok })}
              hodnota={koruny(bonusZObratu(data.obratRoku, muj), jazyk)}
            />
          </div>
          <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'bonusObratu.zaklad')}</p>
        </>
      )}

      <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
          {muj !== null
            ? prelozitS(jazyk, 'bonusObratu.grafBonusu', { rok: data.rok })
            : prelozitS(jazyk, 'bonusObratu.grafObratu', { rok: data.rok })}
        </h2>
        <GrafBonusu mesice={rada} rozjetyMesic={data.rozjetyMesic} />
      </section>

      {muj !== null && (
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
            {prelozit(jazyk, 'bonusObratu.poMesicich')}
          </h2>
          <div className="flex flex-col divide-y divide-line">
            <div className="flex items-center justify-between gap-4 py-2 text-xs font-heading font-semibold uppercase tracking-wide text-muted">
              <span className="min-w-0">{prelozit(jazyk, 'bonusObratu.mesic')}</span>
              <span className="flex items-center gap-6 shrink-0">
                <span className="w-28 text-right">{prelozit(jazyk, 'bonusObratu.obrat')}</span>
                <span className="w-28 text-right">{prelozit(jazyk, 'bonusObratu.bonus')}</span>
              </span>
            </div>
            {data.mesice.map((m) => (
              <div key={m.mesic} className="flex items-center justify-between gap-4 py-2">
                <span className="font-heading text-sm text-ink capitalize min-w-0 truncate">
                  {nazevMesicePalubovky(m.mesic - 1, jazyk)}
                  {m.mesic === data.rozjetyMesic && (
                    <span className="text-xs font-body text-muted"> · {prelozit(jazyk, 'bonusObratu.bezi')}</span>
                  )}
                </span>
                <span className="flex items-center gap-6 shrink-0 tabular-nums">
                  <span className="w-28 text-right text-sm font-body text-muted">{koruny(m.obrat, jazyk)}</span>
                  <span className="w-28 text-right text-sm font-heading font-semibold text-ink">
                    {koruny(bonusZObratu(m.obrat, muj), jazyk)}
                  </span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-2 border-t-2 border-line">
              <span className="font-heading font-semibold text-sm text-ink">
                {prelozitS(jazyk, 'bonusObratu.celkemRok', { rok: data.rok })}
              </span>
              <span className="flex items-center gap-6 shrink-0 tabular-nums">
                <span className="w-28 text-right text-sm font-body text-muted">{koruny(data.obratRoku, jazyk)}</span>
                <span className="w-28 text-right text-sm font-heading font-semibold text-ink">
                  {koruny(bonusZObratu(data.obratRoku, muj), jazyk)}
                </span>
              </span>
            </div>
          </div>
        </section>
      )}

      {jeSpravce && (
        <section className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-heading font-semibold text-sm text-muted uppercase tracking-wide m-0">
              {prelozit(jazyk, 'bonusObratu.vsichni')}
            </h2>
            <p className="text-sm font-body text-muted m-0 mt-1">{prelozit(jazyk, 'bonusObratu.vsichniPopis')}</p>
          </div>
          {data.lide.length === 0 ? (
            <p className="text-sm font-body text-muted m-0">{prelozit(jazyk, 'bonusObratu.nikdoNemaPodil')}</p>
          ) : (
            <PodilyTymu
              rok={data.rok}
              mesicNazev={mesicNazev}
              radky={data.lide.map((c) => ({
                id: c.id,
                jmeno: c.jmeno,
                procento: c.procento,
                bonusMesic: bonusZObratu(mesic.obrat, c.procento),
                bonusRok: bonusZObratu(data.obratRoku, c.procento),
              }))}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Dlazdice({ nazev, hodnota, vyrazna = false }: { nazev: string; hodnota: string; vyrazna?: boolean }) {
  return (
    <div className="bg-surface border border-line rounded-card shadow-sm p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-muted">{nazev}</span>
      <span
        className={`font-display tabular-nums truncate ${vyrazna ? 'text-3xl text-brand-purple' : 'text-2xl text-ink'}`}
      >
        {hodnota}
      </span>
    </div>
  );
}
