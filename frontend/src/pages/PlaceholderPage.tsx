import { Construction } from "lucide-react";

/** Sezioni previste ma non ancora implementate. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
        <Construction className="size-8" />
        <p>Sezione in arrivo.</p>
      </div>
    </div>
  );
}
