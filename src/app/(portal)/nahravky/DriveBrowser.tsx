'use client';

import { useCallback, useEffect, useState } from 'react';

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string;
  webViewLink: string | null;
  isFolder: boolean;
};

function formatBytes(size: string | null): string {
  if (!size) return '—';
  const bytes = parseInt(size, 10);
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function isAudioFile(item: DriveItem): boolean {
  return item.mimeType.startsWith('audio/');
}

// Nektere soubory (typicky Google Dokumenty vytvorene primo na Disku) nemaji
// v nazvu klasickou koncovku (.mp3, .docx...). Aby bylo na prvni pohled
// jasne, o jaky typ souboru jde, dopocitame priponu z mime typu Disku.
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'PDF',
  'application/vnd.google-apps.spreadsheet': 'XLSX',
  'application/vnd.google-apps.presentation': 'PPTX',
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/zip': 'ZIP',
  'application/vnd.rar': 'RAR',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/mp4': 'M4A',
  'audio/aac': 'AAC',
  'audio/flac': 'FLAC',
  'audio/ogg': 'OGG',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
};

function hasVisibleExtension(name: string): boolean {
  return /\.[a-zA-Z0-9]{2,4}$/.test(name);
}

function extensionBadge(item: DriveItem): string | null {
  if (item.isFolder || hasVisibleExtension(item.name)) return null;
  return EXTENSION_BY_MIME[item.mimeType] ?? null;
}

