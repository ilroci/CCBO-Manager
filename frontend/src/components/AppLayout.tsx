import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Dialog as DialogPrimitive } from "radix-ui";
import { KeyRound, LogOut, Menu, Waves, X } from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthContext";
import { navItemsFor, ROLE_LABELS, type NavItem } from "@/auth/permissions";
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
      <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Waves className="size-6 text-primary" aria-hidden />
          <span className="font-semibold tracking-tight">Canoa Club</span>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <div className="text-right text-sm leading-tight">
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
          <MobileMenu items={items} />
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-2 md:flex">
          {items.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>
    </div>
  );
}

function NavItemLink({ item: { to, label, icon: Icon }, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors max-md:py-2.5 max-md:text-base",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

/** Su schermi stretti il menu e le azioni dell'utente stanno in un pannello laterale. */
function MobileMenu({ items }: { items: NavItem[] }) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Apri menu">
          <Menu className="size-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 border-l bg-background p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-lg duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 leading-tight">
              <DialogPrimitive.Title className="truncate font-medium">
                {user.firstName} {user.lastName}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-sm text-muted-foreground">
                {user.email}
              </DialogPrimitive.Description>
              <Badge variant="secondary" className="mt-2">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Chiudi menu">
                <X className="size-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <nav className="grid gap-1 overflow-y-auto border-t pt-4">
            {items.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={() => setOpen(false)} />
            ))}
          </nav>
          <div className="mt-auto grid gap-1 border-t pt-4">
            <ChangePasswordDialog
              trigger={
                <Button variant="ghost" className="h-11 justify-start">
                  <KeyRound /> Cambia password
                </Button>
              }
            />
            <Button variant="ghost" className="h-11 justify-start" onClick={logout}>
              <LogOut /> Esci
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
