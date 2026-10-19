import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { api, getErrorMessage } from "@/lib/api";

export function ChangePasswordDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setError("Le due password non coincidono");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        setDone(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambia password</DialogTitle>
          <DialogDescription>Almeno 8 caratteri.</DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <p className="text-sm">Password aggiornata.</p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Chiudi</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Password attuale</Label>
              <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nuova password</Label>
              <Input id="newPassword" name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Conferma nuova password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvataggio…" : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
