import open from "open";
import { createApp } from "./app.js";
import { getPort, hasToken } from "./config.js";

const app = createApp();
const PORT = getPort();

const server = app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}`;
  console.log(`unsensoredgpt running at ${url}`);
  if (!hasToken()) {
    console.warn("HF_TOKEN is not set — add it to .env for local dev");
  }

  if (process.env.OPEN_BROWSER !== "false") {
    try {
      await open(url);
    } catch (error) {
      console.warn("Could not open browser:", error.message);
    }
  }
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
