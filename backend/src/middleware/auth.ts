import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { publicUserSelect, verifyAccessToken } from "../lib/auth";
import { forbidden, unauthorized } from "../lib/http-error";
import { prisma } from "../lib/prisma";

/**
 * Verifica il token Bearer e carica l'utente dal database.
 * Ruolo e stato attivo vengono letti dal DB a ogni richiesta, quindi un cambio di ruolo
 * o una disattivazione hanno effetto subito, senza attendere la scadenza del token.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw unauthorized();

  const userId = verifyAccessToken(token);
  if (!userId) throw unauthorized("Sessione non valida o scaduta");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user || !user.isActive) throw unauthorized("Utente non abilitato");

  req.user = user;
  next();
}

/** Consente l'accesso solo ai ruoli indicati. Va montato dopo `authenticate`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Modalità sola consultazione (`ADMIN_ONLY_EDITS`): ogni richiesta che modifica dati è
 * riservata all'amministratore. Restano libere login, cambio password e il form Consigli.
 * Va montato su /api prima dei router.
 */
export async function adminOnlyWrites(req: Request, res: Response, next: NextFunction) {
  if (!env.adminOnlyEdits || READ_METHODS.has(req.method)) return next();
  if (req.path.startsWith("/auth/") || req.path === "/suggestions") return next();
  await authenticate(req, res, () => {});
  if (req.user!.role !== Role.ADMIN) {
    throw forbidden("Il sito è in sola consultazione: le modifiche sono riservate all'amministratore");
  }
  next();
}
