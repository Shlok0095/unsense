/**
 * Lexical (BM25) retrieval over a set of text chunks.
 *
 * This is the "no embeddings provider configured" half of what would
 * normally be hybrid (lexical + vector) retrieval. It is genuinely good at
 * exactly the cases hybrid retrieval is meant to catch that pure vector
 * search often misses: exact names, IDs, error codes, and specific
 * terminology. The function signature — retrieve(query, chunks, opts) —
 * is intentionally the same shape a future vector/hybrid scorer would use,
 * so swapping or combining scorers later doesn't require touching callers
 * (src/tools/fileSearch.js, src/tools/memorySearch.js).
 */

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","to","of","in","on",
  "for","and","or","but","with","as","at","by","from","that","this","it","its",
  "into","about","what","which","who","how","do","does","did","can","could",
  "should","would","will","i","you","he","she","they","we","my","your","their",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]*/g)
    ?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) || [];
}

function termFrequencies(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/**
 * @param {string} query
 * @param {Array<{chunkId:string, text:string}>} chunks
 * @param {{ topK?: number }} opts
 * @returns {{ matched: boolean, results: Array<chunk & {score:number}> }}
 */
export function retrieve(query, chunks, { topK = 5 } = {}) {
  if (!chunks?.length) return { matched: false, results: [] };

  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length) {
    return { matched: false, results: chunks.slice(0, topK).map((c) => ({ ...c, score: 0 })) };
  }

  const docs = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    return { chunk, tokens, tf: termFrequencies(tokens), length: tokens.length || 1 };
  });

  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / docs.length;
  const N = docs.length;

  const df = new Map();
  for (const term of queryTerms) {
    let count = 0;
    for (const doc of docs) if (doc.tf.has(term)) count++;
    df.set(term, count);
  }

  const k1 = 1.5;
  const b = 0.75;

  const scored = docs.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const f = doc.tf.get(term) || 0;
      if (!f) continue;
      const n = df.get(term) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + k1 * (1 - b + (b * doc.length) / avgLength);
      score += idf * ((f * (k1 + 1)) / denom);
    }
    return { ...doc.chunk, score };
  });

  scored.sort((a, b2) => b2.score - a.score);
  const best = scored.slice(0, topK);
  const matched = best.some((r) => r.score > 0);

  return {
    matched,
    results: matched ? best.filter((r) => r.score > 0) : chunks.slice(0, topK).map((c) => ({ ...c, score: 0 })),
  };
}
