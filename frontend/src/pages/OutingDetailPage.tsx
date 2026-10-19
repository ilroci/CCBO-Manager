import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CircleCheck,
  Flag,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Play,
  Trash2,
  UserPlus,
  Undo2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { ItemThumbnail } from "@/components/ItemThumbnail";
import { OutingFormDialog, type OutingEditing } from "@/components/OutingFormDialog";
import { ParticipantWizard, type WizardTarget } from "@/components/ParticipantWizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, getErrorMessage } from "@/lib/api";
import { formatPeriod } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { OUTING_STATUS_CLASSES, OUTING_STATUS_LABELS, TRAVEL_MODE_LABELS } from "@/lib/outings";
import { RENTAL_STATUS_LABELS } from "@/lib/rentals";
import type { Outing, OutingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

type Confirm =
  | { kind: "start" | "complete" | "cancel" | "delete" }
  | { kind: "remove"; participant: OutingParticipant };

export function OutingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [outing, setOuting] = useState<Outing>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<OutingEditing>(undefined);
  const [wizard, setWizard] = useState<WizardTarget>(undefined);
  const [confirm, setConfirm] = useState<Confirm>();
  const [busyId, setBusyId] = useState<string>();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ outing: Outing }>(`/api/outings/${id}`);
      setOuting(data.outing);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Esegue un'azione su un partecipante; la risposta contiene l'uscita aggiornata. */
  async function participantAction(p: OutingParticipant, path: string, body?: unknown) {
    setBusyId(p.id);
    setError(undefined);
    try {
      const { data } = await api.post<{ outing: Outing }>(`/api/outings/${id}/participants/${p.id}/${path}`, body);
      setOuting(data.outing);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  }

  if (!outing) {
    return error ? <FormError message={error} /> : <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  const planned = outing.status === "PLANNED";
  const ongoing = outing.status === "ONGOING";
  const cancelled = outing.status === "CANCELLED";
  const toCollect = Number(outing.totals.total) - Number(outing.totals.collected);

  const confirmTexts: Record<Confirm["kind"], { title: string; description: string; label: string }> = {
    start: {
      title: "Partenza dell'uscita?",
      description: "Tutta l'attrezzatura noleggiata viene registrata come consegnata e risulterà \"In noleggio\". Dopo la partenza non si possono più aggiungere partecipanti.",
      label: "Conferma partenza",
    },
    complete: {
      title: "Chiudere l'uscita?",
      description: "Il materiale non ancora rientrato viene registrato come rientrato e torna disponibile. Gli incassi si possono confermare anche dopo.",
      label: "Chiudi uscita",
    },
    cancel: {
      title: "Annullare l'uscita?",
      description: "I noleggi dei partecipanti vengono annullati e l'attrezzatura torna prenotabile.",
      label: "Annulla uscita",
    },
    delete: { title: "Eliminare l'uscita?", description: "L'uscita non ha partecipanti e verrà eliminata.", label: "Elimina" },
    remove: {
      title: "Rimuovere il partecipante?",
      description: "Il suo noleggio per l'uscita viene eliminato e l'attrezzatura torna disponibile.",
      label: "Rimuovi",
    },
  };

  async function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "delete") {
      await api.delete(`/api/outings/${id}`);
      navigate("/outings");
      return;
    }
    const { data } =
      confirm.kind === "remove"
        ? await api.delete<{ outing: Outing }>(`/api/outings/${id}/participants/${confirm.participant.id}`)
        : await api.post<{ outing: Outing }>(`/api/outings/${id}/${confirm.kind}`);
    setOuting(data.outing);
    setConfirm(undefined);
  }

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link to="/outings">
            <ArrowLeft /> Uscite
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{outing.title}</h1>
              <Badge className={cn("border-transparent", OUTING_STATUS_CLASSES[outing.status])}>
                {OUTING_STATUS_LABELS[outing.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {formatPeriod(outing.startDate, outing.endDate)} · {outing.days} {outing.days === 1 ? "giorno" : "giorni"}
              {outing.destination && (
                <>
                  {" · "}
                  <MapPin className="inline size-3.5" /> {outing.destination}
                </>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Responsabile: {outing.instructor.firstName} {outing.instructor.lastName}
            </p>
            {outing.notes && <p className="mt-2 max-w-prose text-sm whitespace-pre-line">{outing.notes}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(planned || ongoing) && (
              <Button variant="outline" onClick={() => setEditing(outing)}>
                <Pencil /> Modifica
              </Button>
            )}
            {planned && outing.participants.length === 0 && (
              <Button variant="outline" onClick={() => setConfirm({ kind: "delete" })}>
                <Trash2 /> Elimina
              </Button>
            )}
            {planned && outing.participants.length > 0 && (
              <Button variant="outline" onClick={() => setConfirm({ kind: "cancel" })}>
                <Ban /> Annulla uscita
              </Button>
            )}
            {planned && (
              <Button onClick={() => setConfirm({ kind: "start" })} disabled={outing.participants.length === 0}>
                <Play /> Partenza
              </Button>
            )}
            {ongoing && (
              <Button onClick={() => setConfirm({ kind: "complete" })}>
                <Flag /> Chiudi uscita
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Partecipanti" value={String(outing.totals.participants)} />
        <Stat
          label="Sul furgone"
          value={`${outing.totals.aboardVan}${outing.vanSeats ? ` / ${outing.vanSeats}` : ""}`}
        />
        <Stat label="Totale quote" value={formatEuro(outing.totals.total)} />
        <Stat
          label="Incassato"
          value={formatEuro(outing.totals.collected)}
          hint={toCollect > 0 ? `${formatEuro(toCollect)} da incassare` : outing.participants.length ? "Tutto incassato" : undefined}
        />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Partecipanti</h2>
        {planned && (
          <Button onClick={() => setWizard(null)}>
            <UserPlus /> Aggiungi socio
          </Button>
        )}
      </div>

      {outing.participants.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          {planned ? "Nessun partecipante: aggiungi i soci con il pulsante qui sopra." : "Nessun partecipante."}
        </p>
      ) : (
        <div className="grid gap-3">
          {outing.participants.map((p) => {
            const busy = busyId === p.id;
            const paid = p.paymentStatus === "PAID";
            const amount = Number(p.totalAmount);
            const mode = TRAVEL_MODE_LABELS[p.travelMode];
            return (
              <Card key={p.id} className="gap-3 py-4">
                <CardContent className="grid gap-3 px-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {p.member.lastName} {p.member.firstName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {mode.letter}) {mode.short}
                        {p.rental && ` · noleggio ${RENTAL_STATUS_LABELS[p.rental.status].toLowerCase()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold tabular-nums">{formatEuro(p.totalAmount)}</span>
                      {amount > 0 && (
                        <Badge
                          className={cn(
                            "border-transparent",
                            paid
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          )}
                        >
                          {paid ? "Pagato" : "Da incassare"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {p.rental ? (
                    <div className="flex flex-wrap gap-2">
                      {p.rental.items.map(({ id: rowId, item, returnedAt }) => (
                        <div key={rowId} className="flex items-center gap-2 rounded-md border py-1 pr-3 pl-1 text-sm">
                          <ItemThumbnail item={item} className="size-8" />
                          <div className="leading-tight">
                            <div>
                              {item.brand} {item.model}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{item.serialNumber}</span>
                              {returnedAt && " · rientrato"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Nessun noleggio: attrezzatura propria.</div>
                  )}

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {[
                        ...(p.rental?.charges.map((c) => `${c.name} ${formatEuro(c.dailyPrice)} × ${c.days}`) ?? []),
                        ...(Number(p.vanSeatAmount) > 0 ? [`Quota furgone ${formatEuro(p.vanSeatAmount)}`] : []),
                        ...(Number(p.transportAmount) > 0 ? [`Trasporto attrezzatura ${formatEuro(p.transportAmount)}`] : []),
                      ].join(" · ")}
                      {paid && p.paidConfirmedBy && (
                        <div>
                          Incasso confermato da {p.paidConfirmedBy.firstName} {p.paidConfirmedBy.lastName}
                          {p.paidAt && ` il ${new Date(p.paidAt).toLocaleDateString("it-IT")}`}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {planned && !paid && (
                        <>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setWizard(p)}>
                            <Pencil /> Modifica
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: "remove", participant: p })}
                          >
                            <Trash2 /> Rimuovi
                          </Button>
                        </>
                      )}
                      {ongoing && p.rental?.status === "ACTIVE" && (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void participantAction(p, "return")}>
                          <PackageCheck /> Rientro materiale
                        </Button>
                      )}
                      {!cancelled && amount > 0 && (
                        paid ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void participantAction(p, "payment", { paid: false })}
                          >
                            <Undo2 /> Annulla incasso
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy} onClick={() => void participantAction(p, "payment", { paid: true })}>
                            <CircleCheck /> Conferma incasso
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OutingFormDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(updated) => {
          setEditing(undefined);
          setOuting(updated);
        }}
      />
      <ParticipantWizard
        outing={outing}
        target={wizard}
        onClose={() => setWizard(undefined)}
        onSaved={(updated) => {
          setWizard(undefined);
          setOuting(updated);
        }}
      />
      {confirm && (
        <ConfirmDialog
          open
          title={confirmTexts[confirm.kind].title}
          description={
            confirm.kind === "remove"
              ? `${confirm.participant.member.firstName} ${confirm.participant.member.lastName}: ${confirmTexts.remove.description}`
              : confirmTexts[confirm.kind].description
          }
          confirmLabel={confirmTexts[confirm.kind].label}
          confirmVariant={confirm.kind === "start" || confirm.kind === "complete" ? "default" : "destructive"}
          onClose={() => setConfirm(undefined)}
          onConfirm={runConfirm}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
