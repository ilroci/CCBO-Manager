/**
 * Crea un utente per ruolo e un inventario di esempio, così si può usare subito l'app.
 * Idempotente: utenti e pezzi già presenti (stessa email / numero di serie) non vengono modificati.
 *
 *   npm run seed                       → password "canoa1234"
 *   SEED_PASSWORD="..." npm run seed   → password scelta (consigliato fuori dal locale)
 *   SEED_DEMO_DATA=false npm run seed  → solo utenti, senza inventario di esempio (produzione)
 */
import { EquipmentCategory, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "admin@canoaclub.local", firstName: "Anna", lastName: "Amministratrice", role: Role.ADMIN },
  { email: "istruttore@canoaclub.local", firstName: "Ivo", lastName: "Istruttore", role: Role.INSTRUCTOR },
  { email: "socio@canoaclub.local", firstName: "Sara", lastName: "Socia", role: Role.MEMBER },
];

const { CANOE, PADDLE, HELMET, WATER_JACKET, SPRAY_DECK, WETSUIT } = EquipmentCategory;

const equipment = [
  { category: CANOE, brand: "Dagger", model: "Mamba 8.1", size: "300 L", serialNumber: "CAN-0001", description: "Canoa da fiume, creek" },
  { category: CANOE, brand: "Dagger", model: "Mamba 8.1", size: "300 L", serialNumber: "CAN-0002", description: "Canoa da fiume, creek" },
  { category: CANOE, brand: "Pyranha", model: "Burn IV", size: "M · 310 L", serialNumber: "CAN-0003", description: "River running" },
  { category: CANOE, brand: "Wavesport", model: "Diesel 75", size: "290 L", serialNumber: "CAN-0004", description: "Scuola e principianti" },
  { category: CANOE, brand: "Jackson Kayak", model: "Zen 3.0", size: "M · 280 L", serialNumber: "CAN-0005" },
  { category: PADDLE, brand: "Werner", model: "Powerhouse", size: "197 cm", serialNumber: "PAG-0001" },
  { category: PADDLE, brand: "Werner", model: "Powerhouse", size: "197 cm", serialNumber: "PAG-0002" },
  { category: PADDLE, brand: "AT Paddles", model: "AT2 Flex", size: "194 cm", serialNumber: "PAG-0003" },
  { category: PADDLE, brand: "Select", model: "Fusion", size: "200 cm", serialNumber: "PAG-0004" },
  { category: HELMET, brand: "Sweet Protection", model: "Rocker", size: "M/L", serialNumber: "CAS-0001" },
  { category: HELMET, brand: "Sweet Protection", model: "Rocker", size: "S/M", serialNumber: "CAS-0002" },
  { category: HELMET, brand: "WRSI", model: "Trident", size: "L/XL", serialNumber: "CAS-0003" },
  { category: WATER_JACKET, brand: "Palm", model: "Atom", size: "M", serialNumber: "GIA-0001", description: "Giacca d'acqua corta" },
  { category: WATER_JACKET, brand: "Palm", model: "Atom", size: "L", serialNumber: "GIA-0002", description: "Giacca d'acqua corta" },
  { category: WATER_JACKET, brand: "Peak UK", model: "Tourlite", size: "S", serialNumber: "GIA-0003" },
  { category: SPRAY_DECK, brand: "Seals", model: "Pro Shocker", size: "1.7", serialNumber: "PAR-0001" },
  { category: SPRAY_DECK, brand: "Seals", model: "Pro Shocker", size: "2.2", serialNumber: "PAR-0002" },
  { category: SPRAY_DECK, brand: "Immersion Research", model: "Shockwave", size: "M/L", serialNumber: "PAR-0003" },
  { category: WETSUIT, brand: "Prijon", model: "Long John 3 mm", size: "M", serialNumber: "MUT-0001" },
  { category: WETSUIT, brand: "Prijon", model: "Long John 3 mm", size: "L", serialNumber: "MUT-0002" },
  { category: WETSUIT, brand: "Hiko", model: "Neoprene 4 mm", size: "S", serialNumber: "MUT-0003" },
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

  if (process.env.SEED_DEMO_DATA === "false") return;

  for (const item of equipment) {
    await prisma.equipmentItem.upsert({
      where: { serialNumber: item.serialNumber },
      update: {},
      create: item,
    });
  }
  console.log(`✓ inventario: ${equipment.length} pezzi di esempio`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
