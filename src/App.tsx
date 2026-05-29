import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Disc,
  Search,
  Heart,
  History,
  Repeat
} from "lucide-react";
import { PRELOADED_SONGS, DESKTOP_WALLPAPERS } from "./data";
import { Song, PlaybackState } from "./types";
import { parseLocalAudioMetadata } from "./utils/id3Parser";
import tasteData from "../data/taste.json";
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
  const isInitialMount = useRef(true);

  // Clear old localStorage data on version change to prevent white screen
  useEffect(() => {
    const version = "20260528-v2";
    const savedVersion = localStorage.getItem("hermedio_version");
    if (savedVersion !== version) {
      console.log("Clearing old app data for version", version);
      const keysToKeep = ["hermedio_version"];
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.startsWith("hermedio_") && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem("hermedio_version", version);
      window.location.reload();
    }
  }, []);

  // Toast state for beautiful non-intrusive floating HUD notifications
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(prev => {
        if (prev.message === message) {
          return { ...prev, visible: false };
        }
        return prev;
      });
    }, 3500);
  };

  // 1. Memory-Aware Songs and Queue states
  const [songs, setSongs] = useState<Song[]>(() => {
    const saved = localStorage.getItem("hermedio_songs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error reading saved songs map:", e);
      }
    }
    return PRELOADED_SONGS;
  });

  const [currentSong, setCurrentSong] = useState<Song>(() => {
    const savedSong = localStorage.getItem("hermedio_current_song");
    const savedQueue = localStorage.getItem("hermedio_songs");
    let initialSongs = PRELOADED_SONGS;
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed) && parsed.length > 0) initialSongs = parsed;
      } catch (e) {}
    }
    if (savedSong) {
      try {
        const parsed = JSON.parse(savedSong);
        if (parsed && parsed.id) {
          const exists = initialSongs.find(s => s.id === parsed.id);
          if (exists) return exists;
        }
      } catch (e) {}
    }
    return initialSongs[0];
  });

  const [playback, setPlayback] = useState<PlaybackState>(() => {
    const savedRepeat = localStorage.getItem("hermedio_repeat_mode") as "off" | "all" | "one" | null;
    const savedShuffle = localStorage.getItem("hermedio_is_shuffle") === "true";
    const savedVol = localStorage.getItem("hermedio_volume");
    const savedMute = localStorage.getItem("hermedio_is_muted");
    const savedTime = localStorage.getItem("hermedio_current_time");
    return {
      isPlaying: false,
      currentTime: savedTime ? Number(savedTime) : 0,
      duration: 300,
      volume: savedVol !== null ? Number(savedVol) : 0.7,
      isMuted: savedMute === "true",
      repeatMode: savedRepeat || "all",
      isShuffle: savedShuffle
    };
  });

  // YouTube removed — NetEase audio-only playback  // Persist volume, mute, and current playhead position
  useEffect(() => {
    localStorage.setItem("hermedio_volume", String(playback.volume));
    localStorage.setItem("hermedio_is_muted", String(playback.isMuted));
    localStorage.setItem("hermedio_current_time", String(playback.currentTime));
  }, [playback.volume, playback.isMuted, playback.currentTime]);

  // Track state persistence
  useEffect(() => {
    localStorage.setItem("hermedio_songs", JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    if (currentSong) {
      localStorage.setItem("hermedio_current_song", JSON.stringify(currentSong));
    }
  }, [currentSong]);

  // Combined play mode trigger
  const cyclePlayMode = () => {
    setPlayback(prev => {
      let nextRepeatMode: "all" | "one" = "all";
      let nextIsShuffle = false;
      
      if (prev.repeatMode === "all" && !prev.isShuffle) {
        nextRepeatMode = "one";
        nextIsShuffle = false;
      } else if (prev.repeatMode === "one" && !prev.isShuffle) {
        nextRepeatMode = "all";
        nextIsShuffle = true;
      } else {
        nextRepeatMode = "all";
        nextIsShuffle = false;
      }
      
      localStorage.setItem("hermedio_repeat_mode", nextRepeatMode);
      localStorage.setItem("hermedio_is_shuffle", String(nextIsShuffle));
      
      return {
        ...prev,
        repeatMode: nextRepeatMode,
        isShuffle: nextIsShuffle
      };
    });
  };

  // Play counter trace and song history tracker to support smart Recommendations
  useEffect(() => {
    if (playback.isPlaying && currentSong) {
      try {
        const counts = JSON.parse(localStorage.getItem("hermedio_play_counts") || "{}");
        counts[currentSong.id] = (counts[currentSong.id] || 0) + 1;
        localStorage.setItem("hermedio_play_counts", JSON.stringify(counts));
      } catch (e) {
        console.error("Failed to update play counts:", e);
      }

      setPlayedSongIds(prev => {
        if (!prev.includes(currentSong.id)) {
          return [...prev, currentSong.id];
        }
        return prev;
      });
    }
  }, [currentSong?.id, playback.isPlaying]);

  // View mode state ("player" vs "library" explorer)
  const [viewMode, setViewMode] = useState<"player" | "library">(() => {
    return (localStorage.getItem("hermedio_view_mode") as "player" | "library") || "player";
  });

  // Always show album cover (MV mode removed)

  // Drag and drop state for reordering playlist songs
  const [draggedSongIdx, setDraggedSongIdx] = useState<number | null>(null);

  const handlePlaylistDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedSongIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlaylistDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedSongIdx === null || draggedSongIdx === index) return;

    const list = [...songs];
    const draggedItem = list[draggedSongIdx];
    list.splice(draggedSongIdx, 1);
    list.splice(index, 0, draggedItem);

    setDraggedSongIdx(index);
    setSongs(list);
  };

  const handlePlaylistDragEnd = () => {
    setDraggedSongIdx(null);
  };

  // Remove song from active playing queue
  const removeSongFromQueue = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (currentSong.id === id) {
      const remainingSongs = songs.filter(s => s.id !== id);
      if (remainingSongs.length > 0) {
        setCurrentSong(remainingSongs[0]);
      } else {
        setCurrentSong(PRELOADED_SONGS[0]);
      }
    }
    setSongs(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        return PRELOADED_SONGS;
      }
      return filtered;
    });
  };

  // Pre-seeded database for custom artists and albums list with localized tracking
  const [libraryArtists, setLibraryArtists] = useState<{ id: string; name: string; avatarUrl: string }[]>(() => {
    const saved = localStorage.getItem("hermedio_library_artists");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const seeded: { id: string; name: string; avatarUrl: string }[] = [];
    PRELOADED_SONGS.forEach((s, idx) => {
      if (!seeded.some(a => a.name.toLowerCase() === s.artist.toLowerCase())) {
        seeded.push({
          id: `art-seed-${idx}`,
          name: s.artist,
          avatarUrl: s.coverUrl
        });
      }
    });
    return seeded;
  });

  const [libraryAlbums, setLibraryAlbums] = useState<{ id: string; title: string; artist: string; coverUrl: string }[]>(() => {
    const saved = localStorage.getItem("hermedio_library_albums");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const seeded: { id: string; title: string; artist: string; coverUrl: string }[] = [];
    PRELOADED_SONGS.forEach((s, idx) => {
      const albumTitle = s.album || "Single Collection";
      if (!seeded.some(a => a.title.toLowerCase() === albumTitle.toLowerCase())) {
        seeded.push({
          id: `alb-seed-${idx}`,
          title: albumTitle,
          artist: s.artist,
          coverUrl: s.coverUrl
        });
      }
    });
    return seeded;
  });

  // Database of tracks exploreable under specific Artists and Albums
  const [libraryTracks, setLibraryTracks] = useState<Song[]>(() => {
    const saved = localStorage.getItem("hermedio_library_tracks");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return PRELOADED_SONGS;
  });

  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [showDailyRecommend, setShowDailyRecommend] = useState<boolean>(false);
  const [dailySongs, setDailySongs] = useState<Song[]>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [showRadar, setShowRadar] = useState<boolean>(false);
  const [radarSongs, setRadarSongs] = useState<Song[]>([]);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isArtistsExpanded, setIsArtistsExpanded] = useState<boolean>(false);
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState<boolean>(false);

  // Favorite Song IDs state
  const [favoriteSongIds, setFavoriteSongIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hermedio_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("hermedio_favorites", JSON.stringify(favoriteSongIds));
  }, [favoriteSongIds]);

  // Listen History and Toggle Filters
  const [showListenedOnly, setShowListenedOnly] = useState<boolean>(false);
  const [playedSongIds, setPlayedSongIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hermedio_played_song_ids");
      if (saved) return JSON.parse(saved);
      const counts = localStorage.getItem("hermedio_play_counts");
      if (counts) {
        return Object.keys(JSON.parse(counts));
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem("hermedio_played_song_ids", JSON.stringify(playedSongIds));
  }, [playedSongIds]);

  const toggleFavorite = (songId: string) => {
    setFavoriteSongIds(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      } else {
        return [...prev, songId];
      }
    });
  };

  // Prevent browser scroll bouncing by handling horizontal mouse wheels natively with non-passive options
  useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        e.stopPropagation();
        const container = e.currentTarget as HTMLDivElement;
        if (container) {
          container.scrollLeft += e.deltaY;
        }
      }
    };

    const artistsEl = artistsScrollRef.current;
    const albumsEl = albumsScrollRef.current;

    if (artistsEl && !isArtistsExpanded) {
      artistsEl.addEventListener("wheel", handleNativeWheel, { passive: false });
    }
    if (albumsEl && !isAlbumsExpanded) {
      albumsEl.addEventListener("wheel", handleNativeWheel, { passive: false });
    }

    return () => {
      if (artistsEl) {
        artistsEl.removeEventListener("wheel", handleNativeWheel);
      }
      if (albumsEl) {
        albumsEl.removeEventListener("wheel", handleNativeWheel);
      }
    };
  }, [isArtistsExpanded, isAlbumsExpanded, libraryArtists, libraryAlbums]);

  useEffect(() => {
    localStorage.setItem("hermedio_library_artists", JSON.stringify(libraryArtists));
  }, [libraryArtists]);

  useEffect(() => {
    localStorage.setItem("hermedio_library_albums", JSON.stringify(libraryAlbums));
  }, [libraryAlbums]);

  useEffect(() => {
    localStorage.setItem("hermedio_library_tracks", JSON.stringify(libraryTracks));
  }, [libraryTracks]);

  useEffect(() => {
    const handleCloseOnOutside = () => {
      setActiveDropdownResultId(null);
      setHeartDropdownOpen(false);
    };
    document.addEventListener("click", handleCloseOnOutside);
    return () => {
      document.removeEventListener("click", handleCloseOnOutside);
    };
  }, []);

  // AI Recommended Loading & List
  const [isRecommending, setIsRecommending] = useState<boolean>(false);

  // 2. Client Space / Theme UI States
  const [wallpaperIdx, setWallpaperIdx] = useState<number>(() => {
    return Number(localStorage.getItem("hermedio_wallpaper_idx") || "0");
  });
  const [isSynthVisible, setIsSynthVisible] = useState<boolean>(() => {
    return localStorage.getItem("hermedio_synth_visible") === "true";
  });
  const [isExpandedCoverVisible, setIsExpandedCoverVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem("hermedio_expanded_cover_visible");
    return saved === null ? true : saved === "true";
  });
  const [isSeeking, setIsSeeking] = useState(false);
  const isSeekingRef = useRef(false);
  const syncIsSeeking = (v: boolean) => { isSeekingRef.current = v; setIsSeeking(v); };
  const [isInfoVisible, setIsInfoVisible] = useState<boolean>(() => {
    return localStorage.getItem("hermedio_info_visible") === "true";
  });
  const [customAccentColor, setCustomAccentColor] = useState<string>(() => {
    return localStorage.getItem("hermedio_custom_accent_color") || "#cb4b51";
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("hermedio_is_dark_mode");
    return saved === null ? true : saved === "true";
  });
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [lyricLines, setLyricLines] = useState<{ time: number; text: string }[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [isStoryExpanded, setIsStoryExpanded] = useState<boolean>(false);

  // Fetch lyrics when opening lyrics panel
  useEffect(() => {
    if (!isLyricsOpen || !currentSong.neteaseId) return;
    setCurrentLyricIndex(0);
    setLyricLines([]);
    (async () => {
      try {
        const res = await fetch(`/api/lyric/${currentSong.neteaseId}`);
        const data = await res.json();
        if (data.lyric) {
          // Parse LRC format: [mm:ss.xx]text
          const lines = data.lyric.split("\n").filter((l: string) => l.trim());
          const parsed = lines
            .map((l: string) => {
              const m = l.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
              if (m) {
                const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
                return { time, text: m[3].trim() };
              }
              return null;
            })
            .filter(Boolean) as { time: number; text: string }[];
          setLyricLines(parsed);
        }
      } catch {}
    })();
  }, [isLyricsOpen, currentSong.neteaseId]);

  // Sync current lyric with playback time
  useEffect(() => {
    if (!isLyricsOpen || lyricLines.length === 0) return;
    const idx = lyricLines.findLastIndex(l => l.time <= playback.currentTime);
    if (idx >= 0 && idx !== currentLyricIndex) {
      setCurrentLyricIndex(idx);
    }
  }, [playback.currentTime, isLyricsOpen, lyricLines]);
  const [isSearchPanelExpanded, setIsSearchPanelExpanded] = useState<boolean>(false);
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState<boolean>(false);
  const togglePlayerCollapsed = (collapsed: boolean) => {
    setIsPlayerCollapsed(collapsed);
    setPositions(prev => {
      // Expanded cover center ≈ y:80 + height/2 ≈ 456
      // Collapsed player height: 148, so target y = 456 - 74 = 382
      const collapsedY = 382;
      const expandedY = 158;
      return {
        ...prev,
        player: {
          ...prev.player,
          y: collapsed ? collapsedY : Math.max(10, expandedY)
        }
      };
    });
  };
  const [isDeepseekOpen, setIsDeepseekOpen] = useState<boolean>(() => {
    return localStorage.getItem("hermedio_is_deepseek_open") === "true";
  });

  // Recenter UI on window resize / fullscreen (F11)
  useEffect(() => {
    const doRecenter = () => {
      localStorage.removeItem("hermedio_widget_positions");
      const w = window.innerWidth;
      if (w > 1080) {
        setPositions({
          player: { x: w / 2 - 435, y: 158 },
          synth: { x: w / 2 + 400, y: 390 },
          expanded: { x: w / 2 + 115, y: 80 },
          info: { x: w / 2 - 250, y: 150 },
        });
      }
    };
    window.addEventListener("resize", doRecenter);
    document.addEventListener("fullscreenchange", doRecenter);
    return () => {
      window.removeEventListener("resize", doRecenter);
      document.removeEventListener("fullscreenchange", doRecenter);
    };
  }, []);

  // 1b. Search & Platform Source States
  const [selectedSource, setSelectedSource] = useState<"netease" | "youtube">(() => {
    return (localStorage.getItem("hermedio_selected_source") as "netease" | "youtube") || "netease";
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [activeDropdownResultId, setActiveDropdownResultId] = useState<string | null>(null);
  const [heartDropdownOpen, setHeartDropdownOpen] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // 3. AI Cognitive Loading States
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>("");

  // 4. Clocks / Calendars
  const [timeString, setTimeString] = useState<string>("12:25");
  const [dateString, setDateString] = useState<string>("05-25 MON");

  // 5. Drag & Drop Floating coordinates - Centered with elegant 50px gap between Player (w: 500) and Expanded Cover (w: 320)
  const [positions, setPositions] = useState(() => {
    const saved = localStorage.getItem("hermedio_widget_positions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      player: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 - 435) : 20, y: 158 },
      synth: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 + 400) : 20, y: 390 },
      expanded: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 + 115) : 20, y: 80 },
      info: { x: window.innerWidth / 2 - 250, y: 150 }
    };
  });
  const [zIndices, setZIndices] = useState(INITIAL_Z_INDEX);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Swipe gesture variables for Panel B cover carousel (Nothing slide-to-switch feel)
  const [swipeState, setSwipeState] = useState<{ startX: number; startY: number; isDragging: boolean } | null>(null);

  // Animation direction state for Panel B's cover carousel and mouse wheel scrolling
  const [carouselDirection, setCarouselDirection] = useState<"next" | "prev">("next");
  const lastWheelTimeRef = useRef<number>(0);

  // Singer/Artist and Album horizontal scroll gallery refs to prevent screen bouncing during wheel slide
  const artistsScrollRef = useRef<HTMLDivElement | null>(null);
  const albumsScrollRef = useRef<HTMLDivElement | null>(null);

  // 6. Archivist Terminal States
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(() => {
    return localStorage.getItem("hermedio_is_terminal_open") === "true";
  });
  const [activeTerminalTab, setActiveTerminalTab] = useState<"deepseek" | "archivist">(() => {
    return (localStorage.getItem("hermedio_active_terminal_tab") as "deepseek" | "archivist") || "deepseek";
  });
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [terminalHistory, setTerminalHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>(() => {
    const saved = localStorage.getItem("hermedio_terminal_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        role: "assistant",
        text: "Awaiting database queries under midnight lamp. Ask me about Nujabes, Shing02, Shibuya-kei, Digable Planets, or any music in this player."
      }
    ];
  });
  const [isTerminalResponding, setIsTerminalResponding] = useState<boolean>(false);

  // 6.5. DeepSeek Chat Console States
  const [deepseekMessages, setDeepseekMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "嗨！我是你的 AI DJ，告诉我你想听什么歌吧~ 🎵" }
  ]);
  const [deepseekInput, setDeepseekInput] = useState<string>("");
  const [isDeepseekTyping, setIsDeepseekTyping] = useState<boolean>(false);
  const deepseekLogRef = useRef<HTMLDivElement | null>(null);

  // Persist high-fidelity states
  useEffect(() => {
    localStorage.setItem("hermedio_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("hermedio_selected_source", selectedSource);
  }, [selectedSource]);

  useEffect(() => {
    localStorage.setItem("hermedio_wallpaper_idx", String(wallpaperIdx));
  }, [wallpaperIdx]);

  useEffect(() => {
    localStorage.setItem("hermedio_synth_visible", String(isSynthVisible));
  }, [isSynthVisible]);

  useEffect(() => {
    localStorage.setItem("hermedio_expanded_cover_visible", String(isExpandedCoverVisible));
  }, [isExpandedCoverVisible]);

  useEffect(() => {
    localStorage.setItem("hermedio_info_visible", String(isInfoVisible));
  }, [isInfoVisible]);

  useEffect(() => {
    localStorage.setItem("hermedio_custom_accent_color", customAccentColor);
  }, [customAccentColor]);

  useEffect(() => {
    localStorage.setItem("hermedio_is_dark_mode", String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("hermedio_widget_positions", JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem("hermedio_is_terminal_open", String(isTerminalOpen));
  }, [isTerminalOpen]);

  useEffect(() => {
    localStorage.setItem("hermedio_active_terminal_tab", activeTerminalTab);
  }, [activeTerminalTab]);

  useEffect(() => {
    localStorage.setItem("hermedio_is_deepseek_open", String(isDeepseekOpen));
  }, [isDeepseekOpen]);

  useEffect(() => {
    localStorage.setItem("hermedio_terminal_history", JSON.stringify(terminalHistory));
  }, [terminalHistory]);

  // Auto-scroll DeepSeek chat
  useEffect(() => {
    if (deepseekLogRef.current) {
      deepseekLogRef.current.scrollTop = deepseekLogRef.current.scrollHeight;
    }
  }, [deepseekMessages, isDeepseekTyping, activeTerminalTab, isTerminalOpen]);

  // Shared play function — resolves URL and plays directly
  const playSongDirectly = async (song: Song) => {
    let playUrl = song.url;
    if (!playUrl && song.neteaseId) {
      try {
        const urlRes = await fetch(`/api/netease-url/${song.neteaseId}`);
        const urlData = await urlRes.json();
        if (urlData.url) playUrl = urlData.url;
      } catch {}
    }
    const s = { ...song, url: playUrl };
    setSongs(prev => {
      if (prev.some(t => t.title.toLowerCase() === s.title.toLowerCase() && t.artist.toLowerCase() === s.artist.toLowerCase())) return prev;
      return [...prev, s];
    });
    setCurrentSong(s);
    setPlayback({ ...playback, isPlaying: true, currentTime: 0 });
    // Play directly
    if (audioRef.current && playUrl) {
      audioRef.current.src = playUrl;
      audioRef.current.load();
      setTimeout(() => audioRef.current?.play().catch(() => {}), 200);
    }
  };

  const handleDeepseekSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deepseekInput.trim() || isDeepseekTyping) return;

    const userText = deepseekInput.trim();
    setDeepseekMessages(prev => [...prev, { role: "user", text: userText }]);
    setDeepseekInput("");
    setIsDeepseekTyping(true);

    // Direct play intent
    const playPatterns = [
      /^(?:放|播放|来首|来点|播|听|我想听|想听|搜|搜索|放首|播首|听首)\s*(.+)/,
      /^(?:play|search)\s+(.+)/i,
    ];
    let searchQuery = "";
    for (const p of playPatterns) {
      const m = userText.match(p);
      if (m?.[1]?.trim()) { searchQuery = m[1].trim(); break; }
    }

    if (searchQuery) {
      try {
        const res = await fetch(`/api/netease-search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            await playSongDirectly(results[0]);
            setDeepseekMessages(prev => [...prev, { role: "assistant", text: `正在播放 ${results[0].title} - ${results[0].artist} 🎵` }]);
            setIsDeepseekTyping(false);
            return;
          }
        }
        setDeepseekMessages(prev => [...prev, { role: "assistant", text: `没找到「${searchQuery}」，换个关键词试试~` }]);
        setIsDeepseekTyping(false);
        return;
      } catch (e) { console.error("DJ play error:", e); }
    }

    try {
      // Send to DeepSeek for chat response (no action tag needed — we handle play locally)
      const apiMessages = [
        {
          role: "system",
          content: `You are an AI DJ in "hermedio", a cozy lo-fi music player. Reply warmly in Chinese or English, 1-2 sentences max. The system handles song search and playback automatically when the user asks for music.

          User's taste — Favorite Artists:
          Western: ${tasteData.favoriteArtists.western.join(", ")}
          K-Pop: ${tasteData.favoriteArtists.kpop.join(", ")}
          J-Pop: ${tasteData.favoriteArtists.jpop.join(", ")}
          Chinese: ${tasteData.favoriteArtists.chinese.join(", ")}
          Indie: ${tasteData.favoriteArtists.indie.join(", ")}
          Genres: ${tasteData.genres.join(", ")}

          Current song: "${currentSong?.title}" by "${currentSong?.artist}".`
        },
        { role: "user" as const, content: userText }
      ];

      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!response.ok) {
        throw new Error(`Connect status ${response.status}`);
      }

      const data = await response.json();
      const aiText = data.text || "";
      setDeepseekMessages(prev => [...prev, { role: "assistant" as const, text: aiText }]);
    } catch (error: any) {
      console.warn("Deepseek API error:", error);
      setDeepseekMessages(prev => [...prev, { role: "assistant", text: "DJ 暂时离线了，但你可以直接告诉我「放BIGBANG」来听歌~" }]);
    } finally {
      setIsDeepseekTyping(false);
    }
  };

  // 7. Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeRef = useRef<HTMLAudioElement | null>(null);
  const mvContainerRef = useRef<HTMLDivElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const terminalLogRef = useRef<HTMLDivElement | null>(null);
  const urlResolvingRef = useRef<Set<string>>(new Set());

  // Resolve NetEase stream URL when song has neteaseId but no url
  useEffect(() => {
    if (!currentSong.neteaseId || currentSong.url || urlResolvingRef.current.has(currentSong.id)) return;
    urlResolvingRef.current.add(currentSong.id);
    (async () => {
      try {
        const res = await fetch(`/api/netease-url/${currentSong.neteaseId}`);
        const data = await res.json();
        if (data.url) {
          setCurrentSong(prev => ({ ...prev, url: data.url }));
          setSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, url: data.url } : s));
        }
      } catch {}
    })();
  }, [currentSong.id, currentSong.neteaseId, currentSong.url]);

  const audioReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const fadeAnimRef = useRef<number>(0);
  const isFadingRef = useRef(false);
  const crossfadeActiveRef = useRef(false);
  const crossfadeHandledRef = useRef(false);

  const fadeVolume = (from: number, to: number, durationMs: number) => {
    if (!audioRef.current) return;
    cancelAnimationFrame(fadeAnimRef.current);
    isFadingRef.current = true;
    const start = performance.now();
    const targetVol = playback.isMuted ? 0 : to;
    const step = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const vol = from + (targetVol - from) * eased;
      if (audioRef.current && !playback.isMuted) {
        audioRef.current.volume = Math.max(0, Math.min(1, vol));
      }
      if (progress < 1) {
        fadeAnimRef.current = requestAnimationFrame(step);
      } else {
        isFadingRef.current = false;
      }
    };
    fadeAnimRef.current = requestAnimationFrame(step);
  };

  // DJ-style crossfade: fade in from 0 on song start
  const fadeInSong = () => {
    if (!audioRef.current || playback.isMuted) return;
    audioRef.current.volume = 0;
    fadeVolume(0, playback.volume, 1500);
  };

  // Spacebar to play/pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        handlePlayPause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playback.isPlaying]);

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

  // Scroll terminal logs to the bottom
  useEffect(() => {
    if (terminalLogRef.current) {
      terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
    }
  }, [terminalHistory, isTerminalResponding, isTerminalOpen, activeTerminalTab]);

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

  const addSearchSongToLibrary = (song: Song) => {
    // 1. Add song to playlist queue
    setSongs(prev => {
      if (prev.some(s => s.title.toLowerCase() === song.title.toLowerCase() && s.artist.toLowerCase() === song.artist.toLowerCase())) return prev;
      return [...prev, song];
    });
    
    // 2. Add to libraryTracks list so they can browse it later!
    setLibraryTracks(prev => {
      if (prev.some(t => t.title.toLowerCase() === song.title.toLowerCase() && t.artist.toLowerCase() === song.artist.toLowerCase())) return prev;
      const newTrack = {
        ...song,
        id: `libtrack-dyn-${Date.now()}`
      };
      return [...prev, newTrack];
    });
  };

  const addArtistToFavorite = (artistName: string, coverUrl: string) => {
    if (!artistName) return;
    setLibraryArtists(prev => {
      if (prev.some(a => a.name.toLowerCase() === artistName.toLowerCase())) {
        showToast(`歌手 "${artistName}" 已经存在于喜欢的歌手列表中！`);
        return prev;
      }
      const newArt = {
        id: `art-dyn-${Date.now()}`,
        name: artistName,
        avatarUrl: coverUrl || `https://picsum.photos/seed/${encodeURIComponent(artistName)}/150/150`
      };
      showToast(`成功将歌手 "${artistName}" 添加到喜欢的歌手！`);
      return [...prev, newArt];
    });
  };

  const addAlbumToFavorite = (albumName: string, artistName: string, coverUrl: string) => {
    if (!albumName) return;
    setLibraryAlbums(prev => {
      if (prev.some(a => a.title.toLowerCase() === albumName.toLowerCase() && a.artist.toLowerCase() === artistName.toLowerCase())) {
        showToast(`专辑 "${albumName}" 已经存在于喜欢的专辑列表中！`);
        return prev;
      }
      const newAlb = {
        id: `alb-dyn-${Date.now()}`,
        title: albumName,
        artist: artistName || "Unknown Artist",
        coverUrl: coverUrl || "https://picsum.photos/seed/album/300/300"
      };
      showToast(`成功将专辑 "${albumName}" 添加到喜欢的专辑！`);
      return [...prev, newAlb];
    });
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await fetch(`/api/netease-search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!response.ok) throw new Error("NetEase search failed");
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("No results found");
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([
        {
          id: `search-fallback-${Date.now()}`,
          title: `${searchQuery} (Acoustic Remaster)`,
          artist: "Hermedio Lounge",
          album: "Midnight Sessions",
          duration: 298,
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
          coverUrl: "https://picsum.photos/seed/midnightsession/300/300",
          musicianStorySummary: `A custom acoustic stream assembled instantly to sync with your search query.`,
          musicianBio: `Designed for relaxing midnight reflection and study, avoiding complex drum frequencies.`,
          aiDetails: {
            story: `This ambient record captures the silent frequencies of the late hours, bringing instant peace and resonance to "${searchQuery}".`,
            lyrics: "Soft whispers of rain on the tin roof\nTwo shadows dancing in the night\nNo words are needed, here is the proof\nOf things that are beautiful and bright...",
            subgenre: "Cozy Searched Chillhop",
            themeColor: "#cb4b51",
            tags: ["#chill", "#quiet_resonance", "#peaceful", "#search_matches"]
          }
        }
      ]);
    } finally {
      setIsSearching(false);
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

  const loadRadar = async () => {
    setIsLoadingRadar(true);
    try {
      const res = await fetch("/api/personal-radar");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRadarSongs(data);
          setLibraryTracks(prev => {
            const updated = [...prev];
            for (const song of data) {
              if (!updated.some(t => t.title === song.title && t.artist === song.artist)) updated.push(song);
            }
            return updated;
          });
          setShowRadar(true);
          setShowFavoritesOnly(false);
          setShowDailyRecommend(false);
          setSelectedArtistId("");
          setSelectedAlbumId("");
          setShowSearchResults(false);
          setShowListenedOnly(false);
        }
      }
    } catch {}
    setIsLoadingRadar(false);
  };

  const loadDailyRecommend = async () => {
    setIsLoadingDaily(true);
    try {
      const res = await fetch("/api/daily-recommend");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDailySongs(data);
          setLibraryTracks(prev => {
            const updated = [...prev];
            for (const song of data) {
              if (!updated.some(t => t.title === song.title && t.artist === song.artist)) {
                updated.push(song);
              }
            }
            return updated;
          });
          setShowDailyRecommend(true);
          setShowFavoritesOnly(false);
          setSelectedArtistId("");
          setSelectedAlbumId("");
          setShowSearchResults(false);
          setShowListenedOnly(false);
        }
      }
    } catch (e) {
      console.error("Daily recommend fetch failed:", e);
    }
    setIsLoadingDaily(false);
  };

  // Auto-fetch all songs for selected artist or album via NetEase
  useEffect(() => {
    if (!selectedArtistId && !selectedAlbumId) return;

    let query = "";
    if (selectedArtistId) {
      const artist = libraryArtists.find(a => a.id === selectedArtistId);
      if (!artist) return;
      query = artist.name;
    } else if (selectedAlbumId) {
      const album = libraryAlbums.find(a => a.id === selectedAlbumId);
      if (!album) return;
      query = `${album.title} ${album.artist}`;
    }
    if (!query) return;

    // Always fetch fresh results from NetEase
    const fetchSongs = async () => {
      try {
        const res = await fetch(`/api/netease-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        setLibraryTracks(prev => {
          let updated = [...prev];
          data.forEach((song: any) => {
            if (!updated.some(t =>
              t.title.toLowerCase() === song.title.toLowerCase() &&
              t.artist.toLowerCase() === song.artist.toLowerCase()
            )) {
              updated.push({ ...song, id: `libtrack-dyn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` });
            }
          });
          return updated;
        });
      } catch (e) {
        console.error("Auto artist/album fetch failed:", e);
      }
    };

    fetchSongs();
  }, [selectedArtistId, selectedAlbumId]);

  // Resolve NetEase stream URL when a song is selected
  useEffect(() => {
    if (currentSong.neteaseId && !currentSong.url) {
      (async () => {
        try {
          const res = await fetch(`/api/netease-url/${currentSong.neteaseId}`);
          const data = await res.json();
          if (data.url) {
            setCurrentSong(prev => ({ ...prev, url: data.url }));
            setSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, url: data.url } : s));
          }
        } catch {}
      })();
    }
  }, [currentSong.id, currentSong.neteaseId]);

  // Audio HTML5 setup sync — waits for canplay before allowing playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentSrc = audio.src || "";
    const targetSrc = currentSong.url;

    if (!targetSrc) return; // NetEase songs resolve URL async

    const isMatches = currentSrc === targetSrc || currentSrc.endsWith(targetSrc);
    if (isMatches && audioReadyRef.current) return; // Already loaded

    // Mark as not ready during load
    audioReadyRef.current = false;
    pendingPlayRef.current = playback.isPlaying;

    audio.src = targetSrc;
    audio.load();

    const onCanPlay = () => {
      audioReadyRef.current = true;
      if (pendingPlayRef.current && playback.isPlaying) {
        audio.play().catch(() => {
          setPlayback(prev => ({ ...prev, isPlaying: false }));
        });
        pendingPlayRef.current = false;
      }
    };

    audio.addEventListener("canplay", onCanPlay, { once: true });
    return () => {
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [currentSong.id, currentSong.url, currentSong.neteaseId]);

  // Audio HTML5 play/pause sync (only when audio is ready)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || currentSong.isYouTube) return;
    if (!audioReadyRef.current) {
      // Not ready yet — flag intent for canplay handler
      pendingPlayRef.current = playback.isPlaying;
      return;
    }

    if (playback.isPlaying) {
      if (audio.paused) {
        audio.play().catch(() => {
          setPlayback(prev => ({ ...prev, isPlaying: false }));
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [playback.isPlaying, currentSong.isYouTube]);

  // Sync Audio Volumes & Mutes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playback.isMuted ? 0 : playback.volume;
    }
  }, [playback.volume, playback.isMuted]);

  // Synchronize playback timeline for YouTube tracks
  useEffect(() => {
    if (currentSong.isYouTube) {
      setPlayback(prev => ({
        ...prev,
        duration: currentSong.duration || 240
      }));
    }
  }, [currentSong.id]);

  // Audio progress is driven by onTimeUpdate event from <audio> element  // Dragging mechanisms
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
    if (!audioRef.current) return;
    if (playback.isPlaying) {
      audioRef.current.pause();
      setPlayback(prev => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play().then(() => {
        setPlayback(prev => ({ ...prev, isPlaying: true }));
      }).catch(err => {
         console.warn("Audio playback failed:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !currentSong.isYouTube) {
      setPlayback(prev => {
        const audioDuration = audioRef.current?.duration;
        return {
          ...prev,
          currentTime: audioRef.current?.currentTime || 0,
          duration: (audioDuration && !isNaN(audioDuration) && audioDuration > 0) ? audioDuration : prev.duration
        };
      });
    }
  };

  const handleMetadataLoaded = () => {
    if (audioRef.current && !currentSong.isYouTube) {
      const savedTime = localStorage.getItem("hermedio_current_time");
      if (savedTime && Number(savedTime) > 0) {
        audioRef.current.currentTime = Math.min(Number(savedTime), (audioRef.current.duration || 99999) - 1);
      }
      setPlayback(prev => ({
        ...prev,
        duration: audioRef.current?.duration || currentSong.duration
      }));
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayback(prev => ({ ...prev, currentTime: val }));
    
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const isMutedState = val === 0;
    setPlayback(prev => ({ 
      ...prev, 
      volume: val, 
      isMuted: isMutedState
    }));
    
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = isMutedState;
    }

  };

  const toggleMute = () => {
    setPlayback(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  // Next and Previous tracks steps
  const handleNext = () => {
    setCarouselDirection("next");
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
    setCarouselDirection("prev");
    const curIdx = songs.findIndex(s => s.id === currentSong.id);
    let prevIdx = curIdx - 1;
    if (prevIdx < 0) {
      prevIdx = songs.length - 1;
    }
    setCurrentSong(songs[prevIdx]);
    setPlayback(prev => ({ ...prev, isPlaying: true }));
  };

  // Auto-crossfade: fade out current song at 4s, load & fade in next song in parallel
  useEffect(() => {
    if (currentSong.isYouTube || !playback.isPlaying || crossfadeActiveRef.current) return;
    if (playback.repeatMode === "one") return;
    const dur = playback.duration || currentSong.duration;
    if (!dur || dur <= 0 || songs.length <= 1) return;
    const remaining = dur - playback.currentTime;
    if (remaining <= 4 && remaining > 2) {
      // Compute next song
      const curIdx = songs.findIndex(s => s.id === currentSong.id);
      if (curIdx < 0) return;
      const nextIdx = (curIdx + 1) % songs.length;
      const nextSong = songs[nextIdx];
      if (!nextSong || !crossfadeRef.current) return;

      crossfadeActiveRef.current = true;
      const a = audioRef.current;
      const targetVol = playback.isMuted ? 0 : playback.volume;

      // 1. Fade out audioRef over remaining time (or skip if tab hidden)
      if (document.visibilityState === "hidden") {
        if (a) a.volume = 0; // immediate mute in background
      } else {
        const fadeStart = performance.now();
        const totalFadeMs = remaining * 1000;
        const doFadeOut = () => {
          const t = Math.min((performance.now() - fadeStart) / totalFadeMs, 1);
          if (a) a.volume = Math.max(0, targetVol * (1 - t));
          if (t < 1) requestAnimationFrame(doFadeOut);
        };
        requestAnimationFrame(doFadeOut);
      }

      // 2. Load next song into crossfadeRef in parallel
      (async () => {
        let playUrl = nextSong.url;
        if (!playUrl && nextSong.neteaseId) {
          try {
            const res = await fetch(`/api/netease-url/${nextSong.neteaseId}`);
            const data = await res.json();
            if (data.url) playUrl = data.url;
          } catch { crossfadeActiveRef.current = false; return; }
        }
        if (!playUrl || !crossfadeRef.current) { crossfadeActiveRef.current = false; return; }

        const cf = crossfadeRef.current;
        cf.src = playUrl;
        cf.volume = 0;
        cf.load();

        cf.oncanplaythrough = () => {
          cf.play().catch(() => {});
          // 3. Fade in crossfadeRef over 1.5s (or skip if tab hidden)
          if (document.visibilityState === "hidden") {
            // Tab hidden: hand off immediately, no animation
            if (a) {
              a.src = playUrl!;
              a.volume = targetVol;
              a.play().catch(() => {});
            }
            cf.pause(); cf.src = "";
            setCurrentSong({ ...nextSong, url: playUrl! });
            crossfadeHandledRef.current = true;
            crossfadeActiveRef.current = false;
            return;
          }
          const fiStart = performance.now();
          const doFadeIn = () => {
            const t = Math.min((performance.now() - fiStart) / 1500, 1);
            cf.volume = Math.max(0, Math.min(1, targetVol * t));
            if (t < 1) requestAnimationFrame(doFadeIn);
            else {
              // 4. Hand off: sync audioRef to new song
              const cfPos = cf.currentTime;
              if (a) {
                a.src = playUrl!;
                a.currentTime = cfPos;
                if (playback.isPlaying) a.play().catch(() => {});
              }
              cf.pause();
              cf.src = "";
              setCurrentSong({ ...nextSong, url: playUrl! });
              crossfadeHandledRef.current = true;
              crossfadeActiveRef.current = false;
            }
          };
          requestAnimationFrame(doFadeIn);
        };
      })();
    }
  }, [playback.currentTime]);

  // Fade-in on new song
  useEffect(() => {
    if (currentSong.isYouTube || !playback.isPlaying) return;
    const timer = setTimeout(() => fadeInSong(), 100);
    return () => clearTimeout(timer);
  }, [currentSong.id]);

  const handleSongEnded = () => {
    // Crossfade already handled the transition
    if (crossfadeActiveRef.current || crossfadeHandledRef.current) {
      crossfadeHandledRef.current = false;
      return;
    }
    isFadingRef.current = false;
    cancelAnimationFrame(fadeAnimRef.current);
    if (playback.repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        fadeInSong();
      }
    } else {
      handleNext();
    }
  };

  // Background audio keep-alive: browser throttles <audio> when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (playback.isPlaying && audioRef.current?.paused) {
          audioRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [playback.isPlaying]);

  // Periodic watchdog: re-check every 5s if audio was throttled by browser (only when tab hidden)
  useEffect(() => {
    if (!playback.isPlaying) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden" && audioRef.current?.paused) {
        audioRef.current.play().catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [playback.isPlaying]);

  // Swipe gesture handlers for Panel B cover carousel (slide-to-switch)
  const handleSwipeStart = (startX: number, startY: number) => {
    setSwipeState({ startX, startY, isDragging: true });
  };

  const handleSwipeMove = (currentX: number, currentY: number) => {
    if (!swipeState || !swipeState.isDragging) return;
    const diffX = currentX - swipeState.startX;
    const diffY = currentY - swipeState.startY;

    const threshold = 55; // 55px drag is the sweet spot for song switching gestures
    if (Math.abs(diffY) > threshold) {
      if (diffY < 0) {
        handleNext(); // drag up -> next track
      } else {
        handlePrev(); // drag down -> prev track
      }
      setSwipeState(null);
    } else if (Math.abs(diffX) > threshold) {
      if (diffX < 0) {
        handleNext(); // drag left -> next track
      } else {
        handlePrev(); // drag right -> prev track
      }
      setSwipeState(null);
    }
  };

  const handleSwipeEnd = () => {
    setSwipeState(null);
  };

  // Mouse wheel scroll handler for Panel B cover carousel (scroll-to-switch song)
  const handleCarouselWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Only trigger switch song if not currently on cooldown
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 650) {
      // Still in cooldown to ensure smooth animation frames and prevent spamming
      return;
    }

    const deltaY = e.deltaY;
    if (Math.abs(deltaY) < 10) return; // avoid tiny accidental scrolls

    if (deltaY > 0) {
      // Scroll down -> go to Next song (enters from bottom)
      handleNext();
      lastWheelTimeRef.current = now;
    } else {
      // Scroll up -> go to Prev song (enters from top)
      handlePrev();
      lastWheelTimeRef.current = now;
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

  // Workspace controls
  const handleWallpaperCycle = () => {
    setWallpaperIdx(prev => (prev + 1) % DESKTOP_WALLPAPERS.length);
  };

  const handleResetWidgetsPosition = () => {
    setPositions({
      player: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 - 435) : 20, y: 158 },
      synth: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 + 400) : 20, y: 390 },
      expanded: { x: window.innerWidth > 1080 ? (window.innerWidth / 2 + 115) : 20, y: 80 },
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

      {/* Primary Native Embedded Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleMetadataLoaded}
        onEnded={handleSongEnded}
        id="native-lofi-media"
      />

      {/* Hidden audio for auto-crossfade overlap */}
      <audio ref={crossfadeRef} style={{ display: "none" }} />

      {/* Decorative desktop background (clean and pristine) */}

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
       <motion.div
         id="hermedio-main-card"
         layout
         onMouseDown={(e) => handleMouseDown(e, "player")}
         animate={{
           opacity: viewMode === "player" ? 1 : 0,
           pointerEvents: viewMode === "player" ? "auto" : "none" as any
         }}
         transition={{ type: "spring", stiffness: 200, damping: 23 }}
         className={`absolute rounded-3xl shadow-2xl overflow-hidden flex flex-col select-none border hover:shadow-[0_25px_60px_rgba(0,0,0,0.22)] ${
           isDarkMode 
             ? "bg-[#161213]/95 border-[#cb4b51]/25 text-neutral-100" 
             : "glass-panel text-neutral-800"
         }`}
         style={{
           left: viewMode === "player"
             ? `${isExpandedCoverVisible ? positions.player.x : Math.max(0, (window.innerWidth - (isPlayerCollapsed ? 420 : 500)) / 2)}px`
             : "-9999px",
           top: viewMode === "player" ? `${positions.player.y}px` : "-9999px",
           zIndex: zIndices.player,
           width: isPlayerCollapsed ? "420px" : "500px",
           height: isPlayerCollapsed ? "148px" : "auto"
         }}
       >
        {/* Top Header fixed bar (Adaptive) */}
        <div className={`h-8 flex items-center justify-between px-4 cursor-default border-b ${
          isDarkMode ? "bg-neutral-900/40 border-neutral-800/40" : "bg-neutral-900/[0.04] border-neutral-200/20"
        }`}>
          {isPlayerCollapsed ? (
            <>
              <button
                onClick={() => {
                  togglePlayerCollapsed(false);
                }}
                className="text-[#cb4b51] hover:text-red-400 font-mono font-extrabold cursor-pointer transition uppercase tracking-wider text-[9px] focus:outline-none bg-transparent"
              >
                [ SHOW FULL ]
              </button>
              <span className="text-neutral-500 font-mono font-bold uppercase tracking-widest text-[9px]">CHILL</span>
              <div className="flex items-center gap-1 opacity-70">
                <span className="w-1.5 h-1.5 rounded-full bg-[#cb4b51] animate-pulse" />
                <span className="text-[8.5px] text-neutral-400 font-mono font-bold uppercase tracking-wider">COLLAPSED</span>
              </div>
            </>
          ) : (
            <>
              <button 
                onClick={() => setViewMode("library")} 
                className="flex items-center gap-1.5 hover:opacity-85 active:scale-95 transition focus:outline-none cursor-pointer bg-transparent border-none p-0"
                title="Open Music Library & Explorer Mode [2/3 Panel]"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
              </button>
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
            </>
          )}
        </div>        {/* Top Clock and DK/LT layout row (Retro Console Screen) */}
        <div className={`flex items-center gap-4.5 px-5 py-4 border-b shrink-0 ${
          isDarkMode ? "border-neutral-800 bg-[#0d090a]/80" : "border-neutral-200 bg-white/40"
        }`} id="retro-player-console-header">
          {/* Left: Little retro thumbnail frame */}
          <div className="flex flex-col items-center shrink-0">
            <div 
              onClick={() => {
                if (isPlayerCollapsed) {
                  togglePlayerCollapsed(false);
                }
              }}
              title="Show full player"
              className={`w-14 h-14 rounded-2xl overflow-hidden border p-0.5 shadow-md flex items-center justify-center cursor-pointer transition hover:scale-105 active:scale-95 duration-200 ${
                isPlayerCollapsed ? "bg-black border-neutral-850" : (isDarkMode ? "bg-black border-neutral-800 hover:border-[#cb4b51] shadow-lg shadow-[#cb4b51]/10" : "bg-neutral-100 border-neutral-300 hover:border-red-400 shadow-lg shadow-red-400/10")
              }`}
            >
              <img 
                src={currentSong.coverUrl} 
                alt="" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-[12px]" 
              />
            </div>
            {isPlayerCollapsed && (
              <div className="flex items-center gap-1 font-mono text-[8.5px] font-black uppercase text-neutral-500 mt-1.5 tracking-wider leading-none">
                <span className="text-[#cb4b51] font-bold">DK</span>
                <span className="opacity-40">|</span>
                <span>LT</span>
              </div>
            )}
          </div>

          {/* Center: Black dot-matrix LED screen */}
          <div className={`flex-1 flex items-center justify-between py-2 px-4 rounded-2xl border text-center shadow-inner ${
            isDarkMode 
              ? "bg-neutral-950/95 border-neutral-850/60 shadow-black" 
              : "bg-stone-50 border-neutral-200/50 shadow-stone-100"
          }`}>
            {/* Left: Lyrics button */}
            {!isPlayerCollapsed ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLyricsOpen(!isLyricsOpen);
                }}
                title="歌词 / Lyrics"
                className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-mono font-black transition cursor-pointer select-none focus:outline-none ${
                  isLyricsOpen
                    ? "bg-[#cb4b51]/20 text-[#cb4b51] border-[#cb4b51]/40"
                    : "bg-transparent text-neutral-500 border-neutral-700/40 hover:text-[#cb4b51] hover:border-[#cb4b51]/50"
                }`}
              >
                词
              </button>
            ) : (
              <div className="w-8 shrink-0" />
            )}

            {/* Central Clock & Spectrum */}
            <div className="flex-1 flex flex-col justify-center items-center">
              <span className="text-[8px] font-mono font-bold tracking-[0.25em] text-[#cb4b51] uppercase leading-none mb-1">
                {isPlayerCollapsed ? "CHILL STATS" : "CHILL ACTIVE SYSTEM"}
              </span>
              <div className={`text-4.5xl font-mono font-black tracking-widest leading-none my-0.5 ${
                isDarkMode ? "text-white drop-shadow-[0_0_8px_rgba(203,75,81,0.2)]" : "text-neutral-900"
              }`}>
                {timeString}
              </div>
              
              {/* Embedded Micro spectrum analyzer utilizing existing bar animation styles */}
              <div className="flex items-end justify-center gap-0.5 h-3.5 mt-1.5 pr-0.5" id="micro-console-spectrum bg-red">
                {[...Array(isPlayerCollapsed ? 12 : 16)].map((_, i) => {
                  const animClass = i % 3 === 0 ? "animate-bar-1" : i % 3 === 1 ? "animate-bar-2" : "animate-bar-3";
                  // Visualizer should only animate if actually playing (YouTube API provides this state)
                  const isVisualizing = playback.isPlaying;
                  
                  return (
                    <span
                      key={i}
                      className={`w-0.5 rounded-[1px] transition-all duration-[400ms] ${isVisualizing ? `${animClass} delay-[${i * 40}ms]` : "h-[2px]"}`}
                      style={{ 
                        backgroundColor: customAccentColor,
                        height: isVisualizing ? undefined : "2px"
                      }}
                    />
                  );
                })}
              </div>

              {!isPlayerCollapsed && (
                <div className={`text-[8.5px] font-mono tracking-[0.15em] uppercase font-bold mt-1 ${
                  isDarkMode ? "text-neutral-500" : "text-neutral-400"
                }`}>
                  {dateString}
                </div>
              )}
            </div>

            {/* Right: Repeat/Shuffle Switcher */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                cyclePlayMode();
              }}
              className={`w-10 h-10 rounded-full border flex flex-col items-center justify-center p-1 cursor-pointer transition uppercase hover:opacity-90 active:scale-95 focus:outline-none shrink-0 ${
                isDarkMode 
                  ? "bg-[#110b0c] border-[#cb4b51]/30 hover:border-[#cb4b51]/60 text-[#cb4b51]" 
                  : "bg-neutral-100 border-neutral-300 hover:border-neutral-400 text-neutral-700"
              }`}
              title="Toggle play mode: Loop All -> Repeat One -> Shuffle"
            >
              {playback.isShuffle ? (
                <Shuffle className={`w-3.5 h-3.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-600"}`} />
              ) : playback.repeatMode === "one" ? (
                <Repeat className="w-3.5 h-3.5 text-[#cb4b51] animate-pulse" />
              ) : (
                <Repeat className={`w-3.5 h-3.5 ${isDarkMode ? "text-neutral-200" : "text-neutral-800"}`} />
              )}
              <span className="text-[7px] font-mono font-extrabold mt-0.5 tracking-tight scale-90">
                {playback.isShuffle ? "SHUF" : playback.repeatMode === "one" ? "SGL" : "LOOP"}
              </span>
            </button>
          </div>

          {/* Right: Stacked switch console buttons */}
          <div className={`flex flex-col border rounded-xl overflow-hidden shrink-0 shadow-sm ${
            isDarkMode ? "border-neutral-800 bg-neutral-950" : "border-stone-200 bg-stone-50"
          }`}>
            <button 
              onClick={() => setIsDarkMode(true)} 
              title="Activate Dark Environment Mode"
              className={`text-[9.5px] font-mono font-black px-2.5 py-1.5 transition cursor-pointer flex items-center justify-center leading-none select-none focus:outline-none ${
                isDarkMode 
                  ? "text-white font-extrabold shadow-inner" 
                  : "text-neutral-400 hover:text-neutral-700"
              }`}
              style={{ backgroundColor: isDarkMode ? customAccentColor : "transparent" }}
            >
              DK
            </button>
            <button 
              onClick={() => setIsDarkMode(false)} 
              title="Activate Light Environment Mode"
              className={`text-[9.5px] font-mono font-black px-2.5 py-1.5 transition cursor-pointer flex items-center justify-center border-t leading-none select-none focus:outline-none ${
                isDarkMode 
                  ? "border-neutral-800 text-neutral-500 hover:text-neutral-300" 
                  : "border-stone-200 text-white font-extrabold shadow-inner"
              }`}
              style={{ 
                backgroundColor: !isDarkMode ? customAccentColor : "transparent"
              }}
            >
              LT
            </button>
          </div>
        </div>

        {/* Height-collapsible wrapper (Folds smoothly vertically) */}
        <motion.div
          initial={{ height: "auto", opacity: 1 }}
          animate={{
            height: isPlayerCollapsed ? 0 : "auto",
            opacity: isPlayerCollapsed ? 0 : 1
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className={`overflow-hidden flex flex-col ${isPlayerCollapsed ? "" : "flex-1"}`}
        >

        {/* Dynamic Compact Control strip section mimicking Image 1 perfectly */}
        <div className={`px-5 py-3 flex items-center justify-between gap-3.5 border-b select-none ${
          isDarkMode ? "bg-[#0b0809]/40 border-neutral-900" : "bg-[#ffffff]/30 border-neutral-200/40"
        }`} id="interactive-control-bar">
          {/* Left Details */}
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h3 className={`text-xs font-black truncate leading-tight tracking-wide ${isDarkMode ? "text-neutral-100" : "text-neutral-900"}`} title={currentSong.title}>
                {currentSong.title}
              </h3>
              <p 
                className="text-[9px] font-mono font-black uppercase tracking-widest mt-0.5 leading-none transition duration-500" 
                style={{ color: playback.isPlaying ? customAccentColor : "#737373" }}
              >
                {playback.isPlaying ? "PLAYING" : "PAUSED"}
              </p>
            </div>
            
            {/* Heart and caret dropdown grouping */}
            <div className="relative flex items-center shrink-0 mr-1">
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   setHeartDropdownOpen(prev => !prev);
                 }}
                 id="player-heart-caret"
                 title="更多收藏选项 / More Options"
                 className={`p-1.5 rounded-lg transition cursor-pointer select-none focus:outline-none flex items-center justify-center ${
                   heartDropdownOpen
                     ? "bg-[#cb4b51]/10 text-[#cb4b51]"
                     : isDarkMode ? "text-neutral-400 hover:text-white hover:bg-neutral-800/30" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/30"
                 }`}
               >
                 <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${heartDropdownOpen ? "rotate-180" : ""}`} />
               </button>

               {/* Heart button */}
               <button
                 onClick={() => {
                   const existsInLibrary = libraryTracks.some(t => t.title.toLowerCase() === currentSong.title.toLowerCase() && t.artist.toLowerCase() === currentSong.artist.toLowerCase());
                   if (!existsInLibrary) {
                     addSearchSongToLibrary(currentSong);
                   }
                   toggleFavorite(currentSong.id);
                 }}
                 id="player-heart-like"
                 title={(favoriteSongIds.includes(currentSong.id) || favoriteSongIds.includes(currentSong.title)) ? "Remove from Favorites" : "Add to Favorites"}
                 className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                   isDarkMode ? "hover:bg-neutral-800/30" : "hover:bg-neutral-200/30"
                 }`}
               >
                 <Heart className={`w-3.5 h-3.5 ${(favoriteSongIds.includes(currentSong.id) || favoriteSongIds.includes(currentSong.title)) ? "fill-red-500 text-red-500" : isDarkMode ? "text-neutral-400" : "text-neutral-500"}`} />
               </button>

               {/* Small floating Dropdown menu */}
               {heartDropdownOpen && (
                 <div className={`absolute top-full right-0 mt-1 w-36 py-1 rounded-xl shadow-xl z-[999] border text-[11px] font-mono select-none ${
                   isDarkMode ? "bg-neutral-900 border-neutral-800 text-neutral-200" : "bg-white border-neutral-200 text-neutral-800"
                 }`}>
                   <button
                     onClick={() => {
                       addArtistToFavorite(currentSong.artist, currentSong.coverUrl);
                       setHeartDropdownOpen(false);
                     }}
                     className={`w-full text-left px-3 py-1.5 transition leading-none flex items-center hover:bg-neutral-800/10`}
                   >
                     加入到喜欢的歌手
                   </button>
                   <button
                     onClick={() => {
                       addAlbumToFavorite(currentSong.album || "Collection", currentSong.artist, currentSong.coverUrl);
                       setHeartDropdownOpen(false);
                     }}
                     className={`w-full text-left px-3 py-1.5 transition leading-none flex items-center hover:bg-neutral-800/10 border-t ${
                       isDarkMode ? "border-neutral-800" : "border-neutral-100"
                     }`}
                   >
                     加入到喜欢的专辑
                   </button>
                 </div>
               )}
            </div>
          </div>

          {/* Right Controllers with high visual-fidelity */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Sleek full rounded Pill */}
            <div className={`rounded-full px-2.5 py-1 flex items-center gap-3 shadow-inner border transition-all ${
              isDarkMode ? "bg-black/70 border-neutral-850" : "bg-white/95 border-neutral-200"
            }`}>
              <button
                onClick={handlePrev}
                id="control-prev"
                title="Previous Track"
                className={`p-1 transition active:scale-75 cursor-pointer flex items-center justify-center ${
                  isDarkMode ? "text-neutral-400 hover:text-rose-500" : "text-neutral-600 hover:text-rose-600"
                }`}
              >
                <SkipBack className="w-3.5 h-3.5 fill-current" />
              </button>

              <button
                onClick={handlePlayPause}
                id="control-play-pause"
                title={playback.isPlaying ? "Pause" : "Play"}
                className="p-1 transition active:scale-75 cursor-pointer flex items-center justify-center text-rose-500"
              >
                {playback.isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                onClick={handleNext}
                id="control-next"
                title="Next Track"
                className={`p-1 transition active:scale-75 cursor-pointer flex items-center justify-center ${
                  isDarkMode ? "text-neutral-400 hover:text-rose-500" : "text-neutral-600 hover:text-rose-600"
                }`}
              >
                <SkipForward className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>

            {/* Circular Stop Button */}
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }
                setPlayback(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
              }}
              id="control-stop"
              title="Stop track playback"
              className={`w-7.5 h-7.5 rounded-full border flex items-center justify-center transition hover:scale-105 active:scale-90 cursor-pointer ${
                isDarkMode ? "bg-black/60 border-neutral-850 text-white" : "bg-white/95 border-neutral-200 text-neutral-800"
              }`}
            >
              <div className="w-2.5 h-2.5 bg-current rounded-sm" />
            </button>

             {/* Custom styled compact HIDE toggler */}
            <button
              onClick={() => {
                togglePlayerCollapsed(true);
              }}
              id="control-hide"
              title="Collapse/Minimize this player widget"
              className={`px-2.5 py-1 text-[9px] font-mono font-extrabold rounded-lg border tracking-wider transition cursor-pointer select-none focus:outline-none ${
                isDarkMode ? "bg-[#171112] border-neutral-800 text-neutral-300 hover:text-white" : "bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900"
              }`}
            >
              HIDE
            </button>

            {/* VOL and retro white custom volume range slider */}
            <div className="flex items-center gap-1.5 pl-0.5">
              <span className={`text-[9.5px] font-mono font-black ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>VOL</span>
              <input
                id="slider-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={playback.isMuted ? 0 : playback.volume}
                onChange={handleVolumeChange}
                className={`w-16 h-1 rounded appearance-none cursor-pointer outline-none transition duration-200 ${
                  isDarkMode
                    ? "bg-neutral-800 [&::-webkit-slider-thumb]:bg-white"
                    : "bg-stone-300 [&::-webkit-slider-thumb]:bg-neutral-800"
                } [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none`}
              />
            </div>
          </div>
        </div>

        {/* Playback Timeline container with Glowing White/Charcoal Playhead orb */}
        <div className={`px-5 py-3.5 flex items-center justify-between gap-3 border-b ${
          isDarkMode ? "bg-black/10 border-neutral-900" : "bg-stone-100/40 border-neutral-200/60"
        }`} id="playback-timeline-strip">
          <span className={`text-[10px] font-mono tracking-tight font-medium shrink-0 ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
            {formatTime(playback.currentTime)}
          </span>
          <div className="flex-1 px-1 relative flex items-center">
            {(() => {
              const duration = playback.duration || currentSong.duration || 100;
              const pct = (Number.isFinite(playback.currentTime) && Number.isFinite(duration) && duration > 0)
                ? (playback.currentTime / duration) * 100
                : 0;
              const trackBg = isDarkMode ? "#262626" : "#e4e7eb";
              return (
                <input
                  id="slider-seek"
                  type="range"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={playback.currentTime}
                  onChange={handleSeekChange}
                  onMouseDown={() => {
                    syncIsSeeking(true);
                  }}
                  onMouseUp={() => {
                    setTimeout(() => syncIsSeeking(false), 800);
                  }}
                  onTouchStart={() => {
                    syncIsSeeking(true);
                  }}
                  onTouchEnd={() => {
                    setTimeout(() => syncIsSeeking(false), 800);
                  }}
                  style={{
                    background: `linear-gradient(to right, ${customAccentColor} 0%, ${customAccentColor} ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`,
                    color: customAccentColor
                  }}
                  className="w-full h-1 my-2 rounded-lg appearance-none cursor-pointer outline-none relative hover:brightness-110 ml-0.5 transition-all
                    [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-lg
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[currentColor] 
                    [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.95),0_0_4px_rgba(0,0,0,0.18)] [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:-translate-y-[5px]
                    [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform
                    
                    [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-lg
                    [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full 
                    [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[currentColor] 
                    [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(255,255,255,0.95)] [&::-moz-range-thumb]:cursor-pointer"
                />
              );
            })()}
          </div>
          <span className={`text-[10px] font-mono tracking-tight font-bold shrink-0 ${isDarkMode ? "text-neutral-300" : "text-neutral-600"}`}>
            {formatTime(playback.duration || currentSong.duration)}
          </span>
        </div>

        {/* Song List view block */}
        <div className={`border-t flex flex-col overflow-hidden ${
          isDarkMode ? "bg-neutral-900/10 border-neutral-850/55" : "bg-neutral-50/50 border-neutral-200/50"
        }`}>
          <div className={`px-5 py-2 flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider border-b ${
            isDarkMode ? "bg-black/30 text-neutral-500 border-neutral-800/30" : "bg-neutral-150/40 text-neutral-400 border-neutral-200/30"
          }`}>
            <span>TRACK SELECTION LIST</span>
            <span>{songs.length} ITEMS</span>
          </div>

          <div className="overflow-y-auto no-scrollbar py-1 max-h-[210px]" id="tracklist-scroll-view">
            {songs.map((song, index) => {
              const isSelected = song.id === currentSong.id;
              
              return (
                <div
                  key={song.id}
                  draggable={true}
                  onDragStart={(e) => handlePlaylistDragStart(e, index)}
                  onDragOver={(e) => handlePlaylistDragOver(e, index)}
                  onDragEnd={handlePlaylistDragEnd}
                  onClick={() => {
                    setCurrentSong(song);
                    // Only start playing if explicitly clicked while already having a song or in library mode
                    setPlayback(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
                  }}
                  id={`track-item-${song.id}`}
                  className={`px-5 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing transition select-none relative ${
                    draggedSongIdx === index ? "bg-rose-500/10 opacity-50 border-t border-b border-rose-500/30" : ""
                  } ${
                    isSelected 
                      ? isDarkMode 
                        ? "bg-neutral-850/40 text-white" 
                        : "bg-stone-200/45 text-stone-900 shadow-sm" 
                      : isDarkMode 
                        ? "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/10" 
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-stone-100/30"
                  }`}
                  style={{ borderBottom: isDarkMode ? "1px solid rgba(255,255,255,0.03)" : "1px solid rgba(0,0,0,0.03)" }}
                >
                  {/* Left accent column bar on active item */}
                  {isSelected && (
                    <span 
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ backgroundColor: customAccentColor }}
                    />
                  )}
                  
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3 pointer-events-none">
                    <span className="w-5 font-mono text-[10px] text-neutral-500 font-semibold text-left">
                      {index + 1}
                    </span>
                    <span className={`text-[12px] truncate ${isSelected ? "font-bold text-rose-500" : "font-medium"}`}>
                      {song.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-wider text-right text-neutral-500">
                    <span className="truncate max-w-[130px]">{song.artist}</span>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSongFromQueue(e, song.id);
                      }}
                      id={`btn-delete-${song.id}`}
                      title="Delete track from queue"
                      className={`p-1 rounded transition cursor-pointer hover:bg-rose-500/10 text-neutral-500 hover:text-rose-500`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Musician Story Accordion Section */}
        <div className={`px-5 py-3 border-t border-b transition-colors ${
          isDarkMode ? "border-neutral-800 bg-black/15 text-neutral-350" : "border-neutral-200/50 bg-neutral-50/15 text-stone-655"
        }`}>
          <div className="flex items-center justify-between text-[10px] font-mono font-bold">
            <span className={`opacity-80 flex items-center gap-1.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-600"}`}>
              <span className="text-[#cb4b51] text-xs font-black">”</span>
              MUSICIAN STORY
            </span>
            <button
              onClick={() => setIsStoryExpanded(!isStoryExpanded)}
              className="hover:underline py-0.5 px-2 rounded hover:bg-neutral-500/10 flex items-center gap-1 transition cursor-pointer text-[9px] tracking-widest uppercase font-extrabold"
              style={{ color: customAccentColor }}
            >
              [ {isStoryExpanded ? "READ LESS" : "READ MORE"} ]
            </button>
          </div>
          
          <div className="mt-2 transition-all duration-300 overflow-hidden select-text leading-relaxed">
            <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-neutral-300" : "text-neutral-750 font-medium"}`}>
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

        {/* Player Bottom Footer — Talk to AI DJ */}
        <div
          onClick={() => {
            setIsTerminalOpen(!isTerminalOpen);
            setZIndices(prev => ({ ...prev, player: Math.max(...(Object.values(prev) as number[])) + 1 }));
          }}
          title="Talk to AI DJ — DeepSeek V4 Flash"
          className={`px-5 py-3 flex items-center justify-between text-[11px] border-t cursor-pointer transition duration-300 select-none ${
            isDarkMode
              ? "bg-black/40 border-neutral-800/60 text-neutral-400 hover:bg-neutral-800/25"
              : "bg-neutral-100/70 border-neutral-200 text-neutral-500 hover:bg-neutral-200/25"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold tracking-wider text-[#cb4b51] bg-[#cb4b51]/5 px-2 py-0.5 rounded-full border border-rose-500/10 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#cb4b51] inline-block animate-ping" />
              TALK TO AI DJ
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline opacity-55">
            [ CLICK TO TALK ]
          </span>
        </div>

        </motion.div>
      </motion.div>

      {/* ==================== AI DJ DIALOG OVERLAY ==================== */}
      <AnimatePresence>
        {isTerminalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            onClick={() => setIsTerminalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border ${
                isDarkMode
                  ? "bg-[#161213]/95 border-neutral-800/60"
                  : "bg-white/95 border-neutral-200"
              }`}
            >
              {/* Header */}
              <div className={`px-5 py-4 flex items-center justify-between border-b ${
                isDarkMode ? "border-neutral-800/60" : "border-neutral-200"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cb4b51] animate-pulse" />
                  <h3 className={`text-sm font-bold tracking-wide ${isDarkMode ? "text-neutral-100" : "text-neutral-800"}`}>
                    AI DJ · DeepSeek V4
                  </h3>
                </div>
                <button
                  onClick={() => setIsTerminalOpen(false)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                    isDarkMode ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat log */}
              <div
                ref={deepseekLogRef}
                className="overflow-y-auto no-scrollbar space-y-3 p-4 max-h-[50vh] text-[12px] leading-relaxed"
              >
                {deepseekMessages.map((msg, idx) => (
                  <div key={idx} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                      msg.role === "user"
                        ? (isDarkMode ? "bg-[#cb4b51]/20 text-rose-200 border border-rose-500/20" : "bg-rose-50 text-rose-700 border border-rose-200")
                        : (isDarkMode ? "bg-neutral-800/60 text-neutral-200 border border-neutral-700/50" : "bg-neutral-100 text-neutral-700 border border-neutral-200")
                    }`}>
                      <p className="text-[9px] font-bold mb-1 opacity-60">{msg.role === "user" ? "You" : "AI DJ"}</p>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isDeepseekTyping && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-2xl bg-neutral-800/40 text-neutral-400 text-[11px] animate-pulse">
                      AI DJ is thinking...
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleDeepseekSend} className={`flex gap-2 p-4 border-t ${
                isDarkMode ? "border-neutral-800/60" : "border-neutral-200"
              }`}>
                <input
                  type="text"
                  value={deepseekInput}
                  onChange={(e) => setDeepseekInput(e.target.value)}
                  disabled={isDeepseekTyping}
                  placeholder="说「放周杰伦的晴天」来听歌..."
                  className={`flex-1 text-xs px-4 py-2.5 rounded-xl border focus:outline-none transition select-text ${
                    isDarkMode
                      ? "bg-black/60 text-neutral-200 border-neutral-700 focus:border-[#cb4b51] placeholder-neutral-600"
                      : "bg-neutral-50 text-neutral-800 border-neutral-300 focus:border-rose-400 placeholder-neutral-400"
                  }`}
                />
                <button
                  type="submit"
                  disabled={isDeepseekTyping || !deepseekInput.trim()}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-[#cb4b51] hover:bg-[#b33f45] transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                >
                  Send
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== LYRICS OVERLAY PANEL (Apple Music Style) ==================== */}
      <AnimatePresence>
        {isLyricsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
            style={{ background: "rgba(0,0,0,0.92)" }}
            onClick={() => setIsLyricsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-8 w-full max-w-2xl px-8 max-h-[90vh]"
            >
              {/* Cover Art — smaller, elegant */}
              <div className="w-40 h-40 rounded-[28px] overflow-hidden shadow-2xl border border-white/10 shrink-0 mt-8">
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Song Info */}
              <div className="text-center">
                <h2 className="text-white text-xl font-bold tracking-wide">{currentSong.title}</h2>
                <p className="text-neutral-400 text-sm mt-1">{currentSong.artist}</p>
              </div>

              {/* Scrolling Lyrics — auto-scroll + click to seek */}
              <div className="flex-1 w-full overflow-hidden relative min-h-0 max-h-[40vh]">
                {/* Gradient fade masks */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/90 to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none" />

                <div
                  ref={(el) => {
                    if (el) {
                      // Auto-scroll active line into view
                      const active = el.querySelector(`[data-lyric-index="${currentLyricIndex}"]`);
                      if (active) active.scrollIntoView({ block: "center", behavior: "smooth" });
                    }
                  }}
                  className="h-full overflow-y-auto no-scrollbar py-[35vh]"
                >
                  {lyricLines.length === 0 ? (
                    <p className="text-neutral-500 text-center text-sm py-12">暂无歌词 / Loading lyrics...</p>
                  ) : (
                    lyricLines.map((line, i) => {
                      const isCurrent = i === currentLyricIndex;
                      return (
                        <div
                          key={i}
                          data-lyric-index={i}
                          onClick={() => {
                            if (audioRef.current && !currentSong.isYouTube) {
                              audioRef.current.currentTime = line.time;
                              setPlayback(prev => ({ ...prev, currentTime: line.time }));
                            }
                          }}
                          className={`text-center py-2.5 px-4 transition-all duration-500 cursor-pointer hover:opacity-80 ${
                            isCurrent ? "" : ""
                          }`}
                        >
                          <span className={`leading-relaxed transition-all duration-500 ${
                            isCurrent
                              ? "text-white text-xl font-bold"
                              : "text-neutral-500 text-base"
                          }`}>
                            {line.text || " "}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Close hint */}
              <p className="text-neutral-600 text-[10px] tracking-wider pb-4">
                点击空白处关闭 / CLICK TO CLOSE
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== PANEL B: VISUAL COZY SPOTLIGHT WINDOW (Enlarged Cover Carousel Stack) ==================== */}
      <motion.div
        id="hermedio-expanded-card"
        onWheel={handleCarouselWheel}
        onMouseDown={(e) => {
          // If clicking a grabber / drag handle, invoke widget dragging. Otherwise, track swipe gesture
          const target = e.target as HTMLElement;
          if (target.closest(".is-grabber") || target.closest(".drag-handle")) {
            handleMouseDown(e, "expanded");
          } else {
            handleSwipeStart(e.clientX, e.clientY);
          }
        }}
        onMouseMove={(e) => {
          if (swipeState) {
            handleSwipeMove(e.clientX, e.clientY);
          }
        }}
        onMouseUp={handleSwipeEnd}
        onMouseLeave={handleSwipeEnd}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          handleSwipeStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          handleSwipeMove(touch.clientX, touch.clientY);
        }}
        onTouchEnd={handleSwipeEnd}
        initial={{ opacity: 0, x: 40, scale: 0.95 }}
        animate={{
          opacity: (viewMode === "player" && isExpandedCoverVisible) ? 1 : 0,
          scale: (viewMode === "player" && isExpandedCoverVisible) ? 1 : 0.95,
          x: (viewMode === "player" && isExpandedCoverVisible) ? 0 : 30
        }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="absolute flex flex-col items-center justify-center select-none w-[320px] py-4"
        style={{
          left: (viewMode === "player" && isExpandedCoverVisible) ? `${positions.expanded.x}px` : "-9999px",
          top: (viewMode === "player" && isExpandedCoverVisible) ? `${positions.expanded.y}px` : "-9999px",
          zIndex: zIndices.expanded,
          pointerEvents: (viewMode === "player" && isExpandedCoverVisible) ? "auto" : "none"
        }}
      >
            <div className="flex flex-col items-center gap-5 w-full relative">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={currentSong.id}
                  initial={{ y: carouselDirection === "next" ? 100 : -100, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: carouselDirection === "next" ? -100 : 100, opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 220, damping: 25 }}
                  className="flex flex-col items-center gap-6 w-full"
                >
                  {/* 1. TOP COVER (Previous Song) - Smaller, blurred, translucent, and clickable */}
                  {songs.length > 0 && (() => {
                    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
                    const prevIdx = (currentIndex - 1 + songs.length) % songs.length;
                    const prevSong = songs[prevIdx];
                    return (
                      <button
                        onClick={() => {
                          setCarouselDirection("prev");
                          setCurrentSong(prevSong);
                          setPlayback(prev => ({ ...prev, isPlaying: true }));
                        }}
                        className="w-48 h-48 rounded-[24px] overflow-hidden opacity-40 blur-[2px] scale-[0.8] transition-all duration-300 hover:opacity-75 hover:blur-none hover:scale-[0.85] shadow-lg relative border border-white/5 cursor-pointer focus:outline-none"
                      >
                        <img 
                          src={prevSong.coverUrl} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    );
                  })()}

                  {/* 2. MIDDLE COVER (Current Active Song) - Large, sharp, custom smooth rounded-[32px] with title + artist overlay or YouTube MV */}
                  <div 
                    ref={mvContainerRef}
                    className="relative w-64 h-64 md:w-72 md:h-72 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 group select-none bg-neutral-900"
                  >
                    {/* Album cover */}
                    <div className="w-full h-full absolute inset-0 z-20">
                      {currentSong.coverUrl ? (
                        <>
                          <img
                            src={currentSong.coverUrl}
                            alt={currentSong.title}
                            className={`w-full h-full object-cover transition-transform duration-1000 ${playback.isPlaying ? "scale-105" : "scale-100"}`}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                           <Music className="w-16 h-16 text-neutral-600 opacity-20" />
                        </div>
                      )}

                      {/* Title / Artist Overlay */}
                      <div className="absolute inset-x-5 bottom-5 bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-center text-white select-none">
                        <h3 className="text-sm font-bold truncate leading-snug drop-shadow-md">{currentSong.title}</h3>
                        <p className="text-[10px] font-mono opacity-80 mt-1 uppercase tracking-widest leading-none drop-shadow-sm">{currentSong.artist}</p>
                      </div>

                      {/* Source badge */}
                      <span
                        className="absolute top-4 left-4 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold text-white tracking-widest shadow backdrop-blur-md border border-white/5"
                        style={{ backgroundColor: `${customAccentColor}cc` }}
                      >
                        ACTIVE
                      </span>
                    </div>
                  </div>

                  {/* 3. BOTTOM COVER (Next Song) - Smaller, blurred, translucent, and clickable */}
                  {songs.length > 0 && (() => {
                    const currentIndex = songs.findIndex(s => s.id === currentSong.id);
                    const nextIdx = (currentIndex + 1) % songs.length;
                    const nextSong = songs[nextIdx];
                    return (
                      <button
                        onClick={() => {
                          setCarouselDirection("next");
                          setCurrentSong(nextSong);
                          setPlayback(prev => ({ ...prev, isPlaying: true }));
                        }}
                        className="w-48 h-48 rounded-[24px] overflow-hidden opacity-40 blur-[2px] scale-[0.8] transition-all duration-300 hover:opacity-75 hover:blur-none hover:scale-[0.85] shadow-lg relative border border-white/5 cursor-pointer focus:outline-none"
                      >
                        <img 
                          src={nextSong.coverUrl} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

      {/* ==================== PANEL E: MUSIC LIBRARY EXPLORER (2/3 size centered display) ==================== */}
      <AnimatePresence>
        {viewMode === "library" && (
          <motion.div
            id="hermedio-library-card"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed inset-0 m-auto select-none rounded-[32px] shadow-2xl border flex flex-col z-[1000] backdrop-blur-3xl overflow-hidden ${
              isDarkMode 
                ? "bg-[#161213]/97 border-[#cb4b51]/25 text-neutral-100" 
                : "bg-white/95 border-neutral-200 text-neutral-800"
            }`}
            style={{
              width: "1060px",
              maxWidth: "94vw",
              height: "700px",
              maxHeight: "85vh",
            }}
          >
            {/* Window title bar header */}
            <div className={`h-11 flex items-center justify-between px-6 border-b shrink-0 ${
              isDarkMode ? "bg-neutral-900/60 border-neutral-800/40" : "bg-neutral-50 border-neutral-200/50"
            }`}>
              {/* Back to player triggering dots */}
              <button 
                onClick={() => setViewMode("player")} 
                className="flex items-center gap-1.5 hover:opacity-85 active:scale-95 transition focus:outline-none cursor-pointer p-0"
                title="Return to Classic Player Mode"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </button>

              <span className={`font-mono text-[10px] uppercase font-black tracking-[0.2em] ${
                isDarkMode ? "text-neutral-400" : "text-neutral-500"
              }`}>
                ✦ HERMEDIO CORE ARCHIVE & MUSIC MANAGER ✦
              </span>

              {/* DK / LT Toggle inside the manager */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono opacity-45 uppercase font-bold">Theme</span>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`text-[9px] font-mono font-black px-2.5 py-1 rounded-lg border transition cursor-pointer select-none leading-none focus:outline-none active:scale-95 uppercase ${
                    isDarkMode 
                      ? "bg-neutral-800 hover:bg-neutral-700 text-amber-400 border-neutral-700" 
                      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300"
                  }`}
                >
                  {isDarkMode ? "Dark / 深色" : "Light / 浅色"}
                </button>
              </div>
            </div>

            {/* Top Search bar utility row (播放器搜索功能移入此) */}
            <div className={`p-5 px-6 border-b shrink-0 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between ${
              isDarkMode ? "bg-black/20 border-neutral-850" : "bg-neutral-50/40 border-neutral-200"
            }`}>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-mono tracking-wider font-extrabold text-neutral-400">
                  SEARCH / 网易云音乐搜索
                </span>
              </div>

              {/* Search Form inside Library Card */}
              <div className="relative flex items-center w-full md:w-[480px] shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchSubmit(e as any);
                    }
                  }}
                  placeholder="搜索网易云音乐 — lofi, study, J-hop..."
                  className={`w-full text-xs font-mono pl-4 pr-10 py-3 rounded-2xl border focus:outline-none transition select-text ${
                    isDarkMode
                      ? "bg-[#0b0809] border-[rgba(203,75,81,0.25)] focus:border-[#cb4b51] text-neutral-200"
                      : "bg-white border-neutral-300 focus:border-rose-400 text-neutral-800"
                  }`}
                />
                {isSearching ? (
                  <span className="absolute right-4 w-4 h-4 border-2 border-dashed rounded-full animate-spin border-[#cb4b51]" />
                ) : (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      handleSearchSubmit(e as any);
                    }} 
                    className="absolute right-4 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Split layout: Left (1/3 Singer/Album), Right (2/3 Music List & AI Rec) */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              
              {/* Left Column Part (Occupy 1/3 workspace width) */}
              <div className={`w-1/3 border-r flex flex-col p-4 overflow-y-auto no-scrollbar gap-5 shrink-0 select-none ${
                isDarkMode ? "border-neutral-850 bg-black/5" : "border-neutral-200 bg-stone-50/30"
              }`}>
                {/* 我喜欢歌单 (My Favorites Playlist Section) */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase font-bold px-1">Playlists / 歌单</span>
                  <button
                    onClick={() => {
                      setShowFavoritesOnly(true);
                      setShowDailyRecommend(false);
                      setShowRadar(false);
                      setSelectedArtistId("");
                      setSelectedAlbumId("");
                      setShowSearchResults(false);
                      setShowListenedOnly(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition duration-200 cursor-pointer ${
                      showFavoritesOnly 
                        ? "bg-red-500/10 border-red-500/40 text-white shadow-[0_0_15px_rgba(239,68,68,0.1)] scale-[1.02]" 
                        : isDarkMode 
                          ? "bg-[#110b0c]/40 border-neutral-850 text-neutral-300 hover:bg-neutral-800/20 hover:border-neutral-700" 
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
                    } active:scale-95`}
                  >
                    <div className={`w-10 h-10 rounded-2xl overflow-hidden transition-all shrink-0 border ${
                      showFavoritesOnly
                        ? "border-red-500/40 rotate-6 ring-2 ring-red-500/20"
                        : isDarkMode ? "border-neutral-700" : "border-neutral-300"
                    }`}>
                      {(() => {
                        const lastId = favoriteSongIds[favoriteSongIds.length - 1];
                        const favTrack = lastId ? [...libraryTracks, ...songs].find(t => t.id === lastId || t.title === lastId) : null;
                        return favTrack?.coverUrl ? (
                          <img src={favTrack.coverUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <Heart className={`w-5 h-5 m-auto ${showFavoritesOnly ? "text-red-500 fill-red-500" : "text-neutral-400"}`} />
                        );
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12px] font-bold uppercase tracking-tight">我喜欢的音乐</h4>
                      <p className="text-[9px] font-mono text-neutral-500 uppercase mt-0.5">{favoriteSongIds.length} tracks liked</p>
                    </div>
                  </button>

                  {/* 每日推荐 */}
                  <button
                    onClick={() => {
                      if (dailySongs.length === 0) {
                        loadDailyRecommend();
                      } else if (showDailyRecommend) {
                        setShowDailyRecommend(false);
                      } else {
                        setShowDailyRecommend(true);
                        setShowFavoritesOnly(false);
                        setShowRadar(false);
                        setSelectedArtistId("");
                        setSelectedAlbumId("");
                        setShowSearchResults(false);
                        setShowListenedOnly(false);
                      }
                    }}
                    disabled={isLoadingDaily}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition duration-200 cursor-pointer ${
                      showDailyRecommend
                        ? "bg-amber-500/10 border-amber-500/40 text-white shadow-[0_0_15px_rgba(245,158,11,0.1)] scale-[1.02]"
                        : isDarkMode
                          ? "bg-[#110b0c]/40 border-neutral-850 text-neutral-300 hover:bg-neutral-800/20 hover:border-neutral-700"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
                    } active:scale-95`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                      showDailyRecommend ? "bg-amber-500/20 rotate-6" : isDarkMode ? "bg-neutral-905" : "bg-neutral-100"
                    }`}>
                      <Sparkles className={`w-5 h-5 ${showDailyRecommend ? "text-amber-400" : "text-neutral-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12px] font-bold uppercase tracking-tight">{isLoadingDaily ? "Loading..." : "每日推荐"}</h4>
                      <p className="text-[9px] font-mono text-neutral-500 uppercase mt-0.5">{dailySongs.length > 0 ? `${dailySongs.length} tracks` : "Daily Picks"}</p>
                    </div>
                  </button>
                  {/* 私人雷达 */}
                  <button
                    onClick={() => {
                      if (radarSongs.length === 0) {
                        loadRadar();
                      } else if (showRadar) {
                        setShowRadar(false);
                      } else {
                        setShowRadar(true);
                        setShowFavoritesOnly(false);
                        setShowDailyRecommend(false);
                        setSelectedArtistId("");
                        setSelectedAlbumId("");
                        setShowSearchResults(false);
                        setShowListenedOnly(false);
                      }
                    }}
                    disabled={isLoadingRadar}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition duration-200 cursor-pointer ${
                      showRadar
                        ? "bg-purple-500/10 border-purple-500/40 text-white shadow-[0_0_15px_rgba(126,87,194,0.1)] scale-[1.02]"
                        : isDarkMode
                          ? "bg-[#110b0c]/40 border-neutral-850 text-neutral-300 hover:bg-neutral-800/20 hover:border-neutral-700"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
                    } active:scale-95`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 overflow-hidden border ${
                      showRadar ? "border-purple-500/40 rotate-6 ring-2 ring-purple-500/20" : isDarkMode ? "border-neutral-700" : "border-neutral-300"
                    }`}>
                      {radarSongs.length > 0 ? (
                        <img src={radarSongs[0]?.coverUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12px] font-bold uppercase tracking-tight">{isLoadingRadar ? "Loading..." : "私人雷达"}</h4>
                      <p className="text-[9px] font-mono text-neutral-500 uppercase mt-0.5">{radarSongs.length > 0 ? `${radarSongs.length} tracks` : "Personal Radar"}</p>
                    </div>
                  </button>
                </div>

                {/* Singers block with scroll (从上往下为一排歌手都要有图片) */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase font-bold">Artists / Singers</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsArtistsExpanded(prev => !prev)}
                        className="text-[9px] font-mono text-neutral-400 hover:text-[#cb4b51] cursor-pointer uppercase font-black tracking-tight"
                      >
                        {isArtistsExpanded ? "[Collapse 折叠]" : "[Expand 展开]"}
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt("Enter custom Singer/Artist name (输入新歌手):");
                          if (name && name.trim()) {
                            const newArt = {
                              id: `art-dyn-${Date.now()}`,
                              name: name.trim(),
                              avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(name.trim())}/150/150`
                            };
                            setLibraryArtists(prev => [...prev, newArt]);
                          }
                        }}
                        className="text-[9px] font-mono hover:text-[#cb4b51] hover:underline cursor-pointer uppercase font-black"
                      >
                        [+ Add]
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll or Grid list of Circle avatars */}
                  <div 
                    ref={artistsScrollRef}
                    className={`flex ${
                      isArtistsExpanded 
                        ? "flex-wrap gap-4 justify-start max-h-[220px] overflow-y-auto no-scrollbar scroll-smooth p-1" 
                        : "gap-3 overflow-x-auto py-1.5 px-0.5 no-scrollbar scroll-smooth"
                    }`}
                  >
                    {libraryArtists.map((artist) => {
                      const isActive = selectedArtistId === artist.id && !showFavoritesOnly;
                      return (
                        <div
                          key={artist.id}
                          onClick={() => {
                            setSelectedArtistId(artist.id);
                            setSelectedAlbumId("");
                            setShowFavoritesOnly(false);
                            setShowDailyRecommend(false);
                            setShowRadar(false);
                            setShowSearchResults(false);
                            setShowListenedOnly(false);
                          }}
                          className={`flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group relative transition duration-350 ${
                            isActive ? "scale-105" : "hover:scale-[1.02]"
                          }`}
                          style={{ width: "76px" }}
                        >
                          {/* Circle Avatar Content */}
                          <div className={`w-14 h-14 rounded-full overflow-hidden border p-0.5 flex items-center justify-center transition-all ${
                            isActive 
                              ? `scale-105 ring-2 ring-[#cb4b51] shadow-lg` 
                              : `border-neutral-700/30 group-hover:border-neutral-500`
                          }`}>
                            <img
                              src={artist.avatarUrl}
                              alt={artist.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                          
                          {/* Inner Singer Title with Group Hover */}
                          <span className={`text-[9.5px] text-center font-mono truncate w-full tracking-tight ${
                            isActive ? "text-[#cb4b51] font-bold" : "text-neutral-400 group-hover:text-neutral-200"
                          }`}>
                            {artist.name}
                          </span>

                          {/* Hover Action to Delete Artist */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryArtists(prev => prev.filter(item => item.id !== artist.id));
                              if (selectedArtistId === artist.id) {
                                setSelectedArtistId("");
                              }
                            }}
                            className="absolute -top-1 right-0 w-5 h-5 bg-neutral-900 border border-neutral-800 text-red-400 hover:bg-red-600 hover:text-white rounded-full flex items-center justify-center text-[11px] font-extrabold shadow-md invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 active:scale-75 cursor-pointer z-20"
                            title="Delete Artist"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Album collections block with scroll (一排专辑都要有图片) */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase font-bold">Album Releases</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsAlbumsExpanded(prev => !prev)}
                        className="text-[9px] font-mono text-neutral-400 hover:text-[#cb4b51] cursor-pointer uppercase font-black tracking-tight"
                      >
                        {isAlbumsExpanded ? "[Collapse 折叠]" : "[Expand 展开]"}
                      </button>
                      <button
                        onClick={() => {
                          const title = prompt("Enter Album Title (输入新专辑):");
                          if (title && title.trim()) {
                            const artName = prompt("Enter Artist for this Album (输入歌手):") || "Unknown Artist";
                            const newAlb = {
                              id: `alb-dyn-${Date.now()}`,
                              title: title.trim(),
                              artist: artName.trim(),
                              coverUrl: `https://picsum.photos/seed/${encodeURIComponent(title.trim())}/300/300`
                            };
                            setLibraryAlbums(prev => [...prev, newAlb]);
                          }
                        }}
                        className="text-[9px] font-mono hover:text-[#cb4b51] hover:underline cursor-pointer uppercase font-black"
                      >
                        [+ Add]
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll or Grid list of Albums square images */}
                  <div 
                    ref={albumsScrollRef}
                    className={`flex ${
                      isAlbumsExpanded 
                        ? "flex-wrap gap-4 justify-start max-h-[220px] overflow-y-auto no-scrollbar scroll-smooth p-1" 
                        : "gap-3 overflow-x-auto py-1.5 px-0.5 no-scrollbar scroll-smooth"
                    }`}
                  >
                    {libraryAlbums.map((album) => {
                      const isActive = selectedAlbumId === album.id && !showFavoritesOnly;
                      return (
                        <div
                          key={album.id}
                          onClick={() => {
                            setSelectedAlbumId(album.id);
                            setSelectedArtistId("");
                            setShowFavoritesOnly(false);
                            setShowDailyRecommend(false);
                            setShowRadar(false);
                            setShowSearchResults(false);
                            setShowListenedOnly(false);
                          }}
                          className={`flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group relative transition duration-350 ${
                            isActive ? "scale-105" : "hover:scale-[1.02]"
                          }`}
                          style={{ width: "76px" }}
                        >
                          <div className={`w-14 h-14 rounded-2xl overflow-hidden border p-0.5 flex items-center justify-center transition-all ${
                            isActive 
                              ? `scale-105 ring-2 ring-[#cb4b51] shadow-lg` 
                              : `border-neutral-700/30 group-hover:border-neutral-500`
                          }`}>
                            <img
                              src={album.coverUrl}
                              alt={album.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-[10px]"
                            />
                          </div>
                          <span className={`text-[9.5px] font-mono truncate w-full text-center leading-none tracking-tight ${
                            isActive ? "text-[#cb4b51] font-bold" : "text-neutral-400 font-medium"
                          }`}>
                            {album.title}
                          </span>
                          <span className="text-[7.5px] text-neutral-500 font-mono truncate w-full text-center leading-none mt-0.5 uppercase">
                            {album.artist}
                          </span>

                          {/* Hover Action to Delete Album */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryAlbums(prev => prev.filter(item => item.id !== album.id));
                              if (selectedAlbumId === album.id) {
                                setSelectedAlbumId("");
                              }
                            }}
                            className="absolute -top-1 right-0 w-5 h-5 bg-neutral-900 border border-neutral-800 text-red-400 hover:bg-red-600 hover:text-white rounded-full flex items-center justify-center text-[11px] font-extrabold shadow-md invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 active:scale-75 cursor-pointer z-25"
                            title="Delete Album"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Queue status mini widget inside Library column */}
                <div className={`mt-auto p-4 rounded-2xl border text-center ${
                  isDarkMode ? "bg-black/40 border-neutral-850" : "bg-neutral-100/40 border-neutral-200"
                }`}>
                  <span className="text-[8px] font-mono text-neutral-400 uppercase tracking-widest font-black block mb-2">Active Queue Player</span>
                  <div className="flex items-center gap-3">
                    <img 
                      src={currentSong.coverUrl} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      className={`w-9 h-9 rounded-xl object-cover ring-1 ring-white/10 shrink-0 ${playback.isPlaying ? "animate-spin-slow" : ""}`} 
                    />
                    <div className="text-left flex-1 min-w-0">
                      <h4 className={`text-[10px] font-bold truncate uppercase ${isDarkMode ? "text-white" : "text-neutral-800"}`}>{currentSong.title}</h4>
                      <p className={`text-[8.5px] font-mono truncate mt-0.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>{currentSong.artist}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewMode("player")}
                    className="w-full mt-3 py-1.5 text-[9px] font-mono font-black border border-[#cb4b51]/35 rounded-xl text-[#cb4b51] hover:bg-[#cb4b51]/10 bg-transparent transition block uppercase"
                  >
                    Open Player Screen
                  </button>
                </div>
              </div>

              {/* Right Column Part (Occupy 2/3 workspace width) */}
              <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto no-scrollbar min-h-0 min-w-0">
                
                {/* Switch between: Search results OR Selected Artist/Album catalog */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {showSearchResults ? (
                    /* Search results overlay layout */
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800/20">
                        <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider font-bold">
                          Cloud Catalog Discovery Results ({searchResults.length} items)
                        </span>
                        <button
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery("");
                          }}
                          className="text-[10px] font-mono hover:text-[#cb4b51] hover:underline cursor-pointer uppercase font-bold text-neutral-500"
                        >
                          [Clear Results]
                        </button>
                      </div>

                      {/* Result Cards Grid list */}
                      <div className="flex-1 overflow-y-auto no-scrollbar pr-1 pt-3 space-y-2.5">
                        {searchResults.map((result, idx) => {
                          const isLiked = favoriteSongIds.some(fav => fav.toLowerCase() === result.title.toLowerCase());
                          return (
                            <div 
                              key={result.id}
                              className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition ${
                                isDarkMode 
                                  ? "bg-neutral-950/40 border-neutral-900 hover:border-[#cb4b51]/30 hover:bg-[#cb4b51]/5" 
                                  : "bg-white border-neutral-200 shadow-sm hover:border-rose-300 hover:bg-rose-50/10"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-[10px] font-mono text-neutral-500 font-bold w-4 text-center">{(idx + 1).toString().padStart(2, "0")}</span>
                                <img src={result.coverUrl} className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-inner" alt="" referrerPolicy="no-referrer" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-[11.5px] font-bold truncate uppercase">{result.title}</h4>
                                  <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 mt-0.5 min-w-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const artistName = result.artist;
                                        // Add artist to library
                                        addArtistToFavorite(artistName, result.coverUrl);
                                        // Find the newly added artist and navigate
                                        setLibraryArtists(prev => {
                                          const found = prev.find(a => a.name.toLowerCase() === artistName.toLowerCase());
                                          if (found) {
                                            setSelectedArtistId(found.id);
                                          }
                                          return prev;
                                        });
                                        setSelectedAlbumId("");
                                        setShowFavoritesOnly(false);
                                        setShowDailyRecommend(false);
                                        setShowRadar(false);
                                        setShowSearchResults(false);
                                      }}
                                      className="text-[#cb4b51] hover:underline cursor-pointer shrink-0 font-bold"
                                    >
                                      {result.artist}
                                    </button>
                                    <span className="text-neutral-500 shrink-0">•</span>
                                    <span className="text-neutral-500 truncate">{result.album}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons with Heart (Like) button */}
                              <div className="flex items-center gap-2 px-1 relative shrink-0">
                                {/* Inverted triangle dropdown button */}
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownResultId(activeDropdownResultId === result.id ? null : result.id);
                                    }}
                                    className="transition active:scale-75 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-800/10 text-neutral-500 hover:text-neutral-300 flex items-center justify-center"
                                    title="More Options"
                                  >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdownResultId === result.id ? "rotate-180 text-red-500" : ""}`} />
                                  </button>

                                  {/* Dropdown Menu */}
                                  {activeDropdownResultId === result.id && (
                                    <div 
                                      className={`absolute right-0 mt-1 w-44 rounded-xl shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
                                        isDarkMode 
                                          ? "bg-neutral-900 border-neutral-800 text-neutral-200" 
                                          : "bg-white border-neutral-200 text-neutral-800"
                                      }`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="py-1">
                                        <button
                                          onClick={() => {
                                            addArtistToFavorite(result.artist, result.coverUrl);
                                            setActiveDropdownResultId(null);
                                          }}
                                          className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 hover:bg-neutral-800/15 cursor-pointer transition ${
                                            isDarkMode ? "hover:text-white" : "hover:text-[#cb4b51]"
                                          }`}
                                        >
                                          <span className="text-[10px]">✨</span>
                                          <span>加入到喜欢的歌手</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            addAlbumToFavorite(result.album || "Collection", result.artist, result.coverUrl);
                                            setActiveDropdownResultId(null);
                                          }}
                                          className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 hover:bg-neutral-800/15 cursor-pointer transition border-t ${
                                            isDarkMode ? "border-neutral-800/50 hover:text-white" : "border-neutral-150 hover:text-[#cb4b51]"
                                          }`}
                                        >
                                          <span className="text-[10px]">💿</span>
                                          <span>加入到喜欢的专辑</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Heart Button */}
                                <button
                                  onClick={() => {
                                    // 1. Ensure the song is registered in libraryCatalog tracks so it can be shown under "我喜欢的音乐"歌单
                                    const existsInLibrary = libraryTracks.some(t => t.title.toLowerCase() === result.title.toLowerCase() && t.artist.toLowerCase() === result.artist.toLowerCase());
                                    if (!existsInLibrary) {
                                      addSearchSongToLibrary(result);
                                    }
                                    // 2. Toggle favorite by title
                                    toggleFavorite(result.title);
                                  }}
                                  className={`transition active:scale-75 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-800/10 ${
                                    isLiked ? "text-red-500 hover:text-red-400" : "text-neutral-500 hover:text-neutral-300"
                                  }`}
                                  title={isLiked ? "Remove Favorite" : "Add Favorite"}
                                >
                                  <Heart className={`w-4 h-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                                </button>

                                {/* PLAY NOW */}
                                <button
                                  onClick={() => {
                                    // Add song to playback songs registry queue without forcing it into Library collections
                                    setSongs(prev => {
                                      if (prev.some(s => s.title.toLowerCase() === result.title.toLowerCase() && s.artist.toLowerCase() === result.artist.toLowerCase())) return prev;
                                      return [...prev, result];
                                    });
                                    setCurrentSong(result);
                                    // Ensure it starts from 0 for NEW selection
                                    setPlayback(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
                                    showToast(`正在播放 "${result.title}"！收藏请点 [Save Collection]`);
                                  }}
                                  className="px-3 py-1.5 text-[10px] font-mono font-bold rounded-xl text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
                                  style={{ backgroundColor: customAccentColor }}
                                  id={`play-now-btn-${result.id}`}
                                >
                                  Play Now
                                </button>
                                <button
                                  onClick={() => {
                                    addSearchSongToLibrary(result);
                                    showToast(`已成功将 "${result.title}" 收藏至您的个人音乐库！`);
                                  }}
                                  className="px-3 py-1.5 text-[10px] font-mono font-bold rounded-xl border border-neutral-700/50 hover:border-[#cb4b51]/40 text-neutral-450 hover:text-white transition active:scale-95 cursor-pointer"
                                  id={`save-collection-btn-${result.id}`}
                                >
                                  Save Collection
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Display Selected Catalog detail list */
                    (() => {
                      const activeArtist = libraryArtists.find(a => a.id === selectedArtistId);
                      const activeAlbum = libraryAlbums.find(a => a.id === selectedAlbumId);
                      
                      let titleLabel = activeArtist ? activeArtist.name : (activeAlbum ? activeAlbum.title : "Library List");
                      let subtitleLabel = activeArtist ? "Artist Collections" : (activeAlbum ? `Album by ${activeAlbum.artist}` : "Tracks catalog");
                      let coverDisplay = activeArtist ? activeArtist.avatarUrl : (activeAlbum ? activeAlbum.coverUrl : PRELOADED_SONGS[0].coverUrl);
                      let filteredTracks = libraryTracks;

                      if (showRadar) {
                        titleLabel = "私人雷达";
                        subtitleLabel = "Personal Radar / 个性推荐";
                        coverDisplay = radarSongs[0]?.coverUrl || "https://images.unsplash.com/photo-1513829096960-ef025c643fac?w=150&auto=format&fit=crop&q=60";
                        filteredTracks = radarSongs;
                      } else if (showDailyRecommend) {
                        titleLabel = "每日推荐";
                        subtitleLabel = "Daily Recommendations / 网易云推荐";
                        coverDisplay = dailySongs[0]?.coverUrl || "https://images.unsplash.com/photo-1513829096960-ef025c643fac?w=150&auto=format&fit=crop&q=60";
                        filteredTracks = dailySongs;
                      } else if (showFavoritesOnly) {
                        titleLabel = "我喜欢的音乐";
                        subtitleLabel = "Loved Tracks / 个人歌单";
                        // Use cover of most recently liked song
                        const lastLikedId = favoriteSongIds[favoriteSongIds.length - 1];
                        const lastLikedTrack = lastLikedId
                          ? [...libraryTracks, ...songs].find(t => t.id === lastLikedId || t.title === lastLikedId)
                          : null;
                        coverDisplay = lastLikedTrack?.coverUrl
                          || songs[songs.length - 1]?.coverUrl
                          || "https://images.unsplash.com/photo-1513829096960-ef025c643fac?w=150&auto=format&fit=crop&q=60";
                        filteredTracks = libraryTracks.filter(track => favoriteSongIds.includes(track.id) || favoriteSongIds.includes(track.title));
                      } else {
                        filteredTracks = libraryTracks.filter(track => {
                          if (activeArtist) return track.artist.toLowerCase() === activeArtist.name.toLowerCase();
                          if (activeAlbum) return track.album.toLowerCase() === activeAlbum.title.toLowerCase();
                          return true;
                        });
                      }

                      // Filter by play history if enabled
                      if (showListenedOnly) {
                        filteredTracks = filteredTracks.filter(track => playedSongIds.includes(track.id) || playedSongIds.includes(track.title));
                      }

                      return (
                        <div className="flex-1 flex flex-col min-h-0 min-w-0">
                          {/* Banner Header for selected item */}
                          <div className={`p-4 rounded-3xl mb-4 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 shadow-sm ${
                            isDarkMode ? "bg-black/35 border-neutral-850" : "bg-neutral-100/30 border-neutral-200"
                          }`}>
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <img src={coverDisplay} className={`w-14 h-14 object-cover shadow border border-white/10 ${activeArtist ? "rounded-full" : "rounded-2xl"}`} alt="" referrerPolicy="no-referrer" />
                              <div className="min-w-0 flex-1">
                                <span className="text-[8.5px] font-mono uppercase tracking-widest text-neutral-400 font-black block">{subtitleLabel}</span>
                                <h3 className="text-lg font-bold truncate uppercase">{titleLabel}</h3>
                                <p className="text-[10px] font-mono text-neutral-400 mt-0.5 uppercase tracking-tight">{filteredTracks.length} catalog elements available</p>
                              </div>
                            </div>

                            {/* Controls block with custom listener switch and Play All */}
                            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                              {/* Toggle: All vs. Played */}
                              <div className={`flex p-0.5 rounded-2xl border text-xs select-none ${
                                isDarkMode ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-200/50 border-neutral-300"
                              }`}>
                                <button
                                  onClick={() => setShowListenedOnly(false)}
                                  className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-all rounded-xl cursor-pointer ${
                                    !showListenedOnly
                                      ? "bg-[#cb4b51] text-white shadow-sm"
                                      : "text-neutral-400 hover:text-neutral-200"
                                  }`}
                                >
                                  全部
                                </button>
                                <button
                                  onClick={() => setShowListenedOnly(true)}
                                  className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-all rounded-xl cursor-pointer ${
                                    showListenedOnly
                                      ? "bg-[#cb4b51] text-white shadow-sm"
                                      : "text-neutral-400 hover:text-neutral-200"
                                  }`}
                                >
                                  听过
                                </button>
                              </div>

                              {/* Play Entire selected list */}
                              {filteredTracks.length > 0 && (
                                <button
                                  onClick={() => {
                                    // Replace playlist with tracks
                                    setSongs(filteredTracks);
                                    setCurrentSong(filteredTracks[0]);
                                    setPlayback(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
                                  }}
                                  className="px-4 py-2 text-xs font-mono font-bold rounded-2xl text-white active:scale-95 transition flex items-center gap-1.5 shrink-0 hover:opacity-90 cursor-pointer shadow-md"
                                  style={{ backgroundColor: customAccentColor }}
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>PLAY ALL</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* List of filtered tracks */}
                          {filteredTracks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-800/40 rounded-3xl p-6 text-center select-none">
                              {showListenedOnly ? (
                                <History className="w-8 h-8 text-[#cb4b51] mb-2 animate-pulse" />
                              ) : showFavoritesOnly ? (
                                <Heart className="w-8 h-8 text-red-500 mb-2 animate-pulse" />
                              ) : (
                                <Music className="w-8 h-8 text-neutral-500 mb-2 animate-bounce" />
                              )}
                              <h4 className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">
                                {showListenedOnly 
                                  ? "No Played Selected History / 还没有听过" 
                                  : showFavoritesOnly 
                                    ? "No Favorite Tracks in List" 
                                    : "No Library Songs registered"}
                              </h4>
                              <p className="text-[10px] text-neutral-500 max-w-sm mt-1 font-mono">
                                {showListenedOnly 
                                  ? "您还没有在这个分类下播放过。快去点击听歌，记录属于您的私家播放历史吧！"
                                  : showFavoritesOnly 
                                    ? "Toggle the Heart icon next to any song in the playlist/catalog to build your ultimate personalized mixtape!"
                                    : "There are no songs uploaded under this artist/album yet. Try searching via YouTube and click \"Save Collection\"!"}
                              </p>
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
                              {filteredTracks.map((track, trackIdx) => {
                                const isCurrentPlaying = currentSong?.title === track.title;
                                const isLiked = favoriteSongIds.includes(track.id) || favoriteSongIds.includes(track.title);
                                return (
                                  <div
                                    key={track.id}
                                    className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl transition border ${
                                      isCurrentPlaying 
                                        ? "bg-[#cb4b51]/10 border-[#cb4b51]/35 shadow-sm shadow-[#cb4b51]/5" 
                                        : (isDarkMode ? "bg-[#110b0c]/30 border-neutral-900/60 hover:bg-neutral-900/40" : "bg-white border-neutral-200/50 hover:bg-stone-50")
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <span className={`text-[9.5px] font-mono font-extrabold w-4 text-center ${isCurrentPlaying ? "text-[#cb4b51]" : "text-neutral-500"}`}>
                                        {(trackIdx + 1).toString().padStart(2, "0")}
                                      </span>
                                      <img src={track.coverUrl} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-neutral-850/60" alt="" referrerPolicy="no-referrer" />
                                      <div className="min-w-0 flex-1">
                                        <h4 className={`text-[11.5px] font-bold truncate uppercase ${isCurrentPlaying ? "text-[#cb4b51]" : isDarkMode ? "text-neutral-200" : "text-neutral-800"}`}>{track.title}</h4>
                                        <p className={`text-[9.5px] font-mono truncate mt-0.5 ${isDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>{track.artist}</p>
                                      </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2.5 shrink-0">
                                      {/* Heart Button */}
                                      <button
                                        onClick={() => toggleFavorite(track.id)}
                                        className={`transition active:scale-75 cursor-pointer p-1 ${
                                          isLiked ? "text-red-500 hover:text-red-400" : "text-neutral-500 hover:text-neutral-300"
                                        }`}
                                        title={isLiked ? "Remove Favorite" : "Add Favorite"}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                                      </button>

                                      <button
                                        onClick={() => {
                                          // Force add to main playlist if absent, and play!
                                          setSongs(prev => {
                                            if (prev.some(s => s.title === track.title)) return prev;
                                            return [...prev, track];
                                          });
                                          setCurrentSong(track);
                                          setPlayback(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
                                        }}
                                        className="p-1 px-3 text-[9.5px] font-mono font-black border border-neutral-755 hover:border-neutral-500 hover:text-white transition rounded-xl active:scale-90 cursor-pointer uppercase"
                                      >
                                        Listen
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSongs(prev => {
                                            if (prev.some(s => s.title === track.title)) {
                                              return prev;
                                            }
                                            return [...prev, track];
                                          });
                                          showToast(`Added "${track.title}" to play queue!`);
                                        }}
                                        className="p-1 px-[#10px] text-[9.5px] font-mono font-black text-rose-500/80 border border-rose-500/15 hover:bg-rose-500/10 transition rounded-xl active:scale-90 cursor-pointer uppercase"
                                      >
                                        + Queue
                                      </button>
                                      <button
                                        onClick={() => {
                                          setLibraryTracks(prev => prev.filter(t => t.id !== track.id));
                                        }}
                                        title="Delete song from Library catalog"
                                        className="p-1 px-2 text-[9px] font-mono hover:text-[#cb4b51] transition rounded-lg hover:bg-neutral-800/20 active:scale-90 text-neutral-500"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* AI Rec Smart Discovery bottom strip (3. 让AI通过常听的歌推荐) */}
                <div className={`mt-4 p-4 rounded-3xl border shrink-0 flex flex-col gap-3 justify-stretch relative ${
                  isDarkMode 
                    ? "bg-gradient-to-tr from-neutral-950/90 to-neutral-900 border-[#cb4b51]/15" 
                    : "bg-gradient-to-tr from-stone-100/70 to-stone-50 border-neutral-300/40"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse animate-spin-slow" />
                      <span className={`text-[10px] font-mono uppercase tracking-widest font-black ${isDarkMode ? "text-white" : "text-neutral-800"}`}>
                        AI Cognitive Discovery Picks
                      </span>
                    </div>

                    {/* AI Recommander trigger */}
                    <button
                      onClick={async () => {
                        setIsRecommending(true);
                        try {
                          // Compile top played songs from counts map in local storage
                          const counts = JSON.parse(localStorage.getItem("hermedio_play_counts") || "{}");
                          const activeHistory = Object.entries(counts).map(([songId, val]) => {
                            const song = songs.find(s => s.id === songId) || libraryTracks.find(t => t.id === songId);
                            return {
                              title: song ? song.title : "Unknown Track",
                              artist: song ? song.artist : "Aesthetic Lounge",
                              count: val as number
                            };
                          });

                          const response = await fetch("/api/recommend-songs", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ history: activeHistory })
                          });

                          if (!response.ok) throw new Error("Recommendation endpoint failed");
                          const pickData = await response.json();
                          
                          // Feed recommended tracks into Library Tracks and display them!
                          setLibraryTracks(prev => {
                            const added = [...prev];
                            pickData.forEach((recItem: Song) => {
                              if (!added.some(s => s.title.toLowerCase() === recItem.title.toLowerCase())) {
                                added.push(recItem);
                              }
                            });
                            return added;
                          });

                          showToast(`AI Discovery successfully generated recommendations!`);
                        } catch (err) {
                           console.error(err);
                           showToast("AI Signal blurry, injecting chill tracks directly!");
                        } finally {
                          setIsRecommending(false);
                        }
                      }}
                      disabled={isRecommending}
                      className="px-3.5 py-1.5 text-[9px] font-mono tracking-wider font-extrabold rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-45 leading-none cursor-pointer flex items-center gap-1"
                    >
                      {isRecommending ? "Generating Picks..." : "⚡ GENERATE AI DISCOVERY"}
                    </button>
                  </div>

                  {/* AI context notice based on history */}
                  <div className="text-[9px] font-mono text-neutral-400 gap-1 leading-normal">
                    💡 <span className="text-neutral-500">The AI maps your frequency patterns by tracking play activity. Listen to more tracks in classic player mode to guide recommendations! Currently cataloged library tracks: {libraryTracks.length}</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="font-mono text-orange-600 font-bold">DeepSeek AI Chat Assistant:</span> Interact directly with model presets. Ready to connect DeepSeek v4 Flash for personalized study advice, chill session vibes, and music discovery tracks.
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
        isPlayingParent={playback.isPlaying}
      />

      {/* Dynamic Toast HUD Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-neutral-900/95 border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-md z-[9999] flex items-center gap-2.5 max-w-sm sm:max-w-md pointer-events-none text-xs font-mono tracking-wider font-semibold"
          >
            <Sparkles className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
            <span className="leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
