import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodeFetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

// Load environment variables
dotenv.config();

// Proxy config for YouTube access
const PROXY_URL = process.env.HTTP_PROXY || "http://127.0.0.1:10909";
const httpsAgent = new HttpsProxyAgent(PROXY_URL);

// Proxied fetch helper
function pfetch(url: string, init?: any) {
  return nodeFetch(url, { ...init, agent: httpsAgent });
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

  // Music search via iTunes/Apple Music API (free, no auth required)
  app.get("/api/search-music", async (req, res) => {
    const { term, limit } = req.query;
    if (!term || typeof term !== "string") {
      res.status(400).json({ error: "Search term is required." });
      return;
    }

    try {
      const searchLimit = Math.min(Number(limit) || 15, 25);
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&limit=${searchLimit}&media=music&entity=song`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`iTunes API returned ${response.status}`);
      const data = await response.json();

      const songs = (data.results || []).map((item: any) => ({
        id: `itunes-${item.trackId}`,
        title: item.trackName || "Unknown Track",
        artist: item.artistName || "Unknown Artist",
        album: item.collectionName || "",
        duration: Math.round((item.trackTimeMillis || 240000) / 1000),
        url: item.previewUrl || "",
        coverUrl: item.artworkUrl100?.replace("100x100bb", "600x600bb") || "",
        hasPreview: !!item.previewUrl,
      }));

      res.json({ songs });
    } catch (error: any) {
      console.error("Music search error:", error);
      res.status(500).json({ error: "Failed to search music", songs: [] });
    }
  });

  // YouTube search via InnerTube API (through proxy)
  const YOUTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // YouTube Web API key

  app.get("/api/youtube/search", async (req, res) => {
    const { q, limit } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Query is required." });
      return;
    }

    try {
      const response = await pfetch(
        `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&key=${YOUTUBE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              client: { hl: "en", gl: "US", clientName: "WEB", clientVersion: "2.20250520.00.00" },
            },
            query: q,
            params: "EgWKAQIIAWoQEAEYBCADEAMQBRAKEAE%3D", // music filter
          }),
        }
      );

      const data: any = await response.json();
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

      const songs = contents
        .map((item: any) => item.videoRenderer)
        .filter(Boolean)
        .slice(0, Number(limit) || 15)
        .map((vr: any) => {
          const thumbUrl =
            vr.thumbnail?.thumbnails?.reverse()?.[0]?.url ||
            vr.thumbnail?.thumbnails?.[0]?.url ||
            "";
          return {
            id: `yt-${vr.videoId}`,
            title: vr.title?.runs?.[0]?.text || "Unknown",
            artist: vr.ownerText?.runs?.[0]?.text || "Unknown Artist",
            album: "",
            duration: vr.lengthText ? timeToSeconds(vr.lengthText.simpleText || "0:00") : 0,
            youtubeId: vr.videoId,
            coverUrl: thumbUrl,
            hasPreview: true,
          };
        });

      res.json({ songs });
    } catch (error: any) {
      console.error("YouTube search error:", error);
      res.status(500).json({ error: "YouTube search failed", songs: [] });
    }
  });

  // Convert "3:45" to seconds
  function timeToSeconds(t: string): number {
    const parts = t.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

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
