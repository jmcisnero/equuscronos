import {
  Controller,
  Get,
  Param,
  Res,
  Header,
  NotFoundException,
} from "@nestjs/common";
import { Response } from "express";
import * as path from "path";
import * as fs from "fs";

@Controller("uploads")
export class AssetsController {
  @Get(":folder/:filename")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  serveFile(
    @Param("folder") folder: string,
    @Param("filename") filename: string,
    @Res() res: Response,
  ) {
    const filePath = path.join(process.cwd(), "uploads", folder, filename);

    // Guard against Directory Traversal
    const safePath = path.resolve(filePath);
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!safePath.startsWith(uploadsDir)) {
      throw new NotFoundException("Archivo no encontrado.");
    }

    if (!fs.existsSync(safePath)) {
      throw new NotFoundException("Archivo no encontrado.");
    }

    // Set correct Content-Type (especially image/webp)
    const ext = path.extname(safePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".webp") {
      contentType = "image/webp";
    } else if (ext === ".png") {
      contentType = "image/png";
    } else if (ext === ".jpg" || ext === ".jpeg") {
      contentType = "image/jpeg";
    }

    res.setHeader("Content-Type", contentType);
    return res.sendFile(safePath);
  }
}
