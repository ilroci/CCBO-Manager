import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { ItemThumbnail } from "@/components/ItemThumbnail";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/equipment";
import type { AvailableItem, EquipmentCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Selezione multipla di pezzi con filtri; quelli occupati nel periodo non sono selezionabili. */
export function ItemPicker({
  items,
  selected,
  onToggle,
  columns = 2,
}: {
  items: AvailableItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Colonne della griglia da `sm` in su. */
  columns?: 1 | 2;
}) {
  const [category, setCategory] = useState<EquipmentCategory | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (category === "ALL" || item.category === category) &&
        (!q ||
          [item.brand, item.model, item.serialNumber, item.size ?? ""].some((f) => f.toLowerCase().includes(q))),
    );
  }, [items, category, query]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca marca, modello, taglia o numero di serie"
          className="pl-9"
          aria-label="Cerca"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ value: "ALL" as const, label: "Tutte" }, ...CATEGORIES].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            aria-pressed={category === value}
            className={cn(
              "rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors",
              category === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {visible.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!item.available}
              onClick={() => onToggle(item.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card p-2 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isSelected ? "border-primary ring-1 ring-primary" : "hover:bg-accent/50",
                !item.available && "cursor-not-allowed opacity-50",
              )}
            >
              <ItemThumbnail item={item} className="size-12" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground uppercase">{CATEGORY_LABELS[item.category]}</div>
                <div className="truncate font-medium">
                  {item.brand} {item.model}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.size ? `${item.size} · ` : ""}
                  <span className="font-mono">{item.serialNumber}</span>
                  {!item.available && " · occupato in queste date"}
                </div>
              </div>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border",
                  isSelected && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {isSelected && <Check className="size-3.5" />}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className={cn("py-8 text-center text-muted-foreground", columns === 2 && "sm:col-span-2")}>
            Nessun pezzo trovato.
          </p>
        )}
      </div>
    </div>
  );
}
