import type { Rating } from "@prisma/client";
import type { TimeControlCategory } from "../game/timeControls.js";

const FIELD_BY_CATEGORY: Record<TimeControlCategory, keyof Rating> = {
  bullet: "bulletRating",
  blitz: "blitzRating",
  rapid: "rapidRating",
  classical: "classicalRating",
};

export function ratingFieldFor(category: TimeControlCategory): keyof Rating {
  return FIELD_BY_CATEGORY[category];
}

export function ratingFor(rating: Rating, category: TimeControlCategory): number {
  return rating[FIELD_BY_CATEGORY[category]] as number;
}
