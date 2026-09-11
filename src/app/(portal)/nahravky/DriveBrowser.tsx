'use client';

import { useCallback, useEffect, useState } from 'react';
import { WaveformPlayer } from '../components/WaveformPlayer';

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

export function DriveBrowser({
  initialFolderId,
  rootName,
  token,
  jenCteni,
}: {
  initialFolderId: string;
  rootName: string;
  /**
   * Token z mailu (zadání 11. 9. 2026: „potřebuju, ať se klient nemusí
   * přihlašovat a jsou ty odkazy otevřené"). Když je vyplněný, přilepí se
   * ke každému dotazu na Disk — server podle něj pozná, do které složky
   * ten odkaz pouští. Bez něj se jede podle přihlášení, jako dosud.
   */
  token?: string;
  /** Klient z odkazu soubory nepřejmenovává. */
  jenCteni?: boolean;
}) {
  // Klic se lepi na KAZDOU adresu k Disku - vypis, stahovani i ZIP.
  const klic = token ? `&k=${encodeURIComponent(token)}` : '';
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
  // Odkaz na celou aktualni slozku (zadani 5. 9. 2026) - vraci ho /api/drive/list.
  const [folderLink, setFolderLink] = useState<string | null>(null);
  const [folderLinkCopied, setFolderLinkCopied] = useState(false);
  // Prejmenovani dvojklikem na nazev.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  // Chovani jako ve Finderu (zadani 5. 9. 2026): jeden klik polozku oznaci,
  // dvojklik otevre slozku / spusti prejmenovani souboru.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);

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
      const res = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}${klic}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Obsah složky se nepodařilo načíst.');
      setItems(body.items ?? []);
      setFolderLink(body.folder?.webViewLink ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Obsah složky se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  }, [klic]);

  useEffect(() => {
    load(currentFolder.id);
    setPlayingId(null);
    setSelectedId(null);
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

  async function copyFolderLink() {
    if (!folderLink) return;
    try {
      await navigator.clipboard.writeText(folderLink);
      setFolderLinkCopied(true);
      setTimeout(() => setFolderLinkCopied(false), 2000);
    } catch {
      // schránka nemusí být dostupná - tiše ignorujeme
    }
  }

  /**
   * "Stáhnout vše" - server slozi ze souboru v aktualni slozce jeden ZIP a
   * rovnou ho streamuje (viz /api/drive/zip). Drive se misto toho spoustelo
   * N samostatnych stazeni, coz prohlizec hlasil jako vyskakovaci okna.
   *
   * Nejdriv se zeptame s probe=1 - kdyz je slozka prazdna nebo moc velka,
   * ukazeme normalni hlasku misto holeho JSONu v novem okne.
   */
  async function downloadAll() {
    const url = `/api/drive/zip?folderId=${encodeURIComponent(currentFolder.id)}${klic}`;
    setZipBusy(true);
    setError(null);
    try {
      const res = await fetch(`${url}&probe=1`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Stažení složky se nezdařilo.');
        return;
      }
      window.location.href = url;
    } catch {
      setError('Stažení složky se nezdařilo.');
    } finally {
      setZipBusy(false);
    }
  }

  /** Jeden klik = označit (Finder). */
  function selectItem(item: DriveItem) {
    setSelectedId(item.id);
  }

  /** Dvojklik = otevřít složku, u souboru přejmenovat. */
  function activateItem(item: DriveItem) {
    if (item.isFolder) {
      openFolder(item);
      return;
    }
    startRename(item);
  }

  function startRename(item: DriveItem) {
    // Klient z odkazu soubory neprejmenovava - /api/drive/rename ho stejne
    // neprusti, tak at se o to ani nepokousi.
    if (jenCteni) return;
    setRenamingId(item.id);
    setRenameValue(item.name);
  }

  async function saveRename(item: DriveItem) {
    const name = renameValue.trim();
    if (!name || name === item.name) {
      setRenamingId(null);
      return;
    }
    setRenameBusy(true);
    try {
      const res = await fetch('/api/drive/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: item.id, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Přejmenování se nezdařilo.');
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, name: data.name ?? name } : i)));
      setRenamingId(null);
    } catch {
      setError('Přejmenování se nezdařilo.');
    } finally {
      setRenameBusy(false);
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
    <div className="rounded-card overflow-hidden border border-line shadow-sm max-w-4xl mx-auto bg-surface">
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
        {/* Nazvy audioknih byvaji dlouhe („... (serie Rychtar Jakub Protiva
            a mnich Blasius 6.)"). Bez tohohle se drobecky zlomi do uzkeho
            sloupce a fialova lista naructe o polovinu vyroste. */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {stack.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-2 min-w-0">
              {index > 0 && <span className="text-white/50 text-sm shrink-0">/</span>}
              <button
                type="button"
                onClick={() => jumpTo(index)}
                disabled={index === stack.length - 1}
                title={crumb.name}
                className={`font-heading text-sm truncate max-w-[22rem] ${
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

        {/* Akce nad celou slozkou (zadani 5. 9. 2026). */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadAll}
            disabled={loading || zipBusy || sorted.every((i) => i.isFolder)}
            title="Stáhnout všechny soubory v této složce jako ZIP"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 text-white text-xs font-heading font-semibold px-3 py-2 hover:bg-white hover:text-brand-purple transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
            </svg>
            {zipBusy ? 'Připravuji ZIP…' : 'Stáhnout vše'}
          </button>
          {/* Odkaz vede na Google Disk, kam klient pristup nema - jemu by to
              bylo jen dalsi zavrene dvere (11. 9. 2026: „sel mail na klienta
              s timto odkazem a on se tam nedostane"). */}
          {!jenCteni && (
          <button
            type="button"
            onClick={copyFolderLink}
            disabled={!folderLink}
            title="Kopírovat odkaz na celou složku"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 text-white text-xs font-heading font-semibold px-3 py-2 hover:bg-white hover:text-brand-purple transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            {folderLinkCopied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M4 12l6 6L20 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9 3h9a1 1 0 0 1 1 1v9m-4-4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
              </svg>
            )}
            {folderLinkCopied ? 'Zkopírováno' : 'Odkaz na složku'}
          </button>
          )}
        </div>
      </div>

      {!loading && !error && sorted.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b border-line bg-field text-[11px] font-heading font-semibold uppercase tracking-wide text-muted">
          <span className="w-5 shrink-0" />
          <button
            type="button"
            onClick={() => toggleSort('name')}
            className="flex-1 min-w-0 flex items-center gap-1 text-left uppercase tracking-wide hover:text-ink transition-colors"
          >
            Název
            {sortBy === 'name' && <SortIcon dir={sortDir} />}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('date')}
            className="w-24 shrink-0 hidden sm:flex items-center justify-end gap-1 uppercase tracking-wide hover:text-ink transition-colors"
          >
            {sortBy === 'date' && <SortIcon dir={sortDir} />}
            Upraveno
          </button>
          <span className="w-20 shrink-0 text-right hidden sm:block">Velikost</span>
          <span className="w-[108px] shrink-0" />
        </div>
      )}

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-muted font-body">Načítám…</div>
      ) : error ? (
        <div className="px-6 py-10 text-center text-sm text-danger font-body">{error}</div>
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
                {/* Radek se chova jako ve Finderu: jeden klik oznaci, dvojklik
                    otevre slozku nebo spusti prejmenovani souboru. */}
                <div
                  role="row"
                  tabIndex={0}
                  onClick={() => selectItem(item)}
                  onDoubleClick={() => activateItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      activateItem(item);
                    }
                    if (e.key === 'Escape') setSelectedId(null);
                  }}
                  className={`flex items-center gap-3 px-6 py-3 transition-colors outline-none cursor-default ${
                    selectedId === item.id ? 'bg-tint' : 'hover:bg-field'
                  }`}
                >
                  <FileIcon mimeType={item.mimeType} isFolder={item.isFolder} />
                  {renamingId === item.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      disabled={renameBusy}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => saveRename(item)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') saveRename(item);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="flex-1 min-w-0 rounded border border-brand-purple bg-surface px-2 py-1 text-sm font-body text-ink outline-none"
                    />
                  ) : (
                    <span
                      title={item.isFolder ? 'Dvojklikem otevřete složku' : 'Dvojklikem přejmenujete'}
                      className={`flex-1 min-w-0 flex items-center gap-2 text-left text-sm font-body text-ink select-none ${
                        item.isFolder ? 'font-semibold' : ''
                      }`}
                    >
                      <span className="truncate">{item.name}</span>
                      {badge && (
                        <span className="shrink-0 text-[10px] font-heading font-bold text-brand-purpleDeep bg-line rounded px-1.5 py-0.5">
                          {badge}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="text-xs text-muted font-body tabular-nums w-24 text-right shrink-0 hidden sm:block">
                    {formatDate(item.modifiedTime)}
                  </span>
                  <span className="text-xs text-muted font-body tabular-nums w-20 text-right shrink-0 hidden sm:block">
                    {item.isFolder ? '—' : formatBytes(item.size)}
                  </span>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-end gap-1.5 shrink-0 w-[108px]"
                  >
                    {audio && (
                      <button
                        type="button"
                        onClick={() => togglePlay(item)}
                        title={isPlaying ? 'Zastavit přehrávání' : 'Přehrát'}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                          isPlaying
                            ? 'bg-brand-green border-brand-green text-onAccent'
                            : 'border-line text-brand-green hover:bg-brand-green hover:text-onAccent'
                        }`}
                      >
                        {isPlaying ? <StopIcon /> : <PlayIcon />}
                      </button>
                    )}
                    {!item.isFolder && (
                      <a
                        href={`/api/drive/download?fileId=${encodeURIComponent(item.id)}${klic}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                        title="Stáhnout"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
                        </svg>
                      </a>
                    )}
                    {item.isFolder && item.webViewLink && (
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Otevřít složku na Google Disku (odtud jde stáhnout celá)"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
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
                    <WaveformPlayer
                      key={item.id}
                      autoPlay
                      src={`/api/drive/download?fileId=${encodeURIComponent(item.id)}&disposition=inline${klic}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <p className="px-6 py-2.5 border-t border-line bg-field text-[11px] font-body text-muted m-0">
          Jeden klik položku označí, dvojklik otevře složku nebo umožní přejmenovat soubor.
        </p>
      )}
    </div>
  );
}
