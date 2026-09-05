import { registerTool } from "./registry.js";
import { webSearchTool } from "./webSearch.js";
import { fetchUrlTool } from "./fetchUrl.js";
import { calculatorTool } from "./calculator.js";
import { timeTool } from "./time.js";
import { fileSearchTool } from "./fileSearch.js";
import { memorySearchTool } from "./memorySearch.js";

let registered = false;

/** Idempotent — safe to call on every cold start without double-registering. */
export function registerBuiltinTools() {
  if (registered) return;
  for (const tool of [
    webSearchTool,
    fetchUrlTool,
    calculatorTool,
    timeTool,
    fileSearchTool,
    memorySearchTool,
  ]) {
    registerTool(tool);
  }
  registered = true;
}

// Self-register on first import so every entry point (Vercel serverless
// functions, the Express dev server) gets a populated registry without
// needing to remember a separate bootstrap call.
registerBuiltinTools();

export { runTool, listTools, getTool } from "./registry.js";
