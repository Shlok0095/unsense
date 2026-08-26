const AUTH_ERROR_RE =
  /invalid username or password|invalid token|unauthorized|authentication/i;

export function toUserFacingApiError(message, status) {
  const text = String(message || "").trim();

  if (status === 401 || AUTH_ERROR_RE.test(text)) {
    return "Invalid Hugging Face API token. In Vercel, set HF_TOKEN to a valid token from huggingface.co/settings/tokens (type: Read or Fine-grained with Inference access).";
  }

  if (status === 403) {
    return "Hugging Face rejected this request. Check that your HF_TOKEN has Inference API access and billing is enabled if required.";
  }

  if (status === 429) {
    return "Hugging Face rate limit reached. Wait a moment and try again.";
  }

  return text || "Failed to reach Hugging Face.";
}
