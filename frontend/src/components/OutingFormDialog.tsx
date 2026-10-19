import { useEffect, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/auth/AuthContext";
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
import { addDays, todayIso } from "@/lib/dates";
import type { Outing, User } from "@/lib/types";

/** `undefined` = chiuso, `null` = nuova uscita, `Outing` = modifica. */
export type OutingEditing = Outing | null | undefined;

export function OutingFormDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: OutingEditing;
  onClose: () => void;
  onSaved: (outing: Outing) => void;
}) {
  const user = useCurrentUser();
  const [staff, setStaff] = useState<User[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isNew = editing === null;
  const defaultStart = addDays(todayIso(), 7);

  useEffect(() => {
    if (editing === undefined) return;
    api
      .get<{ users: User[] }>("/api/users", { params: { active: "true" } })
      .then(({ data }) => setStaff(data.users.filter((u) => u.role !== "MEMBER")))
      .catch(() => setStaff([]));
  }, [editing]);

  function close() {
    setError(undefined);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const seats = text("vanSeats");
    const payload = {
      title: text("title"),
      destination: text("destination"),
      instructorId: text("instructorId") || undefined,
      vanSeats: seats ? Number(seats) : null,
      notes: text("notes"),
      start: text("start"),
      end: text("end"),
    };

    setSaving(true);
    setError(undefined);
    try {
      const { data } = isNew
        ? await api.post<{ outing: Outing }>("/api/outings", payload)
        : await api.patch<{ outing: Outing }>(`/api/outings/${editing!.id}`, payload);
      onSaved(data.outing);
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
          <DialogTitle>{isNew ? "Nuova uscita" : "Modifica uscita"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Dopo averla creata potrai aggiungere i partecipanti."
              : "Se cambi le date, i noleggi dei partecipanti vengono spostati e le quote ricalcolate."}
          </DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Titolo</Label>
            <Input id="title" name="title" required defaultValue={editing?.title} placeholder="es. Discesa del Sesia" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="destination">Destinazione</Label>
            <Input id="destination" name="destination" defaultValue={editing?.destination ?? ""} placeholder="es. Varallo (VC)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="start">Dal giorno</Label>
              <Input id="start" name="start" type="date" required defaultValue={editing?.startDate ?? defaultStart} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Al giorno (incluso)</Label>
              <Input id="end" name="end" type="date" required defaultValue={editing?.endDate ?? defaultStart} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="instructorId">Responsabile</Label>
              {/* key: rimonta quando arriva l'elenco, altrimenti il browser selezionerebbe la prima opzione */}
              <NativeSelect
                key={staff.length}
                id="instructorId"
                name="instructorId"
                defaultValue={editing?.instructor.id ?? user.id}
              >
                {staff.length === 0 && (
                  <option value={editing?.instructor.id ?? user.id}>
                    {editing ? `${editing.instructor.firstName} ${editing.instructor.lastName}` : `${user.firstName} ${user.lastName}`}
                  </option>
                )}
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vanSeats">Posti sul furgone</Label>
              <Input
                id="vanSeats"
                name="vanSeats"
                type="number"
                min={1}
                max={50}
                defaultValue={editing?.vanSeats ?? ""}
                placeholder="Vuoto = nessun limite"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} placeholder="Ritrovo, orari, livello…" />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : isNew ? "Crea uscita" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
