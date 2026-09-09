# Acid Grotesk

Sem patří webové řezy firemního fontu **Acid Grotesk** (Folch Studio,
komerční licence - font se nedá stáhnout z Google Fonts ani odjinud
zdarma, musí přijít z licence Mediaspace).

Očekávané názvy souborů:

```
public/fonts/AcidGrotesk-Regular.woff2   <- povinný, používá se všude
public/fonts/AcidGrotesk-Medium.woff2    <- volitelný
public/fonts/AcidGrotesk-Bold.woff2      <- volitelný
```

Zapojení je hotové v `src/app/globals.css` (`@font-face`) a
`tailwind.config.ts` (rodiny `font-heading`, `font-display`, `font-body`
začínají Acid Groteskem). Dokud soubor `AcidGrotesk-Regular.woff2`
nepřibude, prohlížeč použije `local('Acid Grotesk')` - tedy font
nainstalovaný v systému - a když ani ten není, spadne to na záložní
Inter / Jost / Poppins, takže portál vypadá jako dosud.

Medium a Bold jsou v `globals.css` zakomentované. Jakmile soubory
přibudou, stačí komentář odstranit - jinak by prohlížeč zbytečně sahal
po neexistujících souborech.

Pozn.: Rodný list (PDF) má fonty vložené přímo v sobě
(`src/lib/rodnyListAssets.ts`, dnes Liberation Sans). Ten se z těchto
souborů nebere - přegenerovat se musí skriptem
`scripts/build-rodny-list-assets.py` a k tomu je potřeba .ttf nebo .otf
řez, ne .woff2.
