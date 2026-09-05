/**
 * Splits extracted document text into overlapping, metadata-tagged chunks
 * so a large file doesn't get dumped whole into the model's context window.
 * Heading-aware: if the text has markdown-style headings (## Heading) or
 * "[Page N]" markers (added by the PDF vision extractor), those are
 * preserved as chunk metadata instead of being split apart. Each chunk is
 * tagged with whichever page/heading was most recently in effect as of the
 * end of that chunk.
 */

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 150;

function detectPage(line) {
  const match = line.match(/^\[Page (\d+)\]/);
  return match ? Number(match[1]) : null;
}

function detectHeading(line) {
  const match = line.match(/^#{1,6}\s+(.+)/);
  return match ? match[1].trim() : null;
}

/**
 * @param {string} text
 * @param {{ documentId: string, filename: string }} meta
 * @returns {Array<{chunkId, documentId, filename, page, heading, text}>}
 */
export function chunkText(text, meta) {
  const clean = String(text || "").replace(/\r/g, "").trim();
  if (!clean) return [];

  const lines = clean.split("\n");
  let currentPage = null;
  let currentHeading = null;
  const chunks = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push({
      chunkId: `${meta.documentId}_${index++}`,
      documentId: meta.documentId,
      filename: meta.filename,
      page: currentPage,
      heading: currentHeading,
      text: trimmed,
    });
  };

  for (const line of lines) {
    const page = detectPage(line);
    if (page !== null) currentPage = page;
    const heading = detectHeading(line);
    if (heading) currentHeading = heading;

    buffer += (buffer ? "\n" : "") + line;

    if (buffer.length >= CHUNK_CHARS) {
      flush();
      // Start the next chunk with a small overlap for context continuity.
      buffer = buffer.slice(-CHUNK_OVERLAP_CHARS);
    }
  }
  flush();

  return chunks;
}
