/**
 * SLOŽENÍ PŘÍBĚHU S HUDBOU (zadání 8. 10. 2026: „můžeme nějak u toho příběhu
 * rovnou vybrat hudbu jak na instagramu a mít možnost vypnout původní zvuk?").
 *
 * PROČ TO DĚLÁ PROHLÍŽEČ. Hudební nálepku Instagramu přes API nalepit nejde,
 * takže hudba musí být VYPÁLENÁ V SOUBORU, než se nahraje. Překódovat video
 * na serveru by znamenalo ffmpeg na Vercelu - velký balíček, strop 60 vteřin
 * na funkci a účtovaný procesorový čas za každý příběh. Prohlížeč to umí sám:
 * plátno se nahrává přes `captureStream`, zvuk se k němu přimíchá z Web Audio
 * a `MediaRecorder` z toho udělá rovnou hotový soubor.
 *
 * NAHRÁVÁ SE V REÁLNÉM ČASE. Patnáctivteřinový příběh se skládá patnáct
 * vteřin - jinak to s MediaRecorderem nejde, proto se hlásí průběh.
 *
 * NA TELEFONU VYPADNE MP4, na počítači podle prohlížeče. Instagram WebM
 * nebere, takže když prohlížeč MP4 neumí, hudba se vůbec nenabídne
 * (viz `umiSlozitVideo`) - lepší než příběh, který spadne až při vyvěšení.
 */

/** Příběh se skládá na výšku 9:16; víc než 1080×1920 Instagram stejně zmenší. */
const SIRKA = 1080;
const VYSKA = 1920;
const SNIMKU_ZA_S = 30;

/**
 * Typy, které Instagram u příběhu vezme. Pořadí je podle toho, co chceme
 * nejradši - H.264 v MP4 projde všude.
 */
const TYPY_ZAZNAMU = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4;codecs=avc1',
  'video/mp4',
];

/** Čím tenhle prohlížeč umí nahrávat, nebo null, když MP4 neumí vůbec. */
export function typZaznamu(): string | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null;
  for (const typ of TYPY_ZAZNAMU) {
    try {
      if (MediaRecorder.isTypeSupported(typ)) return typ;
    } catch {
      // Starší prohlížeče na isTypeSupported padají - ber to jako „neumí".
    }
  }
  return null;
}

/**
 * Umí tenhle prohlížeč složit příběh s hudbou? Kromě MediaRecorderu je
 * potřeba i `captureStream` na plátně - bez něj není co nahrávat.
 */
export function umiSlozitVideo(): boolean {
  if (typeof document === 'undefined') return false;
  const platno = document.createElement('canvas');
  const umiPlatno = typeof (platno as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function';
  return umiPlatno && typZaznamu() !== null;
}

/** AudioContext i se starým webkit prefixem (Safari). */
function zvukovyKontext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const okno = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Trida = okno.AudioContext ?? okno.webkitAudioContext;
  return Trida ? new Trida() : null;
}

/**
 * Safari zvukový kontext zakázne, dokud ho nerozběhne klepnutí člověka.
 * Skládání vždycky začíná tlačítkem, takže stačí požádat o probuzení -
 * bez toho by z příběhu vypadlo ticho a nikdo by nevěděl proč.
 */
async function probud(kontext: AudioContext): Promise<void> {
  if (kontext.state === 'suspended') {
    await kontext.resume().catch(() => undefined);
  }
}

/** Stáhne skladbu z portálu a rozkóduje ji - hotové vzorky na míchání. */
export async function nactiSkladbuDoPameti(id: string): Promise<AudioBuffer | null> {
  const kontext = zvukovyKontext();
  if (!kontext) return null;
  try {
    await probud(kontext);
    const res = await fetch(`/api/site/hudba/${encodeURIComponent(id)}/soubor`);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    // Safari starší verze nevrací slib - obalíme obojí.
    return await new Promise<AudioBuffer>((hotovo, chyba) => {
      const slib = kontext.decodeAudioData(data, hotovo, chyba);
      if (slib && typeof slib.then === 'function') slib.then(hotovo, chyba);
    });
  } catch {
    return null;
  } finally {
    void kontext.close().catch(() => undefined);
  }
}

export type ZadaniVidea = {
  /** Fotka (klidně už s vypáleným textem) nebo video, ze kterého se skládá. */
  zdroj: Blob;
  jeVideo: boolean;
  /** Rozkódovaná skladba, nebo null, když se má jen ztlumit původní zvuk. */
  hudba: AudioBuffer | null;
  /** Od kolikáté vteřiny skladby se má hrát. */
  zacatekHudbyS: number;
  /** Jak dlouhý má příběh být. U videa se zkrátí na jeho délku. */
  delkaS: number;
  /** U videa: nechat jeho vlastní zvuk? S hudbou se míchat nebude. */
  puvodniZvuk: boolean;
  /** 0 až 1 - kvůli ukazateli průběhu, nahrává se v reálném čase. */
  prubeh?: (zlomek: number) => void;
};

/**
 * Složí z fotky nebo videa a skladby jeden soubor pro Instagram.
 *
 * Obrázek i video se kreslí na plátno 9:16 „jak se vejde" (contain) na černém
 * podkladu - příběh na výšku tak zůstane celý a širší fotka nepřijde o kraje.
 */
