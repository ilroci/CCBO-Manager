import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { CircleCheck, CircleX, Loader2, Waves } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkHealth, getErrorMessage } from "@/lib/api";

type HealthState = "loading" | "ok" | "error";

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [health, setHealth] = useState<HealthState>("loading");

  // Sveglia il backend (Render free si spegne dopo inattività) e ne mostra lo stato.
  useEffect(() => {
    checkHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);
    try {
      await login(String(form.get("email")), String(form.get("password")));
    } catch (err) {
      setError(getErrorMessage(err, "Accesso non riuscito"));
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <Waves className="size-8 text-primary" aria-hidden />
        <span className="text-2xl font-semibold tracking-tight">Canoa Club</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accedi</CardTitle>
          <CardDescription>Inserisci le credenziali fornite dal club.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="username" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Accedi
            </Button>
          </form>
        </CardContent>
      </Card>

      {import.meta.env.DEV && (
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          Utenti demo (password <code>canoa1234</code>): admin@canoaclub.local ·
          istruttore@canoaclub.local · socio@canoaclub.local
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {health === "loading" && <Loader2 className="size-3 animate-spin" />}
        {health === "ok" && <CircleCheck className="size-3 text-emerald-600" />}
        {health === "error" && <CircleX className="size-3 text-destructive" />}
        Backend:{" "}
        {health === "loading" ? "verifica in corso…" : health === "ok" ? "online" : "non raggiungibile"}
      </div>
    </main>
  );
}
