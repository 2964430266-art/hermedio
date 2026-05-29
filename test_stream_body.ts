async function testStreamBody() {
  const url = "https://music.163.com/song/media/outer/url?id=22673551.mp3";
  const baseHeaders: any = {
    "Referer": "https://music.163.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    "X-Real-IP": "116.25.2.14",
    "X-Forwarded-For": "116.25.2.14",
    "Client-IP": "116.25.2.14"
  };

  try {
    console.log(`Fetching direct stream body...`);
    const res = await fetch(url, { headers: baseHeaders });
    console.log(`Status: ${res.status}`);
    console.log(`Redirected: ${res.redirected}`);
    console.log(`URL reached: ${res.url}`);
    const text = await res.text();
    console.log(`Body (first 500 chars):\n${text.slice(0, 500)}`);
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

testStreamBody();
