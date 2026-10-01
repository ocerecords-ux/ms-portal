/**
 * ÚČET, POD KTERÝM BRUNO PÍŠE. Zakládá ho seed.
 *
 * Vlastní soubor BEZ JEDINÉHO IMPORTU (1. 10. 2026). Konstanta bydlela
 * v brunoServer.ts, jenže ten si přes brunoOdpoved.ts tahá i nástroje - a ve
 * chvíli, kdy jeden z nástrojů začal umět poslat zprávu (a tím potřebovat
 * brunoOznameni.ts), se kruh uzavřel: nástroje → oznámení → server → odpověď
 * → nástroje. Takový kruh se nemusí projevit při buildu, ale za běhu z něj
 * bývá prázdná hodnota a Bruno by mlčel bez vysvětlení.
 *
 * Konstanta sama o sobě nic nepotřebuje, takže stačí, aby bydlela mimo.
 */
export const BRUNO_EMAIL = 'bruno@mediaspace.cz';
