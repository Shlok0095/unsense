import { BASE_SYSTEM_PROMPT } from "./system.js";
import { getModePrompt } from "./modes.js";

export { BASE_SYSTEM_PROMPT } from "./system.js";
export { getModePrompt, MODE_PROMPTS } from "./modes.js";

/** Recent-turns window before the context manager's summarization kicks in. */
export const CONTEXT_WINDOW_MESSAGES = 16;

export function buildSystemPrompt(mode) {
  return `${BASE_SYSTEM_PROMPT}\n\n${getModePrompt(mode)}`;
}
