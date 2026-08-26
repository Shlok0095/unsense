# unsense

Uncensored chat web app using Hugging Face Inference (Featherless).

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. In **Project Settings → Build & Development Settings**, leave **Output Directory** empty (do not set it to `public`)
4. Add environment variables:
   - `HF_TOKEN` = your Hugging Face access token
   - `NVIDIA_API_KEY` = your NVIDIA API key (for file/image extraction)
5. Deploy

## Local development

```bash
npm install
cp .env.example .env   # add HF_TOKEN=hf_...
npm run build:css
npm start
```

Open `http://localhost:3000`

## Features

- Auto model fallback (primary → backup if primary fails)
- Web search enabled by default
- Chat history stored in browser (localStorage)
- Short clickable source links in answers
- No model names shown in UI

## Environment

| Variable   | Required | Description              |
|-----------|----------|--------------------------|
| `HF_TOKEN` | Yes      | Hugging Face API token   |
| `NVIDIA_API_KEY` | Yes (for uploads) | NVIDIA API key for document/image text extraction (`nvidia/nemotron-nano-12b-v2-vl`) |
| `PORT`     | No       | Local dev port (default 3000) |
