/**
 * Uploaded-document bookkeeping. Documents (and their chunks, produced
 * server-side by src/files/documentProcessor.js) are stored on the session
 * itself (session.documents) so they survive across turns — that's what
 * makes multi-turn "what does the doc say about X" follow-ups work without
 * any server-side storage. Chunks are flattened and sent with every request
 * in that session; the server re-ranks them per-question (rag/retriever.js).
 */

/** Flattens every chunk from every document attached to a session. */
export function flattenChunks(session) {
  const docs = session?.documents || [];
  return docs.flatMap((doc) => doc.chunks || []);
}

export function addDocuments(session, newDocuments) {
  const documents = [...(session.documents || []), ...newDocuments];
  return documents;
}

export function documentSummaryLabel(session) {
  const docs = session?.documents || [];
  if (!docs.length) return "";
  if (docs.length === 1) return docs[0].filename;
  return `${docs.length} files`;
}
