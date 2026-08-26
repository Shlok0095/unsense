import multer from "multer";
import { getNvidiaKey } from "../config.js";
import { extractFiles } from "../fileExtract.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
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

  try {
    await runUpload(req, res);
  } catch (err) {
    return res
      .status(400)
      .json({ error: err.message || "Upload failed." });
  }

  const nvidiaKey = getNvidiaKey();
  if (!nvidiaKey) {
    return res.status(503).json({
      error: "NVIDIA_API_KEY is not configured on the server.",
    });
  }

  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  try {
    const extracts = await extractFiles(files, nvidiaKey);
    return res.status(200).json({ ok: true, extracts });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message || "File extraction failed.",
    });
  }
}
