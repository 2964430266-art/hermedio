import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function testModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;

  const ai = new GoogleGenAI({ apiKey: key });
  try {
    console.log("Sending prompt to gemini-3.5-flash...");
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
    );

    const geminiPromise = ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello, say 'API is working'!"
    });

    const response: any = await Promise.race([geminiPromise, timeoutPromise]);
    console.log(`Success! Response: ${response.text}`);
  } catch (err: any) {
    console.error("Gemini failed for gemini-3.5-flash:", err.message);
  }
}

testModel();
