import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, isApiError } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";

export function LoginPage() {
  usePageMeta("Sign in", "Sign in to your ChessLA account to play.");
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Enter your username or email and your password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-10">
      <div className="mb-6 flex flex-col items-center">
        <Logo className="h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-text-muted">Sign in to continue your game.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="identifier" className="label">
            Username or email
          </label>
          <input
            id="identifier"
            className="input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Link to="/forgot-password" className="mt-1.5 inline-block text-sm text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-text-muted">
        New to ChessLA?{" "}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
