#!/usr/bin/env python3
"""
Vyrobi stubs/prisma-client.d.ts ze schema.prisma.

PROC: v repozitari nejsou node_modules (a na pocitaci, kde tohle bezi,
nejde `npm install`), takze `@prisma/client` pri typove kontrole chybi.
Tenhle skript z nej udela nahradu: kazdy model jako typ, kazdy enum jako
sjednoceni retezcu a PrismaClient se seznamem tabulek.

Neni to presna kopie toho, co generuje Prisma - je to zamerne volnejsi
(kazdy model ma `[key: string]: any`, argumenty dotazu jsou `any`), aby
kontrola hlidala to podstatne: nazvy tabulek, poli a enumu. Diky tomu se
poznaji preklepy a zapomenuta migrace, a pritom to nehlasi stovky
falesnych chyb.

Pouziti (z korene repozitare):
    python3 gen-prisma-stub.py && tsc -p tsconfig.check.json
Slozka stubs/ je v .gitignore (ambientni `declare module` by prebilo
skutecneho vygenerovaneho klienta a build by spadl), takze se oboji vyrabi
tady. `env.d.ts` se PREPISUJE jen kdyz chybi - dopsane deklarace v nem
zustanou.
"""

import re
import sys
from pathlib import Path

KOREN = Path(__file__).resolve().parent
SCHEMA = KOREN / 'prisma' / 'schema.prisma'
CIL = KOREN / 'stubs' / 'prisma-client.d.ts'
CIL_ENV = KOREN / 'stubs' / 'env.d.ts'

# Prisma skalar -> typ v TypeScriptu.
SKALARY = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Decimal': 'number',
    'BigInt': 'number',
    'Boolean': 'boolean',
    'DateTime': 'Date',
    'Json': 'Prisma.JsonValue',
    'Bytes': 'Buffer',
}

ENV_D_TS = r'''// Minimalni nahrada za chybejici node_modules - jen aby typova kontrola
// nehlasila stovky falesnych chyb a bylo videt to podstatne.
declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: any }
  interface Element { [key: string]: any }
}
declare module 'next/navigation' {
  export function notFound(): never;
  export function redirect(url: string): never;
  export function useRouter(): any;
  export function usePathname(): string;
  export function useSearchParams(): any;
}
declare namespace React {
  type ReactNode = any;
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type KeyboardEvent<T = any> = any;
  type MouseEvent<T = any> = any;
  type DragEvent<T = any> = any;
  type PointerEvent<T = any> = any;
  type TouchEvent<T = any> = any;
  type FocusEvent<T = any> = any;
  type ClipboardEvent<T = any> = any;
  type WheelEvent<T = any> = any;
  type UIEvent<T = any> = any;
  type CSSProperties = any;
  type Ref<T = any> = any;
  type RefObject<T = any> = any;
  type Dispatch<T = any> = any;
  type SetStateAction<T = any> = any;
  type ComponentType<T = any> = any;
  type FC<T = any> = any;
  type SVGProps<T = any> = any;
  type HTMLAttributes<T = any> = any;
}
declare module 'react' {
  export type ReactNode = any;
  export type FormEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type KeyboardEvent<T = any> = any;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useRef<T>(initial: T | null): { current: T | null };
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T>(fn: T, deps?: any[]): T;
  /** React 18 - plynulý přechod bez probliknutí (kalendář, 20. 9. 2026). */
  export function useTransition(): [boolean, (fn: () => void) => void];
  export function createContext<T>(vychozi: T): any;
  export function useContext<T>(kontext: any): T;
  /** Meri rozmery pred vykreslenim - Zpetna vazba a kalendar (22. 9. 2026). */
  export function useLayoutEffect(effect: () => void | (() => void), deps?: any[]): void;
  export const Children: any;
  export const Fragment: any;
  export function isValidElement(uzel: any): boolean;
  const React: any;
  export default React;
}
declare module '*';

declare var process: any;
declare module 'next/server' {
  export class NextRequest {
    url: string;
    nextUrl: any;
    headers: any;
    cookies: any;
    json(): Promise<any>;
    formData(): Promise<any>;
    text(): Promise<string>;
    [key: string]: any;
  }
  export const NextResponse: any;
}

// --- doplnky (13. 9. 2026) ---
type Buffer = any;
declare var Buffer: any;
declare var global: any;
declare module 'next' {
  export type Metadata = any;
  export type Viewport = any;
}
declare module 'next-auth' {
  export type NextAuthOptions = any;
  export type Session = any;
  export type User = any;
  const NextAuth: any;
  export default NextAuth;
  export function getServerSession(...args: any[]): Promise<any>;
}

declare module 'next-auth/jwt' {
  export type JWT = any;
  export function getToken(args?: any): Promise<any>;
}

// --- doplnky (22. 9. 2026) ---
declare module 'zod' {
  export const z: any;
  export namespace z {
    type infer<T> = any;
  }
  const zod: any;
  export default zod;
}
declare module 'nodemailer' {
  export type Transporter = any;
  export function createTransport(...args: any[]): any;
  const nodemailer: any;
  export default nodemailer;
}
'''

