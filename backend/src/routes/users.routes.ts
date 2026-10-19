import { Role, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { hashPassword, publicUserSelect } from "../lib/auth";
import { badRequest } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { passwordSchema } from "./schemas";

export const usersRouter = Router();

usersRouter.use(authenticate);

const listQuerySchema = z.object({
  role: z.enum(Role).optional(),
  active: z.enum(["true", "false"]).optional(),
  q: z.string().trim().optional(),
});

/**
 * GET /api/users — elenco iscritti.
 * Anche l'istruttore può leggerlo: serve per scegliere i soci nel wizard dell'uscita.
 */
usersRouter.get("/", authorize(Role.ADMIN, Role.INSTRUCTOR), async (req, res) => {
  const { role, active, q } = listQuerySchema.parse(req.query);

  const where: Prisma.UserWhereInput = {
    role,
    isActive: active === undefined ? undefined : active === "true",
    OR: q
      ? [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const users = await prisma.user.findMany({
    where,
    select: publicUserSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  res.json({ users });
});

const idParamsSchema = z.object({ id: z.string().min(1) });

usersRouter.get("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: publicUserSelect,
  });
  res.json({ user });
});

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().min(1).nullish(),
  role: z.enum(Role).default(Role.MEMBER),
});

usersRouter.post("/", authorize(Role.ADMIN), async (req, res) => {
  const { password, ...data } = createUserSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await hashPassword(password) },
    select: publicUserSelect,
  });
  res.status(201).json({ user });
});

const updateUserSchema = createUserSchema
  .omit({ role: true })
  .partial()
  .extend({
    role: z.enum(Role).optional(),
    isActive: z.boolean().optional(),
  });

/**
 * PATCH /api/users/:id — modifica anagrafica, ruolo, stato o password.
 * Non c'è DELETE: un utente si disattiva (`isActive: false`) per non perdere lo storico.
 */
usersRouter.patch("/:id", authorize(Role.ADMIN), async (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const { password, ...data } = updateUserSchema.parse(req.body);
  const isSelf = id === req.user!.id;

  // Evita che un amministratore si chiuda fuori da solo.
  if (isSelf && data.isActive === false) throw badRequest("Non puoi disattivare il tuo account");
  if (isSelf && data.role && data.role !== Role.ADMIN) {
    throw badRequest("Non puoi rimuovere il ruolo di amministratore a te stesso");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...data,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
    select: publicUserSelect,
  });
  res.json({ user });
});
