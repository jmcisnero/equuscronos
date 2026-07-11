import { Injectable, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class AssetsService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("STORAGE_ENDPOINT");
    const bucketName = this.configService.get<string>("STORAGE_BUCKET_NAME");
    const region = this.configService.get<string>("STORAGE_REGION");
    const accessKeyId = this.configService.get<string>("STORAGE_ACCESS_KEY");
    const secretAccessKey = this.configService.get<string>("STORAGE_SECRET_KEY");

    if (!endpoint || !bucketName || !region || !accessKeyId || !secretAccessKey) {
      console.warn(
        "WARNING: Missing storage configuration. S3 uploads will fall back to local storage. Please check STORAGE_ENDPOINT, STORAGE_BUCKET_NAME, STORAGE_REGION, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY in production.",
      );
      return;
    }

    this.bucketName = bucketName;
    this.endpoint = endpoint;

    this.s3Client = new S3Client({
      endpoint: endpoint,
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true, // Mandatory for OVHcloud Object Storage
    });
  }

  async uploadFile(file: any, folder: string): Promise<string> {
    if (!file || !file.buffer) {
      throw new ConflictException("No se proporcionó un archivo válido.");
    }

    const ext = path.extname(file.originalname) || ".png";
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const filename = `${folder}_${uniqueId}${ext}`;

    // Fallback to local storage if S3 client is not configured (e.g. testing or local dev without S3 variables)
    if (!this.s3Client) {
      const uploadDir = path.join(process.cwd(), "uploads", folder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      return `http://localhost:3000/uploads/${folder}/${filename}`;
    }

    const key = `${folder}/${filename}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
          ACL: "public-read",
        }),
      );

      // Clean the endpoint URL to prevent double slashes
      const cleanEndpoint = this.endpoint.endsWith("/")
        ? this.endpoint.slice(0, -1)
        : this.endpoint;

      return `${cleanEndpoint}/${this.bucketName}/${key}`;
    } catch (error: any) {
      console.error("Error uploading to OVH Object Storage:", error);
      throw new ConflictException(
        `Error al subir el archivo al almacenamiento de OVHcloud: ${error.message}`,
      );
    }
  }
}
