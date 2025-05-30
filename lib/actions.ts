"use server"

import { revalidatePath } from "next/cache"
import type { 
  Reservation, 
  ReservationRequest, 
  SystemSettings, 
  EmailSettings, 
  User,
  TimeSlotSettings 
} from "./types"
import {
  createReservation,
  getReservations,
  getReservationById,
  updateReservationStatus,
  deleteReservation,
  getUsers,
  createUser,
  updateUserStatus,
  deleteUser,
  getStatistics,
  getAvailableTimeSlots,
  getAlternativeDates,
  getEnhancedTimeSlotAvailability,
  validateTimeSlotForReservation
} from "./firestore"
import { 
  validateReservationRequest, 
  checkTimeSlotAvailability,
  validateTimeSlotForDate,
  type ValidationResult,
  type TimeSlotValidation
} from "./reservation-validator"
import {
  sendReservationSubmissionEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendCancellationEmail,
  sendAdminNotification
} from "./email"

// Helper function to get email and system settings consistently
export async function getNotificationSettings() {
  try {
    const [emailSettings, systemSettings] = await Promise.all([
      getEmailConfiguration(),
      getSettings()
    ])
    return { emailSettings, systemSettings }  } catch (error) {
    console.error("Error fetching notification settings:", error)
    // Return safe defaults if settings can't be fetched
    // IMPORTANT: Try to get individual settings instead of failing completely
    
    let emailSettings: EmailSettings
    let systemSettings: SystemSettings
    
    try {
      emailSettings = await getEmailConfiguration()
    } catch (emailError) {
      console.error("Failed to get email settings, using defaults:", emailError)
      emailSettings = {
        sendUserEmails: false,
        sendAdminEmails: false,
        templates: {
          approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
          rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
          notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
          submission: "Dear {name},\n\nThank you for submitting your reservation request. Your request has been received and is now pending approval.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}\n\nYou will receive an email notification once your request is approved or if any changes are needed.\n\nThank you for using our reservation system!",
          cancellation: "Dear {name},\n\nYour reservation has been cancelled.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\n\nIf you have any questions about this cancellation, please contact us.\n\nThank you for using our reservation system!"
        }
      }
    }
    
    try {
      systemSettings = await getSettings()
    } catch (systemError) {
      console.error("Failed to get system settings, using defaults:", systemError)
      systemSettings = {
        systemName: "Reservation System",
        organizationName: "Your Organization",
        contactEmail: "admin@example.com", // Use consistent fallback value
        requireApproval: true,
        allowOverlapping: true,
        maxOverlappingReservations: 2,
        publicCalendar: true,
        reservationTypes: ["event", "training", "gym", "other"],
        use12HourFormat: true,
        maxAdvanceBookingDays: 30
      }
    }
    
    return { emailSettings, systemSettings }
  }
}

// Enhanced validation exports for UI components
export { type ValidationResult, type TimeSlotValidation }

// Real-time availability validation for UI components
export async function getEnhancedAvailability(date: Date) {
  try {
    return await getEnhancedTimeSlotAvailability(date)
  } catch (error) {
    console.error("Error fetching enhanced availability:", error)
    return {
      timeSlots: [],
      totalSlots: 0,
      availableSlots: 0,
      fullyBookedSlots: 0,
      partiallyBookedSlots: 0,
      systemSettings: {} as SystemSettings
    }
  }
}

// Enhanced time slot validation for form feedback
export async function validateTimeSlot(date: Date, startTime: string, endTime: string, excludeReservationId?: string) {
  try {
    return await validateTimeSlotForReservation(date, startTime, endTime, excludeReservationId)
  } catch (error) {
    console.error("Error validating time slot:", error)
    return {
      isValid: false,
      canProceed: false,
      errors: ["Unable to validate time slot"],
      warnings: [],
      conflictDetails: {
        overlappingReservations: [],
        totalConflicts: 0,
        worstOccupancy: 0,
        maxCapacity: 1,
        allowOverlapping: false
      },
      recommendedAlternatives: []
    }
  }
}

// Enhanced validation for all time slots on a date
export async function getTimeSlotValidations(date: Date, timeSlotInterval: number = 30): Promise<TimeSlotValidation[]> {
  try {
    return await validateTimeSlotForDate(date, timeSlotInterval)
  } catch (error) {
    console.error("Error getting time slot validations:", error)
    return []
  }
}

