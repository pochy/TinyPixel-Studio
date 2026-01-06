
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tool, DEFAULT_SIZE, MAX_HISTORY, AnchorType, ResizeMode, PixelateMode, PixelateSettings } from './types';
import { createEmptyGrid, floodFill, generateSVG, gridToCanvas, resizeGridFix, resizeGridRescale, pixelateImage, globalReplaceColor } from './utils/pixelUtils';
import Toolbar from './components/Toolbar';
import PixelCanvas from './components/PixelCanvas';

const STORAGE_KEY = 'tinypixel_save_data';

const PRESET_SIZES = [16, 32, 64, 128, 256, 512];

const evaluateArithmetic = (input: string, fallback: number): number => {
  try {
    const sanitized = input.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized.trim()) return fallback;
    const result = new Function(`return ${sanitized}`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.max(1, Math.min(2048, Math.round(result)));
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
};

const App: React.FC = () => {
  const [grid, setGrid] = useState<string[][]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.grid || createEmptyGrid(DEFAULT_SIZE, DEFAULT_SIZE);
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
    return createEmptyGrid(DEFAULT_SIZE, DEFAULT_SIZE);
  });

  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ffffff');
  const [history, setHistory] = useState<string[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isClearing, setIsClearing] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState(false);
  const [isPixelateModalOpen, setIsPixelateModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [resizeWidthInput, setResizeWidthInput] = useState("");
  const [resizeHeightInput, setResizeHeightInput] = useState("");
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.FIX_TO_PAGE);
  const [anchor, setAnchor] = useState<AnchorType>(AnchorType.CENTER);
  const [maintainRatio, setMaintainRatio] = useState(true);

  const [customWidth, setCustomWidth] = useState(DEFAULT_SIZE);
  const [customHeight, setCustomHeight] = useState(DEFAULT_SIZE);

  // Pixelate state
  const [pixelateSource, setPixelateSource] = useState<HTMLImageElement | null>(null);
  const [pixelateSettings, setPixelateSettings] = useState<PixelateSettings>({
    width: 64,
    height: 64,
    mode: PixelateMode.COVER,
    anchor: AnchorType.CENTER,
    paletteSize: 32,
    dither: true,
    bgColor: 'transparent'
  });
  const [pixelatePreview, setPixelatePreview] = useState<string[][] | null>(null);
  const [isPixelating, setIsPixelating] = useState(false);
  const pixelateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (history.length === 0) {
      setHistory([grid]);
      setHistoryIndex(0);
    }
  }, []);

  useEffect(() => {
    if (grid.length > 0 && isResizeModalOpen) {
      setResizeWidthInput(grid[0].length.toString());
      setResizeHeightInput(grid.length.toString());
    }
  }, [grid, isResizeModalOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grid }));
  }, [grid]);

  // Debounced Pixelate Preview
  useEffect(() => {
    if (!pixelateSource || !isPixelateModalOpen) return;
    
    const handler = setTimeout(async () => {
      setIsPixelating(true);
      try {
        const result = await pixelateImage(pixelateSource, pixelateSettings);
        setPixelatePreview(result);
      } catch (e) {
        console.error("Pixelate error", e);
      } finally {
        setIsPixelating(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [pixelateSource, pixelateSettings, isPixelateModalOpen]);

  const commitToHistory = useCallback((newGrid: string[][]) => {
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(newGrid);
      if (nextHistory.length > MAX_HISTORY) {
        return nextHistory.slice(1);
      }
      return nextHistory;
    });
    setHistoryIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex >= MAX_HISTORY ? MAX_HISTORY - 1 : nextIndex;
    });
  }, [historyIndex]);

  const handlePixelChange = (x: number, y: number) => {
    const targetColor = grid[y]?.[x];
    if (targetColor === undefined) return;
    
    let newGrid = [...grid];

    if (tool === 'pencil') {
      if (grid[y][x] === color) return;
      newGrid[y] = [...grid[y]];
      newGrid[y][x] = color;
      setGrid(newGrid);
    } else if (tool === 'eraser') {
      if (grid[y][x] === 'transparent') return;
      newGrid[y] = [...grid[y]];
      newGrid[y][x] = 'transparent';
      setGrid(newGrid);
    } else if (tool === 'bucket') {
      if (targetColor === color) return;
      const filledGrid = floodFill(grid, x, y, targetColor, color);
      setGrid(filledGrid);
      commitToHistory(filledGrid);
    } else if (tool === 'swap') {
      // Global Replace: Click a color on canvas, replace all with active palette color
      const activeColor = (tool as string) === 'eraser' ? 'transparent' : color;
      if (targetColor === activeColor) return;
      const replacedGrid = globalReplaceColor(grid, targetColor, activeColor);
      setGrid(replacedGrid);
      commitToHistory(replacedGrid);
    } else if (tool === 'picker') {
      if (grid[y][x] !== 'transparent') {
        setColor(grid[y][x]);
        setTool('pencil');
      }
    }
  };

  const handleStrokeEnd = useCallback(() => {
    if (historyIndex >= 0 && JSON.stringify(grid) !== JSON.stringify(history[historyIndex])) {
      commitToHistory(grid);
    }
  }, [grid, history, historyIndex, commitToHistory]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setGrid(history[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setGrid(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  };

  const exportPNG = () => {
    const canvas = gridToCanvas(grid, 20);
    const link = document.createElement('a');
    link.download = `pixelart-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsMobileMenuOpen(false);
  };

  const exportSVG = () => {
    const svgStr = generateSVG(grid, 1);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `pixelart-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setIsMobileMenuOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const MAX_DIM = 1024;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      
      const imgData = ctx.getImageData(0, 0, w, h);
      const newGrid = createEmptyGrid(w, h);
      
      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        const a = imgData.data[i + 3];
        const pxIdx = i / 4;
        const pxY = Math.floor(pxIdx / w);
        const pxX = pxIdx % w;
        if (a > 128) {
          newGrid[pxY][pxX] = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
      }
      setGrid(newGrid);
      setHistory([newGrid]);
      setHistoryIndex(0);
      URL.revokeObjectURL(img.src);
      setIsMobileMenuOpen(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const handlePixelateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setPixelateSource(img);
      setIsPixelateModalOpen(true);
      setIsMobileMenuOpen(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const createNewCanvas = (w: number, h: number) => {
    const newGrid = createEmptyGrid(w, h);
    setGrid(newGrid);
    setHistory([newGrid]);
    setHistoryIndex(0);
    setIsSizeModalOpen(false);
  };

  const handleResizeInputChange = (val: string, type: 'w' | 'h') => {
    if (type === 'w') {
      setResizeWidthInput(val);
      if (maintainRatio && grid.length > 0) {
        const numericW = evaluateArithmetic(val, grid[0].length);
        const ratio = grid.length / grid[0].length;
        setResizeHeightInput(Math.round(numericW * ratio).toString());
      }
    } else {
      setResizeHeightInput(val);
      if (maintainRatio && grid.length > 0) {
        const numericH = evaluateArithmetic(val, grid.length);
        const ratio = grid[0].length / grid.length;
        setResizeWidthInput(Math.round(numericH * ratio).toString());
      }
    }
  };

  const handleResizeBlur = (type: 'w' | 'h') => {
    if (type === 'w') {
      const result = evaluateArithmetic(resizeWidthInput, grid[0].length);
      setResizeWidthInput(result.toString());
    } else {
      const result = evaluateArithmetic(resizeHeightInput, grid.length);
      setResizeHeightInput(result.toString());
    }
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'w' | 'h') => {
    if (e.key === 'Enter') {
      handleResizeBlur(type);
    }
  };

  const handleResizeCanvas = () => {
    const finalWidth = evaluateArithmetic(resizeWidthInput, grid[0].length);
    const finalHeight = evaluateArithmetic(resizeHeightInput, grid.length);
    
    let newGrid: string[][];
    if (resizeMode === ResizeMode.FIX_TO_PAGE) {
      newGrid = resizeGridFix(grid, finalWidth, finalHeight, anchor);
    } else {
      newGrid = resizeGridRescale(grid, finalWidth, finalHeight);
    }
    setGrid(newGrid);
    commitToHistory(newGrid);
    setIsResizeModalOpen(false);
  };

  const handleApplyPixelate = () => {
    if (pixelatePreview) {
      setGrid(pixelatePreview);
      commitToHistory(pixelatePreview);
      setIsPixelateModalOpen(false);
      setPixelateSource(null);
      setPixelatePreview(null);
    }
  };

  const clearCanvas = () => {
    const newGrid = createEmptyGrid(grid[0].length, grid.length);
    setGrid(newGrid);
    commitToHistory(newGrid);
    setIsClearing(false);
    setIsMobileMenuOpen(false);
  };

  // Helper to determine active paint color based on tool
  const paintColor = tool === 'eraser' ? 'transparent' : color;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden select-none bg-slate-900" onMouseUp={handleStrokeEnd} onTouchEnd={handleStrokeEnd}>
      <Toolbar 
        currentTool={tool} 
        setTool={setTool} 
        currentColor={color} 
        setColor={setColor}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden pb-[120px] md:pb-0">
        <header className="h-14 bg-slate-800/80 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-3 md:px-4 z-20 shrink-0">
          <div className="flex items-center gap-1 md:gap-2">
             <h1 className="font-bold text-slate-100 hidden sm:block mr-2">TinyPixel</h1>
             
             {/* Primary Actions - Organized for Mobile */}
             <button 
                onClick={() => setIsSizeModalOpen(true)}
                title="New Canvas"
                className="bg-slate-700 hover:bg-slate-600 active:scale-95 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-100 transition-all flex items-center gap-1"
              >
                <span>＋ New</span>
              </button>
              <button 
                onClick={() => setIsResizeModalOpen(true)}
                title="Resize Canvas"
                className="bg-slate-700 hover:bg-slate-600 active:scale-95 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-100 transition-all flex items-center gap-1"
              >
                <span>📏 Resize</span>
              </button>
              <button 
                onClick={() => pixelateInputRef.current?.click()}
                title="Pixelate Image"
                className="bg-purple-600 hover:bg-purple-500 active:scale-95 px-2 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all flex items-center gap-1"
              >
                <span>✨ Pixelate</span>
              </button>
              <input type="file" ref={pixelateInputRef} onChange={handlePixelateFileChange} className="hidden" accept="image/*" />
          </div>
          
          <div className="flex gap-1 md:gap-2">
            {/* Desktop Full Menu */}
            <div className="hidden lg:flex gap-2">
              <label className="bg-slate-700 hover:bg-slate-600 active:scale-95 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all text-slate-200">
                Import
                <input type="file" className="hidden" accept="image/*" onChange={handleImport} />
              </label>
              
              <div className="relative group">
                <button className="bg-blue-600 hover:bg-blue-500 active:scale-95 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 text-white">
                  Export ▾
                </button>
                <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl hidden group-hover:block z-50 overflow-hidden">
                  <button onClick={exportPNG} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-700 text-slate-200 border-b border-slate-700">PNG</button>
                  <button onClick={exportSVG} className="w-full text-left px-4 py-3 text-xs hover:bg-slate-700 text-slate-200">SVG</button>
                </div>
              </div>

              <button 
                onClick={() => setIsClearing(true)}
                className="bg-red-900/40 hover:bg-red-900/60 active:scale-95 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-200 transition-all"
              >
                Clear
              </button>
            </div>

            {/* Mobile / Tablet Menu Button */}
            <div className="lg:hidden relative">
               <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-1.5 rounded-lg transition-colors ${isMobileMenuOpen ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300'}`}
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
               </button>
               
               {isMobileMenuOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setIsMobileMenuOpen(false)}></div>
                   <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                      <label className="flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer">
                        <span className="text-lg">📥</span> Import
                        <input type="file" className="hidden" accept="image/*" onChange={handleImport} />
                      </label>
                      <button onClick={exportPNG} className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700/50">
                        <span className="text-lg">🖼️</span> Export PNG
                      </button>
                      <button onClick={exportSVG} className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
                        <span className="text-lg">✒️</span> Export SVG
                      </button>
                      <button onClick={() => { setIsClearing(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 transition-colors border-t border-slate-700/50">
                        <span className="text-lg">🗑️</span> Clear
                      </button>
                   </div>
                 </>
               )}
            </div>
          </div>
        </header>

        {/* Clear Modal */}
        {isClearing && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] backdrop-blur-md p-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-bold mb-2 text-slate-100">Clear Canvas?</h2>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">This will erase your current work. You can always use Undo to bring it back.</p>
              <div className="flex gap-4">
                <button onClick={() => setIsClearing(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold transition-colors">Cancel</button>
                <button onClick={clearCanvas} className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-sm text-white font-bold shadow-lg shadow-red-900/20 transition-colors">Clear All</button>
              </div>
            </div>
          </div>
        )}

        {/* New Canvas Modal */}
        {isSizeModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] backdrop-blur-md p-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-bold mb-4 text-slate-100">New Canvas</h2>
              
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Templates</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_SIZES.map(size => (
                    <button 
                      key={size}
                      onClick={() => createNewCanvas(size, size)}
                      className="px-3 py-3 rounded-xl bg-slate-700 hover:bg-blue-600 hover:text-white text-sm font-medium transition-all"
                    >
                      {size}x{size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Custom Size</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Width</label>
                    <input 
                      type="number" 
                      value={customWidth} 
                      onChange={(e) => setCustomWidth(Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
                    />
                  </div>
                  <div className="text-slate-600 mt-4">×</div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Height</label>
                    <input 
                      type="number" 
                      value={customHeight} 
                      onChange={(e) => setCustomHeight(Math.max(1, Math.min(2048, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsSizeModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold transition-colors">Cancel</button>
                <button 
                  onClick={() => createNewCanvas(customWidth, customHeight)} 
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-bold shadow-lg shadow-blue-900/20 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resize Canvas Modal */}
        {isResizeModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-[100] backdrop-blur-md p-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-bold mb-4 text-slate-100 flex items-center gap-2">📏 Resize Canvas</h2>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-widest">Dimensions</label>
                  <button 
                    onClick={() => setMaintainRatio(!maintainRatio)}
                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors ${maintainRatio ? 'text-blue-400' : 'text-slate-600'}`}
                  >
                    {maintainRatio ? '🔒 Locked Aspect' : '🔓 Unlocked'}
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={resizeWidthInput} 
                      onChange={(e) => handleResizeInputChange(e.target.value, 'w')}
                      onBlur={() => handleResizeBlur('w')}
                      onKeyDown={(e) => handleResizeKeyDown(e, 'w')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none text-slate-100 focus:ring-2 focus:ring-blue-500"
                      placeholder="Width"
                    />
                  </div>
                  <div className="text-slate-600">×</div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={resizeHeightInput} 
                      onChange={(e) => handleResizeInputChange(e.target.value, 'h')}
                      onBlur={() => handleResizeBlur('h')}
                      onKeyDown={(e) => handleResizeKeyDown(e, 'h')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none text-slate-100 focus:ring-2 focus:ring-blue-500"
                      placeholder="Height"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 italic">* Supports arithmetic like "32 * 2"</p>
              </div>

              <div className="mb-6">
                <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest">Resize Mode</label>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                  <button 
                    onClick={() => setResizeMode(ResizeMode.FIX_TO_PAGE)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${resizeMode === ResizeMode.FIX_TO_PAGE ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Fix to Page
                  </button>
                  <button 
                    onClick={() => setResizeMode(ResizeMode.RESCALE_OBJECTS)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${resizeMode === ResizeMode.RESCALE_OBJECTS ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Rescale
                  </button>
                </div>
              </div>

              {resizeMode === ResizeMode.FIX_TO_PAGE && (
                <div className="mb-8">
                  <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest text-center">Anchor Point</label>
                  <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto bg-slate-900 p-2 rounded-2xl border border-slate-700">
                    {Object.values(AnchorType).map((a) => (
                      <button 
                        key={a}
                        onClick={() => setAnchor(a)}
                        className={`aspect-square w-full rounded-md transition-all flex items-center justify-center ${anchor === a ? 'bg-blue-600 scale-105 shadow-blue-900/50 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >
                        {anchor === a && <div className="w-2 h-2 bg-white rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setIsResizeModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold transition-colors">Cancel</button>
                <button 
                  onClick={handleResizeCanvas}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-bold shadow-lg shadow-blue-900/20 transition-colors"
                >
                  Apply Resize
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pixelate Modal */}
        {isPixelateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center z-[110] backdrop-blur-lg p-4 overflow-y-auto">
            <div className="bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full animate-in zoom-in-95 duration-200">
              <h2 className="text-2xl font-bold mb-6 text-slate-100 flex items-center gap-2">
                <span className="text-purple-400">✨</span> Pixelate Converter
              </h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-widest">Width</label>
                      <input 
                        type="number" 
                        value={pixelateSettings.width} 
                        onChange={(e) => setPixelateSettings(s => ({...s, width: Math.max(1, Math.min(512, parseInt(e.target.value) || 1))}))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none text-slate-100 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-widest">Height</label>
                      <input 
                        type="number" 
                        value={pixelateSettings.height} 
                        onChange={(e) => setPixelateSettings(s => ({...s, height: Math.max(1, Math.min(512, parseInt(e.target.value) || 1))}))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none text-slate-100 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest">Mode</label>
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                      {Object.values(PixelateMode).map(m => (
                        <button 
                          key={m}
                          onClick={() => setPixelateSettings(s => ({...s, mode: m}))}
                          className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${pixelateSettings.mode === m ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest">Anchor</label>
                    <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto bg-slate-900 p-2 rounded-2xl border border-slate-700">
                      {Object.values(AnchorType).map((a) => (
                        <button 
                          key={a}
                          onClick={() => setPixelateSettings(s => ({...s, anchor: a}))}
                          className={`aspect-square w-full rounded-md transition-all flex items-center justify-center ${pixelateSettings.anchor === a ? 'bg-purple-600 scale-105 shadow-purple-900/50 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}
                        >
                          {pixelateSettings.anchor === a && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest">Palette Colors</label>
                      <select 
                        value={pixelateSettings.paletteSize}
                        onChange={(e) => setPixelateSettings(s => ({...s, paletteSize: parseInt(e.target.value)}))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none text-slate-100"
                      >
                        {[8, 16, 32, 64, 128, 256, 0].map(n => (
                          <option key={n} value={n}>{n === 0 ? 'Full color' : `${n} colors`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-3 cursor-pointer text-sm text-slate-300 font-medium">
                        <input 
                          type="checkbox" 
                          checked={pixelateSettings.dither} 
                          onChange={(e) => setPixelateSettings(s => ({...s, dither: e.target.checked}))}
                          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                        />
                        Floyd-Steinberg Dither
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-2 uppercase font-bold tracking-widest">Background</label>
                    <div className="flex gap-2">
                       {['transparent', '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'].map(c => (
                         <button 
                          key={c}
                          onClick={() => setPixelateSettings(s => ({...s, bgColor: c}))}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${pixelateSettings.bgColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`}
                          style={{ backgroundColor: c === 'transparent' ? 'transparent' : c, border: c === 'transparent' ? '1px dashed #444' : undefined }}
                          title={c}
                         />
                       ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="flex flex-col h-full min-h-[300px] border-2 border-slate-700 rounded-2xl overflow-hidden bg-slate-950 relative">
                   <div className="absolute top-2 left-2 z-10 bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-400 uppercase font-bold">Preview Result</div>
                   <div className="flex-1 flex items-center justify-center p-4 relative">
                     {isPixelating && (
                       <div className="absolute inset-0 z-20 bg-slate-950/40 flex items-center justify-center backdrop-blur-sm">
                         <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                       </div>
                     )}
                     {pixelatePreview ? (
                       <div 
                        className="shadow-2xl"
                        style={{
                          width: `${Math.min(320, pixelateSettings.width * 8)}px`,
                          height: `${Math.min(320, pixelateSettings.height * 8)}px`,
                          backgroundImage: `
                            linear-gradient(45deg, #2a2a2a 25%, transparent 25%), 
                            linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #2a2a2a 75%), 
                            linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
                          `,
                          backgroundSize: `16px 16px`,
                          backgroundColor: '#111',
                          imageRendering: 'pixelated'
                        }}
                       >
                         <img 
                          src={gridToCanvas(pixelatePreview).toDataURL()} 
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                          alt="Pixelate Preview"
                         />
                       </div>
                     ) : (
                       <p className="text-slate-500 text-xs text-center px-8">Processing source image...</p>
                     )}
                   </div>
                   <div className="bg-slate-900/50 p-3 text-[10px] text-slate-500 flex justify-between">
                     <span>{pixelateSettings.width} x {pixelateSettings.height} pixels</span>
                     <span>{pixelateSettings.paletteSize === 0 ? 'Full color' : `${pixelateSettings.paletteSize} colors`}</span>
                   </div>
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button onClick={() => { setIsPixelateModalOpen(false); setPixelateSource(null); }} className="flex-1 px-4 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold transition-all active:scale-95">Cancel</button>
                <button 
                  onClick={handleApplyPixelate}
                  disabled={!pixelatePreview || isPixelating}
                  className="flex-2 flex-[2] px-4 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:opacity-50 text-sm text-white font-bold shadow-lg shadow-purple-900/30 transition-all active:scale-95"
                >
                  Apply to Editor
                </button>
              </div>
            </div>
          </div>
        )}

        <PixelCanvas 
          grid={grid} 
          onPixelChange={handlePixelChange} 
          tool={tool} 
          currentColor={color} 
        />
        
        <footer className="hidden md:flex h-10 bg-slate-900 border-t border-slate-800 px-4 items-center justify-between text-[10px] text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <div>{grid[0]?.length || 0} x {grid.length || 0} px</div>
            <div className="w-px h-3 bg-slate-800" />
            <div className="uppercase">TinyPixel Studio v1.2</div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
