import { format } from "date-fns"
import { toZonedTime, format as formatTz } from "date-fns-tz";

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Check if a date is available for booking based on business hours and backend availability
 * @param date - The date to check
 * @param timeSlotSettings - Time slot settings containing business hours
 * @param availabilityMap - Backend availability map with date strings as keys
 * @returns "available" | "limited" | "unavailable"
 */
export function getDateAvailability(
  date: Date,
  timeSlotSettings: any,
  availabilityMap: Record<string, string>
): "available" | "limited" | "unavailable" {
  // Enhanced null checks for robustness
  if (!date || isNaN(date.getTime()) || !timeSlotSettings?.businessHours) return "unavailable"
  
  const timeZone = "Asia/Manila";
  
  // Convert the input date to Manila timezone to ensure consistent date string format
  const dateInManila = toZonedTime(date, timeZone);
  const dateString = formatTz(dateInManila, "yyyy-MM-dd", { timeZone });
  
  // Use Manila timezone date for day of week calculation
  const dayOfWeek = dateInManila.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayName = dayNames[dayOfWeek]
    // First check if the day is enabled in business hours
  const daySchedule = timeSlotSettings.businessHours[dayName]
  if (!daySchedule?.enabled || !daySchedule.timeSlot) {
    return "unavailable"
  }

  // Determine if the 'date' being checked is "today" in Manila timezone
  const now = new Date(); // Current moment
  const todayInManilaDateString = formatTz(toZonedTime(now, timeZone), "yyyy-MM-dd", { timeZone });

  if (dateString === todayInManilaDateString) {
    // This is "today" in Manila. Apply time-based checks.
    const nowInManila = toZonedTime(now, timeZone);
    const currentTimeMinutes = nowInManila.getHours() * 60 + nowInManila.getMinutes();
    
    const currentDaySchedule = timeSlotSettings.businessHours[dayName];

    if (currentDaySchedule?.enabled && currentDaySchedule.timeSlot) {
      const endTimeMinutes = timeToMinutes(currentDaySchedule.timeSlot.end);
      if (currentTimeMinutes >= endTimeMinutes) {
        return "unavailable";
      }
    } else {
      return "unavailable";
    }
  }
  // Then check the availability map from the backend
  const backendAvailability = availabilityMap[dateString] as "available" | "limited" | "full" | "unavailable"
  
  // For debugging: console.log(`Date: ${dateString}, Backend availability: ${backendAvailability || 'not found'}`)
  
  // Treat "full" status as "unavailable" since all slots are occupied
  const finalAvailability = backendAvailability === "full" ? "unavailable" : backendAvailability
  
  // Return the final availability status, defaulting to unavailable if undefined
  return (finalAvailability as "available" | "limited" | "unavailable") || "unavailable"
}
