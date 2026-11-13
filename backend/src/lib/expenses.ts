/**
 * Conti del furgone di un'uscita, sul modello di Splitwise: le spese di viaggio anticipate da chi
 * è a bordo si dividono in parti uguali tra tutti i partecipanti a bordo del furgone.
 * Tutti i calcoli sono in centesimi interi, così la somma dei saldi è sempre esattamente zero.
 */

export interface SplitPerson {
  id: string;
}

export interface SplitExpense {
  payerId: string;
  /** Importo in centesimi */
  cents: number;
}

export interface Balance {
  id: string;
  /** Totale anticipato dal partecipante */
  paid: number;
  /** Sua parte del totale */
  share: number;
  /** paid − share: positivo = deve ricevere, negativo = deve dare */
  balance: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  cents: number;
}

/**
 * Parte di ciascuno: totale ÷ persone, con i centesimi avanzati assegnati uno ciascuno ai primi
 * dell'elenco (l'ordine lo decide il chiamante, es. alfabetico), così le parti sommano al totale.
 */
export function splitEqually(total: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Saldo di ogni persona a bordo. Le spese di chi non è (più) nell'elenco restano nel totale ma
 * non possono capitare: l'API impedisce di far scendere dal furgone chi ha pagato spese.
 */
export function computeBalances(people: SplitPerson[], expenses: SplitExpense[]): Balance[] {
  const total = expenses.reduce((sum, e) => sum + e.cents, 0);
  const shares = splitEqually(total, people.length);
  return people.map((person, i) => {
    const share = shares[i] ?? 0;
    const paid = expenses.filter((e) => e.payerId === person.id).reduce((sum, e) => sum + e.cents, 0);
    return { id: person.id, paid, share, balance: paid - share };
  });
}

/**
 * Trasferimenti che pareggiano i conti ("semplifica i debiti"): a ogni passo chi deve dare di
 * più paga chi deve ricevere di più. Servono al massimo persone − 1 trasferimenti.
 */
export function settleUp(balances: Pick<Balance, "id" | "balance">[]): Transfer[] {
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ id: b.id, amount: b.balance }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ id: b.id, amount: -b.balance }));
  const byAmount = (a: { amount: number }, b: { amount: number }) => b.amount - a.amount;
  const transfers: Transfer[] = [];

  for (;;) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const creditor = creditors[0];
    const debtor = debtors[0];
    if (!creditor || !debtor) break;
    const cents = Math.min(creditor.amount, debtor.amount);
    transfers.push({ fromId: debtor.id, toId: creditor.id, cents });
    creditor.amount -= cents;
    debtor.amount -= cents;
    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }
  return transfers;
}

/** "12.50" (Decimal o stringa dell'API) → 1250 centesimi */
export const toCents = (value: { toFixed(digits: number): string } | string) =>
  Math.round(Number(typeof value === "string" ? value : value.toFixed(2)) * 100);

/** 1250 → "12.50", con il segno per i saldi negativi */
export const fromCents = (cents: number) => (cents / 100).toFixed(2);
