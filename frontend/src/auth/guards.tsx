import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldX } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { canAccess } from "@/auth/permissions";
import type { Role } from "@/lib/types";

/** Pagine riservate agli utenti autenticati: altrimenti rimanda al login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Pagine riservate ad alcuni ruoli. */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user || !canAccess(user.role, roles)) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <ShieldX className="size-10 text-destructive" />
        <h1 className="text-xl font-semibold">Accesso negato</h1>
        <p className="text-muted-foreground">Il tuo ruolo non consente di aprire questa pagina.</p>
      </div>
    );
  }
  return children;
}
