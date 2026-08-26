import "dotenv/config";
import { handleHealth } from "../src/handlers/health.js";

export default function handler(req, res) {
  return handleHealth(req, res);
}
