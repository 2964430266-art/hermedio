async function testRoute() {
  const payload = {
    query: "bigbang",
    source: "netease",
    cookie: ""
  };

  try {
    const response = await fetch("http://localhost:3000/api/search-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log(`Response Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response Body (first 400 chars):\n${text.slice(0, 400)}`);
  } catch (err: any) {
    console.error("Fetch request failed:", err.message);
  }
}

testRoute();
