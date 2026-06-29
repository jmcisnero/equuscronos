const fetch = require('node-fetch'); // wait, let's see if we can use standard dynamic import of node-fetch or native fetch (Node 20+ has global fetch!)
// Node 20 has native fetch, so we can use global.fetch.

async function testDashboard() {
  try {
    console.log("Logging in...");
    const loginRes = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "club2@melo.uy", password: "admin123" })
    });
    
    if (!loginRes.ok) {
      console.error("Login failed:", loginRes.status, await loginRes.text());
      return;
    }
    
    const { access_token } = await loginRes.json();
    console.log("Logged in successfully! Token received:", access_token.substring(0, 20) + "...");
    
    console.log("Querying dashboard stats...");
    const statsRes = await fetch("http://localhost:3000/admin/dashboard/stats", {
      headers: { "Authorization": `Bearer ${access_token}` }
    });
    
    console.log("Status code:", statsRes.status);
    const text = await statsRes.text();
    console.log("Response body:");
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testDashboard();
