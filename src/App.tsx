import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  FolderOpen, 
  Music, 
  ChevronRight, 
  RotateCw, 
  Sparkles, 
  Trash2, 
  Clock, 
  HelpCircle,
  X,
  Shuffle,
  ChevronDown,
  FileAudio,
  Disc
} from "lucide-react";
import { PRELOADED_SONGS, DESKTOP_WALLPAPERS } from "./data";
import { Song, PlaybackState } from "./types";
import { parseLocalAudioMetadata } from "./utils/id3Parser";
import { AmbientSynth } from "./components/AmbientSynth";
import { Visualizer } from "./components/Visualizer";
import { DesktopDock } from "./components/DesktopDock";
import { motion, AnimatePresence } from "motion/react";

// Initial focus indices for panel stacking
const INITIAL_Z_INDEX = {
  player: 10,
  synth: 5,
  expanded: 8,
  info: 20
};

export default function App() {
  // 1. Core Music States
  const [songs, setSongs] = useState<Song[]>(PRELOADED_SONGS);
  const [currentSong, setCurrentSong] = useState<Song>(PRELOADED_SONGS[0]);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: currentSong.duration,
    volume: 0.7,
    isMuted: false,
    repeatMode: "all",
    isShuffle: false
  });

// Client Space / Theme UI States
  const [wallpaperIdx, setWallpaperIdx] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem("hermedio-state") || "{}"); return s.wallpaperIdx ?? 0; } catch { return 0; }
  });
  const [isSynthVisible, setIsSynthVisible] = useState<boolean>(true);
  const [isExpandedCoverVisible, setIsExpandedCoverVisible] = useState<boolean>(true);
  const [isInfoVisible, setIsInfoVisible] = useState<boolean>(false);
  const [customAccentColor, setCustomAccentColor] = useState<string>("#cb4b51"); // dynamic shift
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isStoryExpanded, setIsStoryExpanded] = useState<boolean>(false);

  // 3. AI Cognitive Loading States
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>("");

  // 4. Clocks / Calendars
  const [timeString, setTimeString] = useState<string>("12:25");
  const [dateString, setDateString] = useState<string>("05-25 MON");

  // 5. Drag & Drop Floating coordinates
  const loadPositions = () => {
    try {
      const s = JSON.parse(localStorage.getItem("hermedio-state") || "{}");
      if (s.positions) return s.positions;
    } catch {}
    return {
      player: { x: window.innerWidth > 1080 ? 120 : 20, y: 70 },
      synth: { x: window.innerWidth > 1080 ? 940 : 20, y: 390 },
      expanded: { x: window.innerWidth > 1080 ? 640 : 20, y: 90 },
      info: { x: window.innerWidth / 2 - 250, y: 150 }
    };
  };
  const saveState = () => {
    const state = {
      positions,
      wallpaperIdx,
      isDarkMode,
      isSynthVisible,
      isExpandedCoverVisible,
      volume: playback.volume,
    };
    localStorage.setItem("hermedio-state", JSON.stringify(state));
  };
  const [positions, setPositions] = useState(loadPositions);
  const [zIndices, setZIndices] = useState(INITIAL_Z_INDEX);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 6. Archivist Terminal States
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [terminalHistory, setTerminalHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Awaiting database queries under midnight lamp. Ask me about Nujabes, Shing02, Shibuya-kei, Digable Planets, or any music in this player."
    }
  ]);
  const [isTerminalResponding, setIsTerminalResponding] = useState<boolean>(false);

  // 7. Music Search States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [searchSource, setSearchSource] = useState<"itunes" | "youtube">("youtube");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // 8. YouTube IFrame Player
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const ytVideoIdRef = useRef<string | null>(null);
  const ytTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ytContainerId = "hermedio-yt-player";
  const isYoutubeSong = (song: Song) => song.id.startsWith("yt-");

  // 9. Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const terminalLogRef = useRef<HTMLDivElement | null>(null);

  // Sync clock time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      setTimeString(`${h}:${m}`);

      const mon = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      setDateString(`${mon}-${day} ${days[now.getDay()]}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (document.getElementById("yt-iframe-api-script")) return;

    const tag = document.createElement("script");
    tag.id = "yt-iframe-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      ytReadyRef.current = true;
    };

    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  // Create/destroy YT player when song changes
  useEffect(() => {
    if (!isYoutubeSong(currentSong)) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.stopVideo?.();
        ytPlayerRef.current.destroy?.();
        ytPlayerRef.current = null;
        ytVideoIdRef.current = null;
      }
      if (ytTimeIntervalRef.current) {
        clearInterval(ytTimeIntervalRef.current);
        ytTimeIntervalRef.current = null;
      }
      return;
    }

    const videoId = (currentSong as any).youtubeId;
    if (!videoId || videoId === ytVideoIdRef.current) return;
    ytVideoIdRef.current = videoId;

    // Poll until YT API is ready, then create player
    const tryCreate = () => {
      if (!(window as any).YT?.Player) {
        setTimeout(tryCreate, 300);
        return;
      }

      // Destroy old player
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy?.();
        ytPlayerRef.current = null;
      }

      // Clear old time interval
      if (ytTimeIntervalRef.current) {
        clearInterval(ytTimeIntervalRef.current);
        ytTimeIntervalRef.current = null;
      }

      ytPlayerRef.current = new (window as any).YT.Player(ytContainerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(playback.isMuted ? 0 : playback.volume * 100);
            event.target.playVideo();
            const dur = event.target.getDuration();
            if (dur) setPlayback(prev => ({ ...prev, duration: dur }));
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT;
            if (event.data === YT.PlayerState.ENDED) {
              handleSongEnded();
            } else if (event.data === YT.PlayerState.PLAYING) {
              setPlayback(prev => ({ ...prev, isPlaying: true }));
            } else if (event.data === YT.PlayerState.PAUSED) {
              setPlayback(prev => ({ ...prev, isPlaying: false }));
            }
          },
          onError: () => {
            console.error("YT player error, skipping track");
            handleNext();
          },
        },
      });
    };

    tryCreate();

    return () => {
      // Don't clean up player on unmount unless changing away from YT song
    };
  }, [currentSong.id]);

  // Poll YT player time every 500ms
  useEffect(() => {
    if (!isYoutubeSong(currentSong)) return;

    ytTimeIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current?.getCurrentTime) {
        const t = ytPlayerRef.current.getCurrentTime();
        setPlayback(prev => ({ ...prev, currentTime: t }));
      }
    }, 500);

    return () => {
      if (ytTimeIntervalRef.current) {
        clearInterval(ytTimeIntervalRef.current);
        ytTimeIntervalRef.current = null;
      }
    };
  }, [currentSong.id]);

  // Persist preferences to localStorage
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("hermedio-state") || "{}");
      s.wallpaperIdx = wallpaperIdx;
      s.isDarkMode = isDarkMode;
      s.isSynthVisible = isSynthVisible;
      s.isExpandedCoverVisible = isExpandedCoverVisible;
      s.volume = playback.volume;
      localStorage.setItem("hermedio-state", JSON.stringify(s));
    } catch {}
  }, [wallpaperIdx, isDarkMode, isSynthVisible, isExpandedCoverVisible, playback.volume]);

  // Save on page close
  useEffect(() => {
    const save = () => {
      try {
        const s = JSON.parse(localStorage.getItem("hermedio-state") || "{}");
        s.positions = positions;
        localStorage.setItem("hermedio-state", JSON.stringify(s));
      } catch {}
    };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [positions]);
  useEffect(() => {
    if (terminalLogRef.current) {
      terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
    }
  }, [terminalHistory, isTerminalResponding, isTerminalOpen]);

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || isTerminalResponding) return;

    const userPrompt = terminalInput.trim();
    setTerminalHistory(prev => [...prev, { role: "user", text: userPrompt }]);
    setTerminalInput("");
    setIsTerminalResponding(true);

    try {
      const response = await fetch("/api/archivist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userPrompt,
          artist: currentSong.artist,
          currentSong: currentSong.title
        })
      });

      if (!response.ok) {
         throw new Error("Terminal network connection failed");
      }

      const data = await response.json();
      setTerminalHistory(prev => [...prev, { role: "assistant", text: data.text }]);
    } catch (err: any) {
      console.error("Terminal AI error:", err);
      setTerminalHistory(prev => [
        ...prev, 
        { 
          role: "assistant", 
          text: `[Database Node Unresponsive] Falling back to secondary local logs. Jun Seba's catalog traces back to a golden era. Try asking more about Nujabes or Shibuya-kei.` 
        }
      ]);
    } finally {
      setIsTerminalResponding(false);
    }
  };

  // Update dynamic accent color based on highlighted track
  useEffect(() => {
    if (currentSong.aiDetails?.themeColor) {
      setCustomAccentColor(currentSong.aiDetails.themeColor);
    } else {
      setCustomAccentColor("#cb4b51");
    }
  }, [currentSong]);

  // Audio HTML5 setup sync (skip for YouTube songs)
  useEffect(() => {
    if (isYoutubeSong(currentSong)) return;
    if (audioRef.current) {
      audioRef.current.src = currentSong.url;
      audioRef.current.load();
      if (playback.isPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn("Autoplay blocked/throttled. Waiting for explicit clicks.", err);
          setPlayback(prev => ({ ...prev, isPlaying: false }));
        });
      }
    }
  }, [currentSong]);

  // Sync Audio Volumes & Mutes
  useEffect(() => {
    const vol = playback.isMuted ? 0 : playback.volume;
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(vol * 100);
    }
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, [playback.volume, playback.isMuted]);

  // Dragging mechanisms
  const handleMouseDown = (e: React.MouseEvent, widgetId: string) => {
    const targetElement = e.target as HTMLElement;
    // Only permit dragging on elements tagged with is-grabber or drag-handle
    if (targetElement.closest(".is-grabber") || targetElement.closest(".drag-handle")) {
      setDragTarget(widgetId);
      // Elevate target widget zIndex level
      setZIndices(prev => {
        const currentVals = Object.values(prev) as number[];
        const maxVal = Math.max(...currentVals);
        return {
          ...prev,
          [widgetId]: maxVal + 1
        };
      });

      const elementRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragOffset({
        x: e.clientX - elementRect.left,
        y: e.clientY - elementRect.top
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragTarget) return;

    const desktop = document.getElementById("desktop-workspace");
    if (!desktop) return;
    const bounds = desktop.getBoundingClientRect();

    const rawX = e.clientX - bounds.left - dragOffset.x;
    const rawY = e.clientY - bounds.top - dragOffset.y;

    // Boundary constraints to keep widgets safe inside workspace view
    const posX = Math.max(0, Math.min(bounds.width - 150, rawX));
    const posY = Math.max(0, Math.min(bounds.height - 100, rawY));

    setPositions(prev => ({
      ...prev,
      [dragTarget]: { x: posX, y: posY }
    }));
  };

  const handleMouseUp = () => {
    setDragTarget(null);
    // Save positions after drag ends
    try {
      const s = JSON.parse(localStorage.getItem("hermedio-state") || "{}");
      s.positions = positions;
      localStorage.setItem("hermedio-state", JSON.stringify(s));
    } catch {}
  };

  useEffect(() => {
    if (dragTarget) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragTarget, dragOffset]);

  // Audio Playback Handlers
  const handlePlayPause = () => {
    if (isYoutubeSong(currentSong)) {
      if (!ytPlayerRef.current) return;
      if (playback.isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
      return;
    }
    if (!audioRef.current) return;
    if (playback.isPlaying) {
      audioRef.current.pause();
      setPlayback(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play().then(() => {
        setPlayback(prev => ({ ...prev, isPlaying: true }));
      }).catch(err => {
         console.warn("Audio Context resume trigger failed:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlayback(prev => ({
        ...prev,
        currentTime: audioRef.current?.currentTime || 0
      }));
    }
  };

  const handleMetadataLoaded = () => {
    if (audioRef.current) {
      setPlayback(prev => ({
        ...prev,
        duration: audioRef.current?.duration || currentSong.duration
      }));
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isYoutubeSong(currentSong) && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(val, true);
      setPlayback(prev => ({ ...prev, currentTime: val }));
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setPlayback(prev => ({ ...prev, currentTime: val }));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayback(prev => ({
      ...prev,
      volume: val,
      isMuted: val === 0 ? true : false
    }));
  };

  const toggleMute = () => {
    setPlayback(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  // Next and Previous tracks steps
  const handleNext = () => {
    let nextIdx = 0;
    if (playback.isShuffle) {
      nextIdx = Math.floor(Math.random() * songs.length);
    } else {
      const curIdx = songs.findIndex(s => s.id === currentSong.id);
      nextIdx = (curIdx + 1) % songs.length;
    }
    setCurrentSong(songs[nextIdx]);
    setPlayback(prev => ({ ...prev, isPlaying: true }));
  };

  const handlePrev = () => {
    const curIdx = songs.findIndex(s => s.id === currentSong.id);
    let prevIdx = curIdx - 1;
    if (prevIdx < 0) {
      prevIdx = songs.length - 1;
    }
    setCurrentSong(songs[prevIdx]);
    setPlayback(prev => ({ ...prev, isPlaying: true }));
  };

  const handleSongEnded = () => {
    if (playback.repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      handleNext();
    }
  };

  // Local File uploads and metadata ID3 tags parser
  const processLocalFiles = async (files: FileList) => {
    const freshSongs: Song[] = [];

    // Prompt user visually
    setIsAnalyzing(true);
    setAiStatusMessage("Analyzing local file header binary...");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("audio/")) {
         continue;
      }

      try {
        const meta = await parseLocalAudioMetadata(file);
        const objUrl = URL.createObjectURL(file);

        // Compute local audio duration by temporarily mounting audio checks
        let fileDuration = 240; // baseline fallback
        const dummyAudio = new Audio(objUrl);
        await new Promise<void>((resolve) => {
          dummyAudio.onloadedmetadata = () => {
            fileDuration = dummyAudio.duration;
            resolve();
          };
          // timeout to prevent hanging on corrupt headers
          setTimeout(resolve, 800);
        });

        const newLofiTrack: Song = {
          id: `local-${Date.now()}-${i}`,
          title: meta.title,
          artist: meta.artist || "Cozy Visitor",
          album: meta.album || "Local Desktop Tape",
          duration: fileDuration,
          url: objUrl,
          coverUrl: meta.coverUrl || "https://picsum.photos/seed/vintage/300/300?blur=1",
          isLocal: true,
          fileName: file.name
        };

        freshSongs.push(newLofiTrack);
      } catch (err) {
        console.error("Local file loader error:", err);
      }
    }

    if (freshSongs.length > 0) {
      setSongs(prev => [...prev, ...freshSongs]);
      // Instantly start playing the first loaded song
      setCurrentSong(freshSongs[0]);
      setPlayback(prev => ({ ...prev, isPlaying: true }));
      
      setAiStatusMessage(`Successfully parsed ${freshSongs.length} track(s)!`);
      setTimeout(() => {
        setIsAnalyzing(false);
        setAiStatusMessage("");
      }, 2000);
    } else {
      setIsAnalyzing(false);
      setAiStatusMessage("");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processLocalFiles(e.target.files);
    }
  };

  // Drag over work areas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processLocalFiles(e.dataTransfer.files);
    }
  };

  // Trigger file selection triggers
  const triggerFileSelection = () => {
    fileInputRef.current?.click();
  };

  // AI-powered Gemini 3.5 analyzer connection
  const handleAISongAnalysis = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setAiStatusMessage("Syncing with Gemini late-night lofi insights...");

    try {
      const response = await fetch("/api/analyze-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentSong.title,
          artist: currentSong.artist,
          duration: currentSong.duration,
          filename: currentSong.fileName
        })
      });

      if (!response.ok) {
        throw new Error("Local hermedio Express backend analytical service did not respond validly.");
      }

      const aiData = await response.json();
      
      // Update our song state array with new AI annotations to prevent losing them on track shifts
      setSongs(prevSongs => {
        return prevSongs.map(s => {
          if (s.id === currentSong.id) {
            return {
              ...s,
              aiDetails: aiData
            };
          }
          return s;
        });
      });

      // Update current playing song info
      setCurrentSong(prev => ({
        ...prev,
        aiDetails: aiData
      }));

    } catch (err: any) {
      console.error("Gemini AI analytical flow failed:", err);
    } finally {
      setIsAnalyzing(false);
      setAiStatusMessage("");
    }
  };

  // Music search handler with debounce
  const handleSearchMusic = (term: string) => {
    setSearchTerm(term);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!term.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchResults(true);
      try {
        const endpoint =
          searchSource === "itunes"
            ? `/api/search-music?term=${encodeURIComponent(term.trim())}&limit=15`
            : `/api/youtube/search?q=${encodeURIComponent(term.trim())}&limit=15`;

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSearchResults(data.songs || []);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleAddSearchSong = (song: any) => {
    if (!song.url && !song.youtubeId) return;
    if (searchSource === "itunes" && !song.url) return;

    const finalSong: Song = { ...song, isLocal: false };
    setIsSearching(false);
    setSearchTerm("");

    setSongs(prev => {
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, finalSong];
    });
    setCurrentSong(finalSong);
    setPlayback(prev => ({ ...prev, isPlaying: true }));
    setShowSearchResults(false);
    setSearchResults([]);
  };

  // Click outside search to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Workspace controls
  const handleWallpaperCycle = () => {
    setWallpaperIdx(prev => (prev + 1) % DESKTOP_WALLPAPERS.length);
  };

  const handleResetWidgetsPosition = () => {
    setPositions({
      player: { x: window.innerWidth > 1080 ? 120 : 20, y: 70 },
      synth: { x: window.innerWidth > 1080 ? 940 : 20, y: 390 },
      expanded: { x: window.innerWidth > 1080 ? 640 : 20, y: 90 },
      info: { x: window.innerWidth / 2 - 250, y: 150 }
    });
    setZIndices(INITIAL_Z_INDEX);
  };

  const removeLocalSong = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // If we delete the song currently playing, switch to first preloaded
    if (currentSong.id === id) {
      setCurrentSong(PRELOADED_SONGS[0]);
    }
    setSongs(prev => prev.filter(s => s.id !== id));
  };

  // Time Formatter helper (e.g. 195 seconds to 3:15)
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      id="desktop-workspace"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-screen h-screen overflow-hidden select-none transition-all duration-[1000ms] ${
        isDarkMode ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-800"
      }`}
      style={{ 
        background: isDarkMode 
          ? "linear-gradient(to bottom, #080607, #130a0c, #050404)" 
          : DESKTOP_WALLPAPERS[wallpaperIdx] 
      }}
    >
      {/* Hidden file input for file uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFileInputChange}
        className="hidden"
        id="hidden-audio-input"
      />

      {/* Hidden YouTube IFrame Player (for YouTube songs) */}
      <div
        id={ytContainerId}
        className="absolute pointer-events-none opacity-0"
        style={{ width: "1px", height: "1px", left: "-9999px", top: "-9999px" }}
      />

      {/* Primary Native Embedded Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleMetadataLoaded}
        onEnded={handleSongEnded}
        id="native-lofi-media"
      />

      {/* Decorative desktop grid lines or status */}
      <div className="absolute top-4 left-6 pointer-events-none">
        <h1 className={`text-xl font-display font-bold tracking-tight transition-colors duration-300 ${isDarkMode ? "text-neutral-100" : "text-neutral-800"}`} id="desktop-app-title">
          hermedio lofi room
        </h1>
        <p className={`text-xs font-mono mt-0.5 transition-colors duration-300 ${isDarkMode ? "text-neutral-400" : "text-neutral-500/80"}`}>
          an elegant desktop music hub • drag audio files anywhere to import
        </p>
      </div>

      <div className="absolute top-4 right-6 text-right pointer-events-none">
        <div className={`text-sm font-mono font-medium transition-colors duration-300 ${isDarkMode ? "text-neutral-100" : "text-neutral-800"}`}>
          {dateString}
        </div>
        <div className={`text-xs font-mono transition-colors duration-300 ${isDarkMode ? "text-neutral-400" : "text-neutral-400"}`}>
          UTC {timeString}
        </div>
      </div>

      {/* AI processing toast / overlay */}
      {isAnalyzing && (
        <div 
          id="ai-processing-hud"
          className="fixed top-6 left-1/2 -translate-x-1/2 glass-panel-dark text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[9999] text-xs font-mono animate-pulse"
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{aiStatusMessage}</span>
        </div>
      )}

      {/* ==================== PANEL A: hermedio MAIN CONTROLLER WIDGET ==================== */}
      <div
        id="hermedio-main-card"
        onMouseDown={(e) => handleMouseDown(e, "player")}
        className={`absolute rounded-3xl shadow-2xl w-[440px] overflow-hidden flex flex-col select-none transition-all duration-300 border hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)] ${
          isDarkMode 
            ? "bg-[#161213]/95 border-[#cb4b51]/25 text-neutral-100" 
            : "glass-panel text-neutral-800"
        }`}
        style={{
          left: `${positions.player.x}px`,
          top: `${positions.player.y}px`,
          zIndex: zIndices.player
        }}
      >
        {/* Top Header Drag bar */}
        <div className={`is-grabber drag-handle h-8 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing border-b ${
          isDarkMode ? "bg-neutral-900/40 border-neutral-800/40" : "bg-neutral-900/[0.04] border-neutral-200/20"
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
            hermedio core player
          </span>
          <HelpCircle 
            className={`w-3.5 h-3.5 cursor-pointer transition ${isDarkMode ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400/70 hover:text-neutral-600"}`}
            onClick={() => {
              setIsInfoVisible(true);
              setZIndices(prev => ({ ...prev, info: Math.max(...(Object.values(prev) as number[])) + 1 }));
            }} 
          />
        </div>

        {/* Top Clock and DK/LT layout row */}
        <div className={`flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b ${
          isDarkMode ? "border-neutral-800/60 bg-black/10" : "border-neutral-200/20 bg-white/20"
        }`}>
          <button 
            onClick={() => setIsDarkMode(true)} 
            className={`text-[10px] font-mono font-bold transition-all px-2.5 py-0.5 rounded cursor-pointer ${
              isDarkMode 
                ? "text-[#cb4b51] bg-[#cb4b51]/10 border border-[#cb4b51]/25 font-black scale-105" 
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            DK
          </button>
          
          <div className="text-center">
            <div className={`text-4.5xl font-mono font-bold tracking-widest leading-none ${isDarkMode ? "text-white drop-shadow-[0_0_8px_rgba(203,75,81,0.25)]" : "text-neutral-800"}`}>
              {timeString}
            </div>
            <div className={`text-[9px] font-mono font-bold tracking-wider uppercase mt-1 ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
              {dateString}
            </div>
          </div>

          <button 
            onClick={() => setIsDarkMode(false)} 
            className={`text-[10px] font-mono font-bold transition-all px-2.5 py-0.5 rounded cursor-pointer ${
              !isDarkMode 
                ? "text-rose-600 bg-rose-500/10 border border-rose-300 font-black scale-105" 
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            LT
          </button>
        </div>

        {/* Cover block & Track details area */}
        <div className={`p-5 flex gap-4 ${isDarkMode ? "bg-black/10" : "bg-white/10"}`} id="player-header-split">
          {/* Cover Art Container */}
          <div className={`relative w-36 h-36 rounded-2xl overflow-hidden shadow-md border group shrink-0 ${
            isDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-neutral-100 border-neutral-300/30"
          }`}>
            <img 
              src={currentSong.coverUrl} 
              alt={currentSong.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-700 ${playback.isPlaying ? "scale-105" : ""}`}
              id="player-album-cover"
            />
            {/* Visualizer overlay */}
            <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-black/50 to-transparent p-1">
              <Visualizer isPlaying={playback.isPlaying} audioRef={audioRef} color={customAccentColor} />
            </div>
            {/* Embedded Badge */}
            <span className="absolute top-2 left-2 bg-neutral-900/60 backdrop-blur-md text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-medium">
              {currentSong.isLocal ? "LOCAL" : currentSong.id.startsWith("yt-") ? "YOUTUBE" : currentSong.id.startsWith("itunes-") ? "PREVIEW" : "PRESET"}
            </span>
          </div>

          {/* Album stats, genre and quick volume controls */}
          <div className="flex-1 flex flex-col justify-between pt-1 min-w-0">
            <div>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                isDarkMode ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-500"
              }`}>
                {currentSong.aiDetails?.subgenre || "lofi lounge"}
              </span>
              <h2 className={`text-base font-bold truncate mt-2 ${isDarkMode ? "text-neutral-100" : "text-neutral-800"}`}>
                {currentSong.title}
              </h2>
              <p className={`text-xs font-mono truncate mt-0.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                {currentSong.artist}
              </p>
            </div>

            {/* Quick Volume & Sound labels */}
            <div className="mt-2.5 pb-1">
              <div className="flex items-center gap-2 mb-1 justify-between">
                <span className={`text-[10px] font-mono font-medium ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>VOLUME CONTROLS</span>
                <span className="text-[10px] font-mono font-bold animate-pulse" style={{ color: customAccentColor }}>
                  {playback.isMuted ? "MUTED" : `${Math.round(playback.volume * 100)}%`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  id="btn-volume-toggle"
                  className={`p-1 rounded transition cursor-pointer ${
                    isDarkMode ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50"
                  }`}
                >
                  {playback.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  id="slider-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={playback.isMuted ? 0 : playback.volume}
                  onChange={handleVolumeChange}
                  className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${
                    isDarkMode ? "bg-neutral-800 accent-neutral-200" : "bg-neutral-200 accent-neutral-800"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Music Search Bar */}
        <div className="px-5 pt-3" ref={searchContainerRef}>
          {/* Search source toggle */}
          <div className="flex items-center gap-1.5 mb-2">
            <button
              onClick={() => { setSearchSource("youtube"); setSearchTerm(""); setSearchResults([]); }}
              className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                searchSource === "youtube"
                  ? isDarkMode
                    ? "bg-red-500/15 text-red-400 border border-red-500/30"
                    : "bg-red-50 text-red-600 border border-red-300"
                  : isDarkMode
                    ? "text-neutral-500 hover:text-neutral-300 border border-transparent"
                    : "text-neutral-400 hover:text-neutral-600 border border-transparent"
              }`}
            >
              <span className="flex items-center gap-1">▶ YouTube</span>
            </button>
            <button
              onClick={() => { setSearchSource("itunes"); setSearchTerm(""); setSearchResults([]); }}
              className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                searchSource === "itunes"
                  ? isDarkMode
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    : "bg-rose-50 text-rose-600 border border-rose-300"
                  : isDarkMode
                    ? "text-neutral-500 hover:text-neutral-300 border border-transparent"
                    : "text-neutral-400 hover:text-neutral-600 border border-transparent"
              }`}
            >
              <span className="flex items-center gap-1">♪ Apple</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchMusic(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
              placeholder={
                searchSource === "youtube"
                  ? "Search YouTube for full songs..."
                  : "Search Apple Music for previews..."
              }
              className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border outline-none transition ${
                isDarkMode
                  ? "bg-neutral-900/60 border-neutral-700/60 text-neutral-200 placeholder-neutral-500 focus:border-[#cb4b51]/40"
                  : "bg-white/60 border-neutral-300 text-neutral-700 placeholder-neutral-400 focus:border-rose-400"
              }`}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-transparent border-t-rose-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className={`absolute left-0 right-0 top-full mt-1.5 max-h-[260px] overflow-y-auto no-scrollbar rounded-xl border shadow-xl z-[200] ${
                isDarkMode
                  ? "bg-neutral-900/95 border-neutral-700/60"
                  : "bg-white/95 border-neutral-200"
              }`}>
                {searchResults.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleAddSearchSong(song)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition border-b last:border-b-0 cursor-pointer ${
                      isDarkMode
                        ? "hover:bg-[#cb4b51]/10 border-neutral-800/40"
                        : "hover:bg-rose-50 border-neutral-200/40"
                    }`}
                  >
                    <img
                      src={song.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-700/20"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://picsum.photos/seed/vintage/100/100?blur=1"; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${isDarkMode ? "text-neutral-200" : "text-neutral-700"}`}>
                        {song.title}
                      </p>
                      <p className={`text-[10px] truncate mt-0.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                        {song.artist}{song.album ? `  ·  ${song.album}` : ""}
                      </p>
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      searchSource === "youtube"
                        ? isDarkMode ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"
                        : isDarkMode ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {searchSource === "youtube" ? "FULL" : "PREVIEW"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showSearchResults && searchTerm && !isSearching && searchResults.length === 0 && (
              <div className={`absolute left-0 right-0 top-full mt-1.5 rounded-xl border shadow-xl z-[200] p-6 text-center ${
                isDarkMode ? "bg-neutral-900/95 border-neutral-700/60" : "bg-white/95 border-neutral-200"
              }`}>
                <Music className={`w-5 h-5 mx-auto mb-1.5 ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`} />
                <p className={`text-[11px] font-mono ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                  No results for "{searchTerm}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Drag/Drop and Native Selector Area */}
        <div className="px-5 pb-3 pt-3">
          <button
            onClick={triggerFileSelection}
            id="btn-open-file"
            className={`w-full py-2 cursor-pointer border border-dashed text-xs font-mono flex items-center justify-center gap-2 rounded-xl transition ${
              isDarkMode
                ? "bg-neutral-800/20 border-neutral-700/80 hover:bg-[#cb4b51]/10 hover:border-[#cb4b51]/40 text-neutral-300 hover:text-[#cb4b51]"
                : "bg-neutral-900/5 border-neutral-300 hover:border-rose-300 hover:bg-rose-500/10 text-neutral-600 hover:text-rose-700"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open Audio Folder / Select LP files</span>
          </button>
        </div>

        {/* Seek Bar progress section */}
        <div className={`px-5 py-2.5 border-t border-b ${
          isDarkMode ? "bg-black/10 border-neutral-800" : "bg-white/5 border-neutral-100"
        }`} id="playback-seek-strip">
          <div className={`flex items-center justify-between text-[11px] font-mono mb-1 ${
            isDarkMode ? "text-neutral-400" : "text-neutral-500"
          }`}>
            <span>{formatTime(playback.currentTime)}</span>
            <span className={`font-semibold ${isDarkMode ? "text-neutral-300" : "text-neutral-600"}`}>{formatTime(playback.duration || currentSong.duration)}</span>
          </div>
          <input
            id="slider-seek"
            type="range"
            min="0"
            max={playback.duration || 100}
            step="0.1"
            value={playback.currentTime}
            onChange={handleSeekChange}
            className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
              isDarkMode ? "bg-neutral-800 accent-neutral-200" : "bg-neutral-200 accent-neutral-100"
            }`}
          />
        </div>

        {/* Controls Panel (Pre, Play, Next, Shuffle, Repeat) */}
        <div className={`px-5 py-3 flex items-center justify-between ${
          isDarkMode ? "bg-black/20" : "bg-white/20"
        }`} id="core-playback-controls">
          <button
            onClick={() => setPlayback(prev => ({ ...prev, isShuffle: !prev.isShuffle }))}
            id="control-shuffle"
            title="Shuffle play mode"
            className={`p-2 rounded-xl transition cursor-pointer ${
              playback.isShuffle ? "text-rose-600 bg-rose-500/15" : isDarkMode ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/50"
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              id="control-prev"
              title="Previous Track"
              className={`p-2.5 rounded-xl transition active:scale-95 cursor-pointer ${
                isDarkMode ? "text-neutral-300 hover:text-white hover:bg-neutral-800" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50"
              }`}
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={handlePlayPause}
              id="control-play-pause"
              title={playback.isPlaying ? "Pause" : "Play"}
              className="p-3.5 text-white shadow-md active:scale-95 hover:scale-105 transition rounded-2xl flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: customAccentColor }}
            >
              {playback.isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              )}
            </button>

            <button
              onClick={handleNext}
              id="control-next"
              title="Next Track"
              className={`p-2.5 rounded-xl transition active:scale-95 cursor-pointer ${
                isDarkMode ? "text-neutral-300 hover:text-white hover:bg-neutral-800" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50"
              }`}
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          <button
            onClick={() => {
              setPlayback(prev => {
                const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
                const nextIdx = (modes.indexOf(prev.repeatMode) + 1) % modes.length;
                return { ...prev, repeatMode: modes[nextIdx] };
              });
            }}
            id="control-repeat"
            title="Cycles looping methods"
            className={`p-2 rounded-xl transition flex items-center gap-0.5 text-xs font-mono cursor-pointer ${
              playback.repeatMode !== "off" ? "text-rose-600 bg-rose-500/15 font-bold" : isDarkMode ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/50"
            }`}
          >
            <RotateCw className="w-4 h-4" />
            {playback.repeatMode === "one" && "1"}
          </button>
        </div>

        {/* Song List view block */}
        <div className={`border-t flex-1 flex flex-col max-h-[190px] overflow-hidden ${
          isDarkMode ? "bg-neutral-900/10 border-neutral-850/55" : "bg-neutral-50/50 border-neutral-200/50"
        }`}>
          <div className={`px-5 py-2 flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider border-b ${
            isDarkMode ? "bg-black/30 text-neutral-500 border-neutral-800/30" : "bg-neutral-150/40 text-neutral-400 border-neutral-200/30"
          }`}>
            <span>TRACK SELECTION LIST</span>
            <span>{songs.length} ITEMS</span>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-1" id="tracklist-scroll-view">
            {songs.map((song, index) => {
              const isSelected = song.id === currentSong.id;
              
              return (
                <div
                  key={song.id}
                  onClick={() => {
                    setCurrentSong(song);
                    setPlayback(prev => ({ ...prev, isPlaying: true }));
                  }}
                  id={`track-item-${song.id}`}
                  className={`px-5 py-2.5 flex items-center justify-between cursor-pointer transition border-b ${
                    isSelected 
                      ? isDarkMode 
                        ? "bg-[#cb4b51]/10 border-l-4 shadow-sm" 
                        : "bg-white/95 shadow-sm border-l-4" 
                      : isDarkMode 
                        ? "hover:bg-neutral-800/20 border-neutral-800/10" 
                        : "hover:bg-neutral-100/40 border-neutral-200/10"
                  }`}
                  style={{ borderLeftColor: isSelected ? customAccentColor : "transparent" }}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      referrerPolicy="no-referrer"
                      className={`w-8 h-8 rounded-lg object-cover shrink-0 border ${isDarkMode ? "border-neutral-800" : "border-neutral-300/20"}`}
                    />
                    <div className="min-w-0">
                      <p className={`text-xs truncate font-medium ${
                        isSelected 
                          ? isDarkMode ? "text-white animate-pulse" : "text-neutral-800" 
                          : isDarkMode ? "text-neutral-300" : "text-neutral-700"
                      }`}>
                        {index + 1}. {song.title}
                      </p>
                      <p className={`text-[10px] truncate mt-0.5 flex items-center gap-1 ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
                        <span>{song.artist}</span>
                        {song.album && <span className="opacity-60">• {song.album}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-right shrink-0">
                    {/* Active highlight status pill */}
                    {isSelected ? (
                      <span 
                        className="text-[9px] font-mono text-white px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: customAccentColor }}
                      >
                        PLAYING
                      </span>
                    ) : (
                      <span className={`text-[10px] font-mono ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
                        {formatTime(song.duration)}
                      </span>
                    )}

                    {/* Trash can for local/uploaded files only */}
                    {song.isLocal && (
                      <button
                        onClick={(e) => removeLocalSong(e, song.id)}
                        id={`btn-delete-${song.id}`}
                        title="Delete track"
                        className={`p-1 rounded transition ${
                          isDarkMode 
                            ? "text-neutral-500 hover:text-red-400 hover:bg-neutral-800" 
                            : "text-neutral-400 hover:text-red-500 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Musician Story Accordion Section */}
        <div className={`px-5 py-3 border-t border-b transition-colors ${
          isDarkMode ? "border-neutral-800 bg-black/15 text-neutral-300" : "border-neutral-200/50 bg-neutral-50/20 text-neutral-600"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono tracking-wider font-bold ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
              📝 MUSICIAN STORY
            </span>
            <button
              onClick={() => setIsStoryExpanded(!isStoryExpanded)}
              className="text-[10px] font-mono font-bold hover:underline py-0.5 px-2 rounded hover:bg-neutral-500/10 flex items-center gap-1 transition cursor-pointer"
              style={{ color: customAccentColor }}
            >
              {isStoryExpanded ? "SHOW LESS" : "READ MORE"}
            </button>
          </div>
          
          <div className="mt-1.5 transition-all duration-300 overflow-hidden">
            <p className={`text-[11px] leading-relaxed italic ${isDarkMode ? "text-neutral-300" : "text-neutral-600"}`}>
              {currentSong.musicianStorySummary || "No story loaded."}
            </p>
            {isStoryExpanded && currentSong.musicianBio && (
              <p className={`text-[11.5px] leading-relaxed mt-2 pt-2 border-t border-dashed ${
                isDarkMode ? "border-neutral-800 text-neutral-400" : "border-neutral-300 text-neutral-500"
              } select-text`}>
                {currentSong.musicianBio}
              </p>
            )}
          </div>
        </div>

        {/* Player Bottom Footer Utility Row - Clickable to talk to AI DJ */}
        <div 
          onClick={() => {
            setIsTerminalOpen(true);
            // Elevate overlay zIndex
            setZIndices(prev => ({ ...prev, player: Math.max(...(Object.values(prev) as number[])) + 1 }));
          }}
          title="Click to talk with your AI DJ / Archivist"
          className={`px-5 py-3.5 flex items-center justify-between text-[11px] font-mono border-t cursor-pointer transition duration-300 hover:bg-rose-500/10 ${
            isDarkMode 
              ? "bg-black/40 border-neutral-800/60 text-neutral-400 hover:text-[#cb4b51]" 
              : "bg-neutral-100/70 border-neutral-200 text-neutral-500 hover:text-rose-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold tracking-wider text-rose-500 animate-pulse bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping" />
              # TALK TO AI DJ
            </span>
            <span className="opacity-40">|</span>
            <span className="hover:underline transition">CHILL FM</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline opacity-75">AI RECORDER KEY</span>
            <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-rose-500/10 text-rose-600 animate-bounce transition-transform">
              OPEN TERMINAL
            </span>
          </div>
        </div>

        {/* Archivist Terminal Overlay Drawer */}
        {isTerminalOpen && (
          <div 
            id="archivist-terminal-overlay"
            className="absolute inset-x-0 bottom-0 top-[60px] bg-[#09090b] text-emerald-400 font-mono text-xs flex flex-col z-[150] p-4 select-text animate-in slide-in-from-bottom duration-350 border-t border-emerald-500/25"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold tracking-widest text-[11px] text-emerald-300">ARCHIVIST ASSISTANT AI</span>
              </div>
              <button 
                onClick={() => setIsTerminalOpen(false)}
                className="text-neutral-500 hover:text-emerald-400 transition cursor-pointer p-0.5 text-[11px]"
              >
                [ESC] CLOSE
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 leading-relaxed mb-2.5 border-b border-solid border-emerald-500/10 pb-2.5">
              SYSTEM REVISION: LVR-999 • AI DIRECTIVE CONNECTED.<br />
              ASK PREPARED RECORDS OR INQUIRE REGARDING MUSIC HISTORY.
            </p>

            {/* Message log wrapper */}
            <div 
              ref={terminalLogRef}
              className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-3 pr-1 text-[11px] leading-relaxed"
            >
              {terminalHistory.map((msg, idx) => (
                <div key={idx} className={msg.role === "user" ? "text-right" : "text-left"}>
                  <p className="text-[9px] text-neutral-500 font-semibold mb-0.5">
                    {msg.role === "user" ? "visitor@hermedio" : "archivist@ai-core"}
                  </p>
                  <p 
                    className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-left ${
                      msg.role === "user" 
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15" 
                        : "bg-neutral-900/90 text-neutral-200 border border-neutral-800"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
              
              {isTerminalResponding && (
                <div className="text-left animate-pulse">
                  <span className="text-[9px] text-neutral-500 mb-0.5 block">archivist@fetching</span>
                  <span className="text-emerald-500 inline-block">▒ RETRIEVING ARCHIVAL FREQUENCIES...</span>
                </div>
              )}
            </div>

            {/* Input form */}
            <form onSubmit={handleTerminalSubmit} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                disabled={isTerminalResponding}
                placeholder={`Ask about ${currentSong.artist}...`}
                className="flex-1 bg-neutral-900 text-emerald-300 text-xs px-3 py-2.5 rounded-xl border border-emerald-500/20 focus:border-emerald-400 focus:outline-none transition placeholder-emerald-800"
              />
              <button
                type="submit"
                disabled={isTerminalResponding || !terminalInput.trim()}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl border border-emerald-500/30 transition shadow-inner font-bold cursor-pointer"
              >
                SEND
              </button>
            </form>
          </div>
        )}

        {/* AI Action trigger footer */}
        <button
          onClick={handleAISongAnalysis}
          id="btn-ai-vibe-shift"
          className="w-full py-3 hover:opacity-90 active:scale-[0.99] select-none text-white text-xs font-mono font-bold tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
          style={{ backgroundColor: customAccentColor }}
        >
          <Sparkles className="w-4 h-4 animate-bounce" />
          <span>Sync Gemini AI Lyrics & Vibe commentary</span>
        </button>
      </div>

      {/* ==================== PANEL B: VISUAL COZY SPOTLIGHT WINDOW (Expanded Cover View) ==================== */}
      {isExpandedCoverVisible && (
        <div
          id="hermedio-expanded-card"
          onMouseDown={(e) => handleMouseDown(e, "expanded")}
          className="absolute glass-panel rounded-3xl shadow-2xl w-[280px] p-4 flex flex-col select-none transition-all"
          style={{
            left: `${positions.expanded.x}px`,
            top: `${positions.expanded.y}px`,
            zIndex: zIndices.expanded
          }}
        >
          <div className="is-grabber drag-handle flex items-center justify-between pb-2.5 border-b border-neutral-300/20 cursor-grab active:cursor-grabbing">
            <span className="font-mono text-[9px] text-neutral-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500 animate-spin-slow" />
              Art Spotlight
            </span>
            <button 
              onClick={() => setIsExpandedCoverVisible(false)}
              className="p-0.5 text-neutral-400 hover:text-neutral-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Three-album-cover Stack: Prev (Blurred), Active, Next (Blurred) */}
          <div className="flex flex-col gap-2.5 my-3.5" id="album-cover-stack-view">
            {/* 1. TOP CARD: PREVIOUS TRACK (Blurred background, clickable transition) */}
            {songs.length > 0 && (() => {
              const currentIndex = songs.findIndex(s => s.id === currentSong.id);
              const prevIdx = (currentIndex - 1 + songs.length) % songs.length;
              const prevSong = songs[prevIdx];
              return (
                <div className="relative h-16 w-full">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.button
                      key={`prev-${prevSong.id}`}
                      initial={{ opacity: 0, y: -20, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      onClick={() => {
                        setCurrentSong(prevSong);
                        setPlayback(prev => ({ ...prev, isPlaying: true }));
                      }}
                      id="expanded-stack-prev-card"
                      className={`absolute inset-0 group overflow-hidden rounded-2xl border text-left flex items-center gap-3 px-3.5 py-2 cursor-pointer transition-colors duration-300 ${
                        isDarkMode 
                          ? "bg-black/40 border-neutral-800/60 hover:border-[#cb4b51]/30" 
                          : "bg-white/45 border-neutral-200/60 hover:border-rose-400"
                      }`}
                    >
                      {/* Blurry ambient poster */}
                      <img 
                        src={prevSong.coverUrl} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute inset-0 ${isDarkMode ? "bg-stone-950/60" : "bg-white/40"}`} />
                      
                      <div className="relative z-10 flex items-center gap-2.5 w-full">
                        <motion.img 
                          layoutId={`cover-img-${prevSong.id}`}
                          src={prevSong.coverUrl} 
                          alt="" 
                          className={`w-9 h-9 rounded-lg object-cover shadow-sm blur-[1px] opacity-60 group-hover:blur-0 group-hover:opacity-100 transition duration-300 shrink-0 ${
                            isDarkMode ? "border border-neutral-800" : "border border-white/80"
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className={`text-[8px] font-mono font-bold tracking-widest block mb-0.5 uppercase ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
                            PREV FREQUENCY
                          </span>
                          <h4 className={`text-xs font-semibold truncate leading-tight transition ${isDarkMode ? "text-neutral-300 group-hover:text-[#cb4b51]" : "text-neutral-700 group-hover:text-rose-600"}`}>
                            {prevSong.title}
                          </h4>
                        </div>
                      </div>
                    </motion.button>
                  </AnimatePresence>
                </div>
              );
            })()}

            {/* 2. CENTER CARD: ACTIVE TRACK (Vibrant with mini-equalizer & spinner disc) */}
            <div className="relative h-[116px] w-full">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`active-${currentSong.id}`}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -15 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  id="expanded-stack-active-card"
                  className={`absolute inset-0 overflow-hidden rounded-2xl border text-left p-3.5 shadow-lg transition-colors duration-500 ${
                    isDarkMode 
                      ? "bg-black/70 border-[#cb4b51]/40 shadow-[#cb4b51]/5" 
                      : "bg-white/80 border-rose-300 shadow-rose-100/30"
                  }`}
                >
                  {/* Vibrant ambient backdrop */}
                  <img 
                    src={currentSong.coverUrl} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover blur-lg opacity-40 scale-125"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 ${isDarkMode ? "bg-black/55" : "bg-white/50"}`} />

                  <div className="relative z-10 flex items-center gap-3.5 w-full h-full">
                    {/* Micro-spinning disk inside sleeve */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <motion.img 
                        layoutId={`cover-img-${currentSong.id}`}
                        src={currentSong.coverUrl} 
                        alt={currentSong.title} 
                        className={`w-[70px] h-[70px] rounded-xl object-cover shadow-md border relative z-10 ${
                          playback.isPlaying ? "animate-spin-slow" : ""
                        } ${isDarkMode ? "border-stone-700/60" : "border-white"}`}
                        referrerPolicy="no-referrer"
                      />
                      {/* Vinyl sliding overlay */}
                      <div className={`absolute inset-y-1.5 -right-2 w-[60px] h-[60px] rounded-full bg-[#111111] border flex items-center justify-center -z-10 shadow transition-transform duration-700 ${
                        playback.isPlaying ? "translate-x-2 rotate-180" : "translate-x-0"
                      } ${isDarkMode ? "border-neutral-800" : "border-neutral-700/30"}`}>
                        <div className="w-4 h-4 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-stone-100" />
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 pl-1">
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="text-[8px] font-mono text-white px-1.5 py-0.5 rounded font-black tracking-widest leading-none shrink-0"
                          style={{ backgroundColor: customAccentColor }}
                        >
                          NOW PLAYING
                        </span>
                        {playback.isPlaying && (
                          <div className="flex items-end gap-0.5 h-3 shrink-0 pb-0.5">
                            <span className="w-0.5 bg-[#cb4b51] rounded-sm animate-bar-1 h-3" />
                            <span className="w-0.5 bg-[#cb4b51] rounded-sm animate-bar-2 h-1.5" />
                            <span className="w-0.5 bg-[#cb4b51] rounded-sm animate-bar-3 h-2" />
                          </div>
                        )}
                      </div>
                      <h4 className={`text-xs font-bold truncate leading-tight mt-1.5 ${isDarkMode ? "text-white" : "text-neutral-800"}`}>
                        {currentSong.title}
                      </h4>
                      <p className={`text-[10px] truncate mt-0.5 font-medium ${isDarkMode ? "text-neutral-300" : "text-neutral-500"}`}>
                        {currentSong.artist}
                      </p>
                      {currentSong.album && (
                        <p className={`text-[9px] truncate font-mono italic mt-0.5 uppercase ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
                          LP: {currentSong.album}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 3. BOTTOM CARD: NEXT TRACK (Blurred background, clickable transition) */}
            {songs.length > 0 && (() => {
              const currentIndex = songs.findIndex(s => s.id === currentSong.id);
              const nextIdx = (currentIndex + 1) % songs.length;
              const nextSong = songs[nextIdx];
              return (
                <div className="relative h-16 w-full">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.button
                      key={`next-${nextSong.id}`}
                      initial={{ opacity: 0, y: 20, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      onClick={() => {
                        setCurrentSong(nextSong);
                        setPlayback(prev => ({ ...prev, isPlaying: true }));
                      }}
                      id="expanded-stack-next-card"
                      className={`absolute inset-0 group overflow-hidden rounded-2xl border text-left flex items-center gap-3 px-3.5 py-2 cursor-pointer transition-colors duration-300 ${
                        isDarkMode 
                          ? "bg-black/40 border-neutral-800/60 hover:border-[#cb4b51]/30" 
                          : "bg-white/45 border-neutral-200/60 hover:border-rose-400"
                      }`}
                    >
                      {/* Blurry ambient poster */}
                      <img 
                        src={nextSong.coverUrl} 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute inset-0 ${isDarkMode ? "bg-stone-950/60" : "bg-white/40"}`} />
                      
                      <div className="relative z-10 flex items-center gap-2.5 w-full">
                        <motion.img 
                          layoutId={`cover-img-${nextSong.id}`}
                          src={nextSong.coverUrl} 
                          alt="" 
                          className={`w-9 h-9 rounded-lg object-cover shadow-sm blur-[1px] opacity-60 group-hover:blur-0 group-hover:opacity-100 transition duration-300 shrink-0 ${
                            isDarkMode ? "border border-neutral-800" : "border border-white/80"
                          }`}
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className={`text-[8px] font-mono font-bold tracking-widest block mb-0.5 uppercase ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
                            UP NEXT TRACK
                          </span>
                          <h4 className={`text-xs font-semibold truncate leading-tight transition ${isDarkMode ? "text-neutral-300 group-hover:text-[#cb4b51]" : "text-neutral-700 group-hover:text-rose-600"}`}>
                            {nextSong.title}
                          </h4>
                        </div>
                      </div>
                    </motion.button>
                  </AnimatePresence>
                </div>
              );
            })()}
          </div>

          {/* Active Lyrics and dynamic facts display */}
          <div className="flex-1 flex flex-col max-h-[160px] overflow-hidden pt-1 border-t border-neutral-200/30">
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider">
                {currentSong.aiDetails?.subgenre || "cozy lo-fi"}
              </span>
              <span className="text-[9px] font-mono text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: customAccentColor }}>
                ACTIVE TEXT
              </span>
            </div>

            <div className="text-xs text-neutral-800 leading-normal font-medium mt-2 max-h-[120px] overflow-y-auto no-scrollbar scroll-smooth whitespace-pre-line pr-1 bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-200/20">
              {currentSong.aiDetails?.story ? (
                <>
                  <p className="italic text-neutral-600 mb-2 font-serif text-[11.5px] leading-relaxed">
                     "{currentSong.aiDetails.story}"
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest border-t border-dashed border-neutral-300/40 pt-1.5 mb-1">
                     Lyrical Snippet:
                  </p>
                  <p className="text-[11px] leading-relaxed select-text font-mono text-neutral-700 md:leading-normal">
                     {currentSong.aiDetails.lyrics}
                  </p>
                </>
              ) : (
                <div className="text-center py-4 text-neutral-400 text-[11px] font-mono">
                  <p>No lofi facts loaded yet.</p>
                  <button 
                    onClick={handleAISongAnalysis}
                    className="mt-2 text-[10px] underline font-bold"
                    style={{ color: customAccentColor }}
                  >
                    Click to trigger Gemini Analysis
                  </button>
                </div>
              )}
            </div>
            
            {/* Vibe Tags display */}
            {currentSong.aiDetails?.tags && currentSong.aiDetails.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {currentSong.aiDetails.tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-md text-slate-600 font-medium bg-white border border-neutral-200/45 shrink-0"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== PANEL C: AMBIENT SOUND GENERATOR WIDGET ==================== */}
      {isSynthVisible && (
        <div
          id="hermedio-synth-card"
          onMouseDown={(e) => handleMouseDown(e, "synth")}
          className="absolute"
          style={{
            left: `${positions.synth.x}px`,
            top: `${positions.synth.y}px`,
            zIndex: zIndices.synth
          }}
        >
          <div className="drag-handle is-grabber cursor-grab active:cursor-grabbing">
            <AmbientSynth isPlayingParent={playback.isPlaying} />
          </div>
        </div>
      )}

      {/* ==================== PANEL D: ABOUT INFO POPUP WINDOW ==================== */}
      {isInfoVisible && (
        <div
          id="hermedio-info-card"
          onMouseDown={(e) => handleMouseDown(e, "info")}
          className="absolute glass-panel rounded-3xl shadow-2xl w-[480px] p-6 text-neutral-800 select-none z-[888]"
          style={{
            left: `${positions.info.x}px`,
            top: `${positions.info.y}px`,
            zIndex: zIndices.info
          }}
        >
          <div className="is-grabber drag-handle flex items-center justify-between pb-3 border-b border-neutral-300/30 cursor-grab active:cursor-grabbing mb-4">
            <div className="flex items-center gap-1.5">
              <Disc className="w-5 h-5 text-rose-500 animate-spin" />
              <span className="font-display font-bold text-sm tracking-tight text-neutral-800">
                About hermedio v1.2 Music Hub
              </span>
            </div>
            <button 
              onClick={() => setIsInfoVisible(false)}
              className="p-1 hover:bg-neutral-200/50 rounded-lg text-neutral-500 hover:text-neutral-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 text-xs leading-relaxed font-sans text-neutral-600">
            <p>
              <strong>hermedio</strong> is an elegant lo-fi and J-pop virtual desktop environment carefully designed for late-night music listening, acoustic study, and peaceful vibes.
            </p>
            <p>
              <strong>✨ Key highlights included in this replica:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-1 pt-1 text-neutral-700">
              <li>
                <span className="font-mono text-rose-600 font-bold">100% Client-Side metadata loop:</span> Instantly reads local <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-[10px]">.mp3</code> files, decodes their ID3 frames, and displays embedded APIC cover art instantly.
              </li>
              <li>
                <span className="font-mono text-orange-600 font-bold">Gemini AI lyrics companion:</span> Fully communicates with server side Gemini 3.5 Flash to generate personalized midnight café stories, vibe subgenres, and matching color schemes.
              </li>
              <li>
                <span className="font-mono text-violet-600 font-bold">Web Audio Sound Engine:</span> Integrates procedural sound generators for pink rain noises, retro dusty vinyl crackle pops, and artificial Rhodes minor 7th electric keyboard chords.
              </li>
            </ul>
            <p className="text-[11px] bg-neutral-100 p-2.5 rounded-xl font-mono text-zinc-500 border border-neutral-200/40">
              Drag-and-drop your favourite songs right on the desktop to populate your private playlist! Have a relaxing time in the room.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-neutral-300/30 flex justify-end">
            <button
              onClick={() => setIsInfoVisible(false)}
              className="px-4 py-1.5 text-white rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-900 active:scale-95 transition"
            >
              Let's listen
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Application Dock */}
      <DesktopDock 
        onWallpaperChange={handleWallpaperCycle}
        onResetLayout={handleResetWidgetsPosition}
        onUploadClick={triggerFileSelection}
        toggleSynth={() => setIsSynthVisible(prev => !prev)}
        toggleExpandedCover={() => setIsExpandedCoverVisible(prev => !prev)}
        isSynthOpen={isSynthVisible}
        isExpandedCoverOpen={isExpandedCoverVisible}
        onShowInfo={() => setIsInfoVisible(prev => !prev)}
        songsCount={songs.length}
      />
    </div>
  );
}
