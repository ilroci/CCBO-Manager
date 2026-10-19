import { useState, type FormEvent } from "react";
import { Bus, Pencil } from "lucide-react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import { formatEuro } from "@/lib/money";

/** Tariffa del solo trasporto attrezzatura nelle uscite (opzione B), modificabile sul posto. */
export function TransportFeeCard({ amount, onSaved }: { amount: string | undefined; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("amount") ?? "").trim();
    setSaving(true);
    setError(undefined);
    try {
      await api.put("/api/price-list/service-fees/EQUIPMENT_TRANSPORT", { amount: value });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bus className="size-4 text-primary" /> Solo trasporto attrezzatura
        </CardTitle>
        <CardDescription>
          Opzione B delle uscite: il socio viaggia con mezzo proprio e fa caricare l'attrezzatura sul furgone.
        </CardDescription>
        {!editing && (
          <CardAction>
            <Button variant="ghost" size="icon" title="Modifica" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
            <Input
              name="amount"
              required
              autoFocus
              inputMode="decimal"
              pattern="\d{1,6}([.,]\d{1,2})?"
              title="Es. 5 oppure 4,50"
              defaultValue={amount ? Number(amount).toLocaleString("it-IT") : ""}
              className="w-28"
              aria-label="Importo in euro per uscita"
            />
            <span className="text-sm text-muted-foreground">€ per uscita</span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                Annulla
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                Salva
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-3xl font-semibold tabular-nums">
            {amount ? formatEuro(amount) : "—"}
            <span className="text-base font-normal text-muted-foreground"> / uscita</span>
          </div>
        )}
        <FormError message={error} />
        <p className="text-xs text-muted-foreground">
          Importo fisso, qualunque sia la durata dell'uscita. Le quote già assegnate non cambiano.
        </p>
      </CardContent>
    </Card>
  );
}
