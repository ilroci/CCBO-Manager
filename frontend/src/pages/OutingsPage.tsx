import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bus, Loader2, MapPin, Plus, Users } from "lucide-react";
import { FormError } from "@/components/FormError";
import { OutingFormDialog, type OutingEditing } from "@/components/OutingFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, getErrorMessage } from "@/lib/api";
import { formatPeriod } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { OUTING_PHASE_CLASSES, OUTING_PHASE_LABELS, outingPhase } from "@/lib/outings";
import type { Outing } from "@/lib/types";
import { cn } from "@/lib/utils";

type When = "upcoming" | "past" | "all";

const WHEN_OPTIONS: { value: When; label: string }[] = [
  { value: "all", label: "Tutte" },
  { value: "upcoming", label: "Prossime e in corso" },
  { value: "past", label: "Passate" },
];

export function OutingsPage() {
  const navigate = useNavigate();
  const [when, setWhen] = useState<When>("all");
  const [outings, setOutings] = useState<Outing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<OutingEditing>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ outings: Outing[] }>("/api/outings", { params: { when } });
      setOutings(data.outings);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [when]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Uscite</h1>
          <p className="text-muted-foreground">Uscite di club: partecipanti, attrezzatura, rientri e incassi.</p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus /> Nuova uscita
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {WHEN_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setWhen(value)}
            aria-pressed={when === value}
            className={cn(
              "rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors",
              when === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <FormError message={error} />

      {loading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : outings.length === 0 ? (
        <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">Nessuna uscita.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outings.map((outing) => (
            <Link
              key={outing.id}
              to={`/outings/${outing.id}`}
              className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-3 py-4 transition-colors hover:bg-accent/40">
                <CardContent className="grid gap-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">{outing.title}</div>
                      <div className="text-sm text-muted-foreground">{formatPeriod(outing.startDate, outing.endDate)}</div>
                    </div>
                    <Badge className={cn("border-transparent", OUTING_PHASE_CLASSES[outingPhase(outing)])}>
                      {OUTING_PHASE_LABELS[outingPhase(outing)]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {outing.destination && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {outing.destination}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {outing.totals.participants} partecipanti
                    </span>
                    <span className="flex items-center gap-1">
                      <Bus className="size-3.5" /> {outing.totals.aboardVan}
                      {outing.vanSeats ? `/${outing.vanSeats}` : ""} sul furgone
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Resp. {outing.instructor.firstName} {outing.instructor.lastName}
                    </span>
                    <span>
                      {outing.totals.toReturn > 0 && outingPhase(outing) === "PAST" && (
                        <span className="mr-2 text-amber-700 dark:text-amber-400">Materiale da far rientrare ·</span>
                      )}
                      <span className="font-semibold tabular-nums">{formatEuro(outing.totals.collected)}</span>
                      <span className="text-muted-foreground"> incassati su {formatEuro(outing.totals.total)}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <OutingFormDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(outing) => {
          setEditing(undefined);
          navigate(`/outings/${outing.id}`);
        }}
      />
    </div>
  );
}
