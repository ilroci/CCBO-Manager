import { Link } from "react-router-dom";
import { useCurrentUser } from "@/auth/AuthContext";
import { navItemsFor, ROLE_LABELS } from "@/auth/permissions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardPage() {
  const user = useCurrentUser();
  const sections = navItemsFor(user.role).filter((item) => item.to !== "/");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ciao, {user.firstName}</h1>
        <p className="text-muted-foreground">Accesso come {ROLE_LABELS[user.role].toLowerCase()}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none">
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <Icon className="mb-2 size-6 text-primary" />
                <CardTitle>{label}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
