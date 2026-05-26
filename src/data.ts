import { Song } from "./types";

// Import generated imagery
import featherArt from "./assets/images/lofi_feather_artwork_1779715461944.png";
import luvsicArt from "./assets/images/lofi_luvsic_artwork_1779715488914.png";
import meditationArt from "./assets/images/lofi_meditation_artwork_1779715506606.png";
import rebirthArt from "./assets/images/lofi_rebirth_artwork_1779715528477.png";
import nuvoleArt from "./assets/images/lofi_nuvole_artwork_1779715548162.png";

export const PRELOADED_SONGS: Song[] = [
  {
    id: "preloaded-1",
    title: "Feather (feat. Cise Star & Akin)",
    artist: "Nujabes",
    album: "Modal Soul",
    duration: 390,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    coverUrl: featherArt,
    isLocal: false,
    musicianStorySummary: "Nujabes: Part of the iconic six-part collaboration with Shing02, this track blends melancholic strings and boom-bap drums into one of the most emotional classics in jazz-infused hip hop.",
    musicianBio: "Jun Seba, better known as Nujabes, was a Japanese record producer, DJ, composer and arranger. He was the founder of the independent label Hydeout Productions and released two studio albums: Metaphorical Music (2003) and Modal Soul (2005). Nujabes is famous for his organic integration of cool jazz loops, melancholic piano compositions, and late-night boom bap drum patterns.",
    aiDetails: {
      story: "A cornerstone of the jazzhop subgenre, 'Feather' fuses a sublime, hypnotizing acoustic piano sample with Cise Star and Akin's velvet flow. The lyrics ponder life, cosmic connections, and poetic truth in classic organic hip-hop style.",
      lyrics: "I'm floating away like a feather in the breeze\nTracing out paths through the canopy of trees\nMind in the stars while my boots are on the street\nFinding a rhythm where the sky and concrete meet...\nLet the ink spill on the parchment of the night.",
      subgenre: "Spiritual Jazz-Hop",
      themeColor: "#cb4b51", // crimson accent
      tags: ["#nujabes", "#jazzhop", "#modal_soul", "#warm_rhodes"]
    }
  },
  {
    id: "preloaded-2",
    title: "Luv(sic) (part3) (feat. Shing02)",
    artist: "Nujabes",
    album: "Modal Soul",
    duration: 352,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    coverUrl: luvsicArt,
    isLocal: false,
    musicianStorySummary: "Shing02 & Nujabes: An enduring anthem of the underground J-rap movement. Speaks of love, digital music curation, and cosmic memory systems as an absolute medicine for active minds.",
    musicianBio: "Shing02 (Shingo Annen) is a Japanese-American hip hop MC and producer, born in Tokyo and prominent in the West Coast independent scene. His collaboration with Nujabes produced the celebrated Luv(sic) hexalogy. He writes bilingual poetry reflecting philosophy, social issues, and deeply nostalgic audio connections.",
    aiDetails: {
      story: "The third movement of the legendary Luv(sic) saga. It explores a heartwarming message of music as a universal medicine. The warm vinyl crackle and vintage synth chords paint a comforting sanctuary for late-night thinkers.",
      lyrics: "L.U.V. sic, from the heart, written in the stars\nMusic is the remedy for healing all our scars\nThrough the summer solstice and the winter snow\nKeep the needle on the record, let the energy flow...\nSpeak your truths with the language of the soul.",
      subgenre: "Poetic Lofi Hip-Hop",
      themeColor: "#db8a35", // warm sunset orange
      tags: ["#shing02", "#underground_rap", "#nostalgic_keys", "#tape_hiss"]
    }
  },
  {
    id: "preloaded-3",
    title: "Electric Meditation",
    artist: "Hermedio Lounge",
    album: "Synthetic Zen",
    duration: 302,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    coverUrl: meditationArt,
    isLocal: false,
    musicianStorySummary: "Hermedio Studio: Curated synth wave crafted internally by the hermedio system to showcase live lowpass filtering, echo loops, and soft procedural atmospheric rain cascading.",
    musicianBio: "Hermedio Lounge is an immersive digital project compiling real-time generative synthesizers, binaural wave mixes, and field recordings. Designed as a playground for virtual background listening.",
    aiDetails: {
      story: "A peaceful ambient electronic suite designed for inner equilibrium. Sub-bass vibrations rumble gently under sparkling delay loops and gentle cascading raindrops, creating an immersive cybernetic garden room vibe.",
      lyrics: "Silence speaks louder than a thousand electric voices\nDisconnect the wire, let the signal wash away\nBreathe in the digital air, breathe out the noisy choices\nWhere the neon current pools, the tranquil reflections play...\n[Warm hums of organic filters]",
      subgenre: "Cyber Ambient Meditation",
      themeColor: "#7e57c2", // deep dreamy violet
      tags: ["#cyber_zen", "#rain_relax", "#analog_synth", "#sleep_waves"]
    }
  },
  {
    id: "preloaded-4",
    title: "Rebirth of Slick (Cool Like Dat)",
    artist: "Digable Planets",
    album: "Reachin'",
    duration: 261,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    coverUrl: rebirthArt,
    isLocal: false,
    musicianStorySummary: "Digable Planets: The Grammy-winning gold standard of jazz-rap. Blends Art Blakey and Sonny Rollins double-bass walks into a smoky, finger-snapping Brooklyn coffeehouse atmosphere.",
    musicianBio: "Digable Planets is an American alternative hip hop trio formed in 1987 in Brooklyn, New York. The group is composed of Ishmael Butler ('Butterfly'), Mariana Vieira ('Ladybug Mecca'), and Craig Irving ('Doodlebug'). They pioneered jazz-sampling in rap, creating lush, stylish, and politically conscious retro-future soundscapes.",
    aiDetails: {
      story: "The direct connection between classic bebop jazz and golden-era hop. Driven by an infectious double-bass walk, finger snaps, and smoky trumpet stabs, this track defining 'coolness' in a crowded room.",
      lyrics: "We be reading street rhythms under glowing streetlights\nSnapping these fingers, we be chillin' through the nights\nCool like dat, we be cool like dat, yeah\nDrop a saxophone line of the premium vintage grade...\nComfort in the smoke and the soft yellow shades.",
      subgenre: "Bebop Lounge Jazz-Hop",
      themeColor: "#4caf50", // classy jade green
      tags: ["#double_bass", "#cool_jazz", "#vintage_rap", "#90s_flows"]
    }
  },
  {
    id: "preloaded-5",
    title: "Nuvole Bianche",
    artist: "Ludovico Einaudi",
    album: "Una Mattina",
    duration: 357,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    coverUrl: nuvoleArt,
    isLocal: false,
    musicianStorySummary: "Ludovico Einaudi: A soaring modern classical movement. The gentle cascading piano chords evoke high-altitude introspection and timeless memories.",
    musicianBio: "Ludovico Maria Enrico Einaudi is an Italian pianist and composer. Trained at the Conservatorio Verdi in Milan, he has composed scores for numerous films and trailers. His music is ambient, meditative, and minimalist.",
    aiDetails: {
      story: "Meaning 'White Clouds', this neo-classical piano masterpiece slowly rises and falls like distant memory waves. Its repetitive, melancholic chord progression sweeps readers into a deeply introspective state.",
      lyrics: "[Pure Instrumental Masterpiece]\nFloating above the clouds, free from gravity's hold\nEvery soft keystroke is a story waiting to unfold\nLet the silent spaces speak of things left untold\n...\n[A beautiful, heartrending piano cadence resolves]",
      subgenre: "Emotional Neo-Classical Piano",
      themeColor: "#00acc1", // ocean cyan slate
      tags: ["#piano_solo", "#melancholic", "#white_clouds", "#introspection"]
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
