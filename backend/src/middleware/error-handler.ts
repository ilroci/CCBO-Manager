import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Risorsa non trovata" });
}

/** Gestore centrale: Express 5 inoltra qui anche gli errori dei middleware async. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Dati non validi",
      details: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Esiste già un record con questi dati univoci" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Risorsa non trovata" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Errore interno del server" });
}
