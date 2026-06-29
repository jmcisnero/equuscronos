const axios = require('axios');

async function runTest(email, password, roleName) {
  try {
    const apiBaseUrl = "http://localhost:3000";
    console.log(`\n--- Testing login for ${roleName} (${email}) ---`);
    console.log("1. Simulating login request...");
    const response = await axios.post(`${apiBaseUrl}/auth/login`, {
      email,
      password
    });

    const { access_token, user: loggedUser } = response.data;
    console.log("   Login success! User:", JSON.stringify(loggedUser));

    console.log("2. Checking for active competitions for user's tenant...");
    if (loggedUser.role !== "ADMIN") {
      let competitions = [];
      try {
        const compsResponse = await axios.get(`${apiBaseUrl}/admin/competitions`, {
          headers: {
            "Authorization": `Bearer ${access_token}`
          }
        });
        competitions = compsResponse.data;
      } catch (fetchError) {
        console.error("   Error fetching competitions:", fetchError.message);
        throw new Error("No se pudo verificar el estado de las competencias en el servidor.");
      }

      console.log(`   Fetched ${competitions.length} competitions for this tenant.`);

      const activeCompetition = competitions.find(
        (c) => c.status === "ACTIVE"
      );

      if (!activeCompetition) {
        const clubName = loggedUser.tenantName || "Ninguno";
        throw new Error(
          `No hay competencias activas para su club actual (${clubName}). Por favor, asigne su usuario al club de la competencia activa en la consola de administración web para poder ingresar.`
        );
      }
      
      console.log("   Active competition found! Access granted.");
    } else {
      console.log("   User is ADMIN, bypassing validation. Access granted.");
    }

  } catch (error) {
    console.log("[Validation Error Caught]:", error.message);
  }
}

async function main() {
  await runTest("juez@melo.uy", "juez123", "JUDGE");
  await runTest("admin@equuscronos.com", "admin123", "ADMIN");
}

main();
