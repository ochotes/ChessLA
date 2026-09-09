import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { Modal } from "../ui/Modal";
import { IconSettings } from "../ui/Icons";
import { BOARD_THEMES } from "./boardThemes";
import { PIECE_STYLES } from "./pieceStyles";
import type { UserSettings } from "../../lib/types";

/**
 * A one-click appearance panel reachable from the game screen itself —
 * theme, board, and piece preferences shouldn't require leaving a game to
 * change. Every change here saves through the same /users/me/settings
 * endpoint the full Settings page uses, so it's the same account
 * preference either way, just reachable without interrupting play.
 */
export function QuickAppearanceSettings({
  settings,
  onSettingsChange,
}: {
  settings: UserSettings | null;
  onSettingsChange: (patch: Partial<UserSettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  async function update(patch: Partial<UserSettings>) {
    onSettingsChange(patch);
    if (patch.theme) setTheme(patch.theme);
    try {
      await api.patch("/users/me/settings", patch);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save your preference.", "danger");
    }
  }

  if (!settings) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Appearance settings"
        title="Appearance"
        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-text"
      >
        <IconSettings className="h-4 w-4" />
      </button>

      {open && (
        <Modal
          title="Appearance"
          onClose={() => setOpen(false)}
          footer={
            <button className="btn-primary" onClick={() => setOpen(false)}>
              Done
            </button>
          }
        >
          <div className="space-y-5">
            <div>
              <span className="label">Theme</span>
              <div className="flex gap-2">
                <button
                  className={`btn-secondary ${theme === "light" ? "border-accent text-accent" : ""}`}
                  onClick={() => update({ theme: "light" })}
                >
                  Light
                </button>
                <button
                  className={`btn-secondary ${theme === "dark" ? "border-accent text-accent" : ""}`}
                  onClick={() => update({ theme: "dark" })}
                >
                  Dark
                </button>
              </div>
            </div>

            <div>
              <span className="label">Board theme</span>
              <div className="flex flex-wrap gap-2">
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => update({ boardTheme: t.id })}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      settings.boardTheme === t.id ? "border-accent text-accent" : "border-border text-text-muted hover:bg-surface-raised"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Piece style</span>
              <div className="flex flex-wrap gap-2">
                {PIECE_STYLES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => update({ pieceStyle: p.id })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      settings.pieceStyle === p.id ? "border-accent text-accent" : "border-border text-text-muted hover:bg-surface-raised"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#1b1e1f] text-base leading-none"
                      style={{ color: p.white.fill, textShadow: p.white.shadow, fontWeight: p.fontWeight }}
                    >
                      {p.sample[0]}
                    </span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-text-muted">
              These only change your own view — your opponent keeps their own theme and piece style.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
