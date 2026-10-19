/**
 * Crea un utente per ruolo, il listino del club (noleggi e trasporto) e un inventario di esempio.
 * Idempotente: utenti, voci di listino e pezzi già presenti (stessa email / nome / numero di serie)
 * non vengono modificati.
 *
 *   npm run seed                       → password "canoa1234"
 *   SEED_PASSWORD="..." npm run seed   → password scelta (consigliato fuori dal locale)
 *   SEED_DEMO_DATA=false npm run seed  → solo utenti, senza inventario di esempio (produzione)
 */
import { EquipmentCategory, PrismaClient, Role, ServiceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { email: "admin@canoaclub.local", firstName: "Anna", lastName: "Amministratrice", role: Role.ADMIN },
  { email: "istruttore@canoaclub.local", firstName: "Ivo", lastName: "Istruttore", role: Role.INSTRUCTOR },
  { email: "socio@canoaclub.local", firstName: "Sara", lastName: "Socia", role: Role.MEMBER },
];

/**
 * Istruttori e soci del club, solo per l'ambiente locale (insieme all'inventario di esempio).
 * Cognomi da completare dalla pagina Utenti; stessa password degli utenti demo.
 */
const clubUsers = [
  { email: "giacomo@canoaclub.local", firstName: "Giacomo", lastName: "—", role: Role.INSTRUCTOR },
  { email: "francesco@canoaclub.local", firstName: "Francesco", lastName: "—", role: Role.INSTRUCTOR },
  { email: "eleonora@canoaclub.local", firstName: "Eleonora", lastName: "—", role: Role.INSTRUCTOR },
  { email: "salvo@canoaclub.local", firstName: "Salvo", lastName: "—", role: Role.MEMBER },
  { email: "fra@canoaclub.local", firstName: "Fra", lastName: "—", role: Role.MEMBER },
  { email: "bula@canoaclub.local", firstName: "Bula", lastName: "—", role: Role.MEMBER },
  { email: "giovanni@canoaclub.local", firstName: "Giovanni", lastName: "—", role: Role.MEMBER },
  { email: "andrea.cobi@canoaclub.local", firstName: "Andrea", lastName: "Cobi", role: Role.MEMBER },
];

const { CANOE, PADDLE, HELMET, WATER_JACKET, SPRAY_DECK, WETSUIT, LIFE_JACKET } = EquipmentCategory;

/** Listino reale del club (prezzi al giorno): creato anche in produzione. */
const rentalOptions = [
  {
    name: "Pacchetto Kayak",
    description: "Kayak, pagaia, paraspruzzi, salvagente e casco",
    categories: [CANOE, PADDLE, SPRAY_DECK, LIFE_JACKET, HELMET],
    dailyPrice: "15",
    sortOrder: 1,
  },
  { name: "Giacca d'acqua", description: null, categories: [WATER_JACKET], dailyPrice: "5", sortOrder: 2 },
  { name: "Muta", description: null, categories: [WETSUIT], dailyPrice: "5", sortOrder: 3 },
];

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
  { category: LIFE_JACKET, brand: "Palm", model: "FXr", size: "M/L", serialNumber: "SAL-0001", description: "Salvagente da fiume" },
  { category: LIFE_JACKET, brand: "Palm", model: "FXr", size: "S/M", serialNumber: "SAL-0002", description: "Salvagente da fiume" },
  { category: LIFE_JACKET, brand: "Peak UK", model: "Explorer Zip", size: "L/XL", serialNumber: "SAL-0003" },
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

  for (const option of rentalOptions) {
    await prisma.rentalOption.upsert({ where: { name: option.name }, update: {}, create: option });
  }
  console.log(`✓ listino: ${rentalOptions.map((o) => o.name).join(", ")}`);

  // Uscite, tariffe fisse per uscita: quota furgone (opzione A) e solo trasporto attrezzatura (B).
  for (const type of [ServiceType.VAN_SEAT, ServiceType.EQUIPMENT_TRANSPORT]) {
    await prisma.serviceFee.upsert({ where: { type }, update: {}, create: { type, amount: "5" } });
  }
  console.log("✓ uscite: quota furgone 5 €, trasporto attrezzatura 5 €");

  if (process.env.SEED_DEMO_DATA === "false") return;

  for (const user of clubUsers) {
    await prisma.user.upsert({ where: { email: user.email }, update: {}, create: { ...user, passwordHash } });
  }
  console.log(`✓ utenti del club: ${clubUsers.map((u) => u.firstName).join(", ")}`);

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
