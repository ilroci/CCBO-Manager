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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { CATEGORIES } from "@/lib/equipment";
import type { EquipmentItem } from "@/lib/types";

/** `undefined` = dialog chiuso, `null` = nuovo pezzo, `EquipmentItem` = modifica. */
export type EquipmentEditing = EquipmentItem | null | undefined;

export function EquipmentFormDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: EquipmentEditing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>();
  const isNew = editing === null;

  function close() {
    setError(undefined);
    setPhotoPreview(undefined);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();

    // Stringa vuota sui campi opzionali = svuota il campo (il backend la converte in null).
    const payload = {
      category: text("category"),
      brand: text("brand"),
      model: text("model"),
      size: text("size"),
      serialNumber: text("serialNumber"),
      photoUrl: text("photoUrl"),
      description: text("description"),
    };

    setSaving(true);
    setError(undefined);
    try {
      if (isNew) await api.post("/api/equipment", payload);
      else await api.patch(`/api/equipment/${editing!.id}`, payload);
      setPhotoPreview(undefined);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const preview = photoPreview ?? editing?.photoUrl ?? undefined;

  return (
    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo pezzo" : "Modifica pezzo"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Ogni pezzo deve avere un numero di serie univoco."
              : `Numero di serie ${editing?.serialNumber}`}
          </DialogDescription>
        </DialogHeader>
        {/* key: azzera i campi non controllati quando si cambia pezzo */}
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <NativeSelect id="category" name="category" defaultValue={editing?.category ?? "CANOE"}>
                {CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="serialNumber">Numero di serie</Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                required
                className="font-mono"
                defaultValue={editing?.serialNumber}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" name="brand" required defaultValue={editing?.brand} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model">Modello</Label>
              <Input id="model" name="model" required defaultValue={editing?.model} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="size">Taglia / Volume</Label>
            <Input
              id="size"
              name="size"
              placeholder="es. M, L/XL, 197 cm, 300 L"
              defaultValue={editing?.size ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="photoUrl">URL foto</Label>
            <Input
              id="photoUrl"
              name="photoUrl"
              type="url"
              placeholder="https://…"
              defaultValue={editing?.photoUrl ?? ""}
              onBlur={(event) => setPhotoPreview(event.currentTarget.value.trim())}
            />
            {preview && (
              <img
                src={preview}
                alt="Anteprima"
                className="h-32 w-full rounded-md border object-cover"
                onError={(event) => (event.currentTarget.hidden = true)}
                onLoad={(event) => (event.currentTarget.hidden = false)}
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} />
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
