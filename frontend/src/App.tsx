import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { CircleCheck, CircleX, Loader2, Waves } from "lucide-react";
import { checkHealth } from "@/lib/api";

type HealthState = "loading" | "ok" | "error";

function HomePage() {
  const [health, setHealth] = useState<HealthState>("loading");

  useEffect(() => {
    checkHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 p-6 text-center">
      <Waves className="size-12 text-primary" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">Canoa Club · Gestionale</h1>
      <p className="text-muted-foreground">
        Scheletro dell'applicazione pronto. Inventario, prenotazioni e uscite arriveranno nei
        prossimi passi.
      </p>
      <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
        {health === "loading" && <Loader2 className="size-4 animate-spin" />}
        {health === "ok" && <CircleCheck className="size-4 text-emerald-600" />}
        {health === "error" && <CircleX className="size-4 text-destructive" />}
        <span>
          Backend:{" "}
          {health === "loading" ? "verifica in corso…" : health === "ok" ? "online" : "non raggiungibile"}
        </span>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
