/** The ChessLA mark: an abstract knight's-move glyph (two squares up, one
 * across) inside a rounded badge. Same artwork as public/favicon.svg, kept
 * as an inline component so it can be recolored/sized without an extra
 * network request wherever it appears in the app chrome. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="ChessLA">
      <rect x="3" y="3" width="94" height="94" rx="24" fill="#0E1414" />
      <path
        d="M36 76 L36 40 L66 40"
        fill="none"
        stroke="#3DB09B"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="66" cy="40" r="7.5" fill="#D6AB52" />
    </svg>
  );
}
