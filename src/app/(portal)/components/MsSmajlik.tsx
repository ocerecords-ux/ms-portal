import { najdiSmajlika } from '@/lib/msSmajlici';

/**
 * Vykreslení jednoho Mediaspace smajlíka (zadání 9. 9. 2026).
 *
 * Ve zprávě je uložená jen zkratka, obrázek se skládá až tady - viz
 * lib/msSmajlici.ts. Kresba jde do SVG přes dangerouslySetInnerHTML, což je
 * v tomhle případě v pořádku: obsah je naše vlastní konstanta ze zdrojáku,
 * nikdy nic, co by přišlo od uživatele.
 *
 * Neznámou zkratku (třeba z doby, kdy sada vypadala jinak) záměrně
 * nevykreslujeme jako prázdno - vrátí se jako text, ať se ze zprávy nic
 * neztratí.
 */
export function MsSmajlik({ code, size = 18 }: { code: string; size?: number }) {
  const smajlik = najdiSmajlika(code);
  if (!smajlik) return <span>{code}</span>;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={smajlik.label}
      className="inline-block align-[-0.22em]"
      dangerouslySetInnerHTML={{ __html: smajlik.svg }}
    />
  );
}
