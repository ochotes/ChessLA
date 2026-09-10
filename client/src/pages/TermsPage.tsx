import { usePageMeta } from "../hooks/usePageMeta";

export function TermsPage() {
  usePageMeta("Terms and Conditions", "The terms that govern using ChessLA.");

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-semibold">Terms and Conditions</h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: September 2026</p>

      <div className="mt-8 space-y-8 text-[15px] leading-7 text-text">
        <section>
          <h2 className="text-xl font-semibold">1. Acceptance of terms</h2>
          <p className="mt-2 text-text-muted">
            By creating a ChessLA account or using the ChessLA platform, you agree to these terms. If
            you do not agree, please do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Your account</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-text-muted">
            <li>You must provide accurate registration information and keep your password secure.</li>
            <li>You are responsible for activity that happens under your account.</li>
            <li>Each person may hold one account; creating additional accounts to manipulate matchmaking, ratings, or the leaderboard is prohibited.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Fair play</h2>
          <p className="mt-2 text-text-muted">ChessLA is a competitive platform, so we ask everyone to play fairly:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-text-muted">
            <li>No use of chess engines, move suggestions, or other outside assistance during a rated game.</li>
            <li>No deliberately losing games, abandoning games, or colluding with another player to manipulate ratings.</li>
            <li>No harassment, hate speech, or abusive language in chat.</li>
            <li>No attempting to interfere with the server, other players' connections, or the fairness of the clock.</li>
          </ul>
          <p className="mt-2 text-text-muted">
            We use automated checks and human review to detect violations. Accounts found in violation
            may have games voided, ratings adjusted, or be suspended or banned, as described in our
            admin and moderation process.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Content you submit</h2>
          <p className="mt-2 text-text-muted">
            You retain ownership of any profile information, chat messages, or other content you submit.
            By submitting it, you grant ChessLA a license to store and display it as part of operating the
            service (for example, showing your chat messages to your opponent, or your games in your
            public history).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Service availability</h2>
          <p className="mt-2 text-text-muted">
            We aim to keep ChessLA available and your games accurately recorded, but we do not guarantee
            uninterrupted service. In the event of a server issue during a live game, we will make a
            reasonable effort to restore the game state; if that is not possible, the game may be voided
            and excluded from rating calculations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Termination</h2>
          <p className="mt-2 text-text-muted">
            You may stop using ChessLA and request account deletion at any time. We may suspend or
            terminate accounts that violate these terms, with notice where practical, and always with an
            internal record of the reason (see our administration policy below).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Administration and result corrections</h2>
          <p className="mt-2 text-text-muted">
            Administrators can review reported games and, in rare cases such as confirmed cheating,
            correct a game's recorded result. Every such correction is logged with the administrator who
            made it, the reason given, and the prior state. Administrators cannot silently alter a
            completed game.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Disclaimer and limitation of liability</h2>
          <p className="mt-2 text-text-muted">
            ChessLA is provided "as is" without warranties of any kind. To the fullest extent permitted by
            law, ChessLA is not liable for indirect or consequential damages arising from your use of the
            service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Changes to these terms</h2>
          <p className="mt-2 text-text-muted">
            We may update these terms from time to time. Material changes will be announced on this page
            with an updated effective date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Contact</h2>
          <p className="mt-2 text-text-muted">
            Questions about these terms can be sent to{" "}
            <a href="mailto:support@chessla.com" className="text-accent underline">
              support@chessla.com
            </a>
            .
          </p>
        </section>

        <p className="border-t border-border pt-4 text-xs text-text-muted">
          This page describes ChessLA's actual policies as implemented in this build. It is provided for
          transparency and is not a substitute for legal advice. Have it reviewed by counsel before a
          public launch.
        </p>
      </div>
    </div>
  );
}
