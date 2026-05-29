import { Song } from "./types";

// Import generated imagery
import featherArt from "./assets/images/lofi_feather_artwork_1779715461944.png";
import luvsicArt from "./assets/images/lofi_luvsic_artwork_1779715488914.png";
import meditationArt from "./assets/images/lofi_meditation_artwork_1779715506606.png";
import rebirthArt from "./assets/images/lofi_rebirth_artwork_1779715528477.png";
import nuvoleArt from "./assets/images/lofi_nuvole_artwork_1779715548162.png";

export const PRELOADED_SONGS: Song[] = [
  {
    id: "station-ready",
    title: "Station Offline",
    artist: "Hermedio DJ",
    album: "System",
    duration: 60,
    url: "",
    coverUrl: luvsicArt,
    isLocal: false,
    isYouTube: false,
    youtubeId: "",
    neteaseId: 1332676771,
    musicianStorySummary: "Station is ready. Search above to populate your cozy listening booth.",
    musicianBio: "Luv (sic) pt2 by Nujabes — free to play.",
    aiDetails: {
      story: "Soft loops drift through the midnight air, a gentle echo of lofi dreams.",
      lyrics: "[Nujabes - Luv (sic) pt2]\nFrequencies floating in the quiet night\nWarm vinyl crackles, everything's alright...",
      subgenre: "Jazz Hop",
      themeColor: "#cb4b51",
      tags: ["#nujabes", "#lofi", "#jazzhop"]
    }
  }
];

export const DESKTOP_WALLPAPERS = [
  "linear-gradient(135deg, #f5eae2 0%, #ecd5c5 50%, #dfbfad 100%)", // Warm Peach (matching the image)
  "linear-gradient(to right, #243b55, #141e30)", // Sleepy Blue Dusk
  "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)", // Retro Violet City
  "linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)", // Cozy Matcha Woods
  "linear-gradient(135deg, #eecda3 0%, #ef629f 100%)"  // Pastel Synthwave Sky
];
