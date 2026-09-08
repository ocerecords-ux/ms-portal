'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Plátno na podpis (zadani 8. 9. 2026: podepisování jako u Signi, bez
 * ověřovacích kódů). Kreslí se myší i prstem — proto pointer events, ne
 * mouse/touch zvlášť.
 *
 * Výstupem je PNG v data URL. Plátno se kreslí ve dvojnásobném rozlišení,
 * aby podpis nebyl na retina displeji rozmazaný.
 */
export function SignaturePad({
  onChange,
  disabled,
  height = 180,
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kresli = useRef(false);
  const prazdne = useRef(true);
  const [maPodpis, setMaPodpis] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const sirka = parent ? parent.clientWidth : 480;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(sirka * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${sirka}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#201A33';
  }, [height]);

  function bod(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: any) {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture?.(e.pointerId);
    kresli.current = true;
    const p = bod(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function tah(e: any) {
    if (!kresli.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = bod(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (prazdne.current) {
      prazdne.current = false;
      setMaPodpis(true);
    }
  }

  function konec() {
    if (!kresli.current) return;
    kresli.current = false;
    const canvas = canvasRef.current;
    if (!canvas || prazdne.current) return;
    onChange(canvas.toDataURL('image/png'));
  }

  function smaz() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prazdne.current = true;
    setMaPodpis(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-card border-2 border-dashed border-line bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={tah}
          onPointerUp={konec}
          onPointerLeave={konec}
          onPointerCancel={konec}
          className={`block touch-none ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
        />
        {!maPodpis && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-body text-muted">
            Podepište se sem myší nebo prstem
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-body text-muted">
          Podpis se uloží k dokumentu spolu s časem, IP adresou a otiskem textu.
        </span>
        <button
          type="button"
          onClick={smaz}
          disabled={disabled || !maPodpis}
          className="text-xs font-heading font-semibold text-muted hover:text-ink disabled:opacity-50"
        >
          Vymazat
        </button>
      </div>
    </div>
  );
}
