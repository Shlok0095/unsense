import { handleHealth } from "./handlers/health.js";
import { handleChat } from "./handlers/chat.js";
import { handleExtractFiles } from "./handlers/extractFiles.js";

const routes = {
  get: new Map(),
  post: new Map(),
};

routes.get.set("/health", handleHealth);
routes.post.set("/extract-files", handleExtractFiles);
routes.post.set("/chat", handleChat);

export function createApiRouter() {
  return routes;
}