// Quick availability check for a specific time range
export async function quickAvailabilityCheck(date: Date, startTime: string, endTime: string): Promise<ValidationResult> {
  try {
    return await checkTimeSlotAvailability(date, startTime, endTime)
  } catch (error) {
    console.error("Error in quick availability check:", error)
    return {
      isValid: false,
      errors: ["Unable to check availability"],
      warnings: [],
      availabilityStatus: 'unavailable'
    }
  }
}

// Reservation Actions
export async function submitReservation(request: ReservationRequest) {
  try {
    console.log("Submitting reservation request:", JSON.stringify({
      ...request,
      date: request.date.toString()  // Convert date to string for logging
    }, null, 2))
    
    // Validate the reservation request comprehensively
    const validationResult = await validateReservationRequest(request)
    
    if (!validationResult.isValid) {
      console.warn("Reservation validation failed:", validationResult.errors)
      return {
        success: false,
        message: "Validation failed",
        errors: validationResult.errors,
        warnings: validationResult.warnings
      }
    }
    
    // Log warnings if any
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      console.log("Reservation warnings:", validationResult.warnings)
    }
      const reservationId = await createReservation(request)
    console.log("Reservation created with ID:", reservationId)
      // Send email notifications
    try {
      const { emailSettings, systemSettings } = await getNotificationSettings()
      const reservationDetails = await getReservationById(reservationId)
      
      console.log("Email notification settings check:", {
        userEmailsEnabled: emailSettings.sendUserEmails,
        adminEmailsEnabled: emailSettings.sendAdminEmails,
        contactEmail: systemSettings.contactEmail,
        hasContactEmail: !!systemSettings.contactEmail,
        canSendAdminEmail: emailSettings.sendAdminEmails && !!systemSettings.contactEmail
      })
        if (reservationDetails) {
        // Prepare email tasks for parallel processing
        const emailTasks: Promise<void>[] = []
        
        // Add user confirmation email task (if enabled)
        if (emailSettings.sendUserEmails) {
          emailTasks.push(
            sendReservationSubmissionEmail(reservationDetails, emailSettings)
              .then(() => console.log("User confirmation email sent successfully"))
              .catch(error => console.error("Failed to send user confirmation email:", error))
          )
        } else {
          console.log("User emails are disabled, skipping confirmation email")
        }
        
        // Add admin notification email task (if enabled)
        if (emailSettings.sendAdminEmails && systemSettings.contactEmail) {
          console.log("Attempting to send admin notification email...")
          emailTasks.push(
            sendAdminNotification(reservationDetails, emailSettings, systemSettings, 'created')
              .then(() => console.log("Admin notification email sent successfully"))
              .catch(error => console.error("Failed to send admin notification email:", error))
          )
        } else {
          console.log("Admin emails are disabled or no contact email configured, skipping admin notification")
          console.log("Debug info:", {
            sendAdminEmails: emailSettings.sendAdminEmails,
            contactEmail: `"${systemSettings.contactEmail}"`,
            contactEmailExists: !!systemSettings.contactEmail
          })
        }
        
        // Send all emails in parallel (non-blocking)
        if (emailTasks.length > 0) {
          Promise.all(emailTasks)
            .then(() => console.log("All reservation emails processed successfully"))
            .catch(error => console.error("Some reservation emails failed:", error))
        }
      } else {
        console.warn("Reservation details not found after creation, skipping email notifications")
      }
    } catch (emailError) {
      console.error("Failed to send email notifications:", emailError)
      // Don't fail the reservation creation if email fails
    }
    
    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { 
      success: true, 
      message: "Reservation submitted successfully", 
      reservationId,
      warnings: validationResult.warnings
    }
  } catch (error) {
    console.error("Error submitting reservation:", error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    
    throw error // Re-throw the error so the UI can handle it
  }
}

