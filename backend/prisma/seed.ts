/**
 * Crea un utente per ruolo, così si può entrare subito nell'app.
 * Idempotente: gli utenti già presenti non vengono modificati.
 *
 *   npm run seed                       → password "canoa1234"
 *   SEED_PASSWORD="..." npm run seed   → password scelta (consigliato fuori dal locale)
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "admin@canoaclub.local", firstName: "Anna", lastName: "Amministratrice", role: Role.ADMIN },
  { email: "istruttore@canoaclub.local", firstName: "Ivo", lastName: "Istruttore", role: Role.INSTRUCTOR },
  { email: "socio@canoaclub.local", firstName: "Sara", lastName: "Socia", role: Role.MEMBER },
];

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "canoa1234", 10);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
    console.log(`✓ ${user.role.padEnd(10)} ${user.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
