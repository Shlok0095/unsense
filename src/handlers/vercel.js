function parseJson(raw) {
  if (!raw) return {};
  return JSON.parse(raw);
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      return parseJson(req.body);
    }
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(parseJson(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

export function withJsonBody(handler) {
  return async (req, res) => {
    try {
      req.body = await readJsonBody(req);
      return await handler(req, res);
    } catch (error) {
      const status = error.status || 500;
      const message = error.message || "Internal server error.";
      console.error("[api]", req.url || req.path, status, message);
      return res.status(status).json({ error: message });
    }
  };
}
