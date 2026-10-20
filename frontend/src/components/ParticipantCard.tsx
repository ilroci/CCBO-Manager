import { useState } from "react";
import { ChevronRight, CircleCheck, PackageCheck, Pencil, Trash2, Undo2 } from "lucide-react";
import { ItemThumbnail } from "@/components/ItemThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEuro } from "@/lib/money";
import { COLLECTION_LABELS, TRAVEL_MODE_LABELS } from "@/lib/outings";
import type { Collection, CollectionCategory, OutingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Scheda di un partecipante. Chiusa mostra solo nome e quota ancora da pagare; aperta,
 * una riga per ogni voce da riscuotere (noleggio, trasporto, furgone + costi vivi),
 * ciascuna con il proprio pulsante, perché si pagano in momenti diversi.
 */
export function ParticipantCard({
  participant: p,
  busy,
  onEdit,
  onRemove,
  onCollect,
  onReturn,
}: {
  participant: OutingParticipant;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCollect: (category: CollectionCategory, paid: boolean) => void;
  onReturn: (returned: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const mode = TRAVEL_MODE_LABELS[p.travelMode];
  const unpaid = p.collections.filter((c) => !c.payment);
  const due = unpaid.reduce((sum, c) => sum + Number(c.amount), 0);
  const expensesDue = unpaid.some((c) => c.includesExpenses);
  /** Il rientro ha senso solo se al socio sono stati assegnati pezzi specifici. */
  const hasItems = (p.rental?.items.length ?? 0) > 0;

  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          open ? "rounded-t-xl" : "rounded-xl",
        )}
      >
        <span className="flex items-center gap-2">
          <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="font-medium">
            {p.member.lastName} {p.member.firstName}
          </span>
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {p.collections.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nulla da pagare</span>
          ) : (
            <>
              {unpaid.length > 0 && (
                <span className="text-right">
                  <span className="font-semibold tabular-nums">{formatEuro(due)}</span>
                  {expensesDue && <span className="text-xs text-muted-foreground"> + costi vivi</span>}
                </span>
              )}
              <Badge
                className={cn(
                  "border-transparent",
                  unpaid.length === 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                {unpaid.length === 0
                  ? "Tutto riscosso"
                  : unpaid.length === 1
                    ? "1 voce da riscuotere"
                    : `${unpaid.length} voci da riscuotere`}
              </Badge>
            </>
          )}
        </span>
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {mode.letter}) {mode.short}
            {hasItems && p.rental?.status === "RESERVED" && " · materiale da far rientrare"}
            {hasItems && p.rental?.status === "RETURNED" && " · materiale rientrato"}
            {p.collections.length > 0 && (
              <>
                {" · quota totale "}
                <span className="tabular-nums">{formatEuro(p.totalAmount)}</span>
              </>
            )}
          </div>

          {p.collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Attrezzatura propria e viaggio autonomo: nulla da riscuotere.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {p.collections.map((c) => (
                <CollectionRow
                  key={c.category}
                  collection={c}
                  participant={p}
                  busy={busy}
                  onCollect={(paid) => onCollect(c.category, paid)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasItems && p.rental?.status === "RESERVED" && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onReturn(true)}>
                <PackageCheck /> Materiale rientrato
              </Button>
            )}
            {hasItems && p.rental?.status === "RETURNED" && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReturn(false)}>
                <Undo2 /> Annulla rientro
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
              <Pencil /> Modifica
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 /> Rimuovi
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CollectionRow({
  collection: c,
  participant: p,
  busy,
  onCollect,
}: {
  collection: Collection;
  participant: OutingParticipant;
  busy: boolean;
  onCollect: (paid: boolean) => void;
}) {
  const paid = c.payment !== null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="grid min-w-0 flex-1 gap-1.5 text-sm">
        <div className="font-medium">{COLLECTION_LABELS[c.category]}</div>

        {c.category === "RENTAL" && p.rental && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {p.rental.charges.map((ch) => (
                <Badge key={ch.id ?? ch.name} variant="secondary">
                  {ch.name}
                </Badge>
              ))}
            </div>
            {p.rental.items.length === 0 ? (
              <div className="text-xs text-muted-foreground">Materiale non specificato</div>
            ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.rental.items.map(({ id, item, returnedAt }) => (
                <div key={id} className="flex items-center gap-2 rounded-md border py-0.5 pr-2 pl-0.5 text-xs">
                  <ItemThumbnail item={item} className="size-7" />
                  <span>
                    {item.brand} {item.model} <span className="font-mono text-muted-foreground">{item.serialNumber}</span>
                    {returnedAt && <span className="text-muted-foreground"> · rientrato</span>}
                  </span>
                </div>
              ))}
            </div>
            )}
            <div className="text-xs text-muted-foreground">
              {p.rental.charges.map((ch) => `${ch.name} ${formatEuro(ch.dailyPrice)} × ${ch.days}`).join(" · ")}
            </div>
          </>
        )}

        {c.category === "VAN" && (
          <div className="grid gap-0.5 text-xs">
            <div className="flex justify-between gap-4 sm:justify-start">
              <span className="text-muted-foreground">Quota furgone</span>
              <span className="tabular-nums">{formatEuro(c.amount)}</span>
            </div>
            <div className="flex justify-between gap-4 sm:justify-start">
              <span className="text-muted-foreground">Costi vivi (carburante e caselli)</span>
              <span>da pagare, importo a parte</span>
            </div>
          </div>
        )}

        {paid && (
          <div className="text-xs text-emerald-700 dark:text-emerald-400">
            Riscosso il {new Date(c.payment!.paidAt).toLocaleDateString("it-IT")}
            {c.payment!.confirmedBy && ` da ${c.payment!.confirmedBy.firstName} ${c.payment!.confirmedBy.lastName}`}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums">
          {formatEuro(c.amount)}
          {c.includesExpenses && <span className="font-normal text-muted-foreground"> + costi vivi</span>}
        </span>
        {paid ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCollect(false)}>
            <Undo2 /> Annulla riscossione
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => onCollect(true)}>
            <CircleCheck /> {c.includesExpenses ? "Riscuoti quota e costi vivi" : "Riscuoti"}
          </Button>
        )}
      </div>
    </div>
  );
}
