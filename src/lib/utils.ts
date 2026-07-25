import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Объединяет классы Tailwind с корректным конфликтом-резолвингом.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
