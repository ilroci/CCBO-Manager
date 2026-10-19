import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/equipment";
import type { EquipmentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CLASSES = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  RENTED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
} as const;

/** Stato del pezzo; per i dismessi mostra "Archiviato" al posto dello stato. */
export function StatusBadge({ item }: { item: Pick<EquipmentItem, "status" | "isArchived"> }) {
  if (item.isArchived) return <Badge variant="outline">Archiviato</Badge>;
  return (
    <Badge className={cn("border-transparent", STATUS_CLASSES[item.status])}>
      {STATUS_LABELS[item.status]}
    </Badge>
  );
}
