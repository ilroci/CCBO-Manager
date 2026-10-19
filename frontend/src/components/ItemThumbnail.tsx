import { useState } from "react";
import { ImageOff } from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { EquipmentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Miniatura quadrata della foto del pezzo, con icona se manca o non si carica. */
export function ItemThumbnail({ item, className }: { item: Pick<EquipmentItem, "photoUrl">; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted", className)}>
      {item.photoUrl && !failed ? (
        <img
          src={apiUrl(item.photoUrl)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageOff className="size-4 text-muted-foreground/50" aria-hidden />
      )}
    </div>
  );
}
