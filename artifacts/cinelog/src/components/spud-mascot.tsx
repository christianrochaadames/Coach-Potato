import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SpudProps {
  pose?: string; // kept for API compat
  className?: string;
  size?: number;
  round?: boolean;
}

// The JPEG background is rgb(246,241,235) — slightly cooler than the app's
// warm-cream. We use a canvas pass to replace any pixel within `threshold`
// of that colour with full transparency, then display the canvas directly.
const JPEG_BG: [number, number, number] = [246, 241, 235];
const THRESHOLD = 28; // euclidean distance in RGB space

function colourDistance(r: number, g: number, b: number): number {
  return Math.sqrt(
    (r - JPEG_BG[0]) ** 2 + (g - JPEG_BG[1]) ** 2 + (b - JPEG_BG[2]) ** 2,
  );
}

function useTransparentSpud(size: number) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/spud.jpeg';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (colourDistance(data[i], data[i + 1], data[i + 2]) < THRESHOLD) {
          data[i + 3] = 0; // make transparent
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setDataUrl(canvas.toDataURL('image/png'));
    };
  }, [size]);

  return dataUrl;
}

export function SpudMascot({ className, size = 120, round = false }: SpudProps) {
  const dataUrl = useTransparentSpud(size);

  return (
    <div
      className={cn('select-none flex-shrink-0 flex items-center justify-center', className)}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Spud mascot"
          draggable={false}
          style={{
            width: size,
            height: size,
            borderRadius: round ? '50%' : 0,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : null}
    </div>
  );
}
