import { Router } from "express";
import { TIME_CONTROLS } from "../game/timeControls.js";

export const timeControlsRouter = Router();

timeControlsRouter.get("/", (_req, res) => {
  res.json({ timeControls: TIME_CONTROLS });
});
