import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN", "MODERATOR"));

async function writeAuditLog(actorId: string, action: string, targetType: string, targetId: string, before?: unknown, after?: unknown) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      before: before !== undefined ? JSON.stringify(before) : null,
      after: after !== undefined ? JSON.stringify(after) : null,
    },
  });
}

adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ usernameLower: { contains: q } }, { emailLower: { contains: q } }] } : undefined,
    include: { rating: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      country: u.country,
      createdAt: u.createdAt,
      gamesPlayed: u.rating?.gamesPlayed ?? 0,
    })),
  });
});

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]), reason: z.string().max(500).optional() });

adminRouter.post("/users/:id/status", validateBody(statusSchema), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found." });
  // A moderator/admin's own account can't be neutralized through this endpoint
  // by someone else's mistake: a moderator may act on ordinary players, but
  // changing a fellow staff member's status requires an admin.
  if ((target.role === "ADMIN" || target.role === "MODERATOR") && req.user!.role !== "ADMIN") {
    return res.status(403).json({ error: "Only an admin can change another staff member's status." });
  }
  const updated = await prisma.user.update({ where: { id: target.id }, data: { status: req.body.status } });
  await writeAuditLog(req.user!.sub, "user.status_change", "user", target.id, { status: target.status }, { status: updated.status, reason: req.body.reason });
  res.json({ ok: true, user: { id: updated.id, status: updated.status } });
});

const roleSchema = z.object({ role: z.enum(["PLAYER", "MODERATOR", "ADMIN"]) });

adminRouter.post("/users/:id/role", requireRole("ADMIN"), validateBody(roleSchema), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found." });
  const updated = await prisma.user.update({ where: { id: target.id }, data: { role: req.body.role } });
  await writeAuditLog(req.user!.sub, "user.role_change", "user", target.id, { role: target.role }, { role: updated.role });
  res.json({ ok: true, user: { id: updated.id, role: updated.role } });
});

adminRouter.get("/reports", async (req, res) => {
  const status = String(req.query.status ?? "OPEN");
  const reports = await prisma.report.findMany({
    where: { status },
    include: { reporter: true, reported: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({
    reports: reports.map((r) => ({
      id: r.id,
      reporter: r.reporter.username,
      reported: r.reported.username,
      reportedId: r.reportedId,
      gameId: r.gameId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
});

const resolveReportSchema = z.object({ status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]) });

adminRouter.post("/reports/:id/status", validateBody(resolveReportSchema), async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: "Report not found." });
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { status: req.body.status, resolvedAt: req.body.status === "RESOLVED" || req.body.status === "DISMISSED" ? new Date() : null },
  });
  await writeAuditLog(req.user!.sub, "report.status_change", "report", report.id, { status: report.status }, { status: updated.status });
  res.json({ ok: true });
});

/** Suspicious-activity feed sourced from the inline anti-cheat heuristics (see server/src/anticheat). */
adminRouter.get("/flags", async (_req, res) => {
  const events = await prisma.gameEvent.findMany({
    where: { type: "flag_suspicious" },
    include: { user: true, game: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({
    flags: events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      username: e.user?.username ?? "unknown",
      detail: e.metadata ? JSON.parse(e.metadata) : null,
      createdAt: e.createdAt,
    })),
  });
});

adminRouter.get("/games/:id", async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    include: { whitePlayer: true, blackPlayer: true, moves: { orderBy: { moveNumber: "asc" } }, events: { include: { user: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!game) return res.status(404).json({ error: "Game not found." });
  res.json({ game });
});

// Completed results are never silently rewritten. This endpoint appends a
// correction and audit trail rather than mutating history invisibly, per
// section 38's "must not be able to secretly alter completed game results
// without creating an auditable record".
const overrideSchema = z.object({ result: z.enum(["1-0", "0-1", "1/2-1/2"]), terminationReason: z.string().max(60), reason: z.string().min(1).max(1000) });

adminRouter.post("/games/:id/override-result", requireRole("ADMIN"), validateBody(overrideSchema), async (req, res) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.status !== "COMPLETED") return res.status(400).json({ error: "Only completed games can be corrected." });

  const before = { result: game.result, terminationReason: game.terminationReason };
  const updated = await prisma.game.update({
    where: { id: game.id },
    data: { result: req.body.result, terminationReason: `admin_override:${req.body.terminationReason}` },
  });
  await prisma.gameEvent.create({
    data: { gameId: game.id, userId: req.user!.sub, type: "admin_override", metadata: JSON.stringify({ reason: req.body.reason, before, after: { result: updated.result } }) },
  });
  await writeAuditLog(req.user!.sub, "game.override_result", "game", game.id, before, { result: updated.result, reason: req.body.reason });
  res.json({ ok: true, game: { id: updated.id, result: updated.result, terminationReason: updated.terminationReason } });
});

adminRouter.get("/audit-log", requireRole("ADMIN"), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ logs });
});

adminRouter.get("/stats", async (_req, res) => {
  const [userCount, gameCount, inProgress, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.game.count({ where: { status: "COMPLETED" } }),
    prisma.game.count({ where: { status: "IN_PROGRESS" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);
  res.json({ userCount, gameCount, inProgress, openReports });
});
