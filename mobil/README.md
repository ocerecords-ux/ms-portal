# Aplikace do App Storu a Google Play

Zadání 10. 9. 2026: *„chci, ať se ta aplikace normálně nainstaluje do mobilu."*

Tahle složka je příprava na to, co jde připravit bez vývojářských účtů. Sama
o sobě nic nestaví — je to podklad, ze kterého se aplikace vyrobí, až budou
účty k dispozici.

## Co v této složce je

| Soubor | K čemu je |
| --- | --- |
| `capacitor.config.portal.ts` | Nastavení aplikace **MS Portal** (bez chatu) |
| `capacitor.config.chat.ts` | Nastavení aplikace **MS Chat** |
| `package.json` | Závislosti a příkazy — instaluje se **jen tady**, ne v portálu |
| `ikony/ikona-ms-portal-1024.png` | Ikona pro obchod, 1024 × 1024, bez průhlednosti |
| `ikony/ikona-ms-chat-1024.png` | Totéž pro chat |
| `ikony/uvodni-*-2732.png` | Úvodní obrazovka (splash), 2732 × 2732 |

## Jak to bude fungovat

Capacitor zabalí aplikaci do nativního obalu, který uvnitř zobrazuje
`www.msportal.cz`. Prakticky to znamená:

- **jedna verze kódu** — portál se nasazuje jako dosud přes Vercel a aplikace
  se aktualizuje s ním; do obchodu se posílá znovu, jen když se mění samotný
  obal (ikona, název, oprávnění, nová nativní funkce)
- aplikace se instaluje z App Storu / Google Play, má ikonu, běží na celou
  obrazovku a chová se jako každá jiná
- **odpadá potřeba PWA** — stránka `/instalace` a přidávání na plochu můžou
  zůstat jako záložní cesta pro počítače

## Co je potřeba od tebe, než se to postaví

1. **Apple Developer Program** — 99 USD ročně, [developer.apple.com/programs](https://developer.apple.com/programs/).
   Zápis trvá řádově dny (u firmy chtějí i DUNS číslo).
2. **Google Play Console** — 25 USD jednorázově.
3. **Xcode** na Macu (App Store, ~10 GB) a **Android Studio** pro androidí verzi.
4. Rozhodnout **jméno aplikací v obchodě** a jejich identifikátory. Návrh je
   `cz.msportal.portal` a `cz.msportal.chat` — jednou zvolený identifikátor už
   se nedá změnit.

Klíče, hesla a certifikáty do obchodů zadáváš vždycky ty, ne já.

## Postup, až účty budou

```bash
cd mobil
npm install

# MS Portal
npx cap init "MS Portal" cz.msportal.portal --web-dir=prazdno
cp capacitor.config.portal.ts capacitor.config.ts
npx cap add ios
npx cap add android
npx cap open ios        # dál už se pracuje v Xcode

# MS Chat - stejně, jen s druhým nastavením a v jiné složce
```

Ikony a úvodní obrazovky se do projektů doplní nástrojem
`npx @capacitor/assets generate` ze složky `ikony/`.

## Dvě věci, které je lepší vědět dopředu

**Apple odmítá aplikace, které jsou jen web v obalu.** Pravidlo 4.2
(„Minimum Functionality") na tohle míří přímo a je to nejčastější důvod
zamítnutí u takhle stavěných aplikací. Šance výrazně stoupne, když aplikace
umí něco, co prohlížeč neumí — u nás se nabízí nativní upozornění, sdílení
souboru z jiné aplikace přímo do chatu a přístup k fotoaparátu při přidávání
přílohy. Počítejme s tím, že první kolo schvalování může skončit dotazem
a bude potřeba doplnit odpověď.

**Upozornění se budou muset předělat.** To, co je hotové teď, je Web Push
(VAPID) a v nativním obalu nefunguje — iOS i Android chtějí své vlastní
kanály (APNs, respektive Firebase). Znamená to nový plugin v aplikaci a druhou
cestu odesílání na serveru vedle `src/lib/pushServer.ts`. Web Push zůstane pro
prohlížeč a pro aplikaci přibude nativní varianta.