function FileIcon({ mimeType, isFolder }: { mimeType: string; isFolder: boolean }) {
  if (isFolder) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0">
        <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" fill="#7B55FF" />
      </svg>
    );
  }
  const isAudio = mimeType.startsWith('audio/');
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 shrink-0">
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill={isAudio ? '#1FDF67' : '#D8D2F0'} />
      <path d="M14 2v5h5" fill="none" stroke="#fff" strokeWidth="1.2" />
      {isAudio && <path d="M9 16.5V9.8l6-1v6.7" stroke="#201A33" strokeWidth="1.3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M7 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

type SortBy = 'name' | 'date';

function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-3 h-3 transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`}
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function DriveBrowser({ initialFolderId, rootName }: { initialFolderId: string; rootName: string }) {
  const [stack, setStack] = useState<{ id: string; name: string }[]>([{ id: initialFolderId, name: rootName }]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Rezeni klikem na nadpis sloupce (zadani 12. 9. 2026) - slozky jsou vzdy
  // nahore (bezny zvyk z Disku/Finderu), v ramci toho se radi podle nazvu
  // nebo data zmeny, vzestupne/sestupne.
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(field: SortBy) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  const currentFolder = stack[stack.length - 1];

  const load = useCallback(async (folderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Obsah složky se nepodařilo načíst.');
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Obsah složky se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentFolder.id);
    setPlayingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder.id]);

  function openFolder(item: DriveItem) {
    setStack((prev) => [...prev, { id: item.id, name: item.name }]);
  }

  function goBack() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function jumpTo(index: number) {
    setStack((prev) => prev.slice(0, index + 1));
  }

  function togglePlay(item: DriveItem) {
    setPlayingId((id) => (id === item.id ? null : item.id));
  }

  async function copyLink(item: DriveItem) {
    if (!item.webViewLink) return;
    try {
      await navigator.clipboard.writeText(item.webViewLink);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 2000);
    } catch {
      // schránka nemusí být z nějakého důvodu dostupná - tiše ignorujeme
    }
  }

  const sorted = [...items].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    const dirMul = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'date') {
      return dirMul * (new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime());
    }
    return dirMul * a.name.localeCompare(b.name, 'cs');
  });

  return (
    <div className="rounded-card overflow-hidden border border-line shadow-sm max-w-4xl mx-auto bg-white">
      <div className="bg-brand-purple px-4 sm:px-6 py-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={goBack}
          disabled={stack.length === 1}
          title="Zpět o složku výš"
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors shrink-0 ${
            stack.length === 1
              ? 'border-white/20 text-white/30 cursor-default'
              : 'border-white/40 text-white hover:bg-white hover:text-brand-purple'
          }`}
        >
          <BackIcon />
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {stack.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-2">
              {index > 0 && <span className="text-white/50 text-sm">/</span>}
              <button
                type="button"
                onClick={() => jumpTo(index)}
                disabled={index === stack.length - 1}
                className={`font-heading text-sm ${
                  index === stack.length - 1
                    ? 'text-brand-green font-semibold cursor-default'
                    : 'text-white/85 hover:text-white underline'
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      </div>

      {!loading && !error && sorted.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-line bg-field text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          <span className="w-5 shrink-0" />
          <button
            type="button"
            onClick={() => toggleSort('name')}
            className="flex-1 min-w-0 flex items-center gap-1 text-left hover:text-ink transition-colors"
          >
            Název
            {sortBy === 'name' && <SortIcon dir={sortDir} />}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('date')}
            className="w-20 shrink-0 hidden sm:flex items-center justify-end gap-1 hover:text-ink transition-colors"
          >
            {sortBy === 'date' && <SortIcon dir={sortDir} />}
            Upraveno
          </button>
          <span className="w-16 shrink-0 text-right hidden sm:block">Velikost</span>
          <span className="w-[108px] shrink-0" />
        </div>
      )}

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-muted font-body">Načítám…</div>
      ) : error ? (
        <div className="px-6 py-10 text-center text-sm text-red-600 font-body">{error}</div>
      ) : sorted.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted font-body">Tato složka je prázdná.</div>
      ) : (
        <div className="divide-y divide-line">
          {sorted.map((item) => {
            const badge = extensionBadge(item);
            const audio = isAudioFile(item);
            const isPlaying = playingId === item.id;
            return (
              <div key={item.id}>
                <div className="flex items-center gap-3 px-6 py-3 hover:bg-field transition-colors">
                  <FileIcon mimeType={item.mimeType} isFolder={item.isFolder} />
                  <button
                    type="button"
                    onClick={() => (item.isFolder ? openFolder(item) : undefined)}
                    disabled={!item.isFolder}
                    className={`flex-1 min-w-0 flex items-center gap-2 text-left text-sm font-body text-ink ${
                      item.isFolder ? 'font-semibold hover:underline cursor-pointer' : ''
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    {badge && (
                      <span className="shrink-0 text-[10px] font-heading font-bold text-brand-purpleDeep bg-line rounded px-1.5 py-0.5">
                        {badge}
                      </span>
                    )}
                  </button>
                  <span className="text-xs text-muted font-body w-20 text-right shrink-0 hidden sm:block">
                    {formatDate(item.modifiedTime)}
                  </span>
                  <span className="text-xs text-muted font-body w-16 text-right shrink-0 hidden sm:block">
                    {item.isFolder ? '' : formatBytes(item.size)}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 shrink-0 w-[108px]">
                    {audio && (
                      <button
                        type="button"
                        onClick={() => togglePlay(item)}
                        title={isPlaying ? 'Zastavit přehrávání' : 'Přehrát'}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                          isPlaying
                            ? 'bg-brand-green border-brand-green text-ink'
                            : 'border-line text-brand-green hover:bg-brand-green hover:text-ink'
                        }`}
                      >
                        {isPlaying ? <StopIcon /> : <PlayIcon />}
                      </button>
                    )}
                    {!item.isFolder && (
                      <a
                        href={`/api/drive/download?fileId=${encodeURIComponent(item.id)}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                        title="Stáhnout"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
                        </svg>
                      </a>
                    )}
                    {item.webViewLink && (
                      <button
                        type="button"
                        onClick={() => copyLink(item)}
                        title="Kopírovat odkaz ke sdílení"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                      >
                        {copiedId === item.id ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M4 12l6 6L20 6" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M9 3h9a1 1 0 0 1 1 1v9m-4-4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {audio && isPlaying && (
                  <div className="px-6 pb-3 -mt-1 bg-field">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio
                      key={item.id}
                      controls
                      autoPlay
                      className="w-full h-9"
                      src={`/api/drive/download?fileId=${encodeURIComponent(item.id)}&disposition=inline`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
