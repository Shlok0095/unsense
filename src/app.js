import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getPublicDir, hasToken } from "./config.js";
import { createApiRouter } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  const publicDir = getPublicDir();
  const api = createApiRouter();

  app.use(express.json({ limit: "4mb" }));
  app.use(express.static(publicDir));

  for (const [route, handler] of api.get) {
    app.get(`/api${route}`, handler);
  }
  for (const [route, handler] of api.post) {
    app.post(`/api${route}`, handler);
  }
  if (api.delete) {
    for (const [route, handler] of api.delete) {
      app.delete(`/api${route}`, handler);
    }
  }

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, hasToken: hasToken() });
  });

  return app;
}
