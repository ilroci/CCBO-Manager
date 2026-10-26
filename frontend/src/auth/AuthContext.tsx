import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStorage } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Sola consultazione attiva sul server: modifica solo l'amministratore. */
  adminOnlyEdits: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminOnlyEdits, setAdminOnlyEdits] = useState(false);
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? "loading" : "anonymous",
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(undefined);
  }, [logout]);

  // Al caricamento della pagina recupera l'utente dal token salvato.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    api
      .get<{ user: User; adminOnlyEdits: boolean }>("/api/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        setAdminOnlyEdits(data.adminOnlyEdits);
        setStatus("authenticated");
      })
      .catch(logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User; adminOnlyEdits: boolean }>("/api/auth/login", {
      email,
      password,
    });
    tokenStorage.set(data.token);
    setUser(data.user);
    setAdminOnlyEdits(data.adminOnlyEdits);
    setStatus("authenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, adminOnlyEdits, login, logout }),
    [status, user, adminOnlyEdits, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth va usato dentro <AuthProvider>");
  return ctx;
}

/** Utente corrente nelle pagine protette da RequireAuth (lì non è mai null). */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser va usato dentro una rotta protetta");
  return user;
}

/** L'utente corrente può modificare dati? No per i non amministratori in sola consultazione. */
export function useCanEdit(): boolean {
  const { user, adminOnlyEdits } = useAuth();
  return !adminOnlyEdits || user?.role === "ADMIN";
}
