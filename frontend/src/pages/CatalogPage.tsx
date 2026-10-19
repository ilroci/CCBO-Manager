import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ImageOff,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EquipmentFormDialog, type EquipmentEditing } from "@/components/EquipmentFormDialog";
import { FormError } from "@/components/FormError";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, apiUrl, getErrorMessage } from "@/lib/api";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/equipment";
import type { EquipmentCategory, EquipmentItem, ItemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "grid" | "table";

export function CatalogPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === "ADMIN";

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EquipmentCategory | "ALL">("ALL");
  const [status, setStatus] = useState<ItemStatus | "ALL">("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<View>(isAdmin ? "table" : "grid");

  const [editing, setEditing] = useState<EquipmentEditing>(undefined);
  const [deleting, setDeleting] = useState<EquipmentItem>();

  // L'inventario di un club è piccolo: si carica tutto e si filtra nel browser,
  // così i filtri sono istantanei e i conteggi per categoria sempre corretti.
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ items: EquipmentItem[] }>("/api/equipment", {
        params: isAdmin ? { includeArchived: "true" } : undefined,
      });
      setItems(data.items);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtri di testo, stato e archivio; la categoria è applicata dopo per contare le schede.
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (showArchived || !item.isArchived) &&
        (status === "ALL" || (item.status === status && !item.isArchived)) &&
        (!q ||
          [item.brand, item.model, item.serialNumber, item.size ?? ""].some((field) =>
            field.toLowerCase().includes(q),
          )),
    );
  }, [items, query, status, showArchived]);

  const visible = useMemo(
    () => baseFiltered.filter((item) => category === "ALL" || item.category === category),
    [baseFiltered, category],
  );

  const countByCategory = useMemo(() => {
    const counts = new Map<EquipmentCategory, number>();
    for (const item of baseFiltered) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, [baseFiltered]);

  const availableCount = visible.filter((i) => i.status === "AVAILABLE" && !i.isArchived).length;

  async function toggleArchived(item: EquipmentItem) {
    try {
      await api.patch(`/api/equipment/${item.id}`, { isArchived: !item.isArchived });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalogo</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Inventario dell'attrezzatura del club." : "Attrezzatura del club e disponibilità."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing(null)}>
            <Plus /> Nuovo pezzo
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca marca, modello, taglia o numero di serie"
              className="pl-9"
              aria-label="Cerca"
            />
          </div>
          <NativeSelect
            value={status}
            onChange={(event) => setStatus(event.target.value as ItemStatus | "ALL")}
            className="w-auto"
            aria-label="Stato"
          >
            <option value="ALL">Tutti gli stati</option>
            <option value="AVAILABLE">Disponibili</option>
            <option value="RENTED">In noleggio</option>
          </NativeSelect>
          {isAdmin && (
            <label className="flex items-center gap-2 px-1 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="size-4 accent-primary"
              />
              Mostra archiviati
            </label>
          )}
          <div className="ml-auto flex rounded-md border p-0.5" role="group" aria-label="Vista">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Schede"
            >
              <LayoutGrid />
            </Button>
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              title="Tabella"
            >
              <Rows3 />
            </Button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <CategoryChip active={category === "ALL"} onClick={() => setCategory("ALL")}>
            Tutte <Count n={baseFiltered.length} />
          </CategoryChip>
          {CATEGORIES.map(({ value, label }) => (
            <CategoryChip key={value} active={category === value} onClick={() => setCategory(value)}>
              {label} <Count n={countByCategory.get(value) ?? 0} />
            </CategoryChip>
          ))}
        </div>
      </div>

      <FormError message={error} />

      {loading ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Nessun pezzo corrisponde ai filtri.
        </p>
      ) : (
        <>
          <p className="-mb-3 text-sm text-muted-foreground">
            {visible.length} {visible.length === 1 ? "pezzo" : "pezzi"} · {availableCount} disponibili
          </p>
          {view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  onEdit={isAdmin ? () => setEditing(item) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-0" />
                    <TableHead>N. serie</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Marca e modello</TableHead>
                    <TableHead>Taglia / Volume</TableHead>
                    <TableHead>Stato</TableHead>
                    {isAdmin && <TableHead className="w-0" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => (
                    <TableRow key={item.id} className={item.isArchived ? "opacity-60" : undefined}>
                      <TableCell>
                        <Thumbnail item={item} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.serialNumber}</TableCell>
                      <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                      <TableCell>
                        <span className="font-medium">{item.brand}</span> {item.model}
                      </TableCell>
                      <TableCell>{item.size ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge item={item} />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" title="Modifica" onClick={() => setEditing(item)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={item.isArchived ? "Ripristina" : "Archivia (dismesso)"}
                              onClick={() => void toggleArchived(item)}
                            >
                              {item.isArchived ? <ArchiveRestore /> : <Archive />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Elimina"
                              onClick={() => setDeleting(item)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <>
          <EquipmentFormDialog
            editing={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              void load();
            }}
          />
          <ConfirmDialog
            open={deleting !== undefined}
            title="Eliminare il pezzo?"
            description={
              <>
                {deleting?.brand} {deleting?.model} · <span className="font-mono">{deleting?.serialNumber}</span>
                <br />
                L'eliminazione è definitiva ed è possibile solo per pezzi mai noleggiati. Per un pezzo
                dismesso usa invece "Archivia".
              </>
            }
            confirmLabel="Elimina"
            onClose={() => setDeleting(undefined)}
            onConfirm={async () => {
              await api.delete(`/api/equipment/${deleting!.id}`);
              setDeleting(undefined);
              await load();
            }}
          />
        </>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-xs tabular-nums opacity-70">{n}</span>;
}

/** Miniatura per la vista tabella. */
function Thumbnail({ item }: { item: EquipmentItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
      {item.photoUrl && !failed ? (
        <img
          src={apiUrl(item.photoUrl)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground/50" aria-hidden />
      )}
    </div>
  );
}

function EquipmentCard({ item, onEdit }: { item: EquipmentItem; onEdit?: () => void }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = item.photoUrl && !photoFailed;

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", item.isArchived && "opacity-60")}>
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {showPhoto ? (
          <img
            src={apiUrl(item.photoUrl!)}
            alt={`${item.brand} ${item.model}`}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground/50" aria-hidden />
        )}
      </div>
      <div className="grid gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {CATEGORY_LABELS[item.category]}
          </span>
          <StatusBadge item={item} />
        </div>
        <div>
          <div className="leading-tight font-semibold">
            {item.brand} {item.model}
          </div>
          <div className="text-sm text-muted-foreground">{item.size ?? "Taglia non indicata"}</div>
        </div>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{item.serialNumber}</span>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil /> Modifica
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
