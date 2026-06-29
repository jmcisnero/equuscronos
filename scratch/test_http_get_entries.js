const axios = require('axios');

async function run() {
  try {
    console.log("Logging in as Juez...");
    const loginRes = await axios.post("http://localhost:3000/auth/login", {
      email: "juez@melo.uy",
      password: "juez123"
    });

    const token = loginRes.data.access_token;
    console.log("Login successful! Token acquired.");

    const activeId = "c2000000-0000-0000-0000-000000000001";
    console.log(`Fetching entries for competition ${activeId} as Juez...`);
    const entriesRes = await axios.get(`http://localhost:3000/admin/entries?competitionId=${activeId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    console.log("Entries count:", entriesRes.data.length);
    console.log("Entries:", JSON.stringify(entriesRes.data, null, 2));

  } catch (error) {
    console.error("HTTP Request Failed!");
    console.error(error);
  }
}

run();
