import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { Logo } from "../components/Logo";

export function NotFoundPage() {
  usePageMeta("Page not found", "The page you're looking for doesn't exist.");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <Logo className="h-14 w-14 opacity-80" />
      <h1 className="mt-6 text-4xl font-semibold">404</h1>
      <p className="mt-2 text-lg font-medium text-text">This page doesn't exist.</p>
      <p className="mt-2 text-text-muted">
        The link may be broken, the game may have ended, or the page may have moved. Let's get you back
        on the board.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">
          Go home
        </Link>
        <Link to="/play" className="btn-secondary">
          Find a game
        </Link>
      </div>
    </div>
  );
}
