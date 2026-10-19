import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleCheck, Loader2, PackageCheck, PackageOpen, Plus, X } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { ItemThumbnail } from "@/components/ItemThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, getErrorMessage } from "@/lib/api";
import { formatPeriod } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/equipment";
import { formatEuro } from "@/lib/money";
import { RENTAL_STATUS_CLASSES, RENTAL_STATUS_LABELS } from "@/lib/rentals";
import type { Rental, RentalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "mine" | "all";
type Action = "cancel" | "pickup" | "return";

const STATUS_FILTERS: { value: RentalStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tutti" },
  { value: "RESERVED", label: "Prenotati" },
  { value: "ACTIVE", label: "Ritirati" },
  { value: "RETURNED", label: "Rientrati" },
  { value: "CANCELLED", label: "Annullati" },
];

export function MyRentalsPage() {
  const user = useCurrentUser();
  const isStaff = user.role === "ADMIN" || user.role === "INSTRUCTOR";
  const location = useLocation();
  const createdId = (location.state as { created?: string } | null)?.created;

  const [scope, setScope] = useState<Scope>("mine");
  const [status, setStatus] = useState<RentalStatus | "ALL">("ALL");
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [cancelling, setCancelling] = useState<Rental>();
  const [busyId, setBusyId] = useState<string>();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ rentals: Rental[] }>("/api/rentals", {
        params: { scope, status: status === "ALL" ? undefined : status },
      });
      setRentals(data.rentals);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [scope, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(rental: Rental, action: Action) {
    setBusyId(rental.id);
    try {
      await api.post(`/api/rentals/${rental.id}/${action}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {scope === "all" ? "Tutti i noleggi" : "I miei noleggi"}
          </h1>
          <p className="text-muted-foreground">
            {scope === "all"
              ? "Prenotazioni dei soci: registra consegna e rientro del materiale."
              : "Le tue prenotazioni e lo storico dei noleggi."}
          </p>
        </div>
        <Button asChild>
          <Link to="/my-rentals/new">
            <Plus /> Nuova prenotazione
          </Link>
        </Button>
      </div>

      {createdId && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <CircleCheck className="size-4" /> Prenotazione confermata.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isStaff && (
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Quali noleggi">
            {(["mine", "all"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={scope === value ? "secondary" : "ghost"}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
              >
                {value === "mine" ? "I miei" : "Tutti i soci"}
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn(
                "rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors",
                status === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <FormError message={error} />

      {loading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : rentals.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Nessun noleggio.{" "}
          <Link to="/my-rentals/new" className="text-primary underline-offset-4 hover:underline">
            Prenota l'attrezzatura
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {rentals.map((rental) => {
            const isOwner = rental.member.id === user.id;
            const canCancel = rental.status === "RESERVED" && rental.kind === "PERSONAL" && (isOwner || isStaff);
            const busy = busyId === rental.id;
            return (
              <Card key={rental.id} className={cn("gap-4 py-4", rental.id === createdId && "ring-2 ring-primary")}>
                <CardContent className="grid gap-4 px-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{formatPeriod(rental.startDate, rental.endDate)}</div>
                      <div className="text-sm text-muted-foreground">
                        {rental.days} {rental.days === 1 ? "giorno" : "giorni"}
                        {rental.kind === "OUTING" && " · uscita di club"}
                        {scope === "all" && (
                          <>
                            {" · "}
                            <span className="text-foreground">
                              {rental.member.firstName} {rental.member.lastName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold tabular-nums">{formatEuro(rental.total)}</span>
                      <Badge className={cn("border-transparent", RENTAL_STATUS_CLASSES[rental.status])}>
                        {RENTAL_STATUS_LABELS[rental.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {rental.items.map(({ id, item }) => (
                      <div key={id} className="flex items-center gap-2 rounded-md border py-1 pr-3 pl-1 text-sm">
                        <ItemThumbnail item={item} className="size-8" />
                        <div className="leading-tight">
                          <div>
                            {item.brand} {item.model}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[item.category]} · <span className="font-mono">{item.serialNumber}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      {rental.charges
                        .map((c) => `${c.name} ${formatEuro(c.dailyPrice)} × ${c.days}`)
                        .join(" · ")}
                      {rental.notes && <div className="mt-1 italic">“{rental.notes}”</div>}
                    </div>
                    <div className="flex gap-2">
                      {canCancel && (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => setCancelling(rental)}>
                          <X /> Annulla
                        </Button>
                      )}
                      {isStaff && rental.kind === "PERSONAL" && rental.status === "RESERVED" && (
                        <Button size="sm" disabled={busy} onClick={() => void runAction(rental, "pickup")}>
                          <PackageOpen /> Consegna
                        </Button>
                      )}
                      {isStaff && rental.kind === "PERSONAL" && rental.status === "ACTIVE" && (
                        <Button size="sm" disabled={busy} onClick={() => void runAction(rental, "return")}>
                          <PackageCheck /> Rientro
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={cancelling !== undefined}
        title="Annullare la prenotazione?"
        description={
          cancelling
            ? `${formatPeriod(cancelling.startDate, cancelling.endDate)} · ${cancelling.items.length} pezzi. I pezzi torneranno prenotabili da altri soci.`
            : ""
        }
        confirmLabel="Annulla prenotazione"
        onClose={() => setCancelling(undefined)}
        onConfirm={async () => {
          await api.post(`/api/rentals/${cancelling!.id}/cancel`);
          setCancelling(undefined);
          await load();
        }}
      />
    </div>
  );
}
