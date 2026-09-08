import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  IconPlay,
  IconBolt,
  IconUsers,
  IconTrophy,
  IconHistory,
  IconUser,
  IconSettings,
  IconMoon,
  IconSun,
  IconMenu,
  IconClose,
  IconShield,
} from "../ui/Icons";
import { Logo } from "../Logo";
import { NotificationBell } from "./NotificationBell";

const LINKS = [
  { to: "/play", label: "Play", icon: IconPlay },
  { to: "/friends", label: "Friends", icon: IconUsers },
  { to: "/leaderboard", label: "Leaderboard", icon: IconTrophy },
  { to: "/history", label: "Games", icon: IconHistory },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold tracking-tight">ChessLA</span>
        </NavLink>

        {user && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-raised hover:text-text"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            {(user.role === "ADMIN" || user.role === "MODERATOR") && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-raised hover:text-text"
                  }`
                }
              >
                <IconShield className="h-4 w-4" />
                Admin
              </NavLink>
            )}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-raised hover:text-text"
          >
            {theme === "dark" ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
          </button>

          {user && <NotificationBell />}

          {user ? (
            <>
              <NavLink
                to={`/profile/${user.username}`}
                className="hidden items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-raised sm:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm font-medium">{user.username}</span>
              </NavLink>
              <button className="btn-ghost hidden sm:inline-flex" onClick={() => { void logout(); navigate("/"); }}>
                Sign out
              </button>
              <button
                className="rounded-lg p-2 text-text-muted hover:bg-surface-raised md:hidden"
                aria-label="Open menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink to="/login" className="btn-ghost">
                Sign in
              </NavLink>
              <NavLink to="/register" className="btn-primary">
                Create account
              </NavLink>
            </div>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <nav className="border-t border-border px-4 py-2 md:hidden" aria-label="Main mobile">
          {[...LINKS, { to: "/settings", label: "Settings", icon: IconSettings }, { to: `/profile/${user.username}`, label: "Profile", icon: IconUser }].map(
            ({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-text hover:bg-surface-raised"
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            )
          )}
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-danger hover:bg-surface-raised"
            onClick={() => { void logout(); navigate("/"); }}
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
