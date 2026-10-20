import { CircleCheck, Lock, PackageCheck, Pencil, Trash2, Undo2 } from "lucide-react";
import { ItemThumbnail } from "@/components/ItemThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEuro } from "@/lib/money";
import { COLLECTION_LABELS, TRAVEL_MODE_LABELS } from "@/lib/outings";
import type { Collection, CollectionCategory, OutingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Scheda di un partecipante: una riga per ogni voce da riscuotere (noleggio, trasporto,
 * furgone + costi vivi), ciascuna con il proprio pulsante, perché si pagano in momenti diversi.
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
  const mode = TRAVEL_MODE_LABELS[p.travelMode];
  const pending = p.collections.filter((c) => !c.payment).length;
  const anyPaid = p.collections.some((c) => c.payment);
  const aboard = p.travelMode === "VAN";

  return (
    <Card className="gap-3 py-4">
      <CardContent className="grid gap-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">
              {p.member.lastName} {p.member.firstName}
            </div>
            <div className="text-sm text-muted-foreground">
              {mode.letter}) {mode.short}
              {p.rental?.status === "RESERVED" && " · materiale da far rientrare"}
              {p.rental?.status === "RETURNED" && " · materiale rientrato"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-right">
              <span className="text-lg font-semibold tabular-nums">{formatEuro(p.totalAmount)}</span>
              {aboard && <span className="block text-xs text-muted-foreground">+ costi vivi</span>}
            </span>
            {p.collections.length > 0 && (
              <Badge
                className={cn(
                  "border-transparent",
                  pending === 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                {pending === 0 ? "Tutto riscosso" : pending === 1 ? "1 voce da riscuotere" : `${pending} voci da riscuotere`}
              </Badge>
            )}
          </div>
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
          {p.rental?.status === "RESERVED" && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onReturn(true)}>
              <PackageCheck /> Materiale rientrato
            </Button>
          )}
          {p.rental?.status === "RETURNED" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReturn(false)}>
              <Undo2 /> Annulla rientro
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={busy} onClick={onEdit}>
            <Pencil /> Modifica
          </Button>
          {anyPaid ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Per rimuoverlo annulla prima le riscossioni
            </span>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 /> Rimuovi
            </Button>
          )}
        </div>
      </CardContent>
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
