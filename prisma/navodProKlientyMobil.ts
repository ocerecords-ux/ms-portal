/**
 * PORTÁL V MOBILU (zadání 27. 9. 2026: „u klientů v portálu dej ještě návod
 * na přidání MS portálu do mobilu. S obrázkama").
 *
 * Portál je hotová webová aplikace (manifest, ikona, offline obal), takže si
 * ho telefon umí přidat na plochu a otevírat na celou obrazovku. Klient o tom
 * ale neví - proto tenhle návod.
 *
 * PÍŠE SE PRO KLIENTA: žádné „PWA", „manifest" ani „service worker" - jen
 * klepnutí, která má udělat. Obrázky jsou schematické (kreslí je
 * scripts/obrazkyNavoduMobil.py), ne snímky z cizího telefonu: nezastarají
 * s další verzí systému a platí pro iPhone i Android.
 */
export const KLIENT_MOBIL = {
  slug: 'portal-v-mobilu',
  nazev: 'Portál v mobilu',
  perex: 'Jak si portál přidat na plochu telefonu, aby se otevíral jako aplikace.',
  kategorie: 'Začínáme',
  poradi: 2,
  proRole: ['CLIENT'],
  obsah: `Portál si můžete přidat na plochu telefonu. Otevírá se pak na celou obrazovku jako běžná aplikace — bez adresního řádku, rovnou u vašich projektů, a zůstanete přihlášení. Nic se nestahuje z obchodu s aplikacemi a nic se neinstaluje, je to jen zkratka na ploše.

Trvá to půl minuty. Nejdřív se v telefonu přihlaste na **msportal.cz**, ať máte portál otevřený.

# Otevřít portál v telefonu

Adresu nemusíte do mobilu přepisovat — namiřte na kód fotoaparát telefonu a klepněte na odkaz, který se objeví.

![QR kód na msportal.cz](/navody/mobil-qr.jpg)

Na iPhonu dbejte na to, aby se portál otevřel v **Safari** — z jiného prohlížeče volba „Přidat na plochu“ není.

# iPhone (Safari)

Musí to být Safari — v jiném prohlížeči na iPhonu tahle volba není.

![Spodní lišta Safari se zvýrazněnou značkou sdílení](/navody/mobil-ios-1.jpg)

Dole na liště klepněte na **značku sdílení** — čtvereček se šipkou nahoru.

![Nabídka sdílení v Safari s volbou Přidat na plochu](/navody/mobil-ios-2.jpg)

V nabídce sjeďte níž na **Přidat na plochu** a potvrďte **Přidat** vpravo nahoře. Název můžete nechat, jak je.

# Android (Chrome)

![Nabídka Chromu na Androidu s volbou Instalovat aplikaci](/navody/mobil-android.jpg)

Klepněte na **tři tečky** a vyberte **Instalovat aplikaci**. Podle verze Chromu se volba může jmenovat **Přidat na plochu** — je to totéž. Pak potvrďte.

# Hotovo

![Ikona portálu na ploše telefonu](/navody/mobil-hotovo.jpg)

Na ploše máte fialovou ikonu **MS portal**. Otevře se na celou obrazovku a pamatuje si přihlášení — heslo budete psát jen při prvním přihlášení nebo po odhlášení.

# Když se něco nedaří

- **Volbu „Přidat na plochu" nevidím.** Na iPhonu to jde jen ze Safari, ne z Chromu ani z odkazu otevřeného v jiné aplikaci (třeba z e-mailu). Otevřete msportal.cz přímo v Safari.
- **Přidal jsem to, ale chce to po mně heslo pokaždé.** Zkuste se v aplikaci na ploše přihlásit ještě jednou — od té chvíle už si vás bude pamatovat.
- **Místo fialové ikony mám šedý čtvereček s písmenem M.** To dělá jiný prohlížeč než Safari — Firefox i Chrome si na iPhonu kreslí vlastní šedou dlaždici s prvním písmenem a skutečnou ikonu portálu si nevezmou. Šedou zkratku smažte, otevřete **msportal.cz v Safari** a přidejte ji na plochu znovu; ikona pak bude fialová.
- **Ikona je tam dvakrát.** Přidání se dá zopakovat, takže vznikne druhá zkratka. Přebytečnou smažete jako kteroukoli jinou ikonu.

Kdyby se to nedařilo, napište nám — pošleme vám odkaz nebo vám s tím pomůžeme.`,
};
