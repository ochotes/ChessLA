import { useMemo, useState } from "react";
import { IconChat } from "../ui/Icons";

export interface ChatMessageItem {
  id: string;
  userId: string;
  username: string;
  text: string;
  isSystem: boolean;
}

const QUICK_MESSAGES = ["Good luck!", "Have fun!", "Nice move!", "Well played!", "Good game!", "Thanks!"];

export function ChatPanel({
  messages,
  onSend,
  myUserId,
}: {
  messages: ChatMessageItem[];
  onSend: (text: string) => void;
  myUserId: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  }

  // The other participant, once they've said anything — enough to offer a
  // one-click mute without needing the opponent's identity passed in separately.
  const other = useMemo(() => messages.find((m) => !m.isSystem && m.userId !== myUserId), [messages, myUserId]);

  function toggleMute(userId: string) {
    setMutedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const visibleMessages = messages.filter((m) => m.isSystem || !mutedUserIds.has(m.userId));

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <IconChat className="h-4 w-4" /> Chat
        </button>
        <div className="flex items-center gap-3">
          {other && (
            <button
              className="text-xs font-medium text-text-muted hover:text-text"
              onClick={() => toggleMute(other.userId)}
              aria-pressed={mutedUserIds.has(other.userId)}
            >
              {mutedUserIds.has(other.userId) ? `Unmute ${other.username}` : `Mute ${other.username}`}
            </button>
          )}
          <button className="text-sm text-text-muted" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_MESSAGES.map((m) => (
              <button key={m} onClick={() => submit(m)} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted hover:bg-surface-raised">
                {m}
              </button>
            ))}
          </div>
          <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto text-sm">
            {visibleMessages.length === 0 && <p className="text-text-muted">No messages yet.</p>}
            {visibleMessages.map((m) => (
              <p key={m.id} className={m.isSystem ? "italic text-text-muted" : ""}>
                {!m.isSystem && <span className={`font-semibold ${m.userId === myUserId ? "text-accent" : "text-text"}`}>{m.username}: </span>}
                {m.text}
              </p>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="flex gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              Send a chat message
            </label>
            <input
              id="chat-input"
              className="input"
              placeholder="Send a message..."
              value={draft}
              maxLength={280}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
