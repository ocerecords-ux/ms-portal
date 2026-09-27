'use client';
import { BARVA_PORAD, BARVA_SCHUZEK } from '@/lib/porady';

import { useEffect, useState } from 'react';
import { formatDatumCas, prelozitKolem } from '@/lib/jazyk';
import { useJazyk, usePreklad } from '@/app/(portal)/components/JazykProvider';

/**
 * MS KALENDÁŘ DO TELEFONU (zadání 20. 9. 2026: „potřebuju, aby si můj tým
 * jednoduše přidal MS kalendář do svých kalendářů nativních. Např. Google
 * nebo Apple kalendář. Jen pro čtení").
 *
 * Jedno tlačítko v hlavičce Kalendáře → okno se třemi kroky:
 *  1. CO odebírat (každé studio zvlášť / celý kalendář / jen moje),
 *  2. KAM (Apple, Google, ostatní přes zkopírovaný odkaz),
 *  3. hotovo - kalendář se sám obnovuje, v telefonu je jen ke čtení.
 *
 * Odkaz je osobní. Kdo ho zneplatní, tomu v kalendáři přestane chodit
 * (a kdo odejde z týmu, tomu přestane chodit sám - viz /api/ical).
 */
/**
 * KAŽDÉ STUDIO ZVLÁŠŤ (zadání 20. 9. 2026: „aby se to objevilo jako
 * samostatné čtyři separátní kalendáře, ať si dokážu vypínat jednotlivé
 * kalendáře a zapínat"). Jeden odebíraný odkaz = jeden kalendář v telefonu,
 * víc kalendářů v jednom souboru Apple ani Google neumí. Proto „Zvlášť"
 * připraví odkaz pro každé studio (+ Mimo studio) a každý se přidá svým
 * tlačítkem - v telefonu jsou pak samostatné kalendáře s vlastní barvou.
 */
type Rozsah = 'ZVLAST' | 'ALL' | 'MINE';
type Odber = {
  id: string;
  scope: 'ALL' | 'STUDIO' | 'MINE' | 'MIMO' | 'PORADY' | 'SCHUZKY';
  studioId: string | null;
  url: string;
  naposledy: string | null;
};
type Pripraveny = { klic: string; nazev: string; barva: string; url: string; qr: string | null };
const BARVA_MIMO = '#A7A4B0';

