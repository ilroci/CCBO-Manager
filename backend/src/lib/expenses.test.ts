import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBalances, fromCents, settleUp, splitEqually, toCents } from "./expenses";

const people = [{ id: "anna" }, { id: "bruno" }, { id: "carla" }];

describe("splitEqually", () => {
  it("divisione esatta", () => assert.deepEqual(splitEqually(3000, 3), [1000, 1000, 1000]));
  it("i centesimi avanzati vanno ai primi", () => assert.deepEqual(splitEqually(1000, 3), [334, 333, 333]));
  it("nessuno a bordo", () => assert.deepEqual(splitEqually(1000, 0), []));
});

describe("computeBalances", () => {
  it("una persona paga tutto", () => {
    const balances = computeBalances(people, [{ payerId: "anna", cents: 9000 }]);
    assert.deepEqual(
      balances.map((b) => b.balance),
      [6000, -3000, -3000],
    );
  });

  it("i saldi sommano sempre a zero, anche con i resti", () => {
    const balances = computeBalances(people, [
      { payerId: "anna", cents: 1001 },
      { payerId: "bruno", cents: 4733 },
    ]);
    assert.equal(
      balances.reduce((sum, b) => sum + b.balance, 0),
      0,
    );
    assert.equal(
      balances.reduce((sum, b) => sum + b.share, 0),
      5734,
    );
  });

  it("nessuna spesa = tutti a zero", () => {
    assert.ok(computeBalances(people, []).every((b) => b.paid === 0 && b.share === 0 && b.balance === 0));
  });
});

describe("settleUp", () => {
  it("due debitori pagano l'unico creditore", () => {
    const balances = computeBalances(people, [{ payerId: "anna", cents: 9000 }]);
    assert.deepEqual(settleUp(balances), [
      { fromId: "bruno", toId: "anna", cents: 3000 },
      { fromId: "carla", toId: "anna", cents: 3000 },
    ]);
  });

  it("carburante da Anna, caselli da Bruno", () => {
    // totale 120 €, 40 € a testa: Anna +50, Bruno −10, Carla −40
    const balances = computeBalances(people, [
      { payerId: "anna", cents: 9000 },
      { payerId: "bruno", cents: 3000 },
    ]);
    const transfers = settleUp(balances);
    assert.deepEqual(transfers, [
      { fromId: "carla", toId: "anna", cents: 4000 },
      { fromId: "bruno", toId: "anna", cents: 1000 },
    ]);
  });

  it("i trasferimenti azzerano tutti i saldi", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const balances = computeBalances(many, [
      { payerId: "a", cents: 7333 },
      { payerId: "b", cents: 1250 },
      { payerId: "d", cents: 999 },
    ]);
    const net = new Map(balances.map((b) => [b.id, b.balance]));
    const transfers = settleUp(balances);
    for (const t of transfers) {
      net.set(t.fromId, net.get(t.fromId)! + t.cents);
      net.set(t.toId, net.get(t.toId)! - t.cents);
    }
    assert.ok([...net.values()].every((v) => v === 0));
    assert.ok(transfers.length <= many.length - 1);
  });

  it("conti già pari: nessun trasferimento", () => assert.deepEqual(settleUp(computeBalances(people, [])), []));
});

describe("conversioni", () => {
  it("toCents", () => assert.equal(toCents("12.34"), 1234));
  it("fromCents negativo", () => assert.equal(fromCents(-1050), "-10.50"));
});
