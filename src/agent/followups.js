import { generate } from "../models/gateway.js";
import { matchesSkipSearch } from "./intentHeuristics.js";

const FOLLOWUP_SYSTEM = `Given a user's question and the assistant's answer, suggest 2-4 short,
genuinely useful follow-up questions the user might ask next. They must be
specific to this exact exchange — never generic ("tell me more", "explain
further"). Reply with ONLY a JSON array of strings, nothing else. Example:
["Compare this with X", "Show a real implementation", "What are the tradeoffs?"]`;

function parseFollowups(text) {
  const match = String(text || "").match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim())
      .slice(0, 4);
  } catch {
    return [];
  }
}

/** Returns [] on any failure — follow-ups are a nice-to-have, never fatal. */
export async function generateFollowups({ token, privacyMode, userMessage, assistantContent }) {
  if (matchesSkipSearch(userMessage)) return []; // trivial exchange (greeting, etc.) — skip
  if (!assistantContent || assistantContent.length < 40) return [];

  try {
    const result = await generate({
      token,
      mode: "fast",
      privacyMode,
      temperature: 0.4,
      maxTokens: 200,
      messages: [
        { role: "system", content: FOLLOWUP_SYSTEM },
        {
          role: "user",
          content: `Question: ${userMessage.slice(0, 1000)}\n\nAnswer: ${assistantContent.slice(0, 3000)}`,
        },
      ],
    });
    return parseFollowups(result.content);
  } catch (error) {
    console.warn("[followups] generation failed:", error.message);
    return [];
  }
}
