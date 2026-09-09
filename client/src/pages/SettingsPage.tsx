import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { COUNTRIES } from "../lib/countries";
import { Board } from "../components/chessboard/Board";
import { BOARD_THEMES } from "../components/chessboard/boardThemes";
import { PIECE_STYLES } from "../components/chessboard/pieceStyles";
import type { UserSettings } from "../lib/types";

const PREVIEW_FEN = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 5";

export function SettingsPage() {
  usePageMeta("Settings", "Manage your ChessLA account, board, and game preferences.");
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    api.get<{ settings: UserSettings }>("/users/me/settings").then((r) => setSettings(r.settings));
  }, []);

  async function updateSettings(patch: Partial<UserSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.patch("/users/me/settings", patch);
      if (patch.theme) setTheme(patch.theme);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save your settings.", "danger");
    }
  }

  if (!user || !settings) {
    return <div className="mx-auto max-w-2xl py-8 text-text-muted">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card p-5">
        <h2 className="font-semibold">Appearance</h2>
        <div className="mt-3 flex gap-2">
          <button
            className={`btn-secondary ${theme === "light" ? "border-accent text-accent" : ""}`}
            onClick={() => updateSettings({ theme: "light" })}
          >
            Light
          </button>
          <button
            className={`btn-secondary ${theme === "dark" ? "border-accent text-accent" : ""}`}
            onClick={() => updateSettings({ theme: "dark" })}
          >
            Dark
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Board</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="max-w-[220px]">
            <Board
              fen={PREVIEW_FEN}
              orientation="white"
              interactive={false}
              myColor={null}
              lastMove={null}
              onMove={() => {}}
              boardTheme={settings.boardTheme}
              pieceStyle={settings.pieceStyle}
              showCoordinates={false}
            />
          </div>
          <div className="space-y-3">
            <div>
              <span className="label">Board theme</span>
              <div className="flex flex-wrap gap-2">
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updateSettings({ boardTheme: t.id })}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${settings.boardTheme === t.id ? "border-accent text-accent" : "border-border text-text-muted hover:bg-surface-raised"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-text-muted">Only changes your own view — your opponent keeps their own board theme.</p>
            </div>
            <div>
              <span className="label">Piece style</span>
              <div className="flex flex-wrap gap-2">
                {PIECE_STYLES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateSettings({ pieceStyle: p.id })}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${settings.pieceStyle === p.id ? "border-accent text-accent" : "border-border text-text-muted hover:bg-surface-raised"}`}
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
              <p className="mt-1 text-xs text-text-muted">Only changes your own view — your opponent keeps their own piece style.</p>
            </div>
            <div>
              <span className="label">Board orientation</span>
              <select
                className="input"
                value={settings.boardOrientation}
                onChange={(e) => updateSettings({ boardOrientation: e.target.value as UserSettings["boardOrientation"] })}
              >
                <option value="auto">Automatic (my side at the bottom)</option>
                <option value="white">Always white at the bottom</option>
                <option value="black">Always black at the bottom</option>
              </select>
            </div>
            <ToggleRow label="Show legal moves" checked={settings.showLegalMoves} onChange={(v) => updateSettings({ showLegalMoves: v })} />
            <ToggleRow label="Show coordinates" checked={settings.showCoordinates} onChange={(v) => updateSettings({ showCoordinates: v })} />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Game</h2>
        <div className="mt-3 space-y-3">
          <ToggleRow label="Move animations" checked={settings.moveAnimations} onChange={(v) => updateSettings({ moveAnimations: v })} />
          <ToggleRow label="Sound effects" checked={settings.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} />
          <ToggleRow label="Confirm before resigning" checked={settings.confirmResign} onChange={(v) => updateSettings({ confirmResign: v })} />
          <ToggleRow label="Confirm before offering a draw" checked={settings.confirmDrawOffer} onChange={(v) => updateSettings({ confirmDrawOffer: v })} />
        </div>
      </section>

      <AccountSection settings={settings} onUpdateSettings={updateSettings} onRefreshUser={refreshUser} />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm">{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function AccountSection({
  settings,
  onUpdateSettings,
  onRefreshUser,
}: {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onRefreshUser: () => Promise<void>;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api.patch("/users/me/account", { fullName, country, bio });
      await onRefreshUser();
      showToast("Profile updated.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not update profile.", "danger");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    setPasswordError(null);
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError("New password must be at least 8 characters, with a letter and a number.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/users/me/change-password", { currentPassword, newPassword });
      showToast("Password changed.", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <>
      <section className="card p-5">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-3 space-y-3">
          <div>
            <span className="label">Username</span>
            <input className="input" value={user?.username ?? ""} disabled />
            <p className="mt-1 text-xs text-text-muted">Usernames can't be changed once your account is created.</p>
          </div>
          <div>
            <label htmlFor="fullName" className="label">
              Full name
            </label>
            <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="country" className="label">
              Country
            </label>
            <select id="country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bio" className="label">
              Bio
            </label>
            <textarea id="bio" className="input" rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Privacy</h2>
        <div className="mt-3">
          <ToggleRow
            label="Make my profile public"
            checked={settings.profileIsPublic}
            onChange={(v) => onUpdateSettings({ profileIsPublic: v })}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Change password</h2>
        <div className="mt-3 space-y-3">
          {passwordError && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {passwordError}
            </p>
          )}
          <div>
            <label htmlFor="currentPassword" className="label">
              Current password
            </label>
            <input id="currentPassword" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="newPassword" className="label">
              New password
            </label>
            <input id="newPassword" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={changePassword} disabled={changingPassword || !currentPassword || !newPassword}>
            {changingPassword ? "Updating..." : "Change password"}
          </button>
        </div>
      </section>
    </>
  );
}
