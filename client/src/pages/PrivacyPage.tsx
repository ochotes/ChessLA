import { usePageMeta } from "../hooks/usePageMeta";

export function PrivacyPage() {
  usePageMeta("Privacy Policy", "How ChessLA collects, uses, and protects your data.");

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: September 2026</p>

      <div className="prose-content mt-8 space-y-8 text-[15px] leading-7 text-text">
        <section>
          <h2 className="text-xl font-semibold">1. What this covers</h2>
          <p className="mt-2 text-text-muted">
            This policy explains what information ChessLA collects when you create an account and play
            chess, why we collect it, and the choices you have. It applies to the ChessLA website and
            any ChessLA apps that link to it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Information we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-text-muted">
            <li><strong className="text-text">Account information:</strong> username, full name, email address, country, and a securely hashed password. We never store your password in plain text.</li>
            <li><strong className="text-text">Gameplay data:</strong> every move you make, game results, time control, chat messages sent in a game, and your rating history. This is the core record that makes game history, replay, and ratings work.</li>
            <li><strong className="text-text">Technical data:</strong> IP address and basic request metadata, used only for rate limiting, abuse prevention, and keeping the service secure.</li>
            <li><strong className="text-text">Optional analytics:</strong> only if you accept the analytics cookie in the consent banner. If you decline, no analytics script loads at all.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Cookies we use</h2>
          <table className="mt-3 w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr className="bg-surface-raised text-left">
                <th className="p-3">Cookie</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="p-3 font-mono text-xs">chessla_at / chessla_rt</td>
                <td className="p-3 text-text-muted">Keeps you signed in (access and refresh session tokens).</td>
                <td className="p-3 text-text-muted">Essential</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-mono text-xs">chessla_csrf</td>
                <td className="p-3 text-text-muted">Protects your account from cross-site request forgery.</td>
                <td className="p-3 text-text-muted">Essential</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-mono text-xs">chessla_theme / chessla_cookie_consent</td>
                <td className="p-3 text-text-muted">Remembers your light/dark theme and cookie choice, stored in your browser only.</td>
                <td className="p-3 text-text-muted">Preference</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-mono text-xs">Analytics (optional)</td>
                <td className="p-3 text-text-muted">Aggregate usage statistics. Only loaded after you accept.</td>
                <td className="p-3 text-text-muted">Optional</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. How we use your information</h2>
          <p className="mt-2 text-text-muted">
            We use your data to operate the core service: authenticating you, matching you with
            opponents, running and recording games, calculating ratings, showing leaderboards, and
            enabling features you choose to use like friends and chat. We also use technical data to
            detect abuse, enforce fair play, and keep the platform secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. What we don't do</h2>
          <p className="mt-2 text-text-muted">
            We do not sell your personal information. We do not show gameplay data to third parties
            beyond what is necessary to run the service (for example, our hosting and email providers,
            each bound by their own security obligations).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Your choices</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-text-muted">
            <li>You can update your account details, profile visibility, and password at any time in Settings.</li>
            <li>You can decline analytics cookies at any time; the banner reappears if you clear your browser storage.</li>
            <li>You can request a copy of your data or ask us to delete your account by contacting support at the address below.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Data retention</h2>
          <p className="mt-2 text-text-muted">
            We keep account and game data for as long as your account is active, so your history and
            ratings remain accurate. If you delete your account, we remove your personal information
            within a reasonable period, though anonymized game records may be retained for the
            integrity of other players' history and the leaderboard.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Contact</h2>
          <p className="mt-2 text-text-muted">
            Questions about this policy or your data can be sent to{" "}
            <a href="mailto:privacy@chessla.com" className="text-accent underline">
              privacy@chessla.com
            </a>
            .
          </p>
        </section>

        <p className="border-t border-border pt-4 text-xs text-text-muted">
          This page describes ChessLA's actual data practices as implemented. It is provided for
          transparency and is not a substitute for legal advice. Before a public launch, have it
          reviewed by counsel familiar with the privacy laws of the regions you operate in (for
          example GDPR in the EU/UK or CCPA in California).
        </p>
      </div>
    </div>
  );
}
