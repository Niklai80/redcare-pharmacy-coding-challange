import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(`Error processing request ${req.method} ${req.path}:`, err);
  const errMsg = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: "Internal Server Error", details: errMsg });
}
