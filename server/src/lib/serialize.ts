import type { Rating, User } from "@prisma/client";

/** Shapes exactly what the client is allowed to see. Never spreads a raw
 * Prisma `User` record over the wire — that would leak passwordHash, email
 * (to other users), and internal fields. */
export function toPublicProfile(user: User, rating: Rating) {
  const winRate = rating.gamesPlayed > 0 ? Math.round((rating.wins / rating.gamesPlayed) * 1000) / 10 : 0;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    country: user.country,
    profilePicture: user.profilePicture,
    bio: user.bio,
    role: user.role,
    memberSince: user.createdAt,
    rating: {
      bullet: rating.bulletRating,
      blitz: rating.blitzRating,
      rapid: rating.rapidRating,
      classical: rating.classicalRating,
      highest: rating.highestRating,
    },
    stats: {
      gamesPlayed: rating.gamesPlayed,
      wins: rating.wins,
      losses: rating.losses,
      draws: rating.draws,
      winRate,
      currentStreak: rating.currentStreak,
    },
  };
}

/** Includes the caller's own email — only ever returned to that same user (e.g. /me, /settings). */
export function toOwnProfile(user: User, rating: Rating) {
  return { ...toPublicProfile(user, rating), email: user.email };
}

export type PublicProfile = ReturnType<typeof toPublicProfile>;