METODY = """      findUnique(args?: any): Promise<{T} | null>;
      findFirst(args?: any): Promise<{T} | null>;
      findMany(args?: any): Promise<{T}[]>;
      create(args?: any): Promise<{T}>;
      update(args?: any): Promise<{T}>;
      upsert(args?: any): Promise<{T}>;
      delete(args?: any): Promise<{T}>;
      deleteMany(args?: any): Promise<any>;
      createMany(args?: any): Promise<any>;
      updateMany(args?: any): Promise<any>;
      count(args?: any): Promise<number>;
      groupBy(args?: any): Promise<any[]>;
      aggregate(args?: any): Promise<any>;"""


def bez_komentaru(radek: str) -> str:
    """Utne `//` i `///` komentar na konci radku."""
    return re.sub(r'//.*$', '', radek).strip()


def nacti_bloky(text: str, druh: str):
    """Vrati dvojice (nazev, telo) pro `model X { ... }` nebo `enum X { ... }`."""
    for shoda in re.finditer(r'^%s\s+(\w+)\s*\{(.*?)^\}' % druh, text, re.S | re.M):
        yield shoda.group(1), shoda.group(2)


def prvni_male(nazev: str) -> str:
    """Nazev tabulky v klientovi - Prisma zmensi jen prvni pismeno."""
    return nazev[0].lower() + nazev[1:]


def main() -> int:
    if not SCHEMA.exists():
        print(f'Nenasel jsem {SCHEMA}', file=sys.stderr)
        return 1
    text = SCHEMA.read_text(encoding='utf-8')

    enumy = [(n, t) for n, t in nacti_bloky(text, 'enum')]
    modely = [(n, t) for n, t in nacti_bloky(text, 'model')]
    nazvy_enumu = {n for n, _ in enumy}
    nazvy_modelu = {n for n, _ in modely}

    radky = [
        '// Vygenerovane ze schema.prisma jen pro typovou kontrolu bez node_modules.',
        "declare module '@prisma/client' {",
    ]

    for nazev, telo in enumy:
        hodnoty = []
        for radek in telo.splitlines():
            radek = bez_komentaru(radek)
            if radek and re.fullmatch(r'\w+', radek):
                hodnoty.append(f"'{radek}'")
        radky.append(f'  export type {nazev} = {" | ".join(hodnoty)};')

    for nazev, telo in modely:
        radky.append(f'  export type {nazev} = {{')
        for radek in telo.splitlines():
            radek = bez_komentaru(radek)
            if not radek or radek.startswith('@@'):
                continue
            shoda = re.match(r'^(\w+)\s+(\w+)(\[\])?(\?)?', radek)
            if not shoda:
                continue
            pole, typ, seznam, volitelne = shoda.groups()
            # Seznamy (vazby i `String[]`) do stubu nedavame - vazby si
            # kazdy dotaz vybira sam pres `include`, a to `[key: string]: any`
            # pokryje.
            if seznam or typ in nazvy_modelu:
                continue
            ts = SKALARY.get(typ) or (typ if typ in nazvy_enumu else None)
            if ts is None:
                continue
            if volitelne:
                ts += ' | null'
            radky.append(f'    {pole}: {ts};')
        radky.append('    [key: string]: any;')
        radky.append('  };')

    radky += [
        '  export class PrismaClient {',
        '    constructor(args?: any);',
        '    $transaction(arg: any, opts?: any): Promise<any>;',
        '    $connect(): Promise<void>;',
        '    $disconnect(): Promise<void>;',
        '    $queryRaw(...args: any[]): Promise<any>;',
        '    $executeRaw(...args: any[]): Promise<any>;',
    ]
    for nazev, _ in modely:
        radky.append(f'    {prvni_male(nazev)}: {{')
        radky.append(METODY.replace('{T}', nazev))
        radky.append('    };')
    radky += [
        '  }',
        '  export namespace Prisma {',
        '    type InputJsonValue = string | number | boolean | { [k: string]: InputJsonValue | null } | InputJsonValue[];',
        '    type JsonValue = InputJsonValue | null;',
        '    type TransactionClient = any;',
        '    const JsonNull: any;',
        '    const DbNull: any;',
        '  }',
        '}',
    ]

    CIL.parent.mkdir(parents=True, exist_ok=True)
    if not CIL_ENV.exists():
        CIL_ENV.write_text(ENV_D_TS, encoding='utf-8')
        print(f'{CIL_ENV.relative_to(KOREN)}: vyrobeno znovu')
    CIL.write_text('\n'.join(radky) + '\n', encoding='utf-8')
    print(f'{CIL.relative_to(KOREN)}: {len(modely)} modelu, {len(enumy)} enumu')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