export async function getReservationList(
  status?: "pending" | "approved" | "cancelled",
  userId?: string
) {
  try {
    // Try to use admin SDK for server-side operations
    try {
      const { adminDb } = await import("./firebase-admin")
      const reservationsCollection = adminDb.collection("reservations")
      
      let query = reservationsCollection.orderBy("createdAt", "desc")
      
      if (status) {
        query = query.where("status", "==", status)
      }
      
      if (userId) {
        query = query.where("userId", "==", userId)
      }
      
      const snapshot = await query.get()
      
      // Convert Firestore documents to plain objects with serialized timestamps
      const reservations = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamps to ISO strings for serialization
          date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        }
      })
      
      return reservations
    } catch (adminError) {
      console.log("Admin SDK not available, falling back to client SDK:", adminError)
      
      // Fall back to client SDK
      const reservations = await getReservations(status, userId)
      
      // Convert to serializable format
      return reservations.map(reservation => ({
        ...reservation,
        date: reservation.date.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        updatedAt: reservation.updatedAt?.toISOString() || reservation.createdAt.toISOString()
      }))
    }
  } catch (error) {
    console.error("Error fetching reservations:", error)
    return []
  }
}

export async function approveReservation(id: string) {
  try {
    // Get reservation details before updating status
    const reservationDetails = await getReservationById(id)
    if (!reservationDetails) {
      return { success: false, message: "Reservation not found" }
    }    // Update reservation status
    await updateReservationStatus(id, "approved")
      // Send email notifications in parallel
    try {
      const { emailSettings, systemSettings } = await getNotificationSettings()
      
      // Prepare email tasks for parallel processing
      const emailTasks: Promise<void>[] = []
        // Add user approval email task (if enabled)
      if (emailSettings.sendUserEmails) {
        emailTasks.push(
          sendApprovalEmail(reservationDetails, emailSettings)
            .then(() => console.log("User approval email sent successfully"))
            .catch(error => console.error("Failed to send user approval email:", error))
        )
      } else {
        console.log("User emails are disabled, skipping approval email")
      }
      
      // Note: Admin notifications are only sent for new reservations, not approvals
      console.log("Admin notification skipped for approval - only sent for new reservations")
      
      // Send all emails in parallel (non-blocking)
      if (emailTasks.length > 0) {
        Promise.all(emailTasks)
          .then(() => console.log("All approval emails processed successfully"))
          .catch(error => console.error("Some approval emails failed:", error))
      }
    } catch (emailError) {
      console.error("Failed to send approval email notifications:", emailError)
      // Don't fail the approval if email fails
    }
    
    revalidatePath("/admin")
    return { success: true, message: "Reservation approved successfully" }
  } catch (error) {
    console.error("Error approving reservation:", error)
    return { success: false, message: "Failed to approve reservation" }
  }
}

export async function rejectReservation(id: string, reason?: string) {
  try {
    // Get reservation details before updating status
    const reservationDetails = await getReservationById(id)
    if (!reservationDetails) {
      return { success: false, message: "Reservation not found" }
    }    // Update reservation status
    await updateReservationStatus(id, "rejected")
      // Send email notifications in parallel
    try {
      const { emailSettings, systemSettings } = await getNotificationSettings()
      
      // Prepare email tasks for parallel processing
      const emailTasks: Promise<void>[] = []
        // Add user rejection email task (if enabled)
      if (emailSettings.sendUserEmails) {
        emailTasks.push(
          sendRejectionEmail(reservationDetails, emailSettings, reason)
            .then(() => console.log("User rejection email sent successfully"))
            .catch(error => console.error("Failed to send user rejection email:", error))
        )
      } else {
        console.log("User emails are disabled, skipping rejection email")
      }
      
      // Note: Admin notifications are only sent for new reservations, not rejections
      console.log("Admin notification skipped for rejection - only sent for new reservations")
      
      // Send all emails in parallel (non-blocking)
      if (emailTasks.length > 0) {
        Promise.all(emailTasks)
          .then(() => console.log("All rejection emails processed successfully"))
          .catch(error => console.error("Some rejection emails failed:", error))
      }
    } catch (emailError) {
      console.error("Failed to send rejection email notifications:", emailError)
      // Don't fail the rejection if email fails
    }
    
    revalidatePath("/admin")
    return { success: true, message: "Reservation rejected successfully" }
  } catch (error) {
    console.error("Error rejecting reservation:", error)
    return { success: false, message: "Failed to reject reservation" }
  }
}

