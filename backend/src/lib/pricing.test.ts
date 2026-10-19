import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { calendarDays, parseDate } from "./dates";
import { computeCharges, type PriceOption } from "./pricing";

const listino: PriceOption[] = [
  {
    id: "kayak",
    name: "Pacchetto Kayak",
    dailyPrice: new Prisma.Decimal(15),
    categories: ["CANOE", "PADDLE", "SPRAY_DECK", "LIFE_JACKET", "HELMET"],
  },
  { id: "giacca", name: "Giacca d'acqua", dailyPrice: new Prisma.Decimal(5), categories: ["WATER_JACKET"] },
  { id: "muta", name: "Muta", dailyPrice: new Prisma.Decimal(5), categories: ["WETSUIT"] },
];

describe("calendarDays", () => {
  it("stesso giorno = 1", () => assert.equal(calendarDays(parseDate("2026-06-06"), parseDate("2026-06-06")), 1));
  it("sabato-domenica = 2", () => assert.equal(calendarDays(parseDate("2026-06-06"), parseDate("2026-06-07")), 2));
  it("attraversa il cambio d'ora", () =>
    assert.equal(calendarDays(parseDate("2026-03-28"), parseDate("2026-03-30")), 3));
});

describe("computeCharges", () => {
  it("pacchetto kayak completo per 1 giorno = 15 €", () => {
    const { charges, total } = computeCharges(["CANOE", "PADDLE", "SPRAY_DECK", "LIFE_JACKET", "HELMET"], listino, 1);
    assert.equal(charges.length, 1);
    assert.equal(total.toFixed(2), "15.00");
  });

  it("kit completo per 1 giorno = 25 €", () => {
    const { total } = computeCharges(
      ["CANOE", "PADDLE", "SPRAY_DECK", "LIFE_JACKET", "HELMET", "WATER_JACKET", "WETSUIT"],
      listino,
      1,
    );
    assert.equal(total.toFixed(2), "25.00");
  });

  it("kayak + muta per 2 giorni = 40 €", () => {
    const { charges, total } = computeCharges(["CANOE", "PADDLE", "WETSUIT"], listino, 2);
    assert.deepEqual(
      charges.map((c) => [c.name, c.amount.toFixed(2)]),
      [
        ["Pacchetto Kayak", "30.00"],
        ["Muta", "10.00"],
      ],
    );
    assert.equal(total.toFixed(2), "40.00");
  });

  it("un solo pezzo del pacchetto paga il pacchetto intero, una volta", () => {
    const { total } = computeCharges(["PADDLE"], listino, 1);
    assert.equal(total.toFixed(2), "15.00");
  });

  it("due pezzi della stessa voce non la addebitano due volte", () => {
    const { charges } = computeCharges(["WETSUIT", "WETSUIT"], listino, 1);
    assert.equal(charges.length, 1);
  });

  it("categorie non in listino sono gratuite", () => {
    const { charges, total } = computeCharges(["HELMET"], listino.slice(1), 3);
    assert.equal(charges.length, 0);
    assert.equal(total.toFixed(2), "0.00");
  });

  it("prezzi con decimali", () => {
    const { total } = computeCharges(
      ["WETSUIT"],
      [{ id: "m", name: "Muta", dailyPrice: new Prisma.Decimal("4.50"), categories: ["WETSUIT"] }],
      3,
    );
    assert.equal(total.toFixed(2), "13.50");
  });
});
