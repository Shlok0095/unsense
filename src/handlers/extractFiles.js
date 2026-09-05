import multer from "multer";
import { getNvidiaKey } from "../config.js";
import { processUploads } from "../files/documentProcessor.js";
import { MAX_FILE_BYTES } from "../files/parser.js";
import { checkRateLimit } from "../security/rateLimit.js";
import { createRequestLogger } from "../observability/logger.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
});

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array("files", 5)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function handleExtractFiles(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rate = checkRateLimit(req, { limit: 15, name: "extract" });
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({ error: "Too many uploads. Please slow down." });
  }

  const log = createRequestLogger("extract_files");

  try {
    await runUpload(req, res);
  } catch (err) {
    log.error("upload_failed", { message: err.message });
    return res.status(400).json({ error: err.message || "Upload failed." });
  }

  const nvidiaKey = getNvidiaKey();
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  // Only images/scanned PDFs actually require the vision key — let plain
  // text-layer PDFs and Office documents through without it.
  const requiresVision = files.some((f) => f.mimetype?.startsWith("image/"));
  if (requiresVision && !nvidiaKey) {
    return res.status(503).json({
      error: "NVIDIA_API_KEY is not configured on the server (required for image uploads).",
    });
  }

  try {
    const documents = await processUploads(files, nvidiaKey);
    log.done({
      success: true,
      fileCount: documents.length,
      totalChunks: documents.reduce((sum, d) => sum + d.chunkCount, 0),
    });
    return res.status(200).json({ ok: true, documents });
  } catch (error) {
    log.error("extraction_failed", { message: error.message });
    return res.status(error.status || 400).json({
      error: error.message || "File extraction failed.",
    });
  }
}