export async function cancelReservation(id: string, cancelledBy: 'user' | 'admin' = 'admin') {
  try {
    // Get reservation details before updating status
    const reservationDetails = await getReservationById(id)
    if (!reservationDetails) {
      return { success: false, message: "Reservation not found" }
    }    // Update reservation status
    await updateReservationStatus(id, "cancelled")
      // Send email notifications in parallel
    try {
      const { emailSettings, systemSettings } = await getNotificationSettings()
      
      // Prepare email tasks for parallel processing
      const emailTasks: Promise<void>[] = []
        // Add user cancellation email task (if enabled)
      if (emailSettings.sendUserEmails) {
        emailTasks.push(
          sendCancellationEmail(reservationDetails, emailSettings, cancelledBy)
            .then(() => console.log("User cancellation email sent successfully"))
            .catch(error => console.error("Failed to send user cancellation email:", error))
        )
      } else {
        console.log("User emails are disabled, skipping cancellation email")
      }
      
      // Note: Admin notifications are only sent for new reservations, not cancellations
      console.log("Admin notification skipped for cancellation - only sent for new reservations")
      
      // Send all emails in parallel (non-blocking)
      if (emailTasks.length > 0) {
        Promise.all(emailTasks)
          .then(() => console.log("All cancellation emails processed successfully"))
          .catch(error => console.error("Some cancellation emails failed:", error))
      }
    } catch (emailError) {
      console.error("Failed to send cancellation email notifications:", emailError)
      // Don't fail the cancellation if email fails
    }
    
    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true, message: "Reservation cancelled successfully" }
  } catch (error) {
    console.error("Error cancelling reservation:", error)
    return { success: false, message: "Failed to cancel reservation" }
  }
}

export async function removeReservation(id: string) {
  try {
    // Get reservation details before deletion for email notification
    const reservationDetails = await getReservationById(id)
      // Delete the reservation
    await deleteReservation(id)
    
    // Note: Admin notifications are only sent for new reservations, not deletions
    console.log("Admin notification skipped for deletion - only sent for new reservations")
    
    revalidatePath("/admin")
    return { success: true, message: "Reservation deleted successfully" }
  } catch (error) {
    console.error("Error deleting reservation:", error)
    return { success: false, message: "Failed to delete reservation" }
  }
}

// System Settings Actions
export async function getSettings(): Promise<SystemSettings> {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("systemSettings").doc("main")
    const docSnap = await docRef.get()
    
    if (docSnap.exists) {
      const data = docSnap.data()
      // Convert any Firestore Timestamps to plain objects
      const serializedData = {
        ...data,
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      }
      return serializedData as SystemSettings
    } else {
      // Return default settings if document doesn't exist
      const { getDefaultSystemSettings } = await import("./firestore")
      return getDefaultSystemSettings()
    }  } catch (error) {
    console.error("Error fetching system settings:", error)
    // Return default settings if fetch fails
    return {
      systemName: "Reservation System",
      organizationName: "Your Organization", 
      contactEmail: "admin@example.com",
      requireApproval: true,
      allowOverlapping: true,
      maxOverlappingReservations: 2,
      publicCalendar: true,
      reservationTypes: ["event", "training", "gym", "other"],
      use12HourFormat: true,
      maxAdvanceBookingDays: 30
    }
  }
}

export async function updateSettings(settings: Partial<SystemSettings>) {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("systemSettings").doc("main")
    
    // Get current settings to merge with new ones
    const currentDoc = await docRef.get()
    const currentSettings = currentDoc.exists ? currentDoc.data() : {}
    
    // Merge with current settings
    const mergedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    }
    
    await docRef.set(mergedSettings, { merge: true })
    revalidatePath("/admin")
    return { success: true, message: "Settings updated successfully" }
  } catch (error) {
    console.error("Error updating settings:", error)
    return { success: false, message: "Failed to update settings" }
  }
}

