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
    // Check if this is today - if so, compare current time with latest available time slot using Philippine timezone
  if (isToday(date)) {
    // Get current time in Philippine timezone (UTC+8)
    const now = new Date()
    const philippineTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    const currentTimeMinutes = philippineTime.getHours() * 60 + philippineTime.getMinutes()    // Also check if the date we're checking is actually today in Philippine timezone
    // Convert Philippine time to YYYY-MM-DD format to match dateString format
    const todayInPhilippines = new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}).split(',')[0] // Get date part
    const todayFormatted = new Date(todayInPhilippines).toISOString().split('T')[0] // Convert to YYYY-MM-DD format
    
    // Only apply time-based availability check if it's actually today in Philippine timezone
    if (dateString === todayFormatted) {
      // Find the end time for today's single time slot
      const endTimeMinutes = timeToMinutes(daySchedule.timeSlot.end)
      
      // If current time has passed the available time slot, mark as unavailable
      if (currentTimeMinutes >= endTimeMinutes) {
        return "unavailable"
      }
    }
  }
    // Then check the availability map from the backend
  const backendAvailability = availabilityMap[dateString] as "available" | "limited" | "full" | "unavailable"
  
  // Treat "full" status as "unavailable" since all slots are occupied
  const finalAvailability = backendAvailability === "full" ? "unavailable" : backendAvailability
    // Return the final availability status, defaulting to unavailable if undefined
  return (finalAvailability as "available" | "limited" | "unavailable") || "unavailable"
}
