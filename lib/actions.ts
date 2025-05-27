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
  updateReservationStatus,
  deleteReservation,
  getUsers,
  createUser,
  updateUserStatus,
  deleteUser,
  getStatistics,
  getAvailableTimeSlots
} from "./firestore"

// Reservation Actions
export async function submitReservation(request: ReservationRequest) {
  try {
    console.log("Submitting reservation request:", JSON.stringify({
      ...request,
      date: request.date.toString()  // Convert date to string for logging
    }, null, 2))
    
    const reservationId = await createReservation(request)
    console.log("Reservation created with ID:", reservationId)
    
    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    return { 
      success: true, 
      message: "Reservation submitted successfully", 
      reservationId 
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
    await updateReservationStatus(id, "approved")
    revalidatePath("/admin")
    return { success: true, message: "Reservation approved successfully" }
  } catch (error) {
    console.error("Error approving reservation:", error)
    return { success: false, message: "Failed to approve reservation" }
  }
}

export async function cancelReservation(id: string) {
  try {
    await updateReservationStatus(id, "cancelled")
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
    await deleteReservation(id)
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
    }
  } catch (error) {
    console.error("Error fetching system settings:", error)
    // Return default settings if fetch fails
    return {
      systemName: "Reservation System",
      organizationName: "Your Organization", 
      contactEmail: "admin@example.com",
      timeZone: "Asia/Manila",
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
      // Return default settings if document doesn't exist
      return {
        sendUserEmails: true,
        sendAdminEmails: true,
        notificationRecipients: [],
        templates: {
          approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
          rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
          notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
        }
      }
    }
  } catch (error) {
    console.error("Error fetching email settings:", error)
    // Return default settings if fetch fails
    return {
      sendUserEmails: true,
      sendAdminEmails: true,
      notificationRecipients: [],
      templates: {
        approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
        rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
        notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
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
