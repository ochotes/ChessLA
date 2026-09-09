import { Router } from "express";
import { ENGINE_TIERS } from "../engine/engineTiers.js";

export const enginesRouter = Router();

enginesRouter.get("/", (_req, res) => {
  res.json({ engines: ENGINE_TIERS.map(({ id, name, eloMin, eloMax, targetElo, blurb }) => ({ id, name, eloMin, eloMax, targetElo, blurb })) });
});
