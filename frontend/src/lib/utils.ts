import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Helper standard di Shadcn UI per comporre classi Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
