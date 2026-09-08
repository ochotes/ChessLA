import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { IconBell } from "../ui/Icons";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await api.get<{ notifications: NotificationItem[] }>("/notifications");
    setNotifications(res.notifications);
  }

  useEffect(() => {
    load();
    // Any of these real-time events means something new is worth refetching for.
    const socket = getSocket();
    const refresh = () => load();
    socket.on("invitation:received", refresh);
    socket.on("invitation:accepted", refresh);
    socket.on("friend:request", refresh);
    socket.on("friend:accepted", refresh);
    return () => {
      socket.off("invitation:received", refresh);
      socket.off("invitation:accepted", refresh);
      socket.off("friend:request", refresh);
      socket.off("friend:accepted", refresh);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-text-muted hover:bg-surface-raised hover:text-text"
      >
        <IconBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-accent-contrast">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-80 max-w-[90vw] p-2 shadow-raised">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button className="text-xs font-medium text-accent hover:underline" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-text-muted">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-raised ${
                    n.isRead ? "text-text-muted" : "text-text"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                    <span>
                      <span className="block font-medium">{n.title}</span>
                      <span className="block text-xs text-text-muted">{n.body}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
