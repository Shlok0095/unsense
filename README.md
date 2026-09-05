# unsense

An AI assistant web app powered by Hugging Face Inference (Featherless), with
agentic web search, document RAG, streaming responses, long-term memory, and
provider-independent model routing (Hugging Face + optional local Ollama).

See [WORKFLOW.md](WORKFLOW.md) for the full architecture reference.

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. In **Project Settings → Build & Development Settings**, leave **Output Directory** empty (do not set it to `public`)
4. Add environment variables (see `.env.example`):
   - `HF_TOKEN` = your Hugging Face access token (required)
   - `NVIDIA_API_KEY` = your NVIDIA API key (optional — only needed for image/scanned-PDF uploads)
5. Deploy

## Local development

```bash
npm install
cp .env.example .env   # add HF_TOKEN=hf_...
npm run build:css
npm start
```

Open `http://localhost:3000`

## Testing

```bash
npm test        # unit + integration tests (node's built-in test runner, no extra deps)
npm run eval     # small model-quality/latency benchmark (needs a working HF_TOKEN)
```

## Features

- **Streaming responses** with a working Stop button
- **Model gateway**: provider-independent (Hugging Face + optional local Ollama), automatic fallback to a secondary model on failure, per-model health/cooldown tracking
- **Response modes**: Fast / Think / Research / Analyze / Code — each shapes the model tier, prompt structure, and tool behavior
- **Agentic web search** (DuckDuckGo, no API key) with backend-owned, verified citations — the model can never invent a source URL
- **Document RAG**: PDF / DOCX / PPTX / XLSX / TXT / images are parsed, chunked, and retrieved per-question (lexical BM25 ranking) instead of dumped whole into the prompt — works across follow-up turns in the same session
- **Long-term memory**: entirely user-curated ("Remember this" on a message) and local to your browser — nothing is inferred or saved automatically
- **Conversation context management**: recent turns kept verbatim, older turns folded into a running summary once the window fills up
- **Follow-up suggestions**, message actions (copy / regenerate / edit / branch), lightweight projects for grouping sessions, Ctrl+K search across sessions
- **Privacy modes**: Normal / Temporary (nothing saved) / Private (memory off) / Local (Ollama only, requires `OLLAMA_BASE_URL`)
- **Security**: SSRF-guarded outbound fetches (DNS-resolved, private-range blocked), input validation, best-effort rate limiting, prompt-injection defense (web/document/tool content is wrapped as clearly-labeled untrusted data, never treated as instructions)
- Chat history, memory, settings, and projects are all stored in **browser localStorage** — nothing is persisted server-side (see [WORKFLOW.md](WORKFLOW.md) for why, and what that trades off)

## Environment

See `.env.example` for the full list. Only `HF_TOKEN` is required; everything
else (NVIDIA vision, Ollama, model overrides, context budget) is optional and
the app degrades gracefully without it.