// Time Slot Settings Actions
export async function getTimeSlots(): Promise<TimeSlotSettings> {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("timeSlotSettings").doc("main")
    const docSnap = await docRef.get()
    
    if (docSnap.exists) {
      const data = docSnap.data()
      // Convert any Firestore Timestamps to plain objects
      const serializedData = {
        ...data,
        // Convert blackout dates timestamps to ISO strings for serialization
        blackoutDates: data?.blackoutDates?.map((bd: any) => ({
          ...bd,
          date: bd.date?.toDate ? bd.date.toDate().toISOString() : new Date(bd.date).toISOString()
        })) || [],
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      }
      return serializedData as TimeSlotSettings
    } else {
      // Return default settings if document doesn't exist
      return {
        businessHours: {
          monday: {
            enabled: true,
            timeSlots: [
              { id: "1", start: "08:00", end: "12:00" },
              { id: "2", start: "13:00", end: "17:00" }
            ]
          },
          tuesday: {
            enabled: true,
            timeSlots: [
              { id: "3", start: "08:00", end: "12:00" },
              { id: "4", start: "13:00", end: "17:00" }
            ]
          },
          wednesday: {
            enabled: true,
            timeSlots: [
              { id: "5", start: "08:00", end: "12:00" },
              { id: "6", start: "13:00", end: "17:00" }
            ]
          },
          thursday: {
            enabled: true,
            timeSlots: [
              { id: "7", start: "08:00", end: "12:00" },
              { id: "8", start: "13:00", end: "17:00" }
            ]
          },
          friday: {
            enabled: true,
            timeSlots: [
              { id: "9", start: "08:00", end: "12:00" },
              { id: "10", start: "13:00", end: "17:00" }
            ]
          },
          saturday: { enabled: false, timeSlots: [] },
          sunday: { enabled: false, timeSlots: [] }
        },
        blackoutDates: [],
        minDuration: 30,
        maxDuration: 240,
        timeSlotInterval: 30,
        bufferTime: 15
      }
    }
  } catch (error) {
    console.error("Error fetching time slot settings:", error)
    // Return default settings if fetch fails
    return {
      businessHours: {
        monday: {
          enabled: true,
          timeSlots: [
            { id: "1", start: "08:00", end: "12:00" },
            { id: "2", start: "13:00", end: "17:00" }
          ]
        },
        tuesday: {
          enabled: true,
          timeSlots: [
            { id: "3", start: "08:00", end: "12:00" },
            { id: "4", start: "13:00", end: "17:00" }
          ]
        },
        wednesday: {
          enabled: true,
          timeSlots: [
            { id: "5", start: "08:00", end: "12:00" },
            { id: "6", start: "13:00", end: "17:00" }
          ]
        },
        thursday: {
          enabled: true,
          timeSlots: [
            { id: "7", start: "08:00", end: "12:00" },
            { id: "8", start: "13:00", end: "17:00" }
          ]
        },
        friday: {
          enabled: true,
          timeSlots: [
            { id: "9", start: "08:00", end: "12:00" },
            { id: "10", start: "13:00", end: "17:00" }
          ]
        },
        saturday: { enabled: false, timeSlots: [] },
        sunday: { enabled: false, timeSlots: [] }
      },
      blackoutDates: [],
      minDuration: 30,
      maxDuration: 240,
      timeSlotInterval: 30,
      bufferTime: 15
    }
  }
}

export async function updateTimeSlots(settings: Partial<TimeSlotSettings>) {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("timeSlotSettings").doc("main")
    
    // Get current settings to merge with new ones
    const currentDoc = await docRef.get()
    const currentSettings = currentDoc.exists ? currentDoc.data() : {}
    
    // Merge with current settings
    const mergedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    }
    
    await docRef.set(mergedSettings, { merge: true })
    revalidatePath("/admin")
    revalidatePath("/")
    return { success: true, message: "Time slots updated successfully" }
  } catch (error) {
    console.error("Error updating time slots:", error)
    return { success: false, message: "Failed to update time slots" }
  }
}

export async function getAvailableSlots(date: Date) {
  try {
    return await getAvailableTimeSlots(date)
  } catch (error) {
    console.error("Error fetching available slots:", error)
    return []
  }
}

