export type TimeControlCategory = "bullet" | "blitz" | "rapid" | "classical";

export interface TimeControl {
  id: string;
  category: TimeControlCategory;
  label: string;
  initialTimeMs: number;
  incrementMs: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  fullName: string;
  country: string;
  profilePicture: string | null;
  bio: string | null;
  role: "PLAYER" | "MODERATOR" | "ADMIN";
  memberSince: string;
  rating: { bullet: number; blitz: number; rapid: number; classical: number; highest: number };
  stats: { gamesPlayed: number; wins: number; losses: number; draws: number; winRate: number; currentStreak: number };
  email?: string;
}

export interface PlayerSummary {
  id: string;
  username: string;
  country: string;
  profilePicture: string | null;
  rating: number;
}

export type Side = "white" | "black";

export interface GameStateDTO {
  id: string;
  fen: string;
  turn: "w" | "b";
  status: "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  result: string | null;
  terminationReason: string | null;
  isRated: boolean;
  timeControl: Pick<TimeControl, "category" | "label" | "initialTimeMs" | "incrementMs">;
  white: PlayerSummary;
  black: PlayerSummary;
  clocks: { white: number; black: number };
  moveHistorySan: string[];
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  drawOfferBy: Side | null;
  connection: { white: boolean; black: boolean };
  ratingChange?: { white: number; black: number } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  country: string;
  rating: number;
  gamesPlayed: number;
}

export interface GameHistoryEntry {
  id: string;
  opponent: { username: string; country: string };
  playedAs: Side;
  timeControl: string;
  timeControlCategory: TimeControlCategory;
  result: "win" | "loss" | "draw";
  terminationReason: string | null;
  moveCount: number;
  ratingChange: number | null;
  completedAt: string;
}

export interface GameReplay {
  id: string;
  status: string;
  result: string | null;
  terminationReason: string | null;
  timeControl: string;
  timeControlCategory: TimeControlCategory;
  startingFen: string;
  currentFen: string;
  pgn: string;
  isRated: boolean;
  white: { username: string; country: string; rating?: number } | null;
  black: { username: string; country: string; rating?: number } | null;
  moves: { moveNumber: number; player: Side; san: string; fenAfter: string; clockWhiteMs: number; clockBlackMs: number }[];
  createdAt: string;
  completedAt: string | null;
}

export interface FriendSummary {
  id: string;
  username: string;
  country: string;
  profilePicture: string | null;
  rating: number;
  online?: boolean;
}

export interface UserSettings {
  boardTheme: string;
  pieceStyle: string;
  boardOrientation: "auto" | "white" | "black";
  showLegalMoves: boolean;
  showCoordinates: boolean;
  moveAnimations: boolean;
  soundEffects: boolean;
  confirmResign: boolean;
  confirmDrawOffer: boolean;
  theme: "dark" | "light";
  profileIsPublic: boolean;
}
