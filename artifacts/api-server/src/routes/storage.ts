import { Readable } from "node:stream";
import { Router, type Request, type Response } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage.js";

const router = Router();
const objectStorage = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body ?? {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof size !== "number" ||
    size < 1 ||
    size > 10 * 1024 * 1024 ||
    typeof contentType !== "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType)
  ) {
    return res.status(400).json({ error: "Upload a JPEG, PNG, or WebP image up to 10 MB." });
  }

  try {
    const upload = await objectStorage.getUploadUrl();
    return res.json({ ...upload, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating image upload URL");
    return res.status(500).json({ error: "Unable to prepare the image upload." });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const rawPath = req.params.path;
    const path = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const response = await objectStorage.downloadObject(await objectStorage.getObjectEntityFile(`/objects/${path}`));
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      return Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    }

    return res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return res.status(404).json({ error: "Image not found." });
    req.log.error({ err: error }, "Error serving uploaded image");
    return res.status(500).json({ error: "Unable to load the uploaded image." });
  }
});

export default router;