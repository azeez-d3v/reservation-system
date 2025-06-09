import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to format time in 12-hour format
export function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Convert a Date object to a timezone-safe date string in yyyy-MM-dd format
 * This avoids timezone conversion issues that can occur with toISOString()
 */
export function formatDateKey(date: Date): string {
  return format(new Date(date.getFullYear(), date.getMonth(), date.getDate()), "yyyy-MM-dd");
}