// Email Settings Actions
export async function getEmailConfiguration(): Promise<EmailSettings> {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("emailSettings").doc("main")
    const docSnap = await docRef.get()
    
    if (docSnap.exists) {
      const data = docSnap.data()
      // Convert any Firestore Timestamps to plain objects
      const serializedData = {
        ...data,
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      }
      return serializedData as EmailSettings    
    } else {
      // Create default settings document if it doesn't exist
      const defaultSettings = {
        sendUserEmails: false,
        sendAdminEmails: false,
        templates: {
          approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
          rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
          notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
          submission: "Dear {name},\n\nThank you for submitting your reservation request. Your request has been received and is now pending approval.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}\n\nYou will receive an email notification once your request is approved or if any changes are needed.\n\nThank you for using our reservation system!",
          cancellation: "Dear {name},\n\nYour reservation has been cancelled.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\n\nIf you have any questions about this cancellation, please contact us.\n\nThank you for using our reservation system.",
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // Save default settings to database
      await docRef.set(defaultSettings)
      console.log("Created default email settings in database")
      
      return {
        ...defaultSettings,
        createdAt: defaultSettings.createdAt.toISOString(),
        updatedAt: defaultSettings.updatedAt.toISOString()
      } as EmailSettings
    }
  } catch (error) {
    console.error("Error fetching email settings:", error)
    // Return SAFER defaults that disable emails if there's an error
    // This ensures emails are not sent if we can't verify the admin's preferences
    return {
      sendUserEmails: false,
      sendAdminEmails: false,
      templates: {
        approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
        rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
        notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
        submission: "Dear {name},\n\nThank you for submitting your reservation request. Your request has been received and is now pending approval.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}\n\nYou will receive an email notification once your request is approved or if any changes are needed.\n\nThank you for using our reservation system!",
        cancellation: "Dear {name},\n\nYour reservation has been cancelled.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\n\nIf you have any questions about this cancellation, please contact us.\n\nThank you for using our reservation system!"
      }
    }
  }
}

export async function updateEmailConfiguration(settings: Partial<EmailSettings>) {
  try {
    // Use admin SDK for server-side operations
    const { adminDb } = await import("./firebase-admin")
    const docRef = adminDb.collection("emailSettings").doc("main")
    
    // Get current settings to merge with new ones
    const currentDoc = await docRef.get()
    const currentSettings = currentDoc.exists ? currentDoc.data() : {}
    
    // Merge with current settings
    const mergedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    }
    
    await docRef.set(mergedSettings, { merge: true })
    revalidatePath("/admin")
    return { success: true, message: "Email settings updated successfully" }
  } catch (error) {
    console.error("Error updating email settings:", error)
    return { success: false, message: "Failed to update email settings" }
  }
}

// User Management Actions
export async function getUserList(): Promise<User[]> {
  try {
    return await getUsers()
  } catch (error) {
    console.error("Error fetching users:", error)
    return []
  }
}

export async function addUser(userData: Omit<User, "id" | "createdAt" | "updatedAt">) {
  try {
    await createUser(userData)
    revalidatePath("/admin")
    return { success: true, message: "User created successfully" }
  } catch (error) {
    console.error("Error creating user:", error)
    return { success: false, message: "Failed to create user" }
  }
}

export async function updateUser(id: string, status: "active" | "inactive") {
  try {
    await updateUserStatus(id, status)
    revalidatePath("/admin")
    return { success: true, message: "User updated successfully" }
  } catch (error) {
    console.error("Error updating user:", error)
    return { success: false, message: "Failed to update user" }
  }
}

export async function removeUser(id: string) {
  try {
    await deleteUser(id)
    revalidatePath("/admin")
    return { success: true, message: "User deleted successfully" }
  } catch (error) {
    console.error("Error deleting user:", error)
    return { success: false, message: "Failed to delete user" }
  }
}

// Analytics and Statistics Actions
export async function getReservationStats(timeRange: string = "week") {
  try {
    return await getStatistics()
  } catch (error) {
    console.error("Error fetching statistics:", error)
    return {
      totalReservations: 0,
      pendingReservations: 0,
      approvedReservations: 0,
      cancelledReservations: 0,
      totalUsers: 0,
      activeUsers: 0,
      monthlyReservations: [],
      popularTimeSlots: [],
      roomUtilization: 0
    }
  }
}

// Helper function to check if a date/time slot is available
export async function checkAvailability(date: Date, startTime: string, endTime: string) {
  try {
    const reservations = await getReservations("approved")
    const targetDate = date.toDateString()
    
    const conflictingReservations = reservations.filter(reservation => {
      const reservationDate = reservation.date.toDateString()
      if (reservationDate !== targetDate) return false
      
      const reservationStart = reservation.startTime
      const reservationEnd = reservation.endTime
      
      // Check for time overlap
      return (
        (startTime >= reservationStart && startTime < reservationEnd) ||
        (endTime > reservationStart && endTime <= reservationEnd) ||
        (startTime <= reservationStart && endTime >= reservationEnd)
      )
    })
    
    return conflictingReservations.length === 0
  } catch (error) {
    console.error("Error checking availability:", error)
    return false
  }
}

