import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Fusion de classes Tailwind — même helper que `@antsia/ui/lib/cn` (remplacé au câblage PD0). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
