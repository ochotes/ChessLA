import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, isApiError } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";
import { COUNTRIES } from "../lib/countries";

interface FieldErrors {
  username?: string;
  fullName?: string;
  email?: string;
  password?: string;
  country?: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: { username: string; fullName: string; email: string; password: string; country: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username = "3-20 characters: letters, numbers, and underscores only.";
  }
  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  }
  if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (values.password.length < 8 || !/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) {
    errors.password = "At least 8 characters, including a letter and a number.";
  }
  if (!values.country) {
    errors.country = "Select your country.";
  }
  return errors;
}

export function RegisterPage() {
  usePageMeta("Create your free account", "Create a free ChessLA account and start playing real-time chess.");
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ username: "", fullName: "", email: "", password: "", country: "" });
  const [website, setWebsite] = useState(""); // honeypot — real users never see or fill this
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (website) return; // silently drop bot submissions

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      // The honeypot value has to actually reach the server for its own
      // validation (registerSchema's website field) to mean anything — the
      // client-side early-return above only stops a bot that runs this JS
      // at all, not one that calls the API directly.
      await register({ ...values, website });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (isApiError(err) && err.issues) {
        const mapped: FieldErrors = {};
        for (const issue of err.issues) {
          if (issue.path in values) mapped[issue.path as keyof FieldErrors] = issue.message;
        }
        setErrors(mapped);
      }
      setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-10">
      <div className="mb-6 flex flex-col items-center">
        <Logo className="h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-text-muted">Free forever. No credit card required.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6" noValidate>
        {formError && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        {/* Honeypot: hidden from real users via CSS, invisible to screen readers via tabIndex/aria-hidden, but bots that fill every field will trip it. */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <Field label="Username" id="username" error={errors.username}>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={values.username}
            onChange={(e) => update("username", e.target.value)}
            aria-invalid={Boolean(errors.username)}
          />
        </Field>

        <Field label="Full name" id="fullName" error={errors.fullName}>
          <input
            id="fullName"
            className="input"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            aria-invalid={Boolean(errors.fullName)}
          />
        </Field>

        <Field label="Email" id="email" error={errors.email}>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Password" id="password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>

        <Field label="Country" id="country" error={errors.country}>
          <select
            id="country"
            className="input"
            value={values.country}
            onChange={(e) => update("country", e.target.value)}
            aria-invalid={Boolean(errors.country)}
          >
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Creating account..." : "Create free account"}
        </button>

        <p className="text-center text-xs text-text-muted">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="underline hover:text-accent">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-accent">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
