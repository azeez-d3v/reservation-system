"use server"

import { getReservationsForDate, getSystemSettings, getTimeSlotSettings, validateTimeSlotForReservation } from "./firestore"
import { Reservation, ReservationRequest, SystemSettings, TimeSlotSettings } from "./types"

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  conflictingReservations?: Reservation[]
  availabilityStatus: 'available' | 'limited' | 'full' | 'unavailable'
  maxConcurrentReservations?: number
  currentOccupancy?: number
  detailedConflictInfo?: {
    worstSlotOccupancy: number
    totalConflictingReservations: number
    affectedTimeSlots: string[]
    recommendedAlternatives: string[]
  }
}

export interface TimeSlotValidation {
  time: string
  isValid: boolean
  occupancy: number
  maxOccupancy: number
  status: 'available' | 'limited' | 'full' | 'unavailable'
  conflictingReservations: Reservation[]
}

/**
 * Enhanced comprehensive validation for reservation requests
 */
export async function validateReservationRequest(
  request: ReservationRequest
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    // Get system settings and time slot settings
    const [systemSettings, timeSlotSettings] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings()
    ])

    // Basic field validation
    validateBasicFields(request, errors)
    
    // Date validation
    await validateDate(request.date, timeSlotSettings, systemSettings, errors, warnings)
    
    // Time validation
    validateTimeSlots(request, timeSlotSettings, errors, warnings)
    
    // Duration validation
    validateDuration(request, timeSlotSettings, errors, warnings)
    
    // Enhanced availability and conflict checking
    const slotValidation = await validateTimeSlotForReservation(
      request.date,
      request.startTime,
      request.endTime
    )

    // Merge validation results
    errors.push(...slotValidation.errors)
    warnings.push(...slotValidation.warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conflictingReservations: slotValidation.conflictDetails.overlappingReservations,
      availabilityStatus: slotValidation.conflictDetails.worstOccupancy === 0 ? 'available' :
                         slotValidation.conflictDetails.worstOccupancy < slotValidation.conflictDetails.maxCapacity ? 'limited' :
                         'full',
      maxConcurrentReservations: slotValidation.conflictDetails.maxCapacity,
      currentOccupancy: slotValidation.conflictDetails.worstOccupancy,
      detailedConflictInfo: {
        worstSlotOccupancy: slotValidation.conflictDetails.worstOccupancy,
        totalConflictingReservations: slotValidation.conflictDetails.overlappingReservations.length,
        affectedTimeSlots: calculateAffectedTimeSlots(request.startTime, request.endTime, timeSlotSettings.timeSlotInterval || 30),
        recommendedAlternatives: slotValidation.recommendedAlternatives
      }
    }
  } catch (error) {
    console.error("Error validating reservation request:", error)
    errors.push("An error occurred while validating the reservation. Please try again.")
    
    return {
      isValid: false,
      errors,
      warnings,
      availabilityStatus: 'unavailable'
    }
  }
}

/**
 * Calculate which time slots are affected by a reservation
 */
