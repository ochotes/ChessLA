import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { IconUsers, IconBolt, IconTrophy, IconHistory, IconShield } from "../components/ui/Icons";

const STEPS = [
  {
    icon: IconUsers,
    title: "1. Create your account",
    description: "Sign up with a username, email, and password. Every account starts at a rating of 1200 in each time control.",
  },
  {
    icon: IconBolt,
    title: "2. Find an opponent",
    description: "Use Quick Match to be paired automatically with someone near your rating, challenge a friend directly, or create a private game and share the link or code.",
  },
  {
    icon: IconShield,
    title: "3. Play a fair game",
    description: "Every move you make is checked by the server against the complete rules of chess before it's accepted. Illegal moves are simply rejected, and the clock is tracked server-side so it can't be manipulated.",
  },
  {
    icon: IconTrophy,
    title: "4. Your rating updates",
    description: "When the game ends, both players' ratings update based on the result and each other's rating, calculated separately for bullet, blitz, rapid, and classical.",
  },
  {
    icon: IconHistory,
    title: "5. Review and improve",
    description: "Every completed game is saved to your history. Open any game to replay it move by move and see the material balance shift throughout.",
  },
];

export function HowItWorksPage() {
  usePageMeta("How ChessLA works", "A step-by-step look at how matchmaking, ratings, and fair play work on ChessLA.");

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-3xl font-semibold">How ChessLA works</h1>
      <p className="mt-2 text-text-muted">From creating an account to reviewing your finished games.</p>

      <div className="mt-8 space-y-6">
        {STEPS.map((step) => (
          <div key={step.title} className="card flex gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <step.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-text-muted">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link to="/register" className="btn-primary px-6 py-3 text-base">
          Create free account
        </Link>
      </div>
    </div>
  );
}
