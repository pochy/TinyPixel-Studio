
import React from 'react';
import { Tool, COLOR_PALETTE } from '../types';

interface ToolbarProps {
  currentTool: Tool;
  setTool: (tool: Tool) => void;
  currentColor: string;
  setColor: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool, setTool, currentColor, setColor, onUndo, onRedo, canUndo, canRedo
}) => {
  const tools = [
    { id: 'pencil', icon: '✎', label: 'Pencil' },
    { id: 'eraser', icon: '⌫', label: 'Eraser' },
    { id: 'bucket', icon: '🪣', label: 'Fill' },
    { id: 'picker', icon: '⯈', label: 'Picker' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-16 h-full bg-slate-800 border-r border-slate-700 p-2 gap-4">
        <div className="flex flex-col gap-2 justify-center">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id as Tool)}
              title={tool.label}
              className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
                currentTool === tool.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-xl leading-none">{tool.icon}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 justify-center border-t border-slate-700 pt-4">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-slate-700 text-slate-300 disabled:opacity-30 transition-opacity"
          >
            ↶
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-slate-700 text-slate-300 disabled:opacity-30 transition-opacity"
          >
            ↷
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-1 justify-items-center">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setColor(color)}
                className={`w-6 h-6 rounded-sm border-2 ${
                  currentColor === color ? 'border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                } transition-all`}
                style={{ backgroundColor: color }}
              />
            ))}
            <div className="relative w-6 h-6">
              <input
                type="color"
                value={currentColor === 'transparent' ? '#000000' : currentColor}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-6 h-6 rounded-sm border-2 border-slate-600 flex items-center justify-center text-[10px] bg-slate-700">
                🎨
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center border-t border-slate-700 pt-4">
          <div className="w-10 h-10 rounded-lg border-2 border-white shadow-inner mb-2" style={{ backgroundColor: currentColor }} />
        </div>
      </div>

      {/* Modern Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-t border-slate-700 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
        {/* Horizontal Color Palette */}
        <div className="flex overflow-x-auto py-3 px-4 gap-3 no-scrollbar border-b border-slate-800">
          <div className="flex items-center pr-4 border-r border-slate-700">
             <div className="relative w-10 h-10 flex-shrink-0">
                <input
                  type="color"
                  value={currentColor === 'transparent' ? '#000000' : currentColor}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-10 h-10 rounded-full border-2 border-white/50 flex items-center justify-center bg-slate-800 shadow-lg overflow-hidden">
                  <div className="w-full h-full" style={{ backgroundColor: currentColor }} />
                </div>
              </div>
          </div>
          <div className="flex gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setColor(color)}
                className={`w-10 h-10 rounded-full flex-shrink-0 border-2 transition-transform active:scale-90 ${
                  currentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Tools Menu */}
        <div className="flex items-center justify-around h-16 px-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id as Tool)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all active:scale-95 ${
                currentTool === tool.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <span className="text-2xl mb-0.5">{tool.icon}</span>
              <span className="text-[10px] font-medium uppercase tracking-tighter">{tool.label}</span>
            </button>
          ))}
          
          <div className="w-px h-8 bg-slate-700 mx-1" />

          <div className="flex gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 transition-all active:scale-90 ${
                canUndo ? 'text-slate-200' : 'text-slate-600 opacity-50'
              }`}
            >
              <span className="text-xl">↶</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 transition-all active:scale-90 ${
                canRedo ? 'text-slate-200' : 'text-slate-600 opacity-50'
              }`}
            >
              <span className="text-xl">↷</span>
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </>
  );
};

export default Toolbar;
