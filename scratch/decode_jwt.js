const axios = require('axios');

async function decode() {
  try {
    console.log("Logging in as Juez...");
    const loginRes = await axios.post("http://localhost:3000/auth/login", {
      email: "juez@melo.uy",
      password: "juez123"
    });

    const token = loginRes.data.access_token;
    console.log("Token:", token);

    const payloadBase64 = token.split('.')[1];
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('ascii');
    console.log("Decoded Payload:", JSON.stringify(JSON.parse(payloadJson), null, 2));

  } catch (error) {
    console.error("Failed:", error.message);
  }
}

decode();
