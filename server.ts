import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { cloudsearch, song_url_v1, recommend_songs, lyric_new, user_playlist, playlist_track_all, login_status } = require("NeteaseCloudMusicApi");

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Apply HTTP_PROXY via undici global dispatcher (works with native fetch)
if (process.env.HTTP_PROXY) {
  try {
    const agent = new ProxyAgent({ uri: process.env.HTTP_PROXY });
    setGlobalDispatcher(agent);
    console.log(`[Proxy] All external requests via ${process.env.HTTP_PROXY}`);
  } catch (e) {
    console.warn("[Proxy] Failed to set global proxy agent:", e);
  }
}

let aiClient: GoogleGenAI | null = null;
// Lazy initialize Gemini client to avoid crashes if API key is not yet set
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured or is the default placeholder.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to wrap a promise in a timeout to guarantee rapid responses
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallbackValue);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Helper to generate dynamic procedural lo-fi stories instantly as fallback or primary speed optimization
function getProceduralStories(title: string, artist: string, index: number) {
  const themeColors = ["#cb4b51", "#db8a35", "#3f51b5", "#10b981", "#7e57c2", "#e0536c"];
  const themeColor = themeColors[index % themeColors.length];
  
  let subgenre = "Late-Night Cozy Coffeehouse";
  let tags = ["#cozy_jazz", "#vintage_vinyl", "#midnight_beats"];
  
  const artistLower = artist.toLowerCase();
  const titleLower = title.toLowerCase();

  if (artistLower.includes("bigbang") || artistLower.includes("big bang") || artistLower.includes("g-dragon") || artistLower.includes("taeyang") || artistLower.includes("빅뱅")) {
    subgenre = "Seoul Dusty Boom Bap Rework";
    tags = ["#bigbang", "#yg_vintage", "#lofi_kpop"];
  } else if (artistLower.includes("jay") || artistLower.includes("chou") || artistLower.includes("周杰伦")) {
    subgenre = "Shibuya Crossing Piano Beats";
    tags = ["#周杰伦", "#oriental_hop", "#nostalgic_rhodes"];
  } else if (artistLower.includes("nujabes") || artistLower.includes("seba")) {
    subgenre = "Tokyo Sunset Jazz-Hop";
    tags = ["#nujabes", "#samurai_champloo", "#guitar_loop"];
  } else if (artistLower.includes("eason") || artistLower.includes("陈奕迅")) {
    subgenre = "Rainy Hong Kong Cantopop Lo-fi";
    tags = ["#陈奕迅", "#rainy_terminal", "#tape_crackle"];
  } else if (artistLower.includes("michael") || artistLower.includes("jackson")) {
    subgenre = "Vintage Motown Funky Hop";
    tags = ["#michael_jackson", "#retro_groove", "#dusty_fender"];
  } else if (titleLower.includes("lofi") || titleLower.includes("chill") || titleLower.includes("study") || titleLower.includes("rain")) {
    subgenre = "Cozy Bedroom Dusty Tapes";
    tags = ["#dusty_keys", "#study_escape", "#mellow_vibes"];
  }

  return {
    musicianStorySummary: `经典曲目《${title}》，由传奇音乐人 ${artist} 演绎。`,
    musicianBio: `本曲经由 Hermedio 核心网络重置为高保真流媒体。精良旋律与底噪白噪音完美交融，带给您别样的深夜感动。`,
    aiDetails: {
      story: `经典作《${title}》的迷人声音直接落入您的专属数字聆听舱。在复古滤镜下的温润霓虹里，沉浸于 ${artist} 触动人心的深层质感之中。`,
      lyrics: `《${title}》- 复古意境歌词\n[复古电钢琴独奏伴奏与温暖胶片底噪]\n窗外灯火阑珊，细雨敲打着窗棂\n旋律在黑胶唱机的转针里轻轻流淌\n温热的咖啡香与音符微光融为一体\n愿这舒缓的声音陪伴您度过惬意的时光...`,
      subgenre: subgenre,
      themeColor: themeColor,
      tags: tags
    }
  };
}

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const app = express();

  // JSON parsing middleware
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "alive", systemTime: new Date().toISOString() });
  });

  // AI Song analyzer using Gemini 3.5 Flash
  app.post("/api/analyze-song", async (req, res) => {
    const { title, artist, duration, filename } = req.body;

    if (!title) {
       res.status(400).json({ error: "Song title is required." });
       return;
    }

    try {
      const ai = getGemini();

      const prompt = `Analyze the song with title "${title}" ${artist ? `by artist "${artist}"` : ""}. 
      ${filename ? `(Originally uploaded as filename: "${filename}")` : ""}
      Provide a rich, highly elegant, poetic lofi music background description.
      Since the music player name is "hermedio" (built for J-pop/Jazz-hop vibes), frame your response as a cozy midnight coffee shop commentary.
      
      Generate details structured as JSON matching this format:
      - story: A gorgeous, deep description of the song's energy, vibe, and emotional resonance (approx 2-3 sentences).
      - lyrics: A snippet of 4-6 lines of evocative lyrics (with English translation if J-Pop, or poetic lines capturing the mood if Instrumental).
      - subgenre: A creative, refined subgenre name (e.g. "Rainy Coffee Chillhop", "Nostalgic J-Indie", "Late-Night Vinyl Jazz-Hop").
      - themeColor: A soft, mute aesthetic layout hex color code that fits this song's vibe (e.g. a soft sage green, warm terra cotta, mauve slate, amber twilight). Ensure high contrast against text!
      - tags: Array of 3-5 custom mood tags.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              story: { type: Type.STRING },
              lyrics: { type: Type.STRING },
              subgenre: { type: Type.STRING },
              themeColor: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["story", "lyrics", "subgenre", "themeColor", "tags"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response string returned from Gemini API");
      }

      const parsedData = JSON.parse(responseText.trim());
      res.json(parsedData);

    } catch (error: any) {
      console.error("Gemini API song analyzer error:", error);
      
      // Graceful offline fallback if Gemini is missing or fails
      // This ensures 100% stable execution
      const fallbackColor = title.toLowerCase().includes("feather") ? "#cb4b51" : "#5b6d7a";
      const fallbackTags = ["#aesthetic", "#chill", "#lofi", "#vintage"];
      
      res.json({
        story: `"${title}" has been loaded into hermedio's audio pipeline. Settle into the cozy lo-fi space, adjust your headphones, and let the soothing resonances take over your thoughts.`,
        lyrics: `[Instrumental Resonance / Poetic Whispers]\n...\nDancing in the gentle light\nWaves of sound soft and bright\nFinding peace within the night...`,
        subgenre: "Classic Cozy Chillhop",
        themeColor: fallbackColor,
        tags: fallbackTags,
        isFallback: true,
        errorMsg: error.message
      });
    }
  });

  // YouTube InnerTube search helper
  const YT_API_KEY = "AIzaSyAO_FJ2SlqU8QMeSTEy5DiEA1dPlrRs2LU";

  async function searchYouTube(query: string): Promise<any[]> {
    const body = JSON.stringify({
      context: {
        client: { clientName: "WEB", clientVersion: "2.20240101.00.00" }
      },
      query
    });

    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/search?key=${YT_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      throw new Error(`YouTube API returned status ${response.status}`);
    }

    const data: any = await response.json();
    const results: any[] = [];

    const sectionList = data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents || [];

    for (const section of sectionList) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item?.videoRenderer;
        if (vr?.videoId && results.length < 4) {
          // Parse duration: "MM:SS" or "H:MM:SS"
          const durText = vr.lengthText?.simpleText || "4:00";
          const durParts = durText.split(":").map(Number);
          let durationSecs = 240;
          if (durParts.length === 2) durationSecs = durParts[0] * 60 + durParts[1];
          else if (durParts.length === 3) durationSecs = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];

          let cleanTitle = (vr.title?.runs?.[0]?.text || "Untitled")
            .replace(/\[\s*(Official\s*Video|MV|Official\s*Music\s*Video|Lyrics?\s*Video|HD|Audio)\s*\]/gi, "")
            .replace(/\(\s*(Official\s*Video|MV|Official\s*Music\s*Video|Lyrics?\s*Video|HD|Audio)\s*\)/gi, "")
            .trim();

          results.push({
            id: `yt-${vr.videoId}`,
            youtubeId: vr.videoId,
            isYouTube: true,
            title: cleanTitle,
            artist: (vr.ownerText?.runs?.[0]?.text || "YouTube Creator")
              .replace(/(\s*-\s*Topic)/gi, "").trim(),
            album: "YouTube",
            duration: durationSecs,
            url: `https://www.youtube.com/watch?v=${vr.videoId}`,
            coverUrl: vr.thumbnail?.thumbnails?.[0]?.url
              || `https://picsum.photos/seed/${vr.videoId}/300/300`,
          });
        }
      }
      if (results.length >= 4) break;
    }

    return results;
  }

  // YouTube Search Endpoint
  app.post("/api/search-media", async (req, res) => {
    const { query, source } = req.body;

    if (!query) {
      res.status(400).json({ error: "Query is required." });
      return;
    }

    try {
      console.log(`[Search] Querying YouTube for: "${query}"`);
      const realVideoItems = await searchYouTube(query);

      if (realVideoItems.length === 0) {
        throw new Error("No YouTube results found.");
      }

      try {
        const ai = getGemini();
        const prompt = `You are a music discovery backend serving search requests for the "hermedio lo-fi room" music player.
        We searched YouTube for "${query}" and found these 4 real videos: ${JSON.stringify(realVideoItems)}.
        
        Generate matching lo-fi narrative metadata for each item.
        Keep the fields "id", "youtubeId", "isYouTube", "title", "artist", "album", "duration", "url", "coverUrl" exactly as provided.
        Your task is to enrich each item with beautiful, cozy, retro and narrative properties under the keys:
        - "musicianStorySummary" (poetic 1-sentence background)
        - "musicianBio" (poetic 2-sentence release story background)
        - "aiDetails" (object containing:
             * "story": "Poetic, relaxing coffee-shop commentary (2 sentences)"
             * "lyrics": "4-6 lines of beautifully fitting mood-matched lyrics or transcription"
             * "subgenre": "Refined subgenre name (e.g. Late-Night Tokyo Transit, Cozy Dusty Ambient, Shibuya-kei Beats)"
             * "themeColor": "Soft dark/mute hex color code e.g. #cb4b51, #3f51b5, #10b981"
             * "tags": ["array of 3 hashtags starting with #"]
          )

        Return the final output as a valid and complete JSON array of these 4 enriched objects. Do NOT wrapper markdown blocks, output pure JSON!`;

        const aiPromise = ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  youtubeId: { type: Type.STRING },
                  isYouTube: { type: Type.BOOLEAN },
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  album: { type: Type.STRING },
                  duration: { type: Type.INTEGER },
                  url: { type: Type.STRING },
                  coverUrl: { type: Type.STRING },
                  musicianStorySummary: { type: Type.STRING },
                  musicianBio: { type: Type.STRING },
                  aiDetails: {
                    type: Type.OBJECT,
                    properties: {
                      story: { type: Type.STRING },
                      lyrics: { type: Type.STRING },
                      subgenre: { type: Type.STRING },
                      themeColor: { type: Type.STRING },
                      tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      }
                    },
                    required: ["story", "lyrics", "subgenre", "themeColor", "tags"]
                  }
                },
                required: ["id", "youtubeId", "isYouTube", "title", "artist", "album", "duration", "url", "coverUrl", "musicianStorySummary", "musicianBio", "aiDetails"]
              }
            }
          }
        });

        // Strict 3.1s timeout on Gemini content enrichment for searches
        const response = await withTimeout(aiPromise, 3100, null);

        if (response) {
          const responseText = response.text;
          if (responseText) {
            const results = JSON.parse(responseText.trim());
            if (Array.isArray(results) && results.length > 0) {
              res.json(results);
              return;
            }
          }
        }
      } catch (aiErr) {
        console.warn("AI enrichment failed, utilizing standard cozy procedural generation for real YT videos", aiErr);
      }

      // Decoupled beautiful procedural fallback that still serves the REAL YouTube results!
      const proceduralResults = realVideoItems.map((item, idx) => {
        const themeColors = ["#cb4b51", "#db8a35", "#3f51b5", "#10b981", "#7e57c2"];
        const color = themeColors[idx % themeColors.length];
        return {
          ...item,
          musicianStorySummary: `A real recording discovered on YouTube matching "${query}".`,
          musicianBio: `Brought to you via YouTube Music Search. Enjoy high fidelity sound directly from the source. Recorded / released under licensed network.`,
          aiDetails: {
            story: `This customized lo-fi sequence maps the elegant frequencies of "${item.title}" from YouTube straight to your digital lounge.`,
            lyrics: `[Real Audio Played from YouTube]\nLet the music breathe soft and low\nWatching the shadows pass us by\nNo words are needed in this cozy space\nIn the reflection of a quiet screen...`,
            subgenre: "YouTube Real Discovery",
            themeColor: color,
            tags: ["#real_playback", "#youtube_dig", "#cozy_resonance"]
          }
        };
      });

      res.json(proceduralResults);

    } catch (error: any) {
      console.error("Gemini Platform search endpoint error:", error);
      
      // Beautiful robust offline search match generator
      const queryLower = query.toLowerCase();
      let responseResults = [];
      
      if (queryLower.includes("nujabes") || queryLower.includes("luv") || queryLower.includes("feather")) {
        responseResults = [
          {
            id: `search-offline-nujabes-1`,
            title: "Aruarian Dance",
            artist: "Nujabes",
            album: "Departure",
            duration: 250,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
            coverUrl: "https://picsum.photos/seed/aruarian/300/300",
            musicianStorySummary: "A masterpiece of lofi guitar loops echoing across a gentle retro sunset scenery.",
            musicianBio: "Recorded as part of the Samurai Champloo soundtrack. Uses a beautifully filtered Brazilian guitar sample, defining the soothing chill genre.",
            aiDetails: {
              story: "A serene track designed for high-altitude reflection. The acoustic chords pluck gently, wrapping the room in late evening warmth.",
              lyrics: "[Acoustic Masterpiece - Plucked Strings]\nDeep strings of fate, playing soft and slow\nFinding a calm in the river's flow\nLetting the noise of the world let go...",
              subgenre: "Samurai Jazz Acoustic",
              themeColor: "#db8a35",
              tags: ["#nujabes", "#samurai_champloo", "#acoustic_guitar", "#masterpiece"]
            }
          },
          {
            id: `search-offline-nujabes-2`,
            title: "Counting Stars",
            artist: "Nujabes",
            album: "Metaphorical Music",
            duration: 247,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
            coverUrl: "https://picsum.photos/seed/countingstars/300/300",
            musicianStorySummary: "Sparkling keyboard echoes and a warm underground boom bap loop sync into stellar alignment.",
            musicianBio: "Seba Jun's classic track from his 2003 debut. Embodies nostalgic late night vinyl vibes with soft, ticking high-hats.",
            aiDetails: {
              story: "Perfect for stargazing or quiet nighttime walking. This track feels like cold midnight wind meeting warm cafe steam.",
              lyrics: "Stars shining down on the dusty road\nLightening the heavy, weary load\nFrequencies glowing in the audio node...\nDancing with the echoes...",
              subgenre: "Astro Jazz-Hop",
              themeColor: "#7e57c2",
              tags: ["#counting_stars", "#metaphorical", "#midnight_keys", "#jazzhop"]
            }
          }
        ];
      } else {
        // General query match fallback
        responseResults = [
          {
            id: `search-offline-gen-1`,
            title: `${query.charAt(0).toUpperCase() + query.slice(1)} (Cozy Lounge Version)`,
            artist: "Hermedio Collective",
            album: "Midnight Sessions Vol. I",
            duration: 280,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
            coverUrl: `https://picsum.photos/seed/${encodeURIComponent(query)}/300/300`,
            musicianStorySummary: `A custom acoustic stream assembled instantly to sync with your search for "${query}".`,
            musicianBio: "Designed in our local workspace as a relaxing study escape track, keeping frequencies clean and warm.",
            aiDetails: {
              story: `This customized lo-fi sequence translates the mood of "${query}" into peaceful late-night vinyl crackles and Rhodes minor seventh chords.`,
              lyrics: "Soft whispers of rain on the tin roof\nTwo shadows dancing in the night\nNo words are needed, here is the proof\nOf things that are beautiful and bright...",
              subgenre: "Cozy Searched Chillhop",
              themeColor: "#cb4b51",
              tags: ["#chill", "#quiet_resonance", "#peaceful", "#search_matches"]
            }
          },
          {
            id: `search-offline-gen-2`,
            title: `Sunset over ${query.charAt(0).toUpperCase() + query.slice(1)}`,
            artist: "Tokyo Dusty Tapes",
            album: "Subway Shinkansen Chill",
            duration: 240,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            coverUrl: `https://picsum.photos/seed/${encodeURIComponent(query)}-sunset/300/300`,
            musicianStorySummary: "A warm vinyl beat depicting the passing cityscape of Tokyo through a dusty bullet-train window.",
            musicianBio: "Curated by J-Hop enthusiasts as an elegant blend of urban transit field sounds and organic jazz piano.",
            aiDetails: {
              story: "A golden-hour mood setter. Fuses street background soundscapes with comforting lo-fi chords.",
              lyrics: "[Field recordings of bullet trains & soft chatter]\nMelting colors in the western sky\nWatching the shadows pass us by\nNo need to ask or wonder why...",
              subgenre: "Tokyo Transit Chill",
              themeColor: "#db8a35",
              tags: ["#tokyo_dusty", "#metro_beat", "#field_record", "#lofi_transit"]
            }
          }
        ];
      }
      
      res.json(responseResults);
    }
  });

  // AI Archivist Assistant Chatbot
  app.post("/api/archivist-chat", async (req, res) => {
    const { message, artist, currentSong } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    try {
      const ai = getGemini();
      const prompt = `You are the Archivist Assistant, a helpful AI personnel interface built directly into the "hermedio" retro lo-fi audio player.
      You have deep, profound knowledge of J-Pop, jazz-hop, vintage vinyl culture, Shibuya-kei, and lofi hip-hop (especially artists like Nujabes, Shing02, J Dilla, DJ Okawari, and Digable Planets).
      
      Current playing song: "${currentSong || 'Unknown track'}" ${artist ? `by artist "${artist}"` : ""}.
      User query: "${message}"
      
      Keep your answer highly charming, cozy, poetic yet concise (approx 3-5 sentences maximum). Frame your answer as a vinyl record store clerk chatting with a customer on a rainy midnight close. Always maintain a warm, aesthetic tone.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Archivist Chatbot error:", error);
      
      // Beautiful offline fallback response depending on query
      const query = message.toLowerCase();
      let responseText = `[Archivist Offline Link Resolved] A quiet hum echoes through the terminal. `;
      
      if (query.includes("nujabes") || query.includes("seba")) {
        responseText += `The records tell us that Jun Seba (Nujabes) remains a pivotal pillar of jazzhop history. Founding Hydeout Productions, his soulful curation blends French impressions and jazz samples with golden-era boom bap. Truly, his spirit transcends time through 'Modal Soul'.`;
      } else if (query.includes("who are you") || query.includes("assistant") || query.includes("hermedio")) {
        responseText += `I am the hermedio Archivist, here to guide you through vintage records, lofi frequencies, and late night synth modulations. Ask me any thoughts wandering through your mind.`;
      } else {
        responseText += `Under the soft glow of the terminal lamp, I hear your query. Lofi music, much like water, forms a shape of whatever container it inhabits—be it tape crackle, piano walkdowns, or simple room rain. Keep exploring the frequencies of hermedio.`;
      }

      res.json({ text: responseText, isFallback: true });
    }
  });

  // AI Recommended Songs based on favorite tracks list
  app.post("/api/recommend-songs", async (req, res) => {
    const { history } = req.body;
    
    try {
      const ai = getGemini();
      const historySummary = Array.isArray(history) && history.length > 0 
        ? history.map(h => `"${h.title}" by ${h.artist} (played ${h.count} times)`).join(", ")
        : "None (pre-selections J-Jazz & lofi)";

      const prompt = `You are a music discovery guru and recommendation engine in the "hermedio lo-fi room" digital music workspace.
      The user's favorite list of songs is: ${historySummary}.
      
      Recommend 3 new, beautiful, cozy songs that perfectly match this taste (highly aligned with J-Jazz, Shibuya-kei, lo-fi, chillhop, Nujabes, or organic acoustic beats).
      For each song, provide fully functional mock streaming track properties with the following keys:
      - "id": A unique string starting with "recom-"
      - "title": Song title
      - "artist": Artist name
      - "album": Suggested retro album name
      - "duration": Estimated duration in seconds (integer, e.g. 210 to 320)
      - "url": Standard open audio file address. Specify one of these Safe Helix MP3 files to ensure perfect client streaming:
         * "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
         * "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
         * "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
         * "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"
         * "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
      - "coverUrl": Pure aesthetic illustration image URL. Recommend using beautiful free seeds e.g. "https://picsum.photos/seed/<seed>/300/300"
      - "musicianStorySummary": 1-sentence poetic explanation of why this song matches their listening history
      - "musicianBio": A short fictitious release backstory/record bio for this track
      - "aiDetails": An object mapping:
         * "story": "2 sentences describing the soothing soundscape of this recommendation"
         * "lyrics": "4 lines of poetry fitting the mood"
         * "subgenre": "Refined subgenre like 'Tokyo Dreamscape Jazz', 'Warm Vinyl Chillhop'"
         * "themeColor": "Soft aesthetic dark hex color code"
         * "tags": ["array of 3 hashtags starting with #"]

      Return the final output as a valid and complete JSON array of these 3 objects. Do NOT use markdown code blocks! Output pure JSON!`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                artist: { type: Type.STRING },
                album: { type: Type.STRING },
                duration: { type: Type.INTEGER },
                url: { type: Type.STRING },
                coverUrl: { type: Type.STRING },
                musicianStorySummary: { type: Type.STRING },
                musicianBio: { type: Type.STRING },
                aiDetails: {
                  type: Type.OBJECT,
                  properties: {
                    story: { type: Type.STRING },
                    lyrics: { type: Type.STRING },
                    subgenre: { type: Type.STRING },
                    themeColor: { type: Type.STRING },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["story", "lyrics", "subgenre", "themeColor", "tags"]
                }
              },
              required: ["id", "title", "artist", "album", "duration", "url", "coverUrl", "musicianStorySummary", "musicianBio", "aiDetails"]
            }
          }
        }
      });

      const responseText = response.text;
      if (responseText) {
        const results = JSON.parse(responseText.trim());
        if (Array.isArray(results) && results.length > 0) {
          res.json(results);
          return;
        }
      }
    } catch (err: any) {
      console.error("AI Recommendation failed:", err);
    }

    res.json([
      {
        id: "recom-1",
        title: "Late Night Sakura",
        artist: "Uyama Collective",
        album: "Shibuya Transit",
        duration: 254,
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        coverUrl: "https://picsum.photos/seed/sakuradream/300/300",
        musicianStorySummary: "A beautiful acoustic track blending traditional Japanese flute slides over slow-tempo boom bap loops.",
        musicianBio: "Inspired by Nujabes, this project features acoustic sessions recorded in Meguro under the cherry blossoms.",
        aiDetails: {
          story: "Soft flute layers and dusty vinyl hiss paint a peaceful spring midnight canvas. Perfectly continuous with your modal soul play list.",
          lyrics: "Petals fall under the quiet neon sky\nListening to the wind softly whisper by\nNo rush, let the world spin slow\nIn this midnight room, let the warm feelings grow...",
          subgenre: "Tokyo Nocturnal Chillhop",
          themeColor: "#cb4b51",
          tags: ["#shibuya", "#sakura_vibes", "#acoustic_lofi"]
        }
      },
      {
        id: "recom-2",
        title: "Amber Coffee Cup",
        artist: "Tokyo Study Beats",
        album: "Tokyo Transit",
        duration: 282,
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        coverUrl: "https://picsum.photos/seed/coffeehour/300/300",
        musicianStorySummary: "A nostalgic Rhodes-driven record designed to sync with late-night studies and coding sessions.",
        musicianBio: "A collaborative release collecting vintage Rhodes audio and quiet cafe background chatter.",
        aiDetails: {
          story: "Sweet Fender Rhodes electric piano notes float above a warm, driving bassline. Perfect background companion.",
          lyrics: "[Inspirational Instrumental Loop]\nRhodes keys echo soft and sweet\nRaindrops taps upon the street\nWarmest tea to keep you warm\nGuided safely through the storm...",
          subgenre: "Spiced Rhodes Chillhop",
          themeColor: "#db8a35",
          tags: ["#rhodes_keys", "#cafe_vibes", "#ambient_study"]
        }
      }
    ]);
  });

  // ==================== NetEase Cloud Music API ====================
  const neteaseHeaders: Record<string, string> = {
    "Referer": "https://music.163.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };
  if (process.env.NETEASE_COOKIE) {
    neteaseHeaders["Cookie"] = process.env.NETEASE_COOKIE;
    console.log("[NetEase] Using authenticated cookie for API requests");
  }

  // NetEase search — uses cloudsearch (same as Claudio, better relevance)
  app.get("/api/netease-search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: "Query parameter 'q' is required." });
      return;
    }

    try {
      console.log(`[NetEase] CloudSearch for: "${query}"`);
      const cookie = process.env.NETEASE_COOKIE || "";
      const result = await cloudsearch({ keywords: query, limit: 30, type: 1, cookie });

      if (result.status !== 200 || !result.body?.result?.songs) {
        res.json([]);
        return;
      }

      const songs = result.body.result.songs;

      const results = songs.map((s: any) => ({
        id: `ne-${s.id}`,
        neteaseId: s.id,
        title: s.name,
        artist: (s.ar || []).map((a: any) => a.name).join(", ") || "Unknown",
        album: (s.al || {}).name || "Single",
        duration: Math.round((s.dt || 240000) / 1000),
        coverUrl: ((s.al || {}).picUrl || "").replace(/^http:/, "https:"),
        url: "", // Will be resolved when played via song_url_v1
        isLocal: false,
        isYouTube: false,
        youtubeId: "",
        fee: s.fee,
        musicianStorySummary: (() => {
          const artist = (s.ar || []).map((a: any) => a.name).join(", ");
          const album = (s.al || {}).name || "";
          const name = s.name;
          if (album && artist) return `${artist} 在专辑《${album}》中演绎了这首《${name}》，以独特的音乐语言传递情感与力量。`;
          return `${artist} 演绎的《${name}》，一首值得反复聆听的佳作。`;
        })(),
        musicianBio: (() => {
          const artist = (s.ar || []).map((a: any) => a.name).join(", ");
          const album = (s.al || {}).name || "数字专辑";
          return `${artist} 的音乐创作融合了丰富的音乐元素，专辑《${album}》展现了他们在音乐道路上的探索与成长。`;
        })(),
        aiDetails: {
          story: `来自网易云音乐的高品质音频《${s.name}》。`,
          lyrics: `旋律在午夜的留声机里缓缓流淌\n温暖的和弦包裹着咖啡的香气...`,
          subgenre: "Cloud Music Stream",
          themeColor: "#cb4b51",
          tags: ["#netease", "#cloud_music", "#hifi_stream"]
        }
      }));

      res.json(results);
    } catch (error: any) {
      console.error("[NetEase] Search error:", error);
      res.json([]);
    }
  });

  // Fetch lyrics
  app.get("/api/lyric/:songId", async (req, res) => {
    const { songId } = req.params;
    try {
      const cookie = process.env.NETEASE_COOKIE || "";
      const result = await lyric_new({ id: songId, cookie });
      const lrc = result.body?.lrc?.lyric || result.body?.lyric || "";
      res.json({ lyric: lrc });
    } catch (e: any) {
      res.json({ lyric: "" });
    }
  });

  // Personal Radar — fetches user's actual 私人雷达 playlist from NetEase
  let cachedRadarId: string | null = null;

  app.get("/api/personal-radar", async (req, res) => {
    try {
      const cookie = process.env.NETEASE_COOKIE || "";

      // Find the 私人雷达 playlist if not cached
      if (!cachedRadarId) {
        console.log("[Radar] Getting user ID from cookie...");
        const loginRes = await login_status({ cookie });
        const uid = loginRes.body?.data?.account?.id || loginRes.body?.data?.profile?.userId;
        if (!uid) {
          console.log("[Radar] Could not get user ID from cookie");
          res.json([]); return;
        }
        console.log(`[Radar] Got UID: ${uid}, fetching playlists...`);

        const plResult = await user_playlist({ uid: String(uid), cookie, limit: 100 });

        if (plResult.status === 200 && plResult.body?.playlist) {
          const allPlaylists = plResult.body.playlist;
          console.log(`[Radar] Found ${allPlaylists.length} playlists`);
          const radar = allPlaylists.find((p: any) =>
            p.name?.includes("私人雷达") || p.name?.includes("雷达")
          );
          if (radar) {
            cachedRadarId = String(radar.id);
            console.log(`[Radar] Found: ${radar.name} (id=${cachedRadarId})`);
          } else {
            console.log("[Radar] No playlist matching '私人雷达' found. First 5:", allPlaylists.slice(0, 5).map((p: any) => p.name));
          }
        } else {
          console.log("[Radar] user_playlist failed:", plResult.status, JSON.stringify(plResult.body).substring(0, 200));
        }
      }

      if (!cachedRadarId) {
        res.json([]);
        return;
      }

      // Get tracks from the radar playlist
      const trackResult = await playlist_track_all({ id: cachedRadarId, cookie, limit: 30 });
      console.log(`[Radar] Tracks result: status=${trackResult.status}, songs=${trackResult.body?.songs?.length || 0}`);

      if (trackResult.status !== 200 || !trackResult.body?.songs) {
        res.json([]);
        return;
      }

      const songs = trackResult.body.songs;
      const results = songs.map((s: any) => ({
        id: `ne-${s.id}`,
        neteaseId: s.id,
        title: s.name,
        artist: (s.ar || []).map((a: any) => a.name).join(", ") || "Unknown",
        album: (s.al || {}).name || "Single",
        duration: Math.round((s.dt || 240000) / 1000),
        coverUrl: ((s.al || {}).picUrl || "").replace(/^http:/, "https:"),
        url: "",
        isLocal: false, isYouTube: false, youtubeId: "",
        musicianStorySummary: `私人雷达：${(s.ar || []).map((a: any) => a.name).join(", ")} 的《${s.name}》。`,
        musicianBio: `来自你的网易云「私人雷达」歌单。${(s.ar || []).map((a: any) => a.name).join(", ")} 演绎。`,
        aiDetails: {
          story: "私人雷达为你发现的新音乐。",
          lyrics: "旋律在午夜的留声机里缓缓流淌...",
          subgenre: "Personal Radar", themeColor: "#7e57c2",
          tags: ["#radar", "#personal", "#discovery"]
        }
      }));

      res.json(results);
    } catch (error: any) {
      console.error("[NetEase] Personal Radar error:", error);
      res.json([]);
    }
  });

  // Daily recommendations
  app.get("/api/daily-recommend", async (req, res) => {
    try {
      const cookie = process.env.NETEASE_COOKIE || "";
      const result = await recommend_songs({ cookie });

      if (result.status !== 200 || !result.body?.data?.dailySongs) {
        res.json([]);
        return;
      }

      const songs = result.body.data.dailySongs;
      const results = songs.map((s: any) => ({
        id: `ne-${s.id}`,
        neteaseId: s.id,
        title: s.name,
        artist: (s.ar || []).map((a: any) => a.name).join(", ") || "Unknown",
        album: (s.al || {}).name || "Single",
        duration: Math.round((s.dt || 240000) / 1000),
        coverUrl: ((s.al || {}).picUrl || "").replace(/^http:/, "https:"),
        url: "",
        isLocal: false, isYouTube: false, youtubeId: "",
        musicianStorySummary: (() => {
          const artist = (s.ar || []).map((a: any) => a.name).join(", ");
          const album = (s.al || {}).name || "";
          if (album) return `根据你的喜好为你推荐：${artist} 专辑《${album}》中的《${s.name}》。`;
          return `根据你的喜好为你推荐：${artist} 的《${s.name}》。`;
        })(),
        musicianBio: (() => {
          const artist = (s.ar || []).map((a: any) => a.name).join(", ");
          const album = (s.al || {}).name || "数字专辑";
          return `${artist} 的音乐创作融合了丰富的音乐元素，专辑《${album}》展现了他们在音乐道路上的探索。`;
        })(),
        aiDetails: {
          story: `来自你的每日推荐。`,
          lyrics: `旋律在午夜的留声机里缓缓流淌...`,
          subgenre: "Daily Pick", themeColor: "#cb4b51",
          tags: ["#daily", "#recommend", "#netease"]
        }
      }));

      res.json(results);
    } catch (error: any) {
      console.error("[NetEase] Daily recommend error:", error);
      res.json([]);
    }
  });

  // NetEase song URL — uses song_url_v1 (same as Claudio, supports VIP)
  app.get("/api/netease-url/:songId", async (req, res) => {
    const { songId } = req.params;
    if (!songId) {
      res.status(400).json({ error: "songId is required." });
      return;
    }

    try {
      console.log(`[NetEase] Getting URL for song ${songId}`);
      const cookie = process.env.NETEASE_COOKIE || "";

      let streamUrl: string | null = null;
      for (const level of ["exhigh", "higher", "standard"]) {
        const result = await song_url_v1({ id: [songId], level, cookie });
        if (result.status !== 200) continue;
        const songData = (result.body?.data || [])[0];
        if (songData?.url) {
          streamUrl = songData.url.replace(/^http:/, "https:");
          console.log(`[NetEase] Got URL level=${level}`);
          break;
        }
      }

      if (streamUrl) {
        res.json({ url: streamUrl });
      } else {
        res.json({ url: null, error: "No stream URL available" });
      }
    } catch (error: any) {
      console.error("[NetEase] URL error:", error);
      res.json({ url: null, error: error.message });
    }
  });

  // DeepSeek Chat Console API Proxy
  app.post("/api/deepseek", async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Messages array is required." });
      return;
    }

    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DEEPSEEK_API_KEY is not configured on the server.");
      }
      console.log(`[DeepSeek API] Forwarding ${messages.length} messages to DeepSeek Chat API...`);

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`DeepSeek API responded with status ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error("No completion returned in choices from DeepSeek API.");
      }

      res.json({ text: reply });
    } catch (error: any) {
      console.error("Deepseek proxy server endpoint error:", error);
      
      // Return details for diagnostic transparency, while keeping the client happy and resilient
      res.json({ 
        text: `[DeepSeek Signal Recipient] DeepSeek v4 Flash is alive but having connection difficulty. Feel the slow acoustic strings of Shibuya-kei and continue enjoying this space. (Details: ${error.message})`,
        isFallback: true
      });
    }
  });

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`hermedio server running on port ${PORT}`);
  });
}

startServer();