export async function slozVideoSHudbou(zadani: ZadaniVidea): Promise<Blob> {
  const typ = typZaznamu();
  if (!typ) throw new Error('Tenhle prohlížeč neumí složit video pro Instagram.');

  const adresa = URL.createObjectURL(zadani.zdroj);
  const kontext = zvukovyKontext();
  let platnoStream: MediaStream | null = null;
  let zvukStream: MediaStreamAudioDestinationNode | null = null;

  try {
    const platno = document.createElement('canvas');
    platno.width = SIRKA;
    platno.height = VYSKA;
    const kresba = platno.getContext('2d');
    if (!kresba) throw new Error('Plátno se nepodařilo otevřít.');

    // --- zdroj obrazu -----------------------------------------------------
    let video: HTMLVideoElement | null = null;
    let obrazek: HTMLImageElement | null = null;
    let sirkaZdroje = SIRKA;
    let vyskaZdroje = VYSKA;
    let delka = zadani.delkaS;

    if (zadani.jeVideo) {
      video = document.createElement('video');
      video.src = adresa;
      video.muted = !zadani.puvodniZvuk;
      video.playsInline = true;
      await new Promise<void>((hotovo, chyba) => {
        video!.onloadedmetadata = () => hotovo();
        video!.onerror = () => chyba(new Error('Video se nepodařilo načíst.'));
      });
      sirkaZdroje = video.videoWidth || SIRKA;
      vyskaZdroje = video.videoHeight || VYSKA;
      // Delší příběh nemá smysl skládat - Instagram by ho stejně rozsekal.
      if (Number.isFinite(video.duration) && video.duration > 0) {
        delka = Math.min(delka, video.duration);
      }
    } else {
      obrazek = new Image();
      obrazek.src = adresa;
      await new Promise<void>((hotovo, chyba) => {
        obrazek!.onload = () => hotovo();
        obrazek!.onerror = () => chyba(new Error('Fotku se nepodařilo načíst.'));
      });
      sirkaZdroje = obrazek.naturalWidth || SIRKA;
      vyskaZdroje = obrazek.naturalHeight || VYSKA;
    }

    const mritko = Math.min(SIRKA / sirkaZdroje, VYSKA / vyskaZdroje);
    const kamSirka = sirkaZdroje * mritko;
    const kamVyska = vyskaZdroje * mritko;
    const kamX = (SIRKA - kamSirka) / 2;
    const kamY = (VYSKA - kamVyska) / 2;

    // --- stopy do nahrávky ------------------------------------------------
    platnoStream = (platno as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(
      SNIMKU_ZA_S,
    );
    const stopy = [...platnoStream.getVideoTracks()];

    /**
     * ZVUK. Hudba se pouští z Web Audio, původní zvuk videa z elementu -
     * míchat se nemají: když si někdo vybere skladbu, chce slyšet ji.
     * Bez obojího se nahrává rovnou beze zvuku, což Instagram bere.
     */
    let zdrojHudby: AudioBufferSourceNode | null = null;
    let zdrojVidea: MediaElementAudioSourceNode | null = null;
    if (kontext && (zadani.hudba || (zadani.jeVideo && zadani.puvodniZvuk))) {
      zvukStream = kontext.createMediaStreamDestination();
      if (zadani.hudba) {
        zdrojHudby = kontext.createBufferSource();
        zdrojHudby.buffer = zadani.hudba;
        zdrojHudby.connect(zvukStream);
      } else if (video) {
        zdrojVidea = kontext.createMediaElementSource(video);
        zdrojVidea.connect(zvukStream);
      }
      for (const stopa of zvukStream.stream.getAudioTracks()) stopy.push(stopa);
    }

    if (kontext) await probud(kontext);

    const zaznamnik = new MediaRecorder(new MediaStream(stopy), { mimeType: typ });
    const kusy: Blob[] = [];
    zaznamnik.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) kusy.push(e.data);
    };
    const hotovo = new Promise<void>((splneno) => {
      zaznamnik.onstop = () => splneno();
    });

    // --- běh --------------------------------------------------------------
    let bezi = true;
    const zacatek = performance.now();
    const kresli = () => {
      if (!bezi) return;
      kresba.fillStyle = '#000';
      kresba.fillRect(0, 0, SIRKA, VYSKA);
      const co = video ?? obrazek;
      if (co) kresba.drawImage(co, kamX, kamY, kamSirka, kamVyska);
      const ubehlo = (performance.now() - zacatek) / 1000;
      zadani.prubeh?.(Math.min(1, ubehlo / delka));
      requestAnimationFrame(kresli);
    };

    zaznamnik.start();
    // Vteřina navíc na konci skladby se neřeší - `stop()` přijde dřív.
    if (zdrojHudby) zdrojHudby.start(0, Math.max(0, zadani.zacatekHudbyS));
    if (video) await video.play().catch(() => undefined);
    requestAnimationFrame(kresli);

    await new Promise<void>((splneno) => setTimeout(splneno, delka * 1000));

    bezi = false;
    if (zaznamnik.state !== 'inactive') zaznamnik.stop();
    if (zdrojHudby) {
      try {
        zdrojHudby.stop();
      } catch {
        // Uz dohrala sama - nic se nedeje.
      }
    }
    video?.pause();
    await hotovo;
    zadani.prubeh?.(1);

    return new Blob(kusy, { type: typ.split(';')[0] });
  } finally {
    URL.revokeObjectURL(adresa);
    for (const stopa of platnoStream?.getTracks() ?? []) stopa.stop();
    for (const stopa of zvukStream?.stream.getTracks() ?? []) stopa.stop();
    void kontext?.close().catch(() => undefined);
  }
}
