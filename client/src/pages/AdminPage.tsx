import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { IconShield } from "../components/ui/Icons";

type Tab = "overview" | "users" | "reports" | "flags" | "audit";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  country: string;
  createdAt: string;
  gamesPlayed: number;
}
interface AdminReport {
  id: string;
  reporter: string;
  reported: string;
  reportedId: string;
  gameId: string | null;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}
interface AdminFlag {
  id: string;
  gameId: string;
  username: string;
  detail: { type: string; detail: string }[] | null;
  createdAt: string;
}
interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: string | null;
  after: string | null;
  createdAt: string;
}

export function AdminPage() {
  usePageMeta("Admin", "ChessLA administration dashboard.");
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <IconShield className="h-6 w-6" /> Admin
      </h1>

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-border p-1">
        {(["overview", "users", "reports", "flags", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              tab === t ? "bg-accent text-accent-contrast" : "text-text-muted hover:bg-surface-raised"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "flags" && <FlagsTab />}
        {tab === "audit" && user?.role === "ADMIN" && <AuditTab />}
        {tab === "audit" && user?.role !== "ADMIN" && <p className="text-text-muted">Only administrators can view the audit log.</p>}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<{ userCount: number; gameCount: number; inProgress: number; openReports: number } | null>(null);
  useEffect(() => {
    api.get<{ userCount: number; gameCount: number; inProgress: number; openReports: number }>("/admin/stats").then(setStats);
  }, []);
  if (!stats) return <p className="text-text-muted">Loading...</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatBox label="Total users" value={stats.userCount} />
      <StatBox label="Completed games" value={stats.gameCount} />
      <StatBox label="Games in progress" value={stats.inProgress} />
      <StatBox label="Open reports" value={stats.openReports} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function UsersTab() {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);

  async function load() {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await api.get<{ users: AdminUser[] }>(`/admin/users${params}`);
    setUsers(res.users);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id: string, status: string) {
    try {
      await api.post(`/admin/users/${id}/status`, { status });
      showToast("User status updated.", "success");
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not update user.", "danger");
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input className="input" placeholder="Search by username or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn-secondary" onClick={load}>
          Search
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-left">
              <th className="p-3">Username</th>
              <th className="p-3">Country</th>
              <th className="p-3">Games</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{u.username}</td>
                <td className="p-3 text-text-muted">{u.country}</td>
                <td className="p-3 text-text-muted">{u.gamesPlayed}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="p-3">
                  {u.status === "ACTIVE" ? (
                    <div className="flex gap-2">
                      <button className="text-xs font-medium text-warning hover:underline" onClick={() => setStatus(u.id, "SUSPENDED")}>
                        Suspend
                      </button>
                      <button className="text-xs font-medium text-danger hover:underline" onClick={() => setStatus(u.id, "BANNED")}>
                        Ban
                      </button>
                    </div>
                  ) : (
                    <button className="text-xs font-medium text-success hover:underline" onClick={() => setStatus(u.id, "ACTIVE")}>
                      Reinstate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab() {
  const { showToast } = useToast();
  const [reports, setReports] = useState<AdminReport[]>([]);

  async function load() {
    const res = await api.get<{ reports: AdminReport[] }>("/admin/reports?status=OPEN");
    setReports(res.reports);
  }
  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string, status: "RESOLVED" | "DISMISSED") {
    try {
      await api.post(`/admin/reports/${id}/status`, { status });
      showToast("Report updated.", "success");
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not update report.", "danger");
    }
  }

  if (reports.length === 0) return <p className="text-text-muted">No open reports.</p>;

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="card p-4">
          <p className="font-medium">
            {r.reporter} reported {r.reported} &middot; <span className="text-text-muted">{r.reason.replace(/_/g, " ")}</span>
          </p>
          {r.details && <p className="mt-1 text-sm text-text-muted">{r.details}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-danger" onClick={() => resolve(r.id, "RESOLVED")}>
              Mark resolved
            </button>
            <button className="btn-secondary" onClick={() => resolve(r.id, "DISMISSED")}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FlagsTab() {
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  useEffect(() => {
    api.get<{ flags: AdminFlag[] }>("/admin/flags").then((r) => setFlags(r.flags));
  }, []);

  if (flags.length === 0) return <p className="text-text-muted">No suspicious activity flagged recently.</p>;

  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <div key={f.id} className="card p-4 text-sm">
          <p className="font-medium">{f.username}</p>
          <p className="text-text-muted">Game: {f.gameId}</p>
          {f.detail?.map((d, i) => (
            <p key={i} className="mt-1 text-warning">
              {d.detail}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  useEffect(() => {
    api.get<{ logs: AuditLogEntry[] }>("/admin/audit-log").then((r) => setLogs(r.logs));
  }, []);

  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="card p-3 text-xs">
          <p className="font-medium text-text">
            {l.action} &middot; {l.targetType}/{l.targetId}
          </p>
          <p className="text-text-muted">{new Date(l.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
