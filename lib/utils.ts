import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { toZonedTime, format as formatTz } from "date-fns-tz";

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
 * Uses consistent Asia/Manila timezone to ensure all date operations align
 */
export function formatDateKey(date: Date): string {
  const timeZone = "Asia/Manila";
  const dateInManila = toZonedTime(date, timeZone);
  return formatTz(dateInManila, "yyyy-MM-dd", { timeZone });
}
