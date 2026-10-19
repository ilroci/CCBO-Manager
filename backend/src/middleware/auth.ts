import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
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
