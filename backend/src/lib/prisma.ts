import { PrismaClient } from "@prisma/client";

/**
 * Istanza unica di PrismaClient condivisa da tutta l'app.
 * In sviluppo (tsx watch) evita di aprire nuove connessioni a ogni reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
