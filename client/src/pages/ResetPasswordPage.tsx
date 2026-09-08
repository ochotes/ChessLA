import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";

export function ResetPasswordPage() {
  usePageMeta("Set a new password", "Choose a new password for your ChessLA account.");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-text">This password reset link is missing its token.</p>
        <Link to="/forgot-password" className="btn-primary mt-4 inline-flex">
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters, with a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-10">
      <div className="mb-6 flex flex-col items-center">
        <Logo className="h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold">Choose a new password</h1>
      </div>

      {done ? (
        <div className="card p-6 text-center text-sm text-text">
          <p>Your password has been reset. Redirecting you to sign in...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password" className="label">
              New password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}
