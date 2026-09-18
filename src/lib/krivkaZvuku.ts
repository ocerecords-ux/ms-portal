/**
 * KŘIVKA ZVUKU (vytaženo z AudioTaggeru 18. 9. 2026, aby ji mohl kreslit
 * i tagger pro reklamní spoty - tam se počítá ze zvukové stopy videa).
 *
 * Dekóduje se do 8 kHz mono: z hodinové nahrávky vznikne pár desítek MB
 * místo gigabajtu a na obrázek široký několik set bodů to bohatě stačí.
 *
 * Běží to v prohlížeči (Web Audio), na serveru by to neprošlo.
 */

/** Vzorkování pro křivku. */
export const KRIVKA_HZ = 8000;

/** Nad tuhle velikost se křivka nekreslí - dekódování by sežralo paměť. */
export const STROP_PRO_KRIVKU = 150 * 1024 * 1024;

/** Dvojice [min, max] na každý sloupec křivky. */
export type Peaks = [number, number][];

export async function spocitejKrivku(url: string, pocet = 640): Promise<Peaks> {
  const odpoved = await fetch(url);
  if (!odpoved.ok) throw new Error('nelze stáhnout');
  const data = await odpoved.arrayBuffer();

  const Offline =
    (
      window as unknown as {
        OfflineAudioContext?: typeof OfflineAudioContext;
        webkitOfflineAudioContext?: typeof OfflineAudioContext;
      }
    ).OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const ctx = new Offline(1, KRIVKA_HZ, KRIVKA_HZ);
  const buffer = await ctx.decodeAudioData(data);

  const vzorky = buffer.getChannelData(0);
  const velikost = vzorky.length / pocet;
  const strop = 64;
  const peaks: Peaks = new Array(pocet);
  for (let i = 0; i < pocet; i += 1) {
    const od = Math.floor(i * velikost);
    const do_ = Math.max(od + 1, Math.floor((i + 1) * velikost));
    const krok = Math.max(1, Math.floor((do_ - od) / strop));
    let min = 0;
    let max = 0;
    for (let j = od; j < do_; j += krok) {
      const v = vzorky[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[i] = [min, max];
  }
  return peaks;
}
