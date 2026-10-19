import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import type { RentalOption } from "@/lib/types";

/** Carica il listino; `reload` dopo una modifica. */
export function usePriceList() {
  const [options, setOptions] = useState<RentalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get<{ options: RentalOption[] }>("/api/price-list");
      setOptions(data.options);
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

  return { options, loading, error, reload };
}

/** Prezzo giornaliero di tutte le voci insieme ("kit completo"). */
export function fullKitPrice(options: RentalOption[]): number {
  return options.reduce((sum, option) => sum + Number(option.dailyPrice), 0);
}
