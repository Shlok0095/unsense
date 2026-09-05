import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve } from "../../src/rag/retriever.js";
import { chunkText } from "../../src/rag/chunker.js";

test("retriever ranks the chunk containing the query terms first", () => {
  const chunks = [
    { chunkId: "a", text: "The quarterly revenue for Acme Corp grew by 12 percent." },
    { chunkId: "b", text: "Bananas are a good source of potassium and fiber." },
    { chunkId: "c", text: "Acme Corp's revenue growth was driven by strong demand." },
  ];

  const { matched, results } = retrieve("Acme Corp revenue growth", chunks, { topK: 2 });
  assert.equal(matched, true);
  assert.equal(results.length, 2);
  assert.ok(["a", "c"].includes(results[0].chunkId));
  assert.ok(results[0].score > 0);
});

test("retriever falls back to a representative sample when nothing matches", () => {
  const chunks = [
    { chunkId: "a", text: "alpha beta gamma" },
    { chunkId: "b", text: "delta epsilon zeta" },
  ];
  const { matched, results } = retrieve("xyzxyz nonword", chunks, { topK: 5 });
  assert.equal(matched, false);
  assert.equal(results.length, 2);
});

test("retriever handles an empty chunk set", () => {
  const { matched, results } = retrieve("anything", [], { topK: 5 });
  assert.equal(matched, false);
  assert.deepEqual(results, []);
});

test("chunker preserves page and heading metadata", () => {
  const text = `[Page 1]
## Introduction
This is the intro paragraph repeated to build length. `.repeat(1) + "x".repeat(1300) + `

[Page 2]
## Methods
Second section content here.`;

  const chunks = chunkText(text, { documentId: "doc1", filename: "report.pdf" });
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].documentId, "doc1");
  assert.equal(chunks[0].filename, "report.pdf");
  assert.equal(chunks[0].page, 1);
  assert.equal(chunks[0].heading, "Introduction");
  assert.ok(chunks.some((c) => c.page === 2 && c.heading === "Methods"));
});

test("chunker returns nothing for empty input", () => {
  assert.deepEqual(chunkText("", { documentId: "d", filename: "f" }), []);
  assert.deepEqual(chunkText("   \n  ", { documentId: "d", filename: "f" }), []);
});
