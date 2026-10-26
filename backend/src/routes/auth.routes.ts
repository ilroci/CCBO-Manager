import { Router } from "express";
import { z } from "zod";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  publicUserSelect,
  signAccessToken,
  verifyPassword,
} from "../lib/auth";
import { env } from "../config/env";
import { badRequest, unauthorized } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { passwordSchema } from "./schemas";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/** POST /api/auth/login → { token, user, adminOnlyEdits } */
authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  // Stesso messaggio per email inesistente, password errata o utente disattivato.
  if (!user || !valid || !user.isActive) throw unauthorized("Email o password non corretti");

  const { passwordHash: _omit, ...publicUser } = user;
  res.json({ token: signAccessToken(user), user: publicUser, adminOnlyEdits: env.adminOnlyEdits });
});

/** GET /api/auth/me → utente corrente e modalità sola consultazione */
authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user, adminOnlyEdits: env.adminOnlyEdits });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

/** POST /api/auth/change-password → 204 */
authRouter.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const userId = req.user!.id;

  const { passwordHash } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(currentPassword, passwordHash))) {
    throw badRequest("La password attuale non è corretta");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
    select: publicUserSelect,
  });
  res.status(204).end();
});
