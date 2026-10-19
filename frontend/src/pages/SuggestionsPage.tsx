import { useEffect, useState, type FormEvent } from "react";
import { CircleCheck, Loader2, Send } from "lucide-react";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";

interface SuggestionsConfig {
  enabled: boolean;
  recipient: string | null;
}

const MAX_MESSAGE = 5000;

export function SuggestionsPage() {
  const [config, setConfig] = useState<SuggestionsConfig>();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api
      .get<SuggestionsConfig>("/api/suggestions/config")
      .then(({ data }) => setConfig(data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      await api.post("/api/suggestions", { subject, message });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consigli</h1>
        <p className="text-muted-foreground">
          Idee, segnalazioni o proposte per il club: scrivi qui e il messaggio arriverà via email al direttivo.
        </p>
      </div>

      {!config ? (
        error ? <FormError message={error} /> : <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : sent ? (
        <Card>
          <CardContent className="grid justify-items-start gap-3">
            <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
              <CircleCheck className="size-5" /> Grazie, messaggio inviato!
            </div>
            <p className="text-sm text-muted-foreground">
              Eventuali risposte arriveranno al tuo indirizzo email.
            </p>
            <Button variant="outline" onClick={() => setSent(false)}>
              Scrivi un altro messaggio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nuovo messaggio</CardTitle>
            <CardDescription>
              {config.enabled
                ? `Destinatario: ${config.recipient}. Il tuo nome e la tua email vengono aggiunti in automatico.`
                : "L'invio dei messaggi non è ancora configurato: contatta un amministratore."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <fieldset disabled={!config.enabled || sending} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Oggetto</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    minLength={3}
                    maxLength={150}
                    required
                    placeholder="Es. Nuove pagaie per i corsi"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">Messaggio</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    minLength={10}
                    maxLength={MAX_MESSAGE}
                    required
                    className="min-h-40"
                  />
                  <span className="justify-self-end text-xs text-muted-foreground tabular-nums">
                    {message.length}/{MAX_MESSAGE}
                  </span>
                </div>
              </fieldset>
              <FormError message={error} />
              <Button type="submit" className="justify-self-end" disabled={!config.enabled || sending}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Invio…" : "Invia"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
