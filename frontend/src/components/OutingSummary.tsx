import type { ReactNode } from "react";
import { CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEuro } from "@/lib/money";
import { COLLECTION_LABELS, TRAVEL_MODE_LABELS } from "@/lib/outings";
import type { Outing, OutingParticipant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Spese del furgone di un partecipante: quota furgone + la sua parte dei costi vivi se è a
 * bordo, tariffa del trasporto attrezzatura se viaggia per conto suo. null = nessuna spesa.
 */
function vanCosts(p: OutingParticipant) {
  if (p.travelMode === "VAN") {
    const share = Number(p.vanExpenses?.share ?? 0);
    return {
      total: Number(p.vanSeatAmount) + share,
      detail: `quota ${formatEuro(p.vanSeatAmount)} + costi vivi ${formatEuro(share)}`,
      balance: p.vanExpenses && share > 0 ? p.vanExpenses : null,
    };
  }
  if (p.travelMode === "TRANSPORT_ONLY") {
    return { total: Number(p.transportAmount), detail: "trasporto attrezzatura", balance: null };
  }
  return null;
}

/** Riepilogo dell'uscita: una riga per partecipante con materiale noleggiato e spese del furgone. */
export function OutingSummary({ outing }: { outing: Outing }) {
  const rows = [...outing.participants].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "it"),
  );
  const rentalTotal = rows.reduce((sum, p) => sum + Number(p.rentalAmount), 0);
  const vanTotal = rows.reduce((sum, p) => sum + (vanCosts(p)?.total ?? 0), 0);
  /** La colonna delle spese extra compare solo se l'uscita ne ha. */
  const hasExtra = outing.extraFees.length > 0;
  const extraTotal = rows.reduce((sum, p) => sum + Number(p.extraAmount), 0);

  return (
    <>
      {/* Mobile: una scheda per partecipante */}
      <div className="divide-y rounded-xl border md:hidden">
        {rows.map((p) => (
          <div key={p.id} className="grid gap-2 p-3 text-sm">
            <Member participant={p} />
            <div>
              <div className="text-xs font-medium text-muted-foreground">Materiale noleggiato</div>
              <RentalCell participant={p} />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Spese del furgone</div>
              <VanCell participant={p} />
            </div>
            {hasExtra && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Spese extra</div>
                <ExtraCell participant={p} />
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground">Riscosso</div>
              <CollectedCell participant={p} />
            </div>
          </div>
        ))}
        <div className="flex justify-between gap-3 bg-muted/50 p-3 text-sm font-medium tabular-nums">
          <span>Noleggio {formatEuro(rentalTotal)}</span>
          <span>Furgone {formatEuro(vanTotal)}</span>
          {hasExtra && <span>Extra {formatEuro(extraTotal)}</span>}
        </div>
        <div className="bg-muted/50 px-3 pb-3 text-sm font-medium tabular-nums">
          Riscosso {formatEuro(outing.totals.collected)} su {formatEuro(outing.totals.total)}
        </div>
      </div>

      {/* Desktop: tabella */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Socio</TableHead>
              <TableHead>Materiale noleggiato</TableHead>
              <TableHead>Spese del furgone</TableHead>
              {hasExtra && <TableHead>Spese extra</TableHead>}
              <TableHead className="px-4">Riscosso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="align-top">
                <TableCell className="px-4">
                  <Member participant={p} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <RentalCell participant={p} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <VanCell participant={p} />
                </TableCell>
                {hasExtra && (
                  <TableCell className="text-right">
                    <ExtraCell participant={p} />
                  </TableCell>
                )}
                <TableCell className="px-4">
                  <CollectedCell participant={p} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="px-4">Totale</TableCell>
              <TableCell className="text-right tabular-nums">{formatEuro(rentalTotal)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEuro(vanTotal)}</TableCell>
              {hasExtra && <TableCell className="text-right tabular-nums">{formatEuro(extraTotal)}</TableCell>}
              <TableCell className="px-4 tabular-nums">
                {formatEuro(outing.totals.collected)} su {formatEuro(outing.totals.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

function Member({ participant: p }: { participant: OutingParticipant }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-medium">
        {p.lastName} {p.firstName}
        {p.isGuest && <Badge variant="outline">Ospite</Badge>}
      </div>
      <div className="text-xs text-muted-foreground">{TRAVEL_MODE_LABELS[p.travelMode].short}</div>
    </div>
  );
}

function RentalCell({ participant: p }: { participant: OutingParticipant }) {
  if (!p.rental || p.rental.charges.length === 0) {
    return <Muted>Attrezzatura propria</Muted>;
  }
  return (
    <AmountRow amount={formatEuro(p.rentalAmount)}>
      <div>{p.rental.charges.map((ch) => ch.name).join(", ")}</div>
      {p.rental.items.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {p.rental.items.map(({ id, item }) => (
            <div key={id}>
              {item.brand} {item.model} <span className="font-mono">{item.serialNumber}</span>
            </div>
          ))}
        </div>
      )}
    </AmountRow>
  );
}

function VanCell({ participant: p }: { participant: OutingParticipant }) {
  const costs = vanCosts(p);
  if (!costs) return <Muted>Viaggio autonomo</Muted>;
  const balance = costs.balance ? Number(costs.balance.balance) : 0;
  return (
    <AmountRow amount={formatEuro(costs.total)}>
      <div className="text-xs text-muted-foreground tabular-nums">{costs.detail}</div>
      {costs.balance && (
        <div
          className={cn(
            "text-xs tabular-nums",
            balance > 0 && "text-emerald-700 dark:text-emerald-400",
            balance < 0 && "text-red-700 dark:text-red-400",
            balance === 0 && "text-muted-foreground",
          )}
        >
          ha anticipato {formatEuro(costs.balance.paid)} ·{" "}
          {balance === 0 ? "in pari" : `${balance > 0 ? "riceve" : "deve dare"} ${formatEuro(Math.abs(balance))}`}
        </div>
      )}
    </AmountRow>
  );
}

function ExtraCell({ participant: p }: { participant: OutingParticipant }) {
  return <span className="font-semibold tabular-nums">{formatEuro(p.extraAmount)}</span>;
}

/** Stato delle riscossioni: badge complessivo e una riga per voce (noleggio, trasporto, furgone). */
function CollectedCell({ participant: p }: { participant: OutingParticipant }) {
  if (p.collections.length === 0) return <Muted>Nulla da riscuotere</Muted>;
  const unpaid = p.collections.filter((c) => !c.payment);
  const due = unpaid.reduce((sum, c) => sum + Number(c.amount), 0);
  return (
    <div className="grid gap-1">
      <Badge
        className={cn(
          "border-transparent",
          unpaid.length === 0
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        )}
      >
        {unpaid.length === 0 ? "Tutto riscosso" : `Da riscuotere ${formatEuro(due)}`}
      </Badge>
      {p.collections.length > 1 && (
        <ul className="grid gap-0.5 text-xs">
          {p.collections.map((c) => (
            <li
              key={c.category}
              className={cn(
                "flex items-center gap-1",
                c.payment ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {c.payment ? <CircleCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
              {COLLECTION_LABELS[c.category]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AmountRow({ amount, children }: { amount: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      <span className="shrink-0 font-semibold tabular-nums">{amount}</span>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
