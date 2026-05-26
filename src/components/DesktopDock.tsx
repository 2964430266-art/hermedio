import React, { useRef } from "react";
import { 
  Sparkles, 
  Upload, 
  Palette, 
  LayoutDashboard, 
  SlidersHorizontal, 
  Info,
  Disc,
  FolderOpen
} from "lucide-react";

interface DesktopDockProps {
  onWallpaperChange: () => void;
  onResetLayout: () => void;
  onUploadClick: () => void;
  toggleSynth: () => void;
  toggleExpandedCover: () => void;
  isSynthOpen: boolean;
  isExpandedCoverOpen: boolean;
  onShowInfo: () => void;
  songsCount: number;
}

export const DesktopDock: React.FC<DesktopDockProps> = ({
  onWallpaperChange,
  onResetLayout,
  onUploadClick,
  toggleSynth,
  toggleExpandedCover,
  isSynthOpen,
  isExpandedCoverOpen,
  onShowInfo,
  songsCount
}) => {
  return (
    <div 
      id="desktop-dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/20 hover:bg-white/25 border border-white/30 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-5 transition-all z-50 select-none animate-bounce-short"
    >
      {/* Mini App Indicators or Labels */}
      <div className="flex items-center gap-1.5 border-r border-neutral-300/30 pr-4">
        <Disc className="w-5 h-5 text-rose-500 animate-spin-slow" />
        <span className="font-mono text-xs font-semibold text-neutral-800 tracking-wide uppercase">
          hermedio
        </span>
        <span className="bg-rose-500/15 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium shrink-0">
          v1.2
        </span>
      </div>

      {/* Dock Operations */}
      <div className="flex items-center gap-3">
        {/* Open Local folder click */}
        <button
          onClick={onUploadClick}
          id="dock-btn-upload"
          title="Parse Local Audio (MP3/WAV)"
          className="group relative p-2.5 bg-neutral-800/10 hover:bg-rose-500/20 text-neutral-800 hover:text-rose-600 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <FolderOpen className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Import Music
          </span>
          {songsCount > 5 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-mono leading-none w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow">
              {songsCount - 5}
            </span>
          )}
        </button>

        {/* Change Wallpaper */}
        <button
          onClick={onWallpaperChange}
          id="dock-btn-theme"
          title="Change Desktop Gradients"
          className="group relative p-2.5 bg-neutral-800/10 hover:bg-amber-500/20 text-neutral-800 hover:text-amber-600 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <Palette className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Room Theme
          </span>
        </button>

        {/* Ambient Synthesizer widget toggler */}
        <button
          onClick={toggleSynth}
          id="dock-btn-synth"
          title="Toggle Ambient Audio Synth"
          className={`group relative p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            isSynthOpen 
              ? "bg-rose-500/20 text-rose-600 shadow-inner" 
              : "bg-neutral-800/10 text-neutral-800 hover:bg-neutral-800/20"
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Sound Mixer
          </span>
        </button>

        {/* Dynamic Expanded Cover View */}
        <button
          onClick={toggleExpandedCover}
          id="dock-btn-expanded"
          title="Toggle Canvas Cover Spotlight"
          className={`group relative p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${
            isExpandedCoverOpen 
              ? "bg-purple-500/20 text-purple-600 shadow-inner" 
              : "bg-neutral-800/10 text-neutral-800 hover:bg-neutral-800/20"
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Art Spotlight
          </span>
        </button>

        {/* Reset Layout Coordinates */}
        <button
          onClick={onResetLayout}
          id="dock-btn-reset"
          title="Dock Widgets Home position"
          className="group relative p-2.5 bg-neutral-800/10 hover:bg-teal-500/20 text-neutral-800 hover:text-teal-600 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Reset Widgets
          </span>
        </button>

        {/* Info */}
        <button
          onClick={onShowInfo}
          id="dock-btn-info"
          title="Hermedio Story & Credits"
          className="group relative p-2.5 bg-neutral-800/10 hover:bg-blue-500/20 text-neutral-800 hover:text-blue-600 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <Info className="w-5 h-5" />
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700/50 text-white text-[10px] font-medium font-mono px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            About App
          </span>
        </button>
      </div>
    </div>
  );
};
