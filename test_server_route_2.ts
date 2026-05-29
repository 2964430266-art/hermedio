async function testHealth() {
  try {
    const res = await fetch("http://localhost:3000/api/health");
    console.log(`Health Status: ${res.status}`);
    const text = await res.text();
    console.log(`Health Body: ${text}`);
  } catch (err: any) {
    console.error("Health fetch failed:", err.message);
  }
}

testHealth();