// Public availability function for date picker
export async function getPublicAvailability(startDate: Date, endDate: Date, includeAvailabilityMap: boolean = true) {
  try {
    // If startDate and endDate are the same, return time slots for that specific date
    if (startDate.toDateString() === endDate.toDateString()) {
      try {
        const timeSlots = await getAvailableSlots(startDate)
        const dateKey = startDate.toISOString().split('T')[0]
        const availabilityMap: Record<string, string> = {}
        const availableDates: string[] = []
        
        if (timeSlots.some(slot => slot.available)) {
          availabilityMap[dateKey] = "available"
          availableDates.push(dateKey)
        } else if (timeSlots.some(slot => slot.status === "limited")) {
          availabilityMap[dateKey] = "limited"
          availableDates.push(dateKey)
        } else {
          availabilityMap[dateKey] = "unavailable"
        }
        
        return {
          timeSlots,
          availabilityMap,
          availableDates
        }
      } catch (error) {
        console.error("Error fetching time slots for date:", error)
        return {
          timeSlots: [],
          availabilityMap: {},
          availableDates: []
        }
      }
    }

    // Otherwise, return availability map for date range
    const availabilityMap: Record<string, string> = {}
    const availableDates: string[] = []

    // Get all dates in the range
    const dates: Date[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    // PERFORMANCE OPTIMIZATION: Use Promise.all for parallel requests instead of sequential
    const slotsPromises = dates.map(async (date) => {
      try {
        const slots = await getAvailableSlots(date)
        return { date, slots, error: null }
      } catch (error) {
        return { date, slots: [], error }
      }
    })

    const results = await Promise.all(slotsPromises)

    // Process results
    for (const { date, slots, error } of results) {
      const dateKey = date.toISOString().split('T')[0]
      
      if (error) {
        availabilityMap[dateKey] = "unavailable"
        continue
      }

      const availableSlots = slots.filter(slot => slot.available)
      const limitedSlots = slots.filter(slot => slot.status === "limited")
      
      if (availableSlots.length > 0) {
        availabilityMap[dateKey] = "available"
        availableDates.push(dateKey)
      } else if (limitedSlots.length > 0) {
        availabilityMap[dateKey] = "limited"
      } else {
        availabilityMap[dateKey] = "unavailable"
      }
    }

    return {
      availabilityMap: includeAvailabilityMap ? availabilityMap : undefined,
      availableDates
    }
  } catch (error) {
    console.error("Error fetching public availability:", error)
    return {
      timeSlots: [],
      availabilityMap: {},
      availableDates: []
    }
  }
}

// Re-export firestore functions as server actions
export async function getSystemSettings() {
  try {
    const { getSystemSettings: getSystemSettingsFromFirestore } = await import("./firestore")
    return await getSystemSettingsFromFirestore()
  } catch (error) {
    console.error("Error fetching system settings, using defaults:", error)
    // The underlying Firestore function already returns defaults, but adding fallback here too
    const { getDefaultSystemSettings } = await import("./firestore")
    return getDefaultSystemSettings()
  }
}

export async function getUserReservations(userId: string) {
  try {
    const { getUserReservations: getUserReservationsFromFirestore } = await import("./firestore")
    const reservations = await getUserReservationsFromFirestore(userId)
    
    // Convert Firestore Timestamps to ISO strings for serialization
    return reservations.map(reservation => ({
      ...reservation,
      date: reservation.date.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt?.toISOString() || reservation.createdAt.toISOString()
    }))
  } catch (error) {
    console.error("Error fetching user reservations, returning empty array:", error)
    // Return empty array instead of throwing to prevent app crashes
    return []
  }
}

export async function getUserStats(userId: string) {
  try {
    const { getUserStats: getUserStatsFromFirestore } = await import("./firestore")
    return await getUserStatsFromFirestore(userId)
  } catch (error) {
    console.error("Error fetching user stats, returning default stats:", error)
    // Return default stats instead of throwing to prevent app crashes
    return {
      totalReservations: 0,
      approvedReservations: 0,
      pendingReservations: 0,
      rejectedReservations: 0,
      totalHours: 0
    }
  }
}

// Alternative Dates Action
const alternativeDatesCache = new Map<string, any>()
const CACHE_DURATION = 60000 // 1 minute cache

export async function fetchAlternativeDates(
  requestedDate: string,
  startTime: string,
  endTime: string,
  maxSuggestions: number = 5
) {
  // Create cache key
  const cacheKey = `${requestedDate}-${startTime}-${endTime}-${maxSuggestions}`
  
  try {
    const date = new Date(requestedDate)
    
    // Validate the input date
    if (isNaN(date.getTime())) {
      return {
        success: false,
        error: "Invalid date provided",
        alternatives: []
      }
    }
    
    const cachedResult = alternativeDatesCache.get(cacheKey)
    
    // Return cached result if it exists and is not expired
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log("Returning cached alternative dates for:", { requestedDate, startTime, endTime })
      return cachedResult.data
    }
    
    console.log("Fetching alternative dates for:", {
      requestedDate,
      startTime,
      endTime,
      maxSuggestions
    })
    
    const alternatives = await getAlternativeDates(
      date,
      startTime,
      endTime,
      maxSuggestions
    )
    
    console.log("Found alternative dates:", alternatives.length)
    
    // Format the alternatives with more details for the UI
    const formattedAlternatives = alternatives.map(date => {
      // Get the day of the week as a string (e.g., "Monday")
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
      
      // Get the formatted date (e.g., "January 15, 2024")
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      // Get "Today", "Tomorrow", or "" depending on how soon the date is
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      let relative = ""
      if (date.getTime() === today.getTime()) {
        relative = "Today"
      } else if (date.getTime() === tomorrow.getTime()) {
        relative = "Tomorrow"
      }
      
      // Create a nice display format
      const displayDate = relative ? `${relative} (${dayOfWeek})` : `${dayOfWeek}, ${formattedDate}`
      
      return {
        date: date.toISOString().split('T')[0],
        displayDate,
        dayOfWeek,
        relative,
        formattedDate
      }
    })
    
    const result = {
      success: true,
      alternatives: formattedAlternatives,
      message: formattedAlternatives.length > 0 
        ? `Found ${formattedAlternatives.length} alternative date${formattedAlternatives.length > 1 ? 's' : ''}`
        : "No alternative dates found in the next 2 weeks"
    }
    
    // Cache the result
    alternativeDatesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  } catch (error) {
    console.error("Error fetching alternative dates:", error)
    const errorResult = {
      success: false,
      error: "Failed to fetch alternative dates",
      alternatives: []
    }
    
    // Cache error result for a shorter duration
    alternativeDatesCache.set(cacheKey, {
      data: errorResult,
      timestamp: Date.now()
    })
    
    return errorResult
  }
}

