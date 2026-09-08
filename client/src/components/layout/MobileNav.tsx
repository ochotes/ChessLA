import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { IconPlay, IconUsers, IconHistory, IconUser } from "../ui/Icons";

// Section 29/37: on small screens, navigation collapses to five items fixed
// to the bottom of the viewport rather than a top bar competing for space
// with the board.
export function MobileNav() {
  const { user } = useAuth();
  if (!user) return null;

  const items = [
    { to: "/dashboard", label: "Home", icon: IconHistory },
    { to: "/play", label: "Play", icon: IconPlay },
    { to: "/friends", label: "Friends", icon: IconUsers },
    { to: `/profile/${user.username}`, label: "Profile", icon: IconUser },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main mobile"
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
              isActive ? "text-accent" : "text-text-muted"
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
