import { format } from "date-fns"

/**
 * Check if a date is available for booking based on business hours and backend availability
 * @param date - The date to check
 * @param timeSlotSettings - Time slot settings containing business hours
 * @param availabilityMap - Backend availability map with date strings as keys
 * @returns "available" | "limited" | "full" | "unavailable"
 */
export function getDateAvailability(
  date: Date,
  timeSlotSettings: any,
  availabilityMap: Record<string, string>
): "available" | "limited" | "full" | "unavailable" {
  // Enhanced null checks for robustness
  if (!date || isNaN(date.getTime()) || !timeSlotSettings?.businessHours) return "unavailable"
  
  const dateString = format(date, "yyyy-MM-dd")
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayName = dayNames[dayOfWeek]
  
  // First check if the day is enabled in business hours
  const daySchedule = timeSlotSettings.businessHours[dayName]
  if (!daySchedule?.enabled || !daySchedule.timeSlots?.length) {
    console.log(`Day ${dayName} (${dayOfWeek}) is disabled in business hours`)
    return "unavailable"
  }
    // Then check the availability map from the backend
  const backendAvailability = availabilityMap[dateString] as "available" | "limited" | "full" | "unavailable"
  
  // Log for debugging
  console.log(`Date: ${dateString}, Day: ${dayName} (${dayOfWeek}), Backend: ${backendAvailability}, BusinessHours: ${daySchedule?.enabled}`)
  
  return backendAvailability || "unavailable"
}
