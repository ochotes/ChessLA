import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Server-side validation is authoritative. Client-side form validation is a
 * courtesy for instant feedback; nothing here trusts it. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Some of the information provided is invalid.",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}
