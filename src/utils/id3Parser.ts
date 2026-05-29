export interface ParsedMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
}

/**
 * Highly efficient client-side chunk-based ID3 tag parser.
 * Reads only the first 1MB of the audio file to instantly capture metadata safely and without lag.
 */
export async function parseLocalAudioMetadata(file: File): Promise<ParsedMetadata> {
  const defaultTitle = file.name.replace(/\.[^/.]+$/, ""); // strip extension
  
  // Try to parse Artist - Title from filename if possible
  let guessedArtist = "Unknown Artist";
  let guessedTitle = defaultTitle;
  const parts = defaultTitle.split("-");
  if (parts.length > 1) {
    guessedArtist = parts[0].trim();
    guessedTitle = parts.slice(1).join("-").trim();
  }

  const defaultMeta: ParsedMetadata = {
    title: guessedTitle,
    artist: guessedArtist,
    album: "Local Audio File",
    coverUrl: null
  };

  // Only attempt ID3 parsing for MP3 files
  if (!file.name.toLowerCase().endsWith(".mp3")) {
    return defaultMeta;
  }

  try {
    // Read only the first 256KB to keep it fast
    const headerSlice = file.slice(0, 256 * 1024);
    const arrayBuffer = await headerSlice.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Verify ID3v2 signature "ID3" (0x49, 0x44, 0x33)
    if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
      return defaultMeta;
    }

    const version = view.getUint8(3); // major version e.g. ID3v2.3 or v2.4
    if (version > 4) return defaultMeta;

    // Synchsafe size of ID3 header is defined at bytes 6-9
    const s1 = view.getUint8(6);
    const s2 = view.getUint8(7);
    const s3 = view.getUint8(8);
    const s4 = view.getUint8(9);
    const id3Size = ((s1 & 0x7f) << 21) | ((s2 & 0x7f) << 14) | ((s3 & 0x7f) << 7) | (s4 & 0x7f);

    // Read full ID3 block or up to 256KB, whichever is smaller
    const bytesToRead = Math.min(id3Size + 10, arrayBuffer.byteLength);
    const u8 = new Uint8Array(arrayBuffer, 0, bytesToRead);

    let offset = 10; // skip main header
    const meta: ParsedMetadata = { ...defaultMeta };

    // Function to read text frames based on ID3 encoding
    const readString = (frameData: Uint8Array): string => {
      if (frameData.length === 0) return "";
      const encoding = frameData[0];
      const content = frameData.subarray(1);

      if (encoding === 1 || encoding === 2) {
        // UTF-16 (little/big endian)
        try {
          const decoder = new TextDecoder("utf-16");
          return decoder.decode(content).replace(/\0/g, "").trim();
        } catch {
          // Fallback to basic decoding
        }
      }
      
      // UTF-8 or ISO-8859-1
      try {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(content).replace(/\0/g, "").trim();
      } catch {
        return String.fromCharCode(...content).replace(/\0/g, "").trim();
      }
    };

    while (offset < bytesToRead - 10) {
      // Check for zero padding
      if (u8[offset] === 0) {
        break;
      }

      // Read Frame ID (4 characters)
      const frameId = String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]);
      
      // Read Frame Size (32-bit int)
      let frameSize = (view.getUint32(offset + 4) & (version === 4 ? 0x7f7f7f7f : 0xffffffff));
      if (version === 4) {
        // Synchsafe integer conversion for v2.4
        const f1 = (frameSize >> 24) & 0xff;
        const f2 = (frameSize >> 16) & 0xff;
        const f3 = (frameSize >> 8) & 0xff;
        const f4 = frameSize & 0xff;
        frameSize = ((f1 & 0x7f) << 21) | ((f2 & 0x7f) << 14) | ((f3 & 0x7f) << 7) | (f4 & 0x7f);
      }

      const nextOffset = offset + 10 + frameSize;
      if (nextOffset > bytesToRead) {
        break;
      }

      const frameContent = u8.subarray(offset + 10, offset + 10 + frameSize);

      if (frameId === "TIT2") {
        meta.title = readString(frameContent) || meta.title;
      } else if (frameId === "TPE1") {
        meta.artist = readString(frameContent) || meta.artist;
      } else if (frameId === "TALB") {
        meta.album = readString(frameContent) || meta.album;
      } else if (frameId === "APIC") {
        // Picture frame
        try {
          const mimeStart = 1;
          let mimeEnd = mimeStart;
          while (mimeEnd < frameContent.length && frameContent[mimeEnd] !== 0) {
            mimeEnd++;
          }
          const mimeType = String.fromCharCode(...frameContent.subarray(mimeStart, mimeEnd));
          const pictureType = frameContent[mimeEnd + 1];
          
          // Skip description
          let descStart = mimeEnd + 2;
          let descEnd = descStart;
          while (descEnd < frameContent.length && frameContent[descEnd] !== 0) {
            descEnd++;
          }
          // The image binary starts after description null terminator
          const binaryStart = descEnd + 1;
          const imgBytes = frameContent.subarray(binaryStart);

          if (imgBytes.length > 0) {
            const blob = new Blob([imgBytes], { type: mimeType || "image/jpeg" });
            meta.coverUrl = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error("Failed to parse embedded artwork APIC frame:", e);
        }
      }

      offset = nextOffset;
    }

    return meta;
  } catch (err) {
    console.error("Local ID3 metadata parser warning:", err);
    return defaultMeta;
  }
}
