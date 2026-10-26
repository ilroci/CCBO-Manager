import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useCanEdit } from "@/auth/AuthContext";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { FormError } from "@/components/FormError";
import { ItemPicker } from "@/components/ItemPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { addDays, formatPeriod, todayIso } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { MAX_RENTAL_DAYS } from "@/lib/rentals";
import type { AvailableItem, Rental, RentalQuote } from "@/lib/types";

export function NewRentalPage() {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const [searchParams] = useSearchParams();
  const today = todayIso();

  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  // Preselezione dal catalogo: /my-rentals/new?item=<id>
  const [selected, setSelected] = useState<Set<string>>(() => new Set(searchParams.getAll("item")));
  const [quote, setQuote] = useState<RentalQuote>();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  /** Incrementato per ricaricare la disponibilità (es. dopo un conflitto). */
  const [reloadKey, setReloadKey] = useState(0);

  const maxEnd = addDays(start, MAX_RENTAL_DAYS - 1);
  const periodValid = start >= today && end >= start && end <= maxEnd;

  // Disponibilità per le date scelte; i pezzi selezionati non più liberi vengono tolti.
  useEffect(() => {
    if (!periodValid) return;
    let cancelled = false;
    setLoadingItems(true);
    api
      .get<{ items: AvailableItem[] }>("/api/rentals/availability", { params: { start, end } })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.items);
        setSelected((current) => {
          const free = new Set(data.items.filter((i) => i.available).map((i) => i.id));
          const kept = new Set([...current].filter((id) => free.has(id)));
          if (kept.size < current.size) {
            setNotice("Alcuni pezzi selezionati non sono disponibili nelle nuove date e sono stati tolti.");
          }
          return kept;
        });
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoadingItems(false));
    return () => {
      cancelled = true;
    };
  }, [start, end, periodValid, reloadKey]);

  // Preventivo calcolato dal backend con il listino in vigore.
  useEffect(() => {
    if (!periodValid || selected.size === 0) {
      setQuote(undefined);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .post<RentalQuote>("/api/rentals/quote", { start, end, itemIds: [...selected] })
        .then(({ data }) => !cancelled && setQuote(data))
        .catch((err) => !cancelled && setError(getErrorMessage(err)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [start, end, selected, periodValid]);

  const selectedItems = items.filter((item) => selected.has(item.id));

  function toggle(id: string) {
    setNotice(undefined);
    setError(undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeStart(value: string) {
    setStart(value);
    if (end < value) setEnd(value);
    else if (end > addDays(value, MAX_RENTAL_DAYS - 1)) setEnd(addDays(value, MAX_RENTAL_DAYS - 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(undefined);
    try {
      const { data } = await api.post<{ rental: Rental }>("/api/rentals", {
        start,
        end,
        itemIds: [...selected],
        notes,
      });
      navigate("/my-rentals", { state: { created: data.rental.id } });
    } catch (err) {
      setError(getErrorMessage(err));
      // Qualcuno può aver prenotato gli stessi pezzi nel frattempo: aggiorna la disponibilità.
      setReloadKey((key) => key + 1);
      setSubmitting(false);
    }
  }

  if (!canEdit) return <Navigate to="/my-rentals" replace />;

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
          <Link to="/my-rentals">
            <ArrowLeft /> I miei noleggi
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuova prenotazione</h1>
        <p className="text-muted-foreground">Scegli le date e l'attrezzatura. Il costo si aggiorna da solo.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4">
          <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="start">Dal giorno</Label>
              <Input id="start" type="date" value={start} min={today} onChange={(e) => changeStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Al giorno (incluso)</Label>
              <Input id="end" type="date" value={end} min={start} max={maxEnd} onChange={(e) => setEnd(e.target.value)} />
            </div>
            {!periodValid && (
              <p className="text-sm text-destructive sm:col-span-2">
                Date non valide: da oggi in poi, al massimo {MAX_RENTAL_DAYS} giorni.
              </p>
            )}
          </div>

          {notice && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {notice}
            </div>
          )}

          {loadingItems ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : (
            <ItemPicker items={items} selected={selected} onToggle={toggle} />
          )}
        </div>

        <Card id="summary" className="scroll-mt-32 lg:sticky lg:top-32">
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="text-sm">
              <div className="font-medium">{periodValid ? formatPeriod(start, end) : "—"}</div>
              {quote && (
                <div className="text-muted-foreground">
                  {quote.days} {quote.days === 1 ? "giorno" : "giorni"}
                </div>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun pezzo selezionato.</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {selectedItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {item.brand} {item.model}{" "}
                      <span className="font-mono text-xs text-muted-foreground">{item.serialNumber}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Togli ${item.serialNumber}`}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {quote && (
              <div className="grid gap-1 border-t pt-4 text-sm">
                {quote.charges.map((charge) => (
                  <div key={charge.optionId ?? charge.name} className="flex justify-between gap-2">
                    <span>
                      {charge.name}{" "}
                      <span className="text-muted-foreground">
                        {formatEuro(charge.dailyPrice)} × {charge.days}
                      </span>
                    </span>
                    <span className="tabular-nums">{formatEuro(charge.amount)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between text-base font-semibold">
                  <span>Totale</span>
                  <span className="tabular-nums">{formatEuro(quote.total)}</span>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="notes">Note (facoltative)</Label>
              <Textarea
                id="notes"
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="es. dove andrai, orario di ritiro…"
              />
            </div>

            <FormError message={error} />
            <Button disabled={!periodValid || selected.size === 0 || submitting} onClick={() => void submit()}>
              {submitting && <Loader2 className="animate-spin" />}
              Conferma prenotazione
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Su schermi stretti il riepilogo sta in fondo alla lista: barra fissa per raggiungerlo */}
      {selected.size > 0 && (
        <>
          <div className="h-16 lg:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">
                  {selected.size} {selected.size === 1 ? "pezzo" : "pezzi"}
                  {quote && ` · ${formatEuro(quote.total)}`}
                </div>
                {quote && (
                  <div className="text-muted-foreground">
                    {quote.days} {quote.days === 1 ? "giorno" : "giorni"}
                  </div>
                )}
              </div>
              <Button onClick={() => document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" })}>
                Rivedi e conferma
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
