// A small, deliberately conservative blocklist. This is a first line of
// defense, not a full trust-and-safety system — real moderation still
// happens through the Reports queue in the admin panel.
const BLOCKED_SUBSTRINGS = [
  "http://",
  "https://",
  "www.",
]; // links are stripped rather than banned outright, see sanitizeChatText

const RECENT_MESSAGE_WINDOW_MS = 4000;
const MAX_MESSAGE_LENGTH = 280;

export interface RateLimiterState {
  lastMessageAt: number;
  lastText: string;
  repeatCount: number;
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeChatText(raw: string): string {
  let text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
  for (const term of BLOCKED_SUBSTRINGS) {
    if (text.toLowerCase().includes(term)) {
      // Unescaped, "www." would compile to /www./ — "any character" after
      // "www", not a literal dot — over-redacting things like "www much fun".
      text = text.replace(new RegExp(escapeRegExp(term), "gi"), "[link removed]");
    }
  }
  return text;
}

export function isSpam(state: RateLimiterState | undefined, text: string, now: number): boolean {
  if (!state) return false;
  const tooFast = now - state.lastMessageAt < RECENT_MESSAGE_WINDOW_MS;
  const isRepeat = state.lastText === text;
  return tooFast && isRepeat && state.repeatCount >= 2;
}

export const QUICK_CHAT_MESSAGES = [
  "Good luck!",
  "Have fun!",
  "Nice move!",
  "Well played!",
  "Good game!",
  "Thanks!",
  "Oops!",
  "One moment please.",
];
