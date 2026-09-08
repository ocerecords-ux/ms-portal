'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vyber fotky uzivatele - kliknutim (vybere se soubor z disku) NEBO
 * pretazenim (drag & drop), zadani 12. 9. 2026. Sdileny mezi NewUserForm a
 * UserEditForm, aby se chovaly stejne.
 *
 * Oprava 8. 9. 2026 ("v detailu uživatele se nezobrazuje fotka, i když ji tam
 * mám"): fotku pred odeslanim zmensime primo v prohlizeci na 400 px a
 * prevedeme na JPEG. Server ji pak zvladne ulozit i bez nastaveneho
 * uloziste S3 - vejde se rovnou do databaze (viz lib/storage.ts). Zaroven to
 * usetri prenos: z peticiferneho fotoaparatoveho snimku zbyde par desitek kB.
 */

const MAX_SIDE = 400;

async function downscale(file: File): Promise<File> {
  // Ve starsim prohlizeci (nebo u formatu, ktery neumi dekodovat) radeji
  // posleme original, nez abychom nahravani rozbili.
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'fotka';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function PhotoDropzone({
  file,
  onChange,
  existingUrl,
  onRemoveExisting,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  /** U editace existujiciho uctu - aktualni fotka na serveru (pokud jeste neni oznacena ke smazani/nahrazeni). */
  existingUrl?: string | null;
  /** U editace existujiciho uctu - oznaceni aktualni fotky ke smazani. */
  onRemoveExisting?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setBusy(true);
    try {
      onChange(await downscale(f));
    } finally {
      setBusy(false);
    }
  }

  const showingExisting = !file && !!existingUrl;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-3 border border-dashed rounded-lg px-3 py-3 cursor-pointer transition-colors ${
        dragOver ? 'border-brand-purple bg-brand-purple/5' : 'border-line hover:border-brand-purple/50'
      }`}
    >
      {previewUrl || showingExisting ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl || existingUrl || ''} alt="" className="w-14 h-14 rounded-full object-cover shrink-0 border border-line" />
      ) : (
        <span className="w-14 h-14 rounded-full bg-field border border-line flex items-center justify-center text-muted text-xl shrink-0">📷</span>
      )}
      <span className="text-xs text-muted flex-1 truncate">
        {busy
          ? 'Připravuji fotku…'
          : file
            ? file.name
            : showingExisting
              ? 'Aktuální fotka'
              : 'Přetáhněte sem soubor nebo klikněte pro výběr'}
      </span>
      {(file || showingExisting) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (file) onChange(null);
            else onRemoveExisting?.();
          }}
          className="text-xs text-red-600 font-heading shrink-0"
        >
          Odebrat
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
