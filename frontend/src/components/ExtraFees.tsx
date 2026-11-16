import { useState, type FormEvent } from "react";
import { Pencil, Plus, Receipt, Ticket, Trash2 } from "lucide-react";
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
import { api, getErrorMessage } from "@/lib/api";
import { formatEuro } from "@/lib/money";
import type { Outing, OutingExtraFee } from "@/lib/types";

/** `undefined` = dialog chiuso, `null` = nuova spesa, `OutingExtraFee` = modifica. */
type FeeEditing = OutingExtraFee | null | undefined;

/**
 * Spese extra dell'uscita (es. campo slalom): un importo a testa addebitato a tutti i
 * partecipanti, che lo trovano come voce "Spese extra" da riscuotere. Finché qualcuno l'ha
 * già pagata le spese non si modificano (il backend risponde 409).
 */
export function ExtraFees({
  outing,
  readOnly,
  onChange,
}: {
  outing: Outing;
  /** Sola consultazione: niente aggiunta, modifica o eliminazione. */
  readOnly: boolean;
  onChange: (outing: Outing) => void;
}) {
  const [editing, setEditing] = useState<FeeEditing>(undefined);
  const [deleting, setDeleting] = useState<OutingExtraFee>();
  const fees = outing.extraFees;
  const perHead = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const people = outing.participants.length;

  async function remove() {
    const { data } = await api.delete<{ outing: Outing }>(`/api/outings/${outing.id}/extra-fees/${deleting!.id}`);
    onChange(data.outing);
    setDeleting(undefined);
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Ticket className="size-5 text-muted-foreground" /> Spese extra
          </h2>
          <p className="text-sm text-muted-foreground">
            Importi a testa addebitati a tutti i partecipanti (es. ingresso al campo slalom).
          </p>
        </div>
        {!readOnly && (
          <Button variant="outline" onClick={() => setEditing(null)}>
            <Plus /> Aggiungi spesa extra
          </Button>
        )}
      </div>

      {fees.length > 0 && (
        <Card className="gap-3 py-4">
          <CardContent className="grid gap-3 px-4">
            <ul className="divide-y">
              {fees.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Receipt className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 truncate font-medium">{f.description}</div>
                  <span className="font-semibold tabular-nums">
                    {formatEuro(f.amount)} <span className="font-normal text-muted-foreground">a testa</span>
                  </span>
                  {!readOnly && (
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" aria-label="Modifica spesa extra" onClick={() => setEditing(f)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Elimina spesa extra" onClick={() => setDeleting(f)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {people} {people === 1 ? "partecipante" : "partecipanti"} × {formatEuro(perHead)}
              </span>
              <span className="font-semibold tabular-nums">Totale {formatEuro(perHead * people)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <FeeFormDialog
        outingId={outing.id}
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
          title="Eliminare la spesa extra?"
          description={`${deleting.description} · ${formatEuro(deleting.amount)} a testa: viene tolta dalla quota di tutti i partecipanti.`}
          confirmLabel="Elimina"
          onClose={() => setDeleting(undefined)}
          onConfirm={remove}
        />
      )}
    </section>
  );
}

function FeeFormDialog({
  outingId,
  editing,
  onClose,
  onSaved,
}: {
  outingId: string;
  editing: FeeEditing;
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
      description: String(form.get("description") ?? "").trim(),
      amount: String(form.get("amount") ?? "").trim(),
    };

    setSaving(true);
    setError(undefined);
    try {
      const { data } = isNew
        ? await api.post<{ outing: Outing }>(`/api/outings/${outingId}/extra-fees`, payload)
        : await api.patch<{ outing: Outing }>(`/api/outings/${outingId}/extra-fees/${editing!.id}`, payload);
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
          <DialogTitle>{isNew ? "Nuova spesa extra" : "Modifica spesa extra"}</DialogTitle>
          <DialogDescription>
            L'importo è a testa: si aggiunge alla quota di tutti i partecipanti dell'uscita, anche di quelli
            aggiunti in seguito.
          </DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="grid gap-2">
              <Label htmlFor="extra-description">Descrizione</Label>
              <Input
                id="extra-description"
                name="description"
                required
                maxLength={200}
                defaultValue={editing?.description}
                placeholder="es. Campo slalom"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="extra-amount">A testa (€)</Label>
              <Input
                id="extra-amount"
                name="amount"
                required
                inputMode="decimal"
                pattern="\d{1,6}([.,]\d{1,2})?"
                title="Es. 5 oppure 7,50"
                defaultValue={editing?.amount.replace(".", ",")}
                placeholder="5,00"
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