function calculateAffectedTimeSlots(startTime: string, endTime: string, interval: number): string[] {
  const slots: string[] = []
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    slots.push(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`)
  }
  
  return slots
}

/**
 * Enhanced date validation with more comprehensive checks
 */
async function validateDate(
  date: Date, 
  timeSlotSettings: TimeSlotSettings,
  systemSettings: SystemSettings,
  errors: string[], 
  warnings: string[]
) {
  const now = new Date()
  const minAdvanceBookingDays = systemSettings.minAdvanceBookingDays || 0
  
  // For same-day booking (minAdvanceBookingDays = 0), compare dates at start of day level
  // For advance booking requirements, use precise date/time comparison
  if (minAdvanceBookingDays === 0) {
    // Allow same-day booking - compare start of day only
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedDate = new Date(date)
    selectedDate.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      errors.push("Reservation date cannot be in the past")
      return
    }
  } else {
    // Check if date is in the past (precise comparison for advance booking)
    if (date < now) {
      errors.push("Reservation date cannot be in the past")
      return
    }
    
    // Check minimum advance booking requirement
    const minBookableDate = new Date(now.getTime() + minAdvanceBookingDays * 24 * 60 * 60 * 1000)
    
    if (date < minBookableDate) {
      const dayText = minAdvanceBookingDays === 1 ? "day" : "days"
      errors.push(`Reservations must be made at least ${minAdvanceBookingDays} ${dayText} in advance`)
      return
    }
  }
  
  // Check if date is a blackout date
  const isBlackoutDate = timeSlotSettings.blackoutDates.some(
    bd => bd.date.toDateString() === date.toDateString()
  )
  
  if (isBlackoutDate) {
    errors.push("Selected date is not available for reservations")
    return
  }

  // Check if date falls on an enabled day
  const dayOfWeek = date.getDay()
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    if (!daySchedule || !daySchedule.enabled) {
    errors.push("Selected date is not available for reservations")
    return
  }
  
  // Add helpful warnings for edge cases
  const dayName = dayNames[dayOfWeek]
  if (daySchedule.timeSlots.length === 0) {
    warnings.push(`No time slots configured for ${dayName}`)
  }
}

/**
 * Validate basic required fields
 */
function validateBasicFields(request: ReservationRequest, errors: string[]) {
  if (!request.name?.trim()) {
    errors.push("Name is required")
  }
  
  if (!request.email?.trim() || !isValidEmail(request.email)) {
    errors.push("Valid email address is required")
  }
  
  if (!request.purpose?.trim()) {
    errors.push("Purpose is required")
  }
  
  if (!request.type?.trim()) {
    errors.push("Reservation type is required")
  }
  
  if (!request.attendees || request.attendees < 1) {
    errors.push("Number of attendees must be at least 1")
  } else if (request.attendees > 1000) {
    errors.push("Number of attendees cannot exceed 1000")
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate time slots and operational hours
 */
function validateTimeSlots(
  request: ReservationRequest, 
  timeSlotSettings: TimeSlotSettings, 
  errors: string[], 
  warnings: string[]
) {
  const { startTime, endTime, date } = request
  
  // Validate time format
  if (!isValidTimeFormat(startTime)) {
    errors.push("Invalid start time format")
    return
  }
  
  if (!isValidTimeFormat(endTime)) {
    errors.push("Invalid end time format")
    return
  }
  
  // Convert times to minutes for comparison
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  
  // Check if end time is after start time
  if (endMinutes <= startMinutes) {
    errors.push("End time must be after start time")
    return
  }
  
  // Get day schedule
  const dayOfWeek = date.getDay()
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
  
  if (!daySchedule || !daySchedule.enabled) {
    errors.push("Selected day is not available for reservations")
    return
  }
  
  // Check if times fall within operational hours
  let isWithinOperationalHours = false
  for (const slot of daySchedule.timeSlots) {
    const slotStartMinutes = timeToMinutes(slot.start)
    const slotEndMinutes = timeToMinutes(slot.end)
    
    if (startMinutes >= slotStartMinutes && endMinutes <= slotEndMinutes) {
      isWithinOperationalHours = true
      break
    }
  }
  
  if (!isWithinOperationalHours) {
    errors.push("Requested time is outside operational hours")
  }
}

/**
 * Validate duration constraints
 */
function validateDuration(
  request: ReservationRequest, 
  timeSlotSettings: TimeSlotSettings, 
  errors: string[], 
  warnings: string[]
) {
  const startMinutes = timeToMinutes(request.startTime)
  const endMinutes = timeToMinutes(request.endTime)
  const durationMinutes = endMinutes - startMinutes
  
  // Check minimum duration
  if (durationMinutes < timeSlotSettings.minDuration) {
    errors.push(`Minimum reservation duration is ${timeSlotSettings.minDuration} minutes`)
  }
  
  // Check maximum duration
  if (durationMinutes > timeSlotSettings.maxDuration) {
    errors.push(`Maximum reservation duration is ${timeSlotSettings.maxDuration} minutes`)
  }
  
  // Check if duration aligns with time slot intervals
  if (durationMinutes % timeSlotSettings.timeSlotInterval !== 0) {
    warnings.push(`Reservation duration should be in ${timeSlotSettings.timeSlotInterval}-minute intervals`)
  }
}

/**
 * Validate time format (HH:mm)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Get comprehensive time slot validation for a specific date
 */
export async function validateTimeSlotForDate(
  date: Date,
  timeSlotInterval: number = 30
): Promise<TimeSlotValidation[]> {
  try {
    const [systemSettings, timeSlotSettings, existingReservations] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings(),
      getReservationsForDate(date)
    ])
    
    // Get day schedule
    const dayOfWeek = date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule || !daySchedule.enabled) {
      return []
    }
    
    const timeSlotValidations: TimeSlotValidation[] = []
    
    // Generate all possible time slots
    for (const operatingSlot of daySchedule.timeSlots) {
      const startMinutes = timeToMinutes(operatingSlot.start)
      const endMinutes = timeToMinutes(operatingSlot.end)
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += timeSlotInterval) {
        const timeString = minutesToTimeString(minutes)        // Find conflicting reservations for this time slot
        const conflictingReservations = existingReservations.filter(reservation => {
          const reservationStartMinutes = timeToMinutes(reservation.startTime)
          const reservationEndMinutes = timeToMinutes(reservation.endTime)
          
          // Include slots that are within the reservation period OR are the exact end time boundary
          return (minutes >= reservationStartMinutes && minutes < reservationEndMinutes) ||
                 (minutes === reservationEndMinutes)
        })
        
        const occupancy = conflictingReservations.length
        const maxOccupancy = systemSettings.maxOverlappingReservations || 1
        
        let status: 'available' | 'limited' | 'full' | 'unavailable' = 'available'
        let isValid = true
        
        if (!systemSettings.allowOverlapping && occupancy > 0) {
          status = 'unavailable'
          isValid = false
        } else if (systemSettings.allowOverlapping) {
          if (occupancy >= maxOccupancy) {
            status = 'full'
            isValid = false
          } else if (occupancy > 0) {
            status = 'limited'
          }
        }
        
        timeSlotValidations.push({
          time: timeString,
          isValid,
          occupancy,
          maxOccupancy,
          status,
          conflictingReservations
        })
      }
    }
    
    return timeSlotValidations
  } catch (error) {
    console.error("Error validating time slots for date:", error)
    return []
  }
}

/**
 * Convert minutes to time string format (HH:mm)
 */
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

/**
 * Check if a specific time slot is available for reservation
 */
export async function checkTimeSlotAvailability(
  date: Date,
  startTime: string,
  endTime: string
): Promise<ValidationResult> {
  const mockRequest: ReservationRequest = {
    userId: "temp",
    name: "temp",
    email: "temp@example.com",
    date,
    startTime,
    endTime,
    purpose: "temp",
    attendees: 1,
    type: "temp"
  }
  
  return validateReservationRequest(mockRequest)
}
