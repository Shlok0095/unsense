import { isSafeUrlToFetch } from "../security/ssrf.js";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1/chat/completions";
export const NVIDIA_VISION_MODEL = "nvidia/nemotron-nano-12b-v2-vl";

const EXTRACT_PROMPT = `Extract all text from this document image.
Return clean markdown with headings, lists, and tables when present.
Do not add commentary — only extracted content.`;

async function callVisionApi(imageUrl, apiKey) {
  const res = await fetch(NVIDIA_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || data?.detail || "NVIDIA vision API error";
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    throw new Error("No text extracted from image.");
  }
  return text;
}

export async function extractTextFromImage(buffer, mimeType, apiKey) {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return callVisionApi(dataUrl, apiKey);
}

/**
 * Used for PDF page screenshots, which arrive as data: URLs generated
 * locally — but this also accepts http(s) URLs in principle, so it is
 * SSRF-guarded the same as every other server-side fetch of a URL.
 */
export async function extractTextFromImageUrl(imageUrl, apiKey) {
  if (imageUrl.startsWith("http") && !(await isSafeUrlToFetch(imageUrl))) {
    throw new Error("Refusing to fetch that image URL.");
  }
  return callVisionApi(imageUrl, apiKey);
}
