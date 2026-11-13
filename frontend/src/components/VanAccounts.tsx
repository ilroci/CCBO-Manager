import { useState, type FormEvent } from "react";
import { ArrowRight, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api, getErrorMessage } from "@/lib/api";
import { formatEuro } from "@/lib/money";
import type { Outing, OutingExpense, OutingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

/** `undefined` = dialog chiuso, `null` = nuova spesa, `OutingExpense` = modifica. */
type ExpenseEditing = OutingExpense | null | undefined;

const fullName = (p: Pick<OutingParticipant, "firstName" | "lastName"> | undefined) =>
  p ? `${p.lastName} ${p.firstName}` : "—";

/**
 * Conti del furgone, alla Splitwise: chi è a bordo registra le spese anticipate (carburante,
 * caselli…), il totale si divide in parti uguali tra tutti i partecipanti a bordo e il
 * conguaglio mostra quanto ciascuno deve dare o ricevere e chi deve pagare chi.
 */
export function VanAccounts({
  outing,
  readOnly,
  onChange,
}: {
  outing: Outing;
  /** Sola consultazione: niente aggiunta, modifica o eliminazione di spese. */
  readOnly: boolean;
  onChange: (outing: Outing) => void;
}) {
  const [editing, setEditing] = useState<ExpenseEditing>(undefined);
  const [deleting, setDeleting] = useState<OutingExpense>();
  const { vanAccounts: accounts } = outing;
  const aboard = outing.participants.filter((p) => p.travelMode === "VAN");
  const byId = new Map(outing.participants.map((p) => [p.id, p]));
  const hasExpenses = accounts.expenses.length > 0;
  const perHead = aboard.length > 0 ? Number(accounts.total) / aboard.length : 0;

  async function remove() {
    const { data } = await api.delete<{ outing: Outing }>(`/api/outings/${outing.id}/expenses/${deleting!.id}`);
    onChange(data.outing);
    setDeleting(undefined);
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="size-5 text-muted-foreground" /> Conti del furgone
          </h2>
          <p className="text-sm text-muted-foreground">
            Spese di viaggio divise in parti uguali tra chi è a bordo del furgone.
          </p>
        </div>
        {!readOnly && aboard.length > 0 && (
          <Button onClick={() => setEditing(null)}>
            <Plus /> Aggiungi spesa
          </Button>
        )}
      </div>

      {aboard.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-muted-foreground">
          {hasExpenses
            ? "Nessuno è più a bordo del furgone."
            : "Nessuno a bordo del furgone: i conti si tengono solo tra chi viaggia sul furgone."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MiniStat label="Spesa totale" value={formatEuro(accounts.total)} />
            <MiniStat
              label="A testa"
              value={formatEuro(perHead)}
              hint={`${aboard.length} ${aboard.length === 1 ? "persona" : "persone"} a bordo`}
            />
            <MiniStat
              label="Spese registrate"
              value={String(accounts.expenses.length)}
              className="col-span-2 md:col-span-1"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="gap-3 py-4">
              <CardContent className="grid gap-3 px-4">
                <h3 className="font-medium">Conguaglio</h3>
                <ul className="grid gap-2">
                  {accounts.balances.map((b) => {
                    const balance = Number(b.balance);
                    return (
                      <li key={b.participantId} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{fullName(byId.get(b.participantId))}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            ha pagato {formatEuro(b.paid)} · quota {formatEuro(b.share)}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "shrink-0 text-right tabular-nums",
                            balance > 0 && "text-emerald-700 dark:text-emerald-400",
                            balance < 0 && "text-red-700 dark:text-red-400",
                            balance === 0 && "text-muted-foreground",
                          )}
                        >
                          {balance === 0 ? (
                            "in pari"
                          ) : (
                            <>
                              <div className="text-xs">{balance > 0 ? "riceve" : "deve dare"}</div>
                              <div className="font-semibold">{formatEuro(Math.abs(balance))}</div>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card className="gap-3 py-4">
              <CardContent className="grid gap-3 px-4">
                <h3 className="font-medium">Come pareggiare</h3>
                {accounts.transfers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {hasExpenses ? "Conti in pari: nessuno deve nulla." : "Ancora nessuna spesa registrata."}
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {accounts.transfers.map((t) => (
                      <li
                        key={`${t.fromId}-${t.toId}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{fullName(byId.get(t.fromId))}</span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <span className="font-medium">{fullName(byId.get(t.toId))}</span>
                        <span className="ml-auto font-semibold tabular-nums">{formatEuro(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {hasExpenses && (
        <Card className="gap-3 py-4">
          <CardContent className="grid gap-3 px-4">
            <h3 className="font-medium">Spese</h3>
            <ul className="divide-y">
              {accounts.expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Receipt className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.description}</div>
                    <div className="text-xs text-muted-foreground">pagato da {fullName(byId.get(e.payerId))}</div>
                  </div>
                  <span className="font-semibold tabular-nums">{formatEuro(e.amount)}</span>
                  {!readOnly && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label="Modifica spesa" onClick={() => setEditing(e)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Elimina spesa" onClick={() => setDeleting(e)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ExpenseFormDialog
        outingId={outing.id}
        aboard={aboard}
        editing={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(updated) => {
          setEditing(undefined);
          onChange(updated);
        }}
      />
      {deleting && (
        <ConfirmDialog
          open
          title="Eliminare la spesa?"
          description={`${deleting.description} · ${formatEuro(deleting.amount)}, pagata da ${fullName(byId.get(deleting.payerId))}. Il conguaglio viene ricalcolato.`}
          confirmLabel="Elimina"
          onClose={() => setDeleting(undefined)}
          onConfirm={remove}
        />
      )}
    </section>
  );
}

function MiniStat({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ExpenseFormDialog({
  outingId,
  aboard,
  editing,
  onClose,
  onSaved,
}: {
  outingId: string;
  aboard: OutingParticipant[];
  editing: ExpenseEditing;
  onClose: () => void;
  onSaved: (outing: Outing) => void;
}) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isNew = editing === null;

  function close() {
    setError(undefined);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      payerId: String(form.get("payerId") ?? ""),
      amount: String(form.get("amount") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
    };

    setSaving(true);
    setError(undefined);
    try {
      const { data } = isNew
        ? await api.post<{ outing: Outing }>(`/api/outings/${outingId}/expenses`, payload)
        : await api.patch<{ outing: Outing }>(`/api/outings/${outingId}/expenses/${editing!.id}`, payload);
      setError(undefined);
      onSaved(data.outing);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuova spesa" : "Modifica spesa"}</DialogTitle>
          <DialogDescription>
            Una spesa anticipata da chi è a bordo: viene divisa in parti uguali tra tutti i partecipanti sul furgone.
          </DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="payerId">Chi ha pagato</Label>
            <NativeSelect id="payerId" name="payerId" required defaultValue={editing?.payerId ?? ""}>
              <option value="" disabled>
                Scegli…
              </option>
              {aboard.map((p) => (
                <option key={p.id} value={p.id}>
                  {fullName(p)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="grid gap-2">
              <Label htmlFor="description">Descrizione</Label>
              <Input
                id="description"
                name="description"
                required
                maxLength={200}
                defaultValue={editing?.description}
                placeholder="es. Carburante, casello A22"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Importo (€)</Label>
              <Input
                id="amount"
                name="amount"
                required
                inputMode="decimal"
                pattern="\d{1,6}([.,]\d{1,2})?"
                title="Es. 45 oppure 12,50"
                defaultValue={editing?.amount.replace(".", ",")}
                placeholder="45,00"
              />
            </div>
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
