const axios = require('axios');

async function test() {
  try {
    console.log("Logging in as Juez...");
    const loginRes = await axios.post("http://localhost:3000/auth/login", {
      email: "juez@melo.uy",
      password: "juez123"
    });

    console.log("Response user object:", JSON.stringify(loginRes.data.user, null, 2));

  } catch (error) {
    console.error("Failed:", error.message);
  }
}

test();
