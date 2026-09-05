import { PDFParse } from "pdf-parse";
import officeParser, { OfficeGenerator } from "officeparser";
import mammoth from "mammoth";
import { extractTextFromImage, extractTextFromImageUrl } from "./vision.js";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const OFFICE_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const MAX_CHARS = 20000; // raw extracted text cap, before chunking/retrieval trims further
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

function trimText(text) {
  const cleaned = String(text || "").replace(/\r/g, "").trim();
  if (cleaned.length <= MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_CHARS)}\n\n[truncated]`;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text?.trim() || "";
  } finally {
    await parser.destroy();
  }
}

async function extractPdfVision(buffer, nvidiaApiKey, pages = 4) {
  const parser = new PDFParse({ data: buffer });
  try {
    const screenshot = await parser.getScreenshot({
      partial: Array.from({ length: pages }, (_, i) => i + 1),
      imageDataUrl: true,
      scale: 1.5,
    });

    const chunks = [];
    for (const page of screenshot.pages || []) {
      if (!page.dataUrl) continue;
      const pageText = await extractTextFromImageUrl(page.dataUrl, nvidiaApiKey);
      chunks.push(`[Page ${page.pageNumber}]\n${pageText}`);
    }
    return chunks.join("\n\n").trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() || "";
}

async function extractOfficeMarkdown(buffer) {
  const ast = await officeParser.parseOffice(buffer);
  const { value } = await OfficeGenerator.generate(ast, "md");
  return String(value || "").trim();
}

export function validateUpload(file) {
  if (!file?.buffer?.length) {
    throw new Error("Empty file upload.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.originalname} is too large (max 8MB).`);
  }
}

/**
 * Extracts raw text/markdown from an uploaded file. Chunking (rag/chunker.js)
 * happens afterward, in documentProcessor.js — this function only cares
 * about "how do I get text out of this file format".
 */
export async function extractFileText(file, nvidiaApiKey) {
  validateUpload(file);

  const mime = file.mimetype || "";
  const name = file.originalname || "upload";
  let text = "";
  let usedVision = false;

  if (IMAGE_TYPES.has(mime)) {
    if (!nvidiaApiKey) {
      throw new Error("NVIDIA_API_KEY is required for image extraction.");
    }
    text = await extractTextFromImage(file.buffer, mime, nvidiaApiKey);
    usedVision = true;
  } else if (mime === "application/pdf") {
    text = await extractPdfText(file.buffer);
    // Only fall back to vision OCR when the text layer looks empty/scanned —
    // avoids OCR-ing every page unnecessarily (most PDFs have a real text layer).
    if (text.length < 80) {
      if (!nvidiaApiKey) {
        throw new Error("Scanned PDF detected. Set NVIDIA_API_KEY for vision extraction.");
      }
      text = await extractPdfVision(file.buffer, nvidiaApiKey);
      usedVision = true;
    }
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    text = await extractDocx(file.buffer);
    if (text.length < 40) {
      text = await extractOfficeMarkdown(file.buffer);
    }
  } else if (OFFICE_TYPES.has(mime)) {
    text = await extractOfficeMarkdown(file.buffer);
  } else {
    throw new Error(`Unsupported file type: ${mime || name}`);
  }

  text = trimText(text);
  if (!text) {
    throw new Error(`Could not extract text from ${name}.`);
  }

  return { name, mime, chars: text.length, text, usedVision };
}

export async function extractFiles(files, nvidiaApiKey) {
  const results = [];
  for (const file of files) {
    results.push(await extractFileText(file, nvidiaApiKey));
  }
  return results;
}
