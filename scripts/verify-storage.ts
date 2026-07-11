import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as https from "https";

// Cargar variables de entorno desde el archivo .env de la raíz
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex !== -1) {
        const key = trimmed.substring(0, eqIndex).trim();
        const val = trimmed.substring(eqIndex + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

const endpoint = process.env.STORAGE_ENDPOINT;
const bucketName = process.env.STORAGE_BUCKET_NAME;
const region = process.env.STORAGE_REGION;
const accessKeyId = process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.STORAGE_SECRET_KEY;

async function run() {
  console.log("=== Diagnóstico de Almacenamiento OVHcloud ===");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Bucket:   ${bucketName}`);
  console.log(`Region:   ${region}`);

  if (!endpoint || !bucketName || !region || !accessKeyId || !secretAccessKey) {
    console.error("ERROR: Faltan variables de configuración de almacenamiento en el .env.");
    process.exit(1);
  }

  // 1. Inicializar S3Client
  const s3Client = new S3Client({
    endpoint: endpoint,
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    forcePathStyle: true, // Requerido para OVHcloud
  });

  const testKey = "diagnostics/test-upload.txt";
  const testContent = `OVHcloud Object Storage Verification Successful at ${new Date().toISOString()}`;

  try {
    // 2. Subir archivo de prueba
    console.log(`\n1. Subiendo archivo de prueba a '${testKey}'...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: "text/plain",
      })
    );
    console.log("   -> ¡Carga exitosa!");

    // 3. Generar Presigned URL para descarga
    console.log("\n2. Generando Presigned URL para descarga...");
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 900 });
    console.log(`   -> Presigned URL generada:\n      ${presignedUrl}`);

    // 4. Descargar el archivo usando la Presigned URL para validar permisos y SSL
    console.log("\n3. Descargando archivo a través de la Presigned URL...");
    await new Promise<void>((resolve, reject) => {
      https.get(presignedUrl, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          console.log(`   -> Código de respuesta HTTP: ${res.statusCode}`);
          console.log(`   -> Contenido descargado: "${data}"`);
          if (res.statusCode === 200 && data === testContent) {
            console.log("   -> ¡Verificación de contenido EXITOSA!");
            resolve();
          } else {
            reject(new Error(`La descarga falló con código ${res.statusCode} o contenido incorrecto.`));
          }
        });
      }).on("error", (err) => {
        reject(err);
      });
    });

    // 5. Limpieza del archivo de prueba
    console.log("\n4. Eliminando archivo de prueba...");
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      })
    );
    console.log("   -> Archivo de prueba eliminado.");
    console.log("\n=== DIAGNÓSTICO COMPLETADO CON ÉXITO ===");
  } catch (error: any) {
    console.error("\n❌ ERROR DURANTE EL DIAGNÓSTICO:", error);
    process.exit(1);
  }
}

run();
