import { z } from "zod";

/** Regola unica per le password, usata in creazione utente e cambio password. */
export const passwordSchema = z.string().min(8, "La password deve avere almeno 8 caratteri").max(128);
