import { useState, type FormEvent } from "react";
import { FormError } from "@/components/FormError";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { CATEGORIES } from "@/lib/equipment";
import type { EquipmentCategory, RentalOption } from "@/lib/types";

/** `undefined` = dialog chiuso, `null` = nuova voce, `RentalOption` = modifica. */
export type RentalOptionEditing = RentalOption | null | undefined;

export function RentalOptionFormDialog({
  editing,
  allOptions,
  onClose,
  onSaved,
}: {
  editing: RentalOptionEditing;
  /** Tutte le voci: servono a indicare le categorie già occupate da altre voci. */
  allOptions: RentalOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isNew = editing === null;

  // Una categoria può stare in una sola voce (regola verificata anche dall'API).
  const takenBy = new Map<EquipmentCategory, string>();
  for (const option of allOptions) {
    if (option.id === editing?.id) continue;
    for (const category of option.categories) takenBy.set(category, option.name);
  }

  function close() {
    setError(undefined);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      dailyPrice: String(form.get("dailyPrice") ?? "").trim(),
      categories: form.getAll("categories").map(String),
    };

    setSaving(true);
    setError(undefined);
    try {
      if (isNew) await api.post("/api/price-list", payload);
      else await api.patch(`/api/price-list/${editing!.id}`, payload);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuova voce di listino" : "Modifica voce di listino"}</DialogTitle>
          <DialogDescription>
            Prezzo al giorno, uguale per tutti. Un noleggio paga la voce se comprende almeno un pezzo
            delle sue categorie.
          </DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required defaultValue={editing?.name} placeholder="es. Pacchetto Kayak" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dailyPrice">Prezzo (€/giorno)</Label>
              <Input
                id="dailyPrice"
                name="dailyPrice"
                required
                inputMode="decimal"
                pattern="\d{1,6}([.,]\d{1,2})?"
                title="Es. 15 oppure 12,50"
                defaultValue={editing ? Number(editing.dailyPrice).toLocaleString("it-IT") : ""}
                placeholder="15"
              />
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Categorie comprese</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORIES.map(({ value, label }) => {
                const owner = takenBy.get(value);
                return (
                  <label
                    key={value}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:disabled]:opacity-50"
                    title={owner ? `Già compresa in "${owner}"` : undefined}
                  >
                    <input
                      type="checkbox"
                      name="categories"
                      value={value}
                      defaultChecked={editing?.categories.includes(value)}
                      disabled={owner !== undefined}
                      className="size-4 accent-primary"
                    />
                    <span>{label}</span>
                    {owner && <span className="ml-auto truncate text-xs text-muted-foreground">in {owner}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={editing?.description ?? ""}
              placeholder="es. Kayak, pagaia, paraspruzzi, salvagente e casco"
            />
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
