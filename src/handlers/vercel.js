export function withJsonBody(handler) {
  return async (req, res) => {
    if (req.body !== undefined) {
      return handler(req, res);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      req.body = {};
      return handler(req, res);
    }

    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const raw = Buffer.concat(chunks).toString("utf8");
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(400).json({ error: "Invalid JSON body." });
    }

    return handler(req, res);
  };
}
