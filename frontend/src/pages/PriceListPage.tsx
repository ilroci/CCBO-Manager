import { useState } from "react";
import { CircleAlert, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormError } from "@/components/FormError";
import {
  RentalOptionFormDialog,
  type RentalOptionEditing,
} from "@/components/RentalOptionFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/equipment";
import { formatEuro } from "@/lib/money";
import { fullKitPrice, usePriceList } from "@/lib/price-list";
import type { RentalOption } from "@/lib/types";

export function PriceListPage() {
  const { options, loading, error, reload } = usePriceList();
  const [editing, setEditing] = useState<RentalOptionEditing>(undefined);
  const [deleting, setDeleting] = useState<RentalOption>();

  const covered = new Set(options.flatMap((option) => option.categories));
  const uncovered = CATEGORIES.filter(({ value }) => !covered.has(value));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Listino prezzi</h1>
          <p className="text-muted-foreground">
            Prezzi di noleggio al giorno, uguali per tutti i soci.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus /> Nuova voce
        </Button>
      </div>

      <FormError message={error} />

      {loading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => (
              <Card key={option.id}>
                <CardHeader>
                  <CardTitle>{option.name}</CardTitle>
                  <CardDescription>{option.description ?? " "}</CardDescription>
                  <CardAction className="flex">
                    <Button variant="ghost" size="icon" title="Modifica" onClick={() => setEditing(option)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" title="Elimina" onClick={() => setDeleting(option)}>
                      <Trash2 />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="text-3xl font-semibold tabular-nums">
                    {formatEuro(option.dailyPrice)}
                    <span className="text-base font-normal text-muted-foreground"> / giorno</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sortCategories(option.categories).map((category) => (
                      <Badge key={category} variant="secondary">
                        {CATEGORY_LABELS[category]}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {options.length > 1 && (
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card px-6 py-4">
              <div>
                <div className="font-medium">Kit completo</div>
                <div className="text-sm text-muted-foreground">Tutte le voci del listino insieme</div>
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {formatEuro(fullKitPrice(options))}
                <span className="text-sm font-normal text-muted-foreground"> / giorno</span>
              </div>
            </div>
          )}

          {uncovered.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Categorie non comprese in nessuna voce, quindi noleggiate gratis:{" "}
                {uncovered.map(({ label }) => label).join(", ")}.
              </span>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Come si calcola: un noleggio paga ogni voce di cui comprende almeno un pezzo, moltiplicata
            per i giorni. Le modifiche valgono per i noleggi futuri; quelli già registrati conservano il
            prezzo di allora.
          </p>
        </>
      )}

      <RentalOptionFormDialog
        editing={editing}
        allOptions={options}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          void reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        title="Eliminare la voce?"
        description={`"${deleting?.name}" non sarà più applicata ai nuovi noleggi. I noleggi già registrati la conservano.`}
        confirmLabel="Elimina"
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          await api.delete(`/api/price-list/${deleting!.id}`);
          setDeleting(undefined);
          await reload();
        }}
      />
    </div>
  );
}

/** Categorie nell'ordine standard del catalogo. */
function sortCategories(categories: RentalOption["categories"]) {
  return CATEGORIES.map(({ value }) => value).filter((value) => categories.includes(value));
}
