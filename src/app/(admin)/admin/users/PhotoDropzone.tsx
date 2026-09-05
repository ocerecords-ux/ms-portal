'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Vyber fotky uzivatele - kliknutim (vybere se soubor z disku) NEBO
 * pretazenim (drag & drop), zadani 12. 9. 2026. Sdileny mezi NewUserForm a
 * UserEditForm, aby se chovaly stejne.
 */
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

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith('image/')) onChange(f);
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
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-2.5 border border-dashed rounded-lg px-3 py-2 cursor-pointer transition-colors ${
        dragOver ? 'border-brand-purple bg-brand-purple/5' : 'border-line hover:border-brand-purple/50'
      }`}
    >
      {previewUrl || showingExisting ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl || existingUrl || ''} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <span className="text-muted text-base shrink-0">📷</span>
      )}
      <span className="text-xs text-muted flex-1 truncate">
        {file ? file.name : showingExisting ? 'Aktuální fotka' : 'Přetáhněte sem soubor nebo klikněte pro výběr'}
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
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
