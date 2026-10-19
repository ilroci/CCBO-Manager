import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { FormError } from "@/components/FormError";
import { ItemPicker } from "@/components/ItemPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import { formatPeriod } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/equipment";
import { formatEuro } from "@/lib/money";
import { TRAVEL_MODES, TRAVEL_MODE_LABELS } from "@/lib/outings";
import { usePriceList } from "@/lib/price-list";
import type { AvailableItem, Outing, OutingParticipant, ParticipantQuote, TravelMode, User } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `undefined` = chiuso, `null` = nuovo partecipante, altrimenti modifica. */
export type WizardTarget = OutingParticipant | null | undefined;

const STEPS = ["Socio", "Noleggio", "Trasporto", "Conferma"] as const;

/**
 * Wizard dell'istruttore per inserire un socio nell'uscita:
 * selezione socio → Passo 1 noleggio attrezzatura (opzionale) → Passo 2 modalità di viaggio
 * (scelta unica A/B/C) → riepilogo con calcolo della quota.
 */
export function ParticipantWizard({
  outing,
  target,
  onClose,
  onSaved,
}: {
  outing: Outing;
  target: WizardTarget;
  onClose: () => void;
  onSaved: (outing: Outing) => void;
}) {
  const open = target !== undefined;
  const isEdit = Boolean(target);

  const [step, setStep] = useState(0);
  const [members, setMembers] = useState<User[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberId, setMemberId] = useState<string>();
  const [wantsRental, setWantsRental] = useState<boolean>();
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [travelMode, setTravelMode] = useState<TravelMode>();
  const [quote, setQuote] = useState<ParticipantQuote>();
  const { transportFee } = usePriceList();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Stato iniziale a ogni apertura: vuoto per un nuovo socio, valori attuali in modifica.
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setQuote(undefined);
    setMemberQuery("");
    if (target) {
      setStep(1);
      setMemberId(target.member.id);
      setWantsRental(Boolean(target.rental));
      setSelected(new Set(target.rental?.items.map((row) => row.item.id) ?? []));
      setTravelMode(target.travelMode);
    } else {
      setStep(0);
      setMemberId(undefined);
      setWantsRental(undefined);
      setSelected(new Set());
      setTravelMode(undefined);
      api
        .get<{ users: User[] }>("/api/users", { params: { active: "true" } })
        .then(({ data }) => setMembers(data.users))
        .catch((err) => setError(getErrorMessage(err)));
    }
  }, [open, target]);

  // Pezzi liberi nelle date dell'uscita (in modifica restano selezionabili quelli del socio).
  useEffect(() => {
    if (!open || !wantsRental) return;
    setLoadingItems(true);
    api
      .get<{ items: AvailableItem[] }>("/api/rentals/availability", {
        params: { start: outing.startDate, end: outing.endDate, excludeRentalId: target?.rental?.id },
      })
      .then(({ data }) => setItems(data.items))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingItems(false));
  }, [open, wantsRental, outing.startDate, outing.endDate, target]);

  const itemIds = wantsRental ? [...selected] : [];

  // Calcolo della quota all'arrivo sul riepilogo (dipende solo dal passo: i dati sono già fissati).
  useEffect(() => {
    if (step !== 3) return;
    setQuote(undefined);
    api
      .post<ParticipantQuote>(`/api/outings/${outing.id}/quote`, { itemIds, travelMode })
      .then(({ data }) => setQuote(data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [step]);

  const participantIds = new Set(outing.participants.map((p) => p.member.id));
  const candidates = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return members.filter(
      (m) =>
        !participantIds.has(m.id) &&
        (!q || `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q)),
    );
  }, [members, memberQuery, outing.participants]);

  const member = target?.member ?? members.find((m) => m.id === memberId);
  const selectedItems = items.filter((item) => selected.has(item.id));

  // Posti sul furgone ancora liberi (chi è già a bordo e viene modificato non conta).
  const aboardOthers = outing.participants.filter((p) => p.travelMode === "VAN" && p.id !== target?.id).length;
  const vanFull = outing.vanSeats !== null && aboardOthers >= outing.vanSeats;

  const canNext =
    (step === 0 && memberId) ||
    (step === 1 && wantsRental !== undefined && (!wantsRental || selected.size > 0)) ||
    (step === 2 && travelMode);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      const { data } = isEdit
        ? await api.patch<{ outing: Outing }>(`/api/outings/${outing.id}/participants/${target!.id}`, {
            itemIds,
            travelMode,
          })
        : await api.post<{ outing: Outing }>(`/api/outings/${outing.id}/participants`, {
            memberId,
            itemIds,
            travelMode,
          });
      onSaved(data.outing);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const firstStep = isEdit ? 1 : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifica partecipante" : "Aggiungi partecipante"}
            {member && step > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {member.firstName} {member.lastName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {outing.title} · {formatPeriod(outing.startDate, outing.endDate)} ({outing.days}{" "}
            {outing.days === 1 ? "giorno" : "giorni"})
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs sm:text-sm">
          {STEPS.map((label, index) => {
            if (index < firstStep) return null;
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    current && "border-primary bg-primary text-primary-foreground",
                    done && "border-primary text-primary",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1 - firstStep}
                </span>
                <span className={cn("truncate", current ? "font-medium" : "text-muted-foreground")}>{label}</span>
                {index < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
              </li>
            );
          })}
        </ol>

        {step === 0 && (
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                autoFocus
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Cerca per nome o email"
                className="pl-9"
                aria-label="Cerca socio"
              />
            </div>
            <div className="grid max-h-80 gap-1 overflow-y-auto">
              {candidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMemberId(m.id)}
                  aria-pressed={memberId === m.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    memberId === m.id ? "border-primary ring-1 ring-primary" : "hover:bg-accent/50",
                  )}
                >
                  <span>
                    <span className="font-medium">
                      {m.lastName} {m.firstName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.email}</span>
                  </span>
                  {memberId === m.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nessun socio da aggiungere.</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <p className="text-sm font-medium">Il socio deve noleggiare attrezzatura del club per l'uscita?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: "Sì, noleggia" },
                { value: false, label: "No, ha la sua" },
              ].map(({ value, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setWantsRental(value)}
                  aria-pressed={wantsRental === value}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    wantsRental === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {wantsRental &&
              (loadingItems ? (
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
              ) : (
                <ItemPicker items={items} selected={selected} onToggle={toggle} />
              ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3" role="radiogroup" aria-label="Modalità di viaggio">
            <p className="text-sm font-medium">Qual è la modalità di viaggio/trasporto del socio?</p>
            {TRAVEL_MODES.map((mode) => {
              const disabled = mode.value === "VAN" && vanFull && travelMode !== "VAN";
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={travelMode === mode.value}
                  disabled={disabled}
                  onClick={() => setTravelMode(mode.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    travelMode === mode.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      travelMode === mode.value && "border-primary",
                    )}
                  >
                    {travelMode === mode.value && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                  <span>
                    <span className="font-medium">
                      {mode.letter}) {mode.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">{mode.description}</span>
                    {mode.value === "TRANSPORT_ONLY" && transportFee && (
                      <span className="block text-xs font-medium">{formatEuro(transportFee)} per uscita</span>
                    )}
                    {mode.value === "VAN" && outing.vanSeats !== null && (
                      <span className="block text-xs text-muted-foreground">
                        Posti liberi: {Math.max(0, outing.vanSeats - aboardOthers)} su {outing.vanSeats}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Quota furgone e spese vive non sono ancora a listino: per ora l'opzione A viene registrata senza
              costi.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 text-sm">
            <div className="grid gap-1">
              <div className="font-medium">Noleggio attrezzatura</div>
              {itemIds.length === 0 ? (
                <div className="text-muted-foreground">Nessun noleggio</div>
              ) : (
                <ul className="grid gap-0.5 text-muted-foreground">
                  {(selectedItems.length > 0 ? selectedItems : (target?.rental?.items.map((r) => r.item) ?? [])).map(
                    (item) => (
                      <li key={item.id}>
                        {CATEGORY_LABELS[item.category]}: {item.brand} {item.model}{" "}
                        <span className="font-mono text-xs">{item.serialNumber}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
            <div className="grid gap-1">
              <div className="font-medium">Trasporto</div>
              <div className="text-muted-foreground">
                {travelMode && `${TRAVEL_MODE_LABELS[travelMode].letter}) ${TRAVEL_MODE_LABELS[travelMode].label}`}
              </div>
            </div>
            <div className="grid gap-1 rounded-lg border bg-muted/40 p-3">
              {!quote ? (
                <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  {quote.charges.map((charge) => (
                    <div key={charge.optionId ?? charge.name} className="flex justify-between gap-2">
                      <span>
                        {charge.name}{" "}
                        <span className="text-muted-foreground">
                          {formatEuro(charge.dailyPrice)} × {charge.days}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatEuro(charge.amount)}</span>
                    </div>
                  ))}
                  {quote.charges.length === 0 && (
                    <div className="flex justify-between gap-2 text-muted-foreground">
                      <span>Noleggio attrezzatura</span>
                      <span className="tabular-nums">{formatEuro(0)}</span>
                    </div>
                  )}
                  <div
                    className={cn("flex justify-between gap-2", Number(quote.transportAmount) === 0 && "text-muted-foreground")}
                  >
                    <span>{travelMode === "VAN" ? "Quota furgone e spese vive" : "Trasporto attrezzatura"}</span>
                    <span className="tabular-nums">{formatEuro(quote.transportAmount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 border-t pt-2 text-base font-semibold">
                    <span>Quota individuale</span>
                    <span className="tabular-nums">{formatEuro(quote.totalAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <FormError message={error} />

        <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 rounded-b-lg border-t bg-background px-6 py-4">
          {step > firstStep && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="sm:mr-auto">
              Indietro
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Avanti
            </Button>
          ) : (
            <Button type="button" disabled={saving || !quote} onClick={() => void submit()}>
              {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Aggiungi all'uscita"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