export function OdberKalendare({ studios }: { studios: { id: string; name: string; color: string | null }[] }) {
  const t = usePreklad();
  const jazyk = useJazyk();
  const [otevreno, setOtevreno] = useState(false);
  const [rozsah, setRozsah] = useState<Rozsah>('ZVLAST');
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [zvlast, setZvlast] = useState<Pripraveny[] | null>(null);
  const [qrOtevreny, setQrOtevreny] = useState<string | null>(null);
  const [zkopirovanyKlic, setZkopirovanyKlic] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [odbery, setOdbery] = useState<Odber[]>([]);
  const [bezi, setBezi] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zkopirovano, setZkopirovano] = useState(false);

  const kratce = (nazev: string) => (nazev.split(' - ').pop() ?? nazev).trim();
  const popisRozsahu = (o: Pick<Odber, 'scope' | 'studioId'>) =>
    o.scope === 'ALL'
      ? t('odberKalendare.rozsahVse')
      : o.scope === 'MINE'
        ? t('odberKalendare.rozsahMoje')
        : o.scope === 'MIMO'
          ? t('odberKalendare.mimoStudio')
          : o.scope === 'PORADY'
            ? t('odberKalendare.porady')
            : o.scope === 'SCHUZKY'
              ? t('odberKalendare.schuzky')
          : t('odberKalendare.rozsahStudio', {
              nazev: kratce(studios.find((s) => s.id === o.studioId)?.name ?? ''),
            });

  async function nactiOdbery() {
    const res = await fetch('/api/kalendar/odber');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setOdbery(data.odbery ?? []);
  }

  useEffect(() => {
    if (otevreno) void nactiOdbery();
  }, [otevreno]);

  // Kazda zmena rozsahu = jiny odkaz; stary se schova, at nikdo neodebira omylem.
  useEffect(() => {
    setOdkaz(null);
    setQr(null);
    setZvlast(null);
    setQrOtevreny(null);
    setZkopirovano(false);
  }, [rozsah]);

  async function pozadej(telo: Record<string, string>): Promise<{ url: string; qr: string | null }> {
    const res = await fetch('/api/kalendar/odber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || t('odberKalendare.chybaOdkaz'));
    return { url: data.url, qr: data.qr ?? null };
  }

  async function vytvor() {
    setBezi(true);
    setChyba(null);
    try {
      if (rozsah === 'ZVLAST') {
        // Kazde studio + Mimo studio. Server vraci pro stejny rozsah porad
        // stejny odkaz, takze opakovane kliknuti nic nerozbije.
        const polozky = [
          ...studios.map((s) => ({
            klic: s.id,
            nazev: kratce(s.name),
            barva: s.color ?? '#7B55FF',
            telo: { scope: 'STUDIO', studioId: s.id },
          })),
          { klic: 'mimo', nazev: t('odberKalendare.mimoStudio'), barva: BARVA_MIMO, telo: { scope: 'MIMO' } },
          // Porady (21. 9. 2026) - jen ty, na kterých je ten, kdo odebírá.
          { klic: 'porady', nazev: t('odberKalendare.porady'), barva: BARVA_PORAD, telo: { scope: 'PORADY' } },
          /**
           * Schůzky (25. 9. 2026: „nemůžu si přidat kalendář schůzky do svého
           * Apple kalendáře"). Kalendář Další schůzky přibyl později než
           * odběry a tenhle řádek do nich nikdo nedopsal - odkaz pro něj
           * tedy vůbec nešel vyrobit. Komu schůzky nepatří, dostane prázdný
           * kalendář; o tom, co v něm je, rozhoduje server.
           */
          { klic: 'schuzky', nazev: t('odberKalendare.schuzky'), barva: BARVA_SCHUZEK, telo: { scope: 'SCHUZKY' } },
        ];
        const hotove = await Promise.all(
          polozky.map(async (p) => ({ klic: p.klic, nazev: p.nazev, barva: p.barva, ...(await pozadej(p.telo)) })),
        );
        setZvlast(hotove);
      } else {
        const r = await pozadej({ scope: rozsah });
        setOdkaz(r.url);
        setQr(r.qr);
      }
      void nactiOdbery();
    } catch (err) {
      setChyba(err instanceof Error ? err.message : t('odberKalendare.chybaOdkaz'));
    } finally {
      setBezi(false);
    }
  }

  async function zneplatni(id: string) {
    await fetch('/api/kalendar/odber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revokeId: id }),
    });
    const url = odbery.find((o) => o.id === id)?.url;
    if (url === odkaz) setOdkaz(null);
    if (url && zvlast?.some((z) => z.url === url)) setZvlast(null);
    void nactiOdbery();
  }

  async function kopiruj(text: string, klic?: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (klic) {
        setZkopirovanyKlic(klic);
        setTimeout(() => setZkopirovanyKlic(null), 2500);
        return;
      }
      setZkopirovano(true);
      setTimeout(() => setZkopirovano(false), 2500);
    } catch {
      window.prompt(t('obecne.zkopirujteOdkaz'), text);
    }
  }

  const webcal = odkaz?.replace(/^https?:\/\//, 'webcal://') ?? '';
  const google = odkaz ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : '';

  const naWebcal = (url: string) => url.replace(/^https?:\/\//, 'webcal://');
  const naGoogle = (url: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(naWebcal(url))}`;

  const VOLBY: { klic: Rozsah; nazev: string; popis: string }[] = [
    {
      klic: 'ZVLAST',
      nazev: t('odberKalendare.rozsahZvlast'),
      popis: t('odberKalendare.rozsahZvlastPopis'),
    },
    { klic: 'ALL', nazev: t('odberKalendare.rozsahVse'), popis: t('odberKalendare.rozsahVsePopis') },
    { klic: 'MINE', nazev: t('odberKalendare.rozsahMoje'), popis: t('odberKalendare.rozsahMojePopis') },
  ];

  /**
   * Věty s tučným slovem uprostřed - celá věta je jeden klíč a rozdělí se až
   * při vykreslení (pravidlo 7 v docs/preklad-portalu.md).
   */
  const qrVeta = prelozitKolem(jazyk, 'odberKalendare.qrPostup', 'odebirat');
  const zvlastVeta = prelozitKolem(jazyk, 'odberKalendare.zvlastObnova', 'aktualizovat');
  const iphoneVeta = prelozitKolem(jazyk, 'odberKalendare.qrPostupDlouhy', 'odebirat');
  const obnovaVeta = prelozitKolem(jazyk, 'odberKalendare.obnova', 'aktualizovat');

  return (
    <>
      {/* Jen nenapadna ikonka (zadani 20. 9. 2026: „tlacitko je strasne
          velke a zbytecne na to, ze se to prida jednou a pak uz se
          nepouziva"). Popis je v bublince po najeti mysi. */}
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        aria-label={t('odberKalendare.tlacitko')}
        title={t('odberKalendare.tlacitko')}
        className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-brand-purple hover:bg-field transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3M12 13v5M9.5 15.5h5" />
        </svg>
      </button>

      {otevreno && (
        <div
          className="fixed inset-0 z-[70] bg-black/55 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t('odberKalendare.nadpis')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOtevreno(false);
          }}
        >
          <div className="w-full max-w-xl bg-surface rounded-card border border-line shadow-lg p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-2xl text-ink m-0">{t('odberKalendare.nadpis')}</p>
                <p className="text-sm font-body text-muted m-0 mt-1">{t('odberKalendare.podnadpis')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOtevreno(false)}
                aria-label={t('obecne.zavrit')}
                className="text-muted hover:text-ink text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 1. Co */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">
                {t('odberKalendare.krok1')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VOLBY.map((v) => (
                  <button
                    key={v.klic}
                    type="button"
                    onClick={() => setRozsah(v.klic)}
                    aria-pressed={rozsah === v.klic}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      rozsah === v.klic
                        ? 'border-brand-purple bg-brand-purple/10'
                        : 'border-dashed border-line hover:border-brand-purple'
                    }`}
                  >
                    <span className="block font-heading font-semibold text-sm text-ink">{v.nazev}</span>
                    <span className="block text-xs font-body text-muted mt-0.5">{v.popis}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Kam */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">
                {t('odberKalendare.krok2')}
              </p>
              {rozsah === 'ZVLAST' && zvlast ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-body text-muted m-0">{t('odberKalendare.zvlastPopis')}</p>
                  <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                    {zvlast.map((z) => (
                      <li key={z.klic} className="rounded-lg border border-line px-3 py-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-2 font-heading font-semibold text-sm text-ink mr-auto">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: z.barva }} />
                            {z.nazev}
                          </span>
                          <a
                            href={naWebcal(z.url)}
                            className="rounded-lg bg-brand-purple text-white px-3 py-1.5 text-xs font-heading font-semibold no-underline hover:bg-brand-purpleDeep"
                          >
                            Apple
                          </a>
                          <a
                            href={naGoogle(z.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-brand-purple text-white px-3 py-1.5 text-xs font-heading font-semibold no-underline hover:bg-brand-purpleDeep"
                          >
                            Google
                          </a>
                          {z.qr && (
                            <button
                              type="button"
                              onClick={() => setQrOtevreny(qrOtevreny === z.klic ? null : z.klic)}
                              aria-pressed={qrOtevreny === z.klic}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs font-heading font-semibold text-ink hover:border-brand-purple"
                            >
                              QR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void kopiruj(z.url, z.klic)}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-heading font-semibold text-ink hover:border-brand-purple whitespace-nowrap"
                          >
                            {zkopirovanyKlic === z.klic
                              ? `✓ ${t('obecne.zkopirovano')}`
                              : t('odberKalendare.kopirovatOdkaz')}
                          </button>
                        </div>
                        {qrOtevreny === z.klic && z.qr && (
                          <div className="flex items-center gap-3">
                            <div
                              className="w-28 h-28 shrink-0 bg-white rounded-md p-1 [&>svg]:w-full [&>svg]:h-full"
                              dangerouslySetInnerHTML={{ __html: z.qr }}
                              aria-label={t('odberKalendare.qrPopisekNazev', { nazev: z.nazev })}
                              role="img"
                            />
                            <p className="text-xs font-body text-muted m-0">
                              {qrVeta[0]}
                              <b>{t('odberKalendare.slovoOdebirat')}</b>
                              {qrVeta[1]}
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-body text-muted m-0 bg-field rounded-lg px-3 py-2">
                    {zvlastVeta[0]}
                    <b>{t('odberKalendare.slovoAktualizovatPet')}</b>
                    {zvlastVeta[1]}
                  </p>
                </div>
              ) : !odkaz ? (
                <div>
                  <button
                    type="button"
                    onClick={() => void vytvor()}
                    disabled={bezi}
                    className="bg-brand-purple text-white font-heading font-semibold text-sm rounded-lg px-5 py-2.5 hover:bg-brand-purpleDeep disabled:opacity-60"
                  >
                    {bezi
                      ? t('odberKalendare.pripravuji')
                      : rozsah === 'ZVLAST'
                        ? t('odberKalendare.pripravitKalendare')
                        : t('odberKalendare.pripravitOdkaz')}
                  </button>
                  {chyba && <p className="text-sm text-danger m-0 mt-2">{chyba}</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={webcal}
                      className="rounded-lg bg-brand-purple text-white px-4 py-3 no-underline hover:bg-brand-purpleDeep transition-colors"
                    >
                      <span className="block font-heading font-semibold text-sm">{t('odberKalendare.apple')}</span>
                      <span className="block text-xs opacity-80">{t('odberKalendare.applePopis')}</span>
                    </a>
                    <a
                      href={google}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-brand-purple text-white px-4 py-3 no-underline hover:bg-brand-purpleDeep transition-colors"
                    >
                      <span className="block font-heading font-semibold text-sm">{t('kalendarOdber.google')}</span>
                      <span className="block text-xs opacity-80">{t('odberKalendare.googlePopis')}</span>
                    </a>
                  </div>
                  {/* QR (20. 9. 2026) - pocitac ukaze kod, iPhone ho nacte
                      fotoaparatem a Kalendar rovnou nabidne odber. */}
                  {qr && (
                    <div className="flex items-center gap-4 rounded-lg border border-line p-3">
                      <div
                        className="w-32 h-32 shrink-0 bg-white rounded-md p-1 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: qr }}
                        aria-label={t('odberKalendare.qrPopisek')}
                        role="img"
                      />
                      <div className="text-sm font-body text-ink">
                        <p className="font-heading font-semibold m-0">{t('odberKalendare.naskenujte')}</p>
                        <p className="text-xs text-muted m-0 mt-1">
                          {iphoneVeta[0]}
                          <b>{t('odberKalendare.slovoOdebirat')}</b>
                          {iphoneVeta[1]}
                        </p>
                        <p className="text-xs text-muted m-0 mt-1">{t('odberKalendare.android')}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-body text-muted">{t('odberKalendare.outlook')}</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={odkaz}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 rounded-lg border border-line bg-field px-3 py-2 text-xs font-mono text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => void kopiruj(odkaz)}
                        className="rounded-lg border border-line px-3 py-2 text-sm font-heading font-semibold text-ink hover:border-brand-purple whitespace-nowrap"
                      >
                        {zkopirovano ? `✓ ${t('obecne.zkopirovano')}` : t('odberKalendare.kopirovat')}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-body text-muted m-0 bg-field rounded-lg px-3 py-2">
                    {obnovaVeta[0]}
                    <b>{t('odberKalendare.slovoAktualizovat')}</b>
                    {obnovaVeta[1]}
                  </p>
                </div>
              )}
            </div>

            {/* Moje odbery */}
            {odbery.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <p className="text-xs font-heading font-semibold text-muted uppercase tracking-wide m-0">
                  {t('odberKalendare.mojeOdbery')}
                </p>
                <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                  {odbery.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-heading text-ink">
                        {popisRozsahu(o)}
                        <span className="text-xs font-body text-muted ml-2">
                          {o.naposledy
                            ? t('odberKalendare.naposledyStazeno', {
                                datum: formatDatumCas(jazyk, new Date(o.naposledy)),
                              })
                            : t('odberKalendare.nestazeno')}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void zneplatni(o.id)}
                        className="text-xs font-heading text-muted hover:text-danger underline"
                        title={t('odberKalendare.zneplatnitBublina')}
                      >
                        {t('odberKalendare.zneplatnit')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
