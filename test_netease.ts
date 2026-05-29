async function testV1Stream() {
  const songId = "22673551"; // BIGBANG's "Lies"
  const baseHeaders: any = {
    "Referer": "https://music.163.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    "X-Real-IP": "116.25.2.14",
    "X-Forwarded-For": "116.25.2.14",
    "Client-IP": "116.25.2.14"
  };

  try {
    const v1Endpoint = `https://music.163.com/api/song/enhance/player/url/v1?ids=[${songId}]&level=standard&encodeType=mp3`;
    console.log(`Testing NetEase v1 endpoint: ${v1Endpoint}`);
    const res = await fetch(v1Endpoint, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `ids=[${songId}]&level=standard&encodeType=mp3`
    });
    console.log(`v1 Status: ${res.status}`);
    const data: any = await res.json();
    console.log(`v1 Data:`, JSON.stringify(data));
    const url = data?.data?.[0]?.url;
    console.log(`v1 URL: ${url}`);
  } catch (err: any) {
    console.error("v1 Test failed:", err.message);
  }
}

testV1Stream();
