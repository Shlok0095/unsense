# unsense

Uncensored chat web app using Hugging Face Inference (Featherless).

## Deploy on Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variable:
   - `HF_TOKEN` = your Hugging Face access token
4. Deploy

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
| `PORT`     | No       | Local dev port (default 3000) |
