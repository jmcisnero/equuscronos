import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import * as fs from "fs";
import * as path from "path";

describe("Multimedia Cache and Formats (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Crear un archivo de prueba ficticio en uploads/jerseys/test_jersey.webp
    const uploadDir = path.join(process.cwd(), "uploads", "jerseys");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(uploadDir, "test_jersey.webp"),
      "fake webp binary data",
    );
  });

  afterAll(async () => {
    const testFilePath = path.join(
      process.cwd(),
      "uploads",
      "jerseys",
      "test_jersey.webp",
    );
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    await app.close();
  });

  it("debería responder con Content-Type image/webp y cabeceras de caché inmutables", async () => {
    const response = await request(app.getHttpServer())
      .get("/uploads/jerseys/test_jersey.webp")
      .expect(200);

    expect(response.headers["content-type"]).toBe("image/webp");
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("debería devolver 404 para archivos inexistentes", async () => {
    await request(app.getHttpServer())
      .get("/uploads/jerseys/nonexistent_file.webp")
      .expect(404);
  });
});
