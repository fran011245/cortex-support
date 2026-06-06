import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * macOS detection for native traffic light (red/yellow/green) safe area.
 * Used to add top padding when titleBarStyle: "Overlay" is active in tauri.conf.json.
 */
export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
