import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareImage } from "@/lib/image";
import { cn } from "@/lib/utils";

/** `undefined` = foto invariata, `string` = nuova foto (data URL), `null` = foto rimossa. */
export type PhotoChange = string | null | undefined;

/** Scelta della foto dal PC: clic o trascinamento, con anteprima e compressione nel browser. */
export function PhotoPicker({
  currentUrl,
  value,
  onChange,
  onError,
}: {
  /** Foto già salvata (URL assoluto), se presente. */
  currentUrl: string | null;
  value: PhotoChange;
  onChange: (value: PhotoChange) => void;
  onError: (message: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const preview = value === undefined ? currentUrl : value;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    onError(undefined);
    try {
      onChange(await prepareImage(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Immagine non valida");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex h-44 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/50 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          dragOver && "border-primary bg-accent",
        )}
        aria-label={preview ? "Sostituisci foto" : "Scegli foto"}
      >
        {preview ? (
          <img src={preview} alt="Anteprima" className="size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <ImagePlus className="size-8" />
            Clicca o trascina qui una foto
          </span>
        )}
        {processing && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = ""; // consente di riscegliere lo stesso file
        }}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload /> {preview ? "Sostituisci" : "Scegli dal PC"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(currentUrl ? null : undefined)}>
            <Trash2 /> Rimuovi
          </Button>
        )}
      </div>
    </div>
  );
}
