
import React, { useRef, useEffect, useState } from 'react';
import { Point, Tool } from '../types';

interface PixelCanvasProps {
  grid: string[][];
  onPixelChange: (x: number, y: number) => void;
  tool: Tool;
  currentColor: string;
}

const PixelCanvas: React.FC<PixelCanvasProps> = ({ grid, onPixelChange, tool, currentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(10);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const isDrawing = useRef(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = grid[0].length;
    const height = grid.length;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    
    // Draw background pattern (checkerboard)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = grid[y][x];
        if (color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  };

  useEffect(() => {
    draw();
  }, [grid]);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.floor((clientX - rect.left) / (rect.width / canvas.width));
    const y = Math.floor((clientY - rect.top) / (rect.height / canvas.height));
    
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      return { x, y };
    }
    return null;
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const pos = getEventPos(e);
    if (pos) onPixelChange(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const pos = getEventPos(e);
    if (pos) onPixelChange(pos.x, pos.y);
  };

  const handleEnd = () => {
    isDrawing.current = false;
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden touch-none"
      onWheel={(e) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(prev => Math.min(Math.max(prev * delta, 1), 50));
      }}
    >
      <div 
        className="canvas-container shadow-2xl relative"
        style={{
          width: `${grid[0].length * scale}px`,
          height: `${grid.length * scale}px`,
          backgroundImage: `
            linear-gradient(45deg, #2a2a2a 25%, transparent 25%), 
            linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #2a2a2a 75%), 
            linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
          `,
          backgroundSize: `${scale * 2}px ${scale * 2}px`,
          backgroundPosition: `0 0, 0 ${scale}px, ${scale}px -${scale}px, -${scale}px 0px`,
          backgroundColor: '#1a1a1a'
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
      
      <div className="absolute bottom-4 left-4 bg-slate-800/80 px-2 py-1 rounded text-xs text-slate-400">
        Scale: {Math.round(scale * 10)}% | Scroll to Zoom
      </div>
    </div>
  );
};

export default PixelCanvas;
