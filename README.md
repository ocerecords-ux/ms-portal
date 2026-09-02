# MS Portal

Klientský portál MEDIA SPACE (Next.js 14, App Router, TypeScript, Tailwind, Prisma/PostgreSQL).
Veřejný web MEDIA SPACE zůstává na Wixu — tohle je samostatná aplikace pro `www.msportal.cz`.

## Co je hotové (fáze 1, část 1)

- Přihlášení klientů e-mailem/heslem (NextAuth), účty zakládá pouze administrátor (žádná veřejná registrace).
- **Bezpečná izolace dat mezi klienty** — `companyId` se vždy bere ze session na serveru, nikdy z URL/parametrů. Viz `src/app/(portal)/layout.tsx` a každou stránku v `src/app/(portal)/`.
- Design systém odpovídající vzhledu **msportal.cz** (barvy, fonty — viz níže).
- Obrazovka **Moje projekty**.
- Formulář **Objednávka audioknihy** s automatickým výpočtem předběžné ceny (počet normostran × sazba klienta), uložením objednávky, e-mailem na `objednavky@mediaspace.cz` a založením projektu v Caflou (název, firma/štítek, počet normostran).
- Obrazovka **Nahrávky** — odkaz na Google Drive složku klienta.
- **Administrace** (`/admin`, jen pro účty s rolí ADMIN) — zakládání a úprava klientů (název, sazba za normostranu, Caflou štítek, odkaz na Drive složku) a zakládání přihlašovacích účtů klientům. Odkaz na ni najdete po přihlášení jako admin v menu vpravo nahoře.

## Co ještě chybí (další kroky)

- Ověření přesné specifikace Caflou API (endpoint, pole, autentizace) — `src/lib/caflou.ts` má připravenou strukturu, ale tvar požadavku je potřeba doladit s reálným API klíčem.
- Import už existujících projektů z Caflou (podle štítku klienta) do sekce Projekty — teď se tam objevují jen projekty založené přes portál.

## Design systém

Vytaženo přímo z živého webu msportal.cz (Wix), aby portál vizuálně navazoval:

| Token | Hodnota | Použití |
|---|---|---|
| `brand.purple` | `#7B55FF` | hlavní pozadí, hlavička |
| `brand.green` | `#1FDF67` | akcent, nadpisy, odkazy, tlačítka |
| Nadpisy / navigace | Inter (bold/semibold) | náhrada za Helvetica Neue z Wixu |
| Nadpisy formulářů | Jost | náhrada za Futura z Wixu |
| Popisky / běžný text | Poppins | náhrada za Avenir z Wixu |

Vše je nastavené v `tailwind.config.ts` a `src/app/layout.tsx` (Google Fonts přes `next/font`).

## Nasazení bez terminálu (doporučený postup pro spuštění na www.msportal.cz)

Build (`npm run build`) je nastavený tak, že si při každém nasazení sám spustí databázové migrace i počáteční data (`prisma migrate deploy` + seed) — po nahrání kódu tedy není potřeba nic spouštět z příkazové řádky.

1. **GitHub** — založte si účet na github.com (zdarma), vytvořte nový repozitář (např. `ms-portal`) a nahrajte do něj obsah složky `web/` (na stránce repozitáře jde použít "uploading an existing file" — přetažením souborů v prohlížeči, terminál není potřeba).
2. **Supabase** — účet na supabase.com (zdarma tarif stačí), založte nový projekt → v nastavení projektu (Project Settings → Database) zkopírujte "Connection string" → to je váš `DATABASE_URL`.
3. **Vercel** — účet na vercel.com, "Add New Project" → import repozitáře z GitHubu → v "Environment Variables" vyplňte hodnoty z `.env.example` (`DATABASE_URL` ze Supabase, `NEXTAUTH_SECRET` — cokoliv náhodného a dlouhého, `NEXTAUTH_URL=https://www.msportal.cz`, a dále S3/SMTP/Caflou údaje) → Deploy.
4. **Doména u Active24** — ve Vercelu v projektu otevřete záložku Domains, přidejte `www.msportal.cz`, Vercel vám ukáže konkrétní DNS záznamy (obvykle CNAME) → v administraci Active24 tyto záznamy nastavte místo těch, které teď vedou na Wix. Pozor: tímto krokem přestane být na `msportal.cz` dostupný současný Wix prototyp — nahradí ho ostrá aplikace.
5. Po nasazení se přihlaste jako `admin@mediaspace.cz` / `zmente-toto-heslo` a **hned si heslo změňte** (přes Prisma Studio nebo počkejte na admin obrazovku).

## Spuštění lokálně (alternativa pro vývojáře)

```bash
npm install
cp .env.example .env       # a doplňte hodnoty (viz níže)
npx prisma migrate dev --name init
npm run db:seed            # založí testovací admin + klientský účet
npm run dev
```

Otevřete `http://localhost:3000` — přihlaste se jako `admin@mediaspace.cz` / `zmente-toto-heslo` a v menu vpravo nahoře otevřete **Administrace**, kde zakládáte klienty a jejich účty. Testovací klient `ocerecords@gmail.com` / `zmente-toto-heslo` je založený automaticky (seed).

Pro pokročilejší přímý zásah do databáze (výjimečně) lze použít i `npx prisma studio`.

## Potřebné údaje pro doplnění `.env` / proměnných ve Vercelu

- `DATABASE_URL` — PostgreSQL ze Supabase (viz výše).
- `NEXTAUTH_SECRET` — libovolný náhodný dlouhý řetězec.
- `NEXTAUTH_URL` — `https://www.msportal.cz`.
- `S3_*` — úložiště příloh (AWS S3 nebo Cloudflare R2 — R2 má zdarma tarif).
- `SMTP_*` — pro odesílání objednávek na `objednavky@mediaspace.cz`.
- `CAFLOU_API_BASE_URL` / `CAFLOU_API_KEY` — z vašeho Caflou účtu (Nastavení → API).
