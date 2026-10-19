const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** Formatta un importo dell'API ("15.00") o un numero come "15,00 €". */
export function formatEuro(value: string | number): string {
  return euro.format(typeof value === "string" ? Number(value) : value);
}
