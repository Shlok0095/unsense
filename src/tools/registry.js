/**
 * Generic tool registry. Tools are looked up and invoked by the
 * orchestrator, never called directly by handlers — this is the one place
 * that knows what tools exist, so adding a tool never means touching the
 * orchestrator's control flow.
 *
 * A tool definition:
 *   name        unique id
 *   description what it does (for logging/observability, and for a future
 *               function-calling model)
 *   schema      plain-object description of expected args (documentation,
 *               not enforced by a validator library — see each tool's own
 *               input checks)
 *   permissions e.g. ["network"] — informational, surfaced in logs
 *   timeoutMs   hard cap; the tool is aborted and treated as a failure past this
 *   handler     async (args, context) => result
 */

const tools = new Map();

export function registerTool(definition) {
  if (!definition?.name || typeof definition.handler !== "function") {
    throw new Error("Tool definition requires a name and a handler.");
  }
  tools.set(definition.name, {
    timeoutMs: 8000,
    permissions: [],
    ...definition,
  });
}

export function getTool(name) {
  return tools.get(name) || null;
}

export function listTools() {
  return [...tools.values()].map(({ name, description, schema, permissions }) => ({
    name,
    description,
    schema,
    permissions,
  }));
}

function withTimeout(promise, ms, toolName) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs a registered tool by name. Never throws — tool failures are
 * reported as { ok: false, error } so a single failing tool degrades the
 * orchestrator gracefully instead of failing the whole response.
 */
export async function runTool(name, args, context = {}) {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  try {
    const result = await withTimeout(
      Promise.resolve(tool.handler(args, context)),
      tool.timeoutMs,
      name
    );
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}
