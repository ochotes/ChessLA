import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";

export function ForgotPasswordPage() {
  usePageMeta("Reset your password", "Request a password reset link for your ChessLA account.");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (website) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // The honeypot value has to actually reach the server for its own
      // validation (forgotPasswordSchema's website field) to mean anything
      // — the early-return above only stops a bot that runs this JS at
      // all, not one that calls the API directly.
      await api.post("/auth/forgot-password", { email, website });
      setSent(true);
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
        <h1 className="mt-4 text-2xl font-semibold">Reset your password</h1>
      </div>

      {sent ? (
        <div className="card p-6 text-center text-sm text-text">
          <p>If that email is registered, we've sent a reset link to it. It expires in one hour.</p>
          <Link to="/login" className="btn-secondary mt-4 inline-flex">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-text-muted">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
