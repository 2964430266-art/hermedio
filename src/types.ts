export interface AIDetails {
  story: string;
  lyrics: string;
  subgenre: string;
  themeColor: string;
  tags: string[];
  isFallback?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  url: string; // URL or static endpoint or object URL
  coverUrl: string; // URL or base64 image
  isLocal: boolean;
  fileName?: string;
  aiDetails?: AIDetails;
  musicianBio?: string;
  musicianStorySummary?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
}

export interface DesktopWidget {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  zIndex: number;
}
