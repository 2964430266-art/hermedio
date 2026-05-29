import ytSearch from "yt-search";

async function testYt() {
  console.log("Testing yt-search...");
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout after 15s")), 15000)
    );

    const searchPromise = ytSearch("bigbang");
    const result: any = await Promise.race([searchPromise, timeoutPromise]);
    console.log(`Success! Found ${result?.videos?.length || 0} videos.`);
  } catch (err: any) {
    console.error("YtSearch Failed:", err.message);
  }
}

testYt();
