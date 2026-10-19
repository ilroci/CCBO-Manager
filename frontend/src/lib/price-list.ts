import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import type { RentalOption, ServiceFee } from "@/lib/types";

/** Carica il listino (voci di noleggio e tariffe dei servizi); `reload` dopo una modifica. */
export function usePriceList() {
  const [options, setOptions] = useState<RentalOption[]>([]);
  const [serviceFees, setServiceFees] = useState<ServiceFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get<{ options: RentalOption[]; serviceFees: ServiceFee[] }>("/api/price-list");
      setOptions(data.options);
      setServiceFees(data.serviceFees);
      setError(undefined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Tariffe fisse per uscita: quota furgone (opzione A) e solo trasporto attrezzatura (opzione B). */
  const vanSeatFee = serviceFees.find((fee) => fee.type === "VAN_SEAT")?.amount;
  const transportFee = serviceFees.find((fee) => fee.type === "EQUIPMENT_TRANSPORT")?.amount;

  return { options, serviceFees, vanSeatFee, transportFee, loading, error, reload };
}

/** Prezzo giornaliero di tutte le voci insieme ("kit completo"). */
export function fullKitPrice(options: RentalOption[]): number {
  return options.reduce((sum, option) => sum + Number(option.dailyPrice), 0);
}
