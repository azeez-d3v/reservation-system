import { format, isToday } from "date-fns"

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
  
  const dateString = format(date, "yyyy-MM-dd")
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayName = dayNames[dayOfWeek]
    // First check if the day is enabled in business hours
  const daySchedule = timeSlotSettings.businessHours[dayName]
  if (!daySchedule?.enabled || !daySchedule.timeSlot) {
    // console.log(`Day ${dayName} (${dayOfWeek}) is disabled in business hours`)
    return "unavailable"
  }
  
  // Check if this is today - if so, compare current time with latest available time slot
  if (isToday(date)) {
    const now = new Date()
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()
    
    // Find the end time for today's single time slot
    const endTimeMinutes = timeToMinutes(daySchedule.timeSlot.end)
    
    // If current time has passed the available time slot, mark as unavailable
    if (currentTimeMinutes >= endTimeMinutes) {
      // console.log(`Date ${dateString} is unavailable - current time (${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}) has passed time slot end (${Math.floor(endTimeMinutes / 60)}:${(endTimeMinutes % 60).toString().padStart(2, "0")})`)
      return "unavailable"
    }
  }
  
  // Then check the availability map from the backend
  const backendAvailability = availabilityMap[dateString] as "available" | "limited" | "full" | "unavailable"
  
  // Treat "full" status as "unavailable" since all slots are occupied
  const finalAvailability = backendAvailability === "full" ? "unavailable" : backendAvailability
  
  // Log for debugging
  // console.log(`Date: ${dateString}, Day: ${dayName} (${dayOfWeek}), Backend: ${backendAvailability}, Final: ${finalAvailability}, BusinessHours: ${daySchedule?.enabled}`)
  
  return (finalAvailability as "available" | "limited" | "unavailable") || "unavailable"
}
