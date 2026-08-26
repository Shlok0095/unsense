import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPublicDir() {
  return path.resolve(__dirname, "..", "public");
}

export function getToken() {
  return process.env.HF_TOKEN || "";
}

export function getNvidiaKey() {
  return process.env.NVIDIA_API_KEY || "";
}

export function hasToken() {
  return Boolean(getToken());
}

export function hasNvidiaKey() {
  return Boolean(getNvidiaKey());
}

export function getPort() {
  return Number(process.env.PORT) || 3000;
}
