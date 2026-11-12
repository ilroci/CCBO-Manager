import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Bus, Car, Loader2, MapPin, Package, PackageCheck, Pencil, UserPlus, type LucideIcon } from "lucide-react";
import { useCanEdit } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { OutingFormDialog, type OutingEditing } from "@/components/OutingFormDialog";
import { ParticipantCard } from "@/components/ParticipantCard";
import { ParticipantWizard, type WizardTarget } from "@/components/ParticipantWizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, getErrorMessage } from "@/lib/api";
import { formatPeriod } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { OUTING_PHASE_CLASSES, OUTING_PHASE_LABELS, TRAVEL_MODES, outingPhase } from "@/lib/outings";
import type { Outing, OutingParticipant, TravelMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Confirm = { kind: "cancel" } | { kind: "remove"; participant: OutingParticipant };

/** Intestazioni dei gruppi di partecipanti, uno per modalità di viaggio (furgone per primo). */
const TRAVEL_GROUPS: Record<TravelMode, { title: string; icon: LucideIcon }> = {
  VAN: { title: "Sul furgone", icon: Bus },
  TRANSPORT_ONLY: { title: "Solo trasporto attrezzatura", icon: Package },
  AUTONOMOUS: { title: "Autonomi", icon: Car },
};

export function OutingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canEdit = useCanEdit();
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

  async function returnAll() {
    setError(undefined);
    try {
      const { data } = await api.post<{ outing: Outing }>(`/api/outings/${id}/return-all`);
      setOuting(data.outing);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!outing) {
    return error ? <FormError message={error} /> : <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  const phase = outingPhase(outing);
  const toCollect = Number(outing.totals.total) - Number(outing.totals.collected);

  const confirmTexts: Record<Confirm["kind"], { title: string; description: string; label: string }> = {
    cancel: {
      title: "Annullare l'uscita?",
      description:
        outing.participants.length > 0
          ? "L'uscita viene eliminata con tutti i partecipanti, le riscossioni registrate e il materiale prenotato, che torna subito disponibile. L'operazione non si può annullare."
          : "L'uscita viene eliminata. L'operazione non si può annullare.",
      label: "Annulla uscita",
    },
    remove: {
      title: "Rimuovere il partecipante?",
      description: "Il suo noleggio e le eventuali riscossioni vengono eliminati; l'attrezzatura torna disponibile.",
      label: "Rimuovi",
    },
  };

  async function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "cancel") {
      await api.delete(`/api/outings/${id}`);
      navigate("/outings");
      return;
    }
    const { data } = await api.delete<{ outing: Outing }>(`/api/outings/${id}/participants/${confirm.participant.id}`);
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
              <Badge className={cn("border-transparent", OUTING_PHASE_CLASSES[phase])}>
                {OUTING_PHASE_LABELS[phase]}
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
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirm({ kind: "cancel" })}>
                <Ban /> Annulla uscita
              </Button>
              <Button variant="outline" onClick={() => setEditing(outing)}>
                <Pencil /> Modifica dati
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Partecipanti" value={String(outing.totals.participants)} />
        <Stat
          label="Sul furgone"
          value={`${outing.totals.aboardVan}${outing.vanSeats ? ` / ${outing.vanSeats}` : ""}`}
        />
        <Stat label="Totale quote" value={formatEuro(outing.totals.total)} hint="Costi vivi esclusi" />
        <Stat
          label="Riscosso"
          value={formatEuro(outing.totals.collected)}
          hint={
            outing.totals.pendingCollections === 0
              ? outing.participants.length
                ? "Tutto riscosso"
                : undefined
              : [
                  `${formatEuro(toCollect)} da riscuotere`,
                  outing.totals.pendingExpenses > 0 &&
                    `costi vivi: ${outing.totals.pendingExpenses} ${outing.totals.pendingExpenses === 1 ? "socio" : "soci"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
      </div>

      <FormError message={error} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Partecipanti</h2>
        {canEdit && (
        <div className="flex flex-wrap gap-2">
          {outing.totals.toReturn > 0 && (
            <Button variant="outline" onClick={() => void returnAll()}>
              <PackageCheck /> Tutto il materiale è rientrato
            </Button>
          )}
          <Button onClick={() => setWizard(null)}>
            <UserPlus /> Aggiungi socio
          </Button>
        </div>
        )}
      </div>

      {outing.participants.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          {canEdit ? "Nessun partecipante: aggiungi i soci con il pulsante qui sopra." : "Nessun partecipante."}
        </p>
      ) : (
        <div className="grid gap-6">
          {TRAVEL_MODES.map(({ value }) => {
            const group = outing.participants.filter((p) => p.travelMode === value);
            if (group.length === 0) return null;
            const { title, icon: Icon } = TRAVEL_GROUPS[value];
            const seats = value === "VAN" && outing.vanSeats ? ` / ${outing.vanSeats} posti` : "";
            return (
              <section key={value} className="grid gap-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <Icon className="size-4 text-muted-foreground" />
                  {title}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">
                    ({group.length}
                    {seats})
                  </span>
                </h3>
                {group.map((p) => (
                  <ParticipantCard
                    key={p.id}
                    participant={p}
                    busy={busyId === p.id}
                    readOnly={!canEdit}
                    onEdit={() => setWizard(p)}
                    onRemove={() => setConfirm({ kind: "remove", participant: p })}
                    onCollect={(category, paid) => void participantAction(p, `payments/${category}`, { paid })}
                    onReturn={(returned) => void participantAction(p, "return", { returned })}
                  />
                ))}
              </section>
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
              ? `${confirm.participant.firstName} ${confirm.participant.lastName}: ${confirmTexts.remove.description}`
              : confirmTexts[confirm.kind].description
          }
          confirmLabel={confirmTexts[confirm.kind].label}
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
