import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { ALL_ROLES, ROLE_LABELS } from "@/auth/permissions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";
import type { Role, User } from "@/lib/types";

/** `undefined` = dialog chiuso, `null` = nuovo utente, `User` = modifica. */
type Editing = User | null | undefined;

export function UsersPage() {
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<Editing>(undefined);
  const [deleting, setDeleting] = useState<User>();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ users: User[] }>("/api/users");
      setUsers(data.users);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utenti</h1>
          <p className="text-muted-foreground">Soci, istruttori e amministratori del club.</p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus /> Nuovo utente
        </Button>
      </div>

      <FormError message={error} />

      {loading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={user.isActive ? undefined : "opacity-60"}>
                  <TableCell className="font-medium">
                    {user.lastName} {user.firstName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "MEMBER" ? "outline" : "secondary"}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.isActive ? "Attivo" : "Disattivato"}</TableCell>
                  <TableCell>
                    <div className="flex">
                      <Button variant="ghost" size="icon" title="Modifica" onClick={() => setEditing(user)}>
                        <Pencil />
                      </Button>
                      {user.id !== currentUser.id && (
                        <Button variant="ghost" size="icon" title="Elimina" onClick={() => setDeleting(user)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UserFormDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          void load();
        }}
      />

      {deleting && (
        <ConfirmDialog
          open
          title={`Eliminare ${deleting.firstName} ${deleting.lastName}?`}
          description="Vengono eliminati anche i suoi noleggi, le partecipazioni alle uscite e le relative riscossioni. L'operazione non si può annullare: per sospendere un utente conservando lo storico, disattivalo da Modifica."
          confirmLabel="Elimina"
          onClose={() => setDeleting(undefined)}
          onConfirm={async () => {
            await api.delete(`/api/users/${deleting.id}`);
            setDeleting(undefined);
            void load();
          }}
        />
      )}
    </div>
  );
}

function UserFormDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentUser = useCurrentUser();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isNew = editing === null;
  const isSelf = editing?.id === currentUser.id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const password = text("password");

    const payload = {
      firstName: text("firstName"),
      lastName: text("lastName"),
      phone: text("phone") || null,
      role: text("role") as Role,
      ...(isNew ? { email: text("email") } : { isActive: form.get("isActive") === "on" }),
      ...(password ? { password } : {}),
    };

    setSaving(true);
    setError(undefined);
    try {
      if (isNew) await api.post("/api/users", payload);
      else await api.patch(`/api/users/${editing!.id}`, payload);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={editing !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setError(undefined);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo utente" : "Modifica utente"}</DialogTitle>
          <DialogDescription>
            {isNew ? "L'utente potrà accedere con email e password." : editing?.email}
          </DialogDescription>
        </DialogHeader>
        {/* key: azzera i campi non controllati quando si cambia utente */}
        <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" name="firstName" required defaultValue={editing?.firstName} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Cognome</Label>
              <Input id="lastName" name="lastName" required defaultValue={editing?.lastName} />
            </div>
          </div>
          {isNew && (
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="off" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={editing?.phone ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Ruolo</Label>
              <NativeSelect
                id="role"
                name="role"
                defaultValue={editing?.role ?? "MEMBER"}
                disabled={isSelf}
                title={isSelf ? "Non puoi cambiare il tuo ruolo" : undefined}
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
              {/* Un select disabilitato non viene inviato: manteniamo il ruolo attuale */}
              {isSelf && <input type="hidden" name="role" value={editing!.role} />}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{isNew ? "Password" : "Nuova password (opzionale)"}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required={isNew}
              autoComplete="new-password"
              placeholder={isNew ? "Almeno 8 caratteri" : "Lascia vuoto per non cambiarla"}
            />
          </div>
          {!isNew && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive}
                disabled={isSelf}
                className="size-4 accent-primary"
              />
              Account attivo
              {isSelf && <input type="hidden" name="isActive" value="on" />}
            </label>
          )}
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
