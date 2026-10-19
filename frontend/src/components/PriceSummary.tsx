import { Receipt } from "lucide-react";
import { formatEuro } from "@/lib/money";
import { fullKitPrice, usePriceList } from "@/lib/price-list";

/** Riepilogo compatto del listino, mostrato in cima al catalogo. */
export function PriceSummary() {
  const { options } = usePriceList();
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <Receipt className="size-4 text-primary" /> Prezzi al giorno
      </span>
      {options.map((option) => (
        <span key={option.id} title={option.description ?? undefined}>
          {option.name} <span className="font-medium tabular-nums">{formatEuro(option.dailyPrice)}</span>
        </span>
      ))}
      {options.length > 1 && (
        <span>
          Kit completo <span className="font-medium tabular-nums">{formatEuro(fullKitPrice(options))}</span>
        </span>
      )}
    </div>
  );
}
