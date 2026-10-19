import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Prisma, Role } from "@prisma/client";
import { env } from "../config/env";

const BCRYPT_ROUNDS = 10;

/** Campi dell'utente esposti dalle API: mai `passwordHash`. */
export const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash fittizio usato quando l'email non esiste, così il tempo di risposta del login
 * non rivela quali indirizzi sono registrati.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("password-inesistente", BCRYPT_ROUNDS);

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(user: { id: string; role: Role }): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

/** Restituisce l'id utente contenuto nel token, oppure `null` se il token non è valido o è scaduto. */
export function verifyAccessToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    return typeof decoded === "object" && typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}
