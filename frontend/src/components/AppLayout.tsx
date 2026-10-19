import { NavLink, Outlet } from "react-router-dom";
import { KeyRound, LogOut, Waves } from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthContext";
import { navItemsFor, ROLE_LABELS } from "@/auth/permissions";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const items = navItemsFor(user.role);

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Waves className="size-6 text-primary" aria-hidden />
          <span className="font-semibold tracking-tight">Canoa Club</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right text-sm leading-tight sm:block">
              <div className="font-medium">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            <ChangePasswordDialog
              trigger={
                <Button variant="ghost" size="icon" title="Cambia password">
                  <KeyRound />
                </Button>
              }
            />
            <Button variant="ghost" size="icon" title="Esci" onClick={logout}>
              <LogOut />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
