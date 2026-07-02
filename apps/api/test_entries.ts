import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { CompetitionEntriesService } from "./src/modules/competition-entries/competition-entries.service";
import { tenantStorage } from "./src/modules/auth/tenant.storage";

async function test() {
  console.log("Bootstrapping Nest application context...");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const service = app.get(CompetitionEntriesService);

  console.log(
    "Running service.findAllByCompetition with JUDGE tenant context...",
  );
  tenantStorage.run(
    { tenantId: "a1000000-0000-0000-0000-000000000001" },
    async () => {
      try {
        const result = await service.findAllByCompetition(
          "c88eacaf-d206-418b-a2ff-224115490470",
        );
        console.log("Success! Found entries count:", result.length);
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error("ERROR IN SERVICE:");
        console.error(err);
      } finally {
        await app.close();
      }
    },
  );
}

test();