// Debug function to help diagnose the admin email issue
export async function debugReservationEmailFlow(reservationId: string) {
  try {
    console.log("=== RESERVATION EMAIL FLOW DEBUG ===")
    console.log("Reservation ID:", reservationId)
    
    const { emailSettings, systemSettings } = await getNotificationSettings()
    const reservationDetails = await getReservationById(reservationId)
    
    console.log("Reservation found:", !!reservationDetails)
    if (reservationDetails) {
      console.log("Reservation details:", {
        id: reservationDetails.id,
        name: reservationDetails.name,
        email: reservationDetails.email,
        status: reservationDetails.status
      })
    }
    
    console.log("Email Settings Check:")
    console.log("- sendUserEmails:", emailSettings.sendUserEmails)
    console.log("- sendAdminEmails:", emailSettings.sendAdminEmails)
    
    console.log("System Settings Check:")
    console.log("- contactEmail:", `"${systemSettings.contactEmail}"`)
    console.log("- contactEmail length:", systemSettings.contactEmail?.length || 0)
    console.log("- contactEmail is truthy:", !!systemSettings.contactEmail)
    
    const canSendAdminEmail = emailSettings.sendAdminEmails && !!systemSettings.contactEmail
    console.log("Final admin email decision:", canSendAdminEmail)
    console.log("Condition breakdown:", {
      sendAdminEmailsEnabled: emailSettings.sendAdminEmails,
      hasContactEmail: !!systemSettings.contactEmail,
      finalResult: canSendAdminEmail
    })
    
    console.log("=== END RESERVATION EMAIL FLOW DEBUG ===")
    
    return {
      emailSettings,
      systemSettings,
      reservationDetails,
      canSendAdminEmail
    }
  } catch (error) {
    console.error("Error in debugReservationEmailFlow:", error)
    return null
  }
}
