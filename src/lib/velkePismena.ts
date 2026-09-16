/**
 * VELKÉ PÍSMENO NA ZAČÁTKU VĚTY (zadání 16. 9. 2026: „v chatu bych potřeboval
 * zapnout, aby na začátku věty bylo automaticky velké písmeno").
 *
 * Telefony to dělají samy, počítač ne — a tým píše do chatu z obojího, takže
 * půlka zpráv chodila s malým písmenem na začátku. Tohle dělá na počítači
 * totéž, co dělá klávesnice na mobilu.
 *
 * ZVĚTŠUJE SE JEN PRÁVĚ NAPSANÉ PÍSMENO, nikdy hotový text. Kdo si pak písmeno
 * opraví zpátky na malé, nic mu ho znovu nepřepíše — soubor rozhoduje jen
 * o jediném znaku v okamžiku, kdy ho člověk zmáčkne.
 */

/**
 * Zkratky, po kterých věta NEKONČÍ. Bez tečky a malými písmeny.
 *
 * Kdyby tu nebyly, „napsal jsem to např. ondrovi" by se zlomilo na „Ondrovi"
 * uprostřed věty. Seznam je schválně krátký — jen to, co Mediaspace v chatu
 * opravdu píše. Radši nechat pár vět bez velkého písmena než lidem přepisovat
 * text, který napsali správně.
 */
const ZKRATKY = new Set([
  'např', 'atd', 'apod', 'tzn', 'tzv', 'tj', 'mj', 'resp', 'cca', 'popř',
  'str', 'č', 'čís', 'kap', 'obr', 'tab', 'zejm', 'hod', 'min', 'ks',
  'spol', 's.r.o', 'a.s', 'p', 'pí', 'ing', 'mgr', 'mga', 'bc', 'dr',
]);

/**
 * Začíná se na tomhle místě nová věta?
 *
 * `textPred` je všechno, co v poli stojí PŘED kurzorem. Nová věta je:
 *  - úplný začátek zprávy (i když už jsou před kurzorem jen mezery),
 *  - nový řádek,
 *  - tečka, vykřičník, otazník nebo výpustka a za nimi mezera.
 *
 * Nikdy ne po ČÍSLICI s tečkou: „natáčíme 16. září" a „bod 3. je hotový" jsou
 * v češtině běžnější než věta začínající číslovkou, a přepsané „Září" by bylo
 * horší než malé písmeno na začátku věty.
 */
export function zacatekVety(textPred: string): boolean {
  // Konec řádku i konec zprávy: mezery na konci se nepočítají.
  const bezMezer = textPred.replace(/[ \t]+$/, '');
  if (bezMezer === '') return true;
  if (bezMezer.endsWith('\n')) return true;

  // Za koncovou tečkou MUSÍ být mezera - „3.5" ani „www.seznam" větu nekončí.
  if (bezMezer.length === textPred.length) return false;

  const shoda = /([^\s]*?)([.!?…]+)$/.exec(bezMezer);
  if (!shoda) return false;

  const pred = shoda[1];
  // Číslice před tečkou: datum („16. 9."), pořadí („3. bod"), verze.
  if (/\d$/.test(pred)) return false;

  const klic = pred.toLocaleLowerCase('cs-CZ').replace(/^[^\p{L}.]+/u, '');
  if (ZKRATKY.has(klic)) return false;
  // Zkratka i s tečkami uvnitř („s.r.o."), jak ji zachytí tenhle výraz.
  if (ZKRATKY.has(klic.replace(/\.$/, ''))) return false;

  return true;
}

/**
 * Velká podoba znaku, nebo `null`, když se zvětšit nedá (číslice, mezera,
 * emodži, už velké písmeno).
 */
export function naVelke(znak: string): string | null {
  if (znak.length !== 1) return null;
  const velke = znak.toLocaleUpperCase('cs-CZ');
  if (velke === znak || velke.length !== 1) return null;
  return velke;
}
