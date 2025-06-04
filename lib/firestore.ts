import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  getDoc,
  setDoc,
  writeBatch,
  limit,
  runTransaction,
  Transaction
} from "firebase/firestore"
import { db } from "./firebase"
import type { 
  Reservation, 
  ReservationRequest, 
  SystemSettings, 
  TimeSlotSettings, 
  EmailSettings,
  User,
  BlackoutDate
} from "./types"

// Collection names
const RESERVATIONS_COLLECTION = "reservations"
const SYSTEM_SETTINGS_COLLECTION = "systemSettings"
const TIME_SLOT_SETTINGS_COLLECTION = "timeSlotSettings"
const EMAIL_SETTINGS_COLLECTION = "emailSettings"
const USERS_COLLECTION = "users"
const BLACKOUT_DATES_COLLECTION = "blackoutDates"

export async function createReservation(data: ReservationRequest): Promise<string> {
  try {
    console.log("Creating reservation with data:", data)
    
    // Enhanced pre-creation validation with real-time availability check
    const validationResult = await validateReservationAvailability(data)
    if (!validationResult.isValid) {
      throw new Error(`Reservation validation failed: ${validationResult.errors.join(', ')}`)
    }

    // Get system settings to determine if approval is required
    const systemSettings = await getSystemSettings()
    const requiresApproval = systemSettings.requireApproval

    // Use Firestore transaction for atomic operation
    const reservationId = doc(collection(db, RESERVATIONS_COLLECTION)).id
    
    const result = await runTransaction(db, async (transaction) => {
      // Re-check availability within transaction to prevent race conditions
      const realtimeValidation = await validateReservationAvailabilityInTransaction(transaction, data)
      if (!realtimeValidation.isValid) {
        throw new Error(`Reservation no longer available: ${realtimeValidation.errors.join(', ')}`)
      }
        // Set initial status based on requireApproval setting
      const initialStatus = requiresApproval ? "pending" : "approved"
      
      const reservationData = {
        ...data,
        id: reservationId,
        status: initialStatus,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        validationMetadata: {
          currentOccupancy: realtimeValidation.currentOccupancy,
          maxCapacity: realtimeValidation.maxCapacity,
          availabilityStatus: realtimeValidation.availabilityStatus,
          conflictingReservationIds: realtimeValidation.conflictingReservations.map(r => r.id)
        }
      }
      
      const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId)
      transaction.set(reservationRef, reservationData)
      
      console.log(`Reservation created with status: ${initialStatus} (requireApproval: ${requiresApproval})`)
      return reservationId
    })
    
    console.log("Reservation created successfully with ID:", result)
    return result
    
  } catch (error) {
    console.error("Error creating reservation:", error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Failed to create reservation due to an unexpected error")
  }
}

// Enhanced validation function for real-time availability checking
async function validateReservationAvailability(data: ReservationRequest): Promise<{
  isValid: boolean
  errors: string[]
  warnings: string[]
  currentOccupancy: number
  maxCapacity: number
  availabilityStatus: string
  conflictingReservations: Reservation[]
}> {
  try {
    const [systemSettings, timeSlotSettings, existingReservations] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings(),
      getReservationsForDate(data.date)
    ])
      const errors: string[] = []
    const warnings: string[] = []
    
    // Check basic date/time validity with same-day booking support
    const minAdvanceBookingDays = systemSettings.minAdvanceBookingDays || 0
    
    if (minAdvanceBookingDays === 0) {
      // Allow same-day booking - compare start of day only
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const selectedDate = new Date(data.date)
      selectedDate.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        errors.push("Cannot create reservations for past dates")
      }    } else {
      // Check if date is in the past (precise comparison for advance booking)
      if (data.date < new Date()) {
        errors.push("Cannot create reservations for past dates")
      }
      
      // Check minimum advance booking requirement
      const minBookableDate = new Date()
      minBookableDate.setDate(minBookableDate.getDate() + minAdvanceBookingDays)
      minBookableDate.setHours(0, 0, 0, 0)
      
      const selectedDate = new Date(data.date)
      selectedDate.setHours(0, 0, 0, 0)
      
      if (selectedDate < minBookableDate) {
        const dayText = minAdvanceBookingDays === 1 ? "day" : "days"
        errors.push(`Reservations must be made at least ${minAdvanceBookingDays} ${dayText} in advance`)
      }
    }
    
    // Check if date is enabled for reservations
    const dayOfWeek = data.date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule?.enabled) {
      errors.push("Selected date is not available for reservations")
    }
    
    // Calculate time overlap conflicts with precise minute-level accuracy
    const requestStartMinutes = timeToMinutes(data.startTime)
    const requestEndMinutes = timeToMinutes(data.endTime)
    
    const conflictingReservations = existingReservations.filter(reservation => {
      if (reservation.status === "cancelled" || reservation.status === "rejected") {
        return false
      }
      
      const reservationStartMinutes = timeToMinutes(reservation.startTime)
      const reservationEndMinutes = timeToMinutes(reservation.endTime)
      
      // Check for any time overlap using precise interval comparison
      return (requestStartMinutes < reservationEndMinutes && requestEndMinutes > reservationStartMinutes)
    })
    
    const currentOccupancy = conflictingReservations.length
    const maxCapacity = systemSettings.maxOverlappingReservations || 1
    
    let availabilityStatus = "available"
    
    // Apply business rules for availability
    if (!systemSettings.allowOverlapping && currentOccupancy > 0) {
      availabilityStatus = "unavailable"
      errors.push(`Time slot is already reserved. Overlapping reservations are not allowed.`)
    } else if (systemSettings.allowOverlapping && currentOccupancy >= maxCapacity) {
      availabilityStatus = "full"
      errors.push(`Time slot is fully booked (${currentOccupancy}/${maxCapacity} reservations)`)
    } else if (currentOccupancy > 0) {
      availabilityStatus = "limited"
      warnings.push(`Time slot has ${currentOccupancy} existing reservation(s)`)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      currentOccupancy,
      maxCapacity,
      availabilityStatus,
      conflictingReservations
    }
    
  } catch (error) {
    console.error("Error validating reservation availability:", error)
    return {
      isValid: false,
      errors: ["Unable to validate reservation availability"],
      warnings: [],
      currentOccupancy: 0,
      maxCapacity: 1,
      availabilityStatus: "unavailable",
      conflictingReservations: []
    }
  }
}

// Transaction-safe validation to prevent race conditions
async function validateReservationAvailabilityInTransaction(
  transaction: Transaction,
  data: ReservationRequest
): Promise<{
  isValid: boolean
  errors: string[]
  currentOccupancy: number
  maxCapacity: number
  availabilityStatus: string
  conflictingReservations: Reservation[]
}> {
  // Get system settings within transaction
  const settingsRef = doc(db, SYSTEM_SETTINGS_COLLECTION, "default")
  const settingsDoc = await transaction.get(settingsRef)
  
  const systemSettings = settingsDoc.exists() ? settingsDoc.data() as SystemSettings : getDefaultSystemSettings()
  
  // Get existing reservations for the date - we need to do this outside transaction
  // since Firestore transactions can't perform queries, only single document reads
  const existingReservations = await getReservationsForDate(data.date)
  
  // Perform the same conflict detection as before
  const requestStartMinutes = timeToMinutes(data.startTime)
  const requestEndMinutes = timeToMinutes(data.endTime)
  
  const conflictingReservations = existingReservations.filter(reservation => {
    if (reservation.status === "cancelled" || reservation.status === "rejected") {
      return false
    }
    
    const reservationStartMinutes = timeToMinutes(reservation.startTime)
    const reservationEndMinutes = timeToMinutes(reservation.endTime)
    
    return (requestStartMinutes < reservationEndMinutes && requestEndMinutes > reservationStartMinutes)
  })
  
  const currentOccupancy = conflictingReservations.length
  const maxCapacity = systemSettings.maxOverlappingReservations || 1
  const errors: string[] = []
  
  let availabilityStatus = "available"
  
  if (!systemSettings.allowOverlapping && currentOccupancy > 0) {
    availabilityStatus = "unavailable"
    errors.push("Time slot is no longer available")
  } else if (systemSettings.allowOverlapping && currentOccupancy >= maxCapacity) {
    availabilityStatus = "full"
    errors.push("Time slot is now fully booked")
  } else if (currentOccupancy > 0) {
    availabilityStatus = "limited"
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    currentOccupancy,
    maxCapacity,
    availabilityStatus,
    conflictingReservations
  }
}

export async function getReservations(status?: string, userId?: string): Promise<Reservation[]> {
  try {
    let q = query(
      collection(db, RESERVATIONS_COLLECTION),
      orderBy("createdAt", "desc")
    )
    
    if (status) {
      q = query(
        collection(db, RESERVATIONS_COLLECTION),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      )
    }
    
    if (userId) {
      if (status) {
        q = query(
          collection(db, RESERVATIONS_COLLECTION),
          where("status", "==", status),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      } else {
        q = query(
          collection(db, RESERVATIONS_COLLECTION),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      }
    }
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
      }
    }) as Reservation[]
  } catch (error) {
    console.error("Error fetching reservations:", error)
    throw new Error("Failed to fetch reservations")
  }
}

export async function getUserReservations(userId: string): Promise<Reservation[]> {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
      }
    }) as Reservation[]
  } catch (error) {
    console.error("Error fetching user reservations, returning empty array:", error)
    // Return empty array instead of throwing to prevent app crashes
    return []
  }
}

export async function updateReservationStatus(
  reservationId: string, 
  status: "approved" | "rejected" | "cancelled"
): Promise<void> {
  try {
    const reservationRef = doc(db, RESERVATIONS_COLLECTION, reservationId)
    await updateDoc(reservationRef, {
      status,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error("Error updating reservation status:", error)
    throw new Error("Failed to update reservation status")
  }
}

export async function deleteReservation(reservationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RESERVATIONS_COLLECTION, reservationId))
  } catch (error) {
    console.error("Error deleting reservation:", error)
    throw new Error("Failed to delete reservation")
  }
}

export async function getReservationById(reservationId: string): Promise<Reservation | null> {
  try {
    const docRef = doc(db, RESERVATIONS_COLLECTION, reservationId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
      } as Reservation
    }
    return null
  } catch (error) {
    console.error("Error fetching reservation:", error)
    throw new Error("Failed to fetch reservation")
  }
}

export async function getReservationsForDate(date: Date): Promise<Reservation[]> {
  try {
    // Create date boundaries using Philippine timezone to ensure consistency
    // across different server environments (localhost vs deployed)
    const dateInPhilippines = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    
    const startOfDay = new Date(dateInPhilippines)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(dateInPhilippines)
    endOfDay.setHours(23, 59, 59, 999)

    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("date", ">=", Timestamp.fromDate(startOfDay)),
      where("date", "<=", Timestamp.fromDate(endOfDay)),
      where("status", "==", "approved")
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
      }
    }) as Reservation[]
  } catch (error) {
    console.error("Error fetching reservations for date:", error)
    throw new Error("Failed to fetch reservations for date")
  }
}

// System Settings Functions
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, "main")
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      // Convert any Firestore Timestamps to plain objects for serialization
      const serializedData = {
        ...data,
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      }
      return serializedData as SystemSettings
    } else {
      // Return default settings if none exist
      return getDefaultSystemSettings()
    }
  } catch (error) {
    console.error("Error fetching system settings, using defaults:", error)
    // Return default settings instead of throwing to prevent app crashes
    return getDefaultSystemSettings()
  }
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
  try {
    const docRef = doc(db, SYSTEM_SETTINGS_COLLECTION, "main")
    
    // Get current settings to merge with new ones
    const currentDoc = await getDoc(docRef)
    const currentSettings = currentDoc.exists() ? currentDoc.data() as SystemSettings : getDefaultSystemSettings()
    
    // Merge with current settings
    const mergedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    }
    
    await setDoc(docRef, mergedSettings, { merge: true })
  } catch (error) {
    console.error("Error updating system settings:", error)
    throw new Error("Failed to update system settings")
  }
}

// Time Slot Settings Functions
export async function getTimeSlotSettings(): Promise<TimeSlotSettings> {
  try {
    const docRef = doc(db, TIME_SLOT_SETTINGS_COLLECTION, "main")
    const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
      const data = docSnap.data()
      
      return {
        ...data,
        blackoutDates: data.blackoutDates?.map((bd: any) => ({
          ...bd,
          date: bd.date?.toDate ? bd.date.toDate() : new Date(bd.date)
        })) || [],
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      } as TimeSlotSettings
    } else {
      return getDefaultTimeSlotSettings()
    }
  } catch (error) {
    console.error("Error fetching time slot settings, using defaults:", error)
    // Return default settings instead of throwing to prevent app crashes
    return getDefaultTimeSlotSettings()
  }
}

// Internal function to get the raw time slot settings document
export async function getTimeSlotSettingsDocument(): Promise<TimeSlotSettings> {
  try {
    const docRef = doc(db, TIME_SLOT_SETTINGS_COLLECTION, "main")
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        ...data,
        blackoutDates: data.blackoutDates?.map((bd: any) => ({
          ...bd,
          date: bd.date.toDate()
        })) || []
      } as TimeSlotSettings
    } else {
      return getDefaultTimeSlotSettings()
    }
  } catch (error) {
    console.error("Error fetching time slot settings document:", error)
    return getDefaultTimeSlotSettings()
  }
}

export async function updateTimeSlotSettings(settings: Partial<TimeSlotSettings>): Promise<void> {
  try {
    const docRef = doc(db, TIME_SLOT_SETTINGS_COLLECTION, "main")
    
    // Get current settings to merge with new ones
    const currentDoc = await getDoc(docRef)
    const currentSettings = currentDoc.exists() 
      ? {
          ...currentDoc.data(),
          blackoutDates: currentDoc.data()?.blackoutDates?.map((bd: any) => ({
            ...bd,
            date: bd.date.toDate()
          })) || []
        } as TimeSlotSettings 
      : getDefaultTimeSlotSettings()
    
    // Prepare settings to save with proper Timestamp conversion for blackout dates
    const settingsToSave = {
      ...currentSettings,
      ...settings,
      blackoutDates: settings.blackoutDates?.map(bd => ({
        ...bd,
        date: Timestamp.fromDate(bd.date)
      })) || currentSettings.blackoutDates?.map(bd => ({
        ...bd,
        date: Timestamp.fromDate(bd.date)
      })) || [],
      updatedAt: new Date()
    }
    
    await setDoc(docRef, settingsToSave, { merge: true })
  } catch (error) {
    console.error("Error updating time slot settings:", error)
    throw new Error("Failed to update time slot settings")
  }
}

// Function to get blackout dates
export async function getBlackoutDates(): Promise<BlackoutDate[]> {
  try {
    const timeSlotSettings = await getTimeSlotSettings()
    return timeSlotSettings.blackoutDates || []
  } catch (error) {
    console.error("Error fetching blackout dates:", error)
    return []
  }
}

// Email Settings Functions
export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const docRef = doc(db, EMAIL_SETTINGS_COLLECTION, "main")
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      const data = docSnap.data()
      // Convert any Firestore Timestamps to plain objects for serialization
      const serializedData = {
        ...data,
        // Convert updatedAt timestamp to ISO string if it exists
        ...(data?.updatedAt && { updatedAt: data.updatedAt.toDate().toISOString() })
      }
      return serializedData as EmailSettings
    } else {
      // Return default settings instead of throwing
      return getDefaultEmailSettings()
    }
  } catch (error) {
    console.error("Error fetching email settings, returning defaults:", error)
    // Return default settings instead of throwing to prevent app crashes
    return getDefaultEmailSettings()
  }
}

export async function updateEmailSettings(settings: Partial<EmailSettings>): Promise<void> {
  try {
    const docRef = doc(db, EMAIL_SETTINGS_COLLECTION, "main")
    
    // Get current settings to merge with new ones
    const currentDoc = await getDoc(docRef)
    const currentSettings = currentDoc.exists() ? currentDoc.data() as EmailSettings : getDefaultEmailSettings()
    
    // Deep merge settings, especially for templates
    const mergedSettings = {
      ...currentSettings,
      ...settings,
      templates: {
        ...currentSettings.templates,
        ...settings.templates
      },
      updatedAt: new Date()
    }
    
    await setDoc(docRef, mergedSettings, { merge: true })
  } catch (error) {
    console.error("Error updating email settings:", error)
    throw new Error("Failed to update email settings")
  }
}

// User Management Functions
export async function createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, USERS_COLLECTION), {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating user:", error)
    throw new Error("Failed to create user")
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
        updatedAt: docSnap.data().updatedAt.toDate(),
        lastLoginAt: docSnap.data().lastLoginAt?.toDate() || null
      } as User
    }
    return null
  } catch (error) {
    console.error("Error fetching user:", error)
    throw new Error("Failed to fetch user")
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where("email", "==", email),
      limit(1)
    )
    const querySnapshot = await getDocs(q)
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
        lastLoginAt: doc.data().lastLoginAt?.toDate() || null
      } as User
    }
    return null
  } catch (error) {
    console.error("Error fetching user by email:", error)
    throw new Error("Failed to fetch user by email")
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy("createdAt", "desc")
    )
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
      lastLoginAt: doc.data().lastLoginAt?.toDate() || null
    })) as User[]
  } catch (error) {
    console.error("Error fetching all users:", error)
    throw new Error("Failed to fetch all users")
  }
}

export async function updateUser(userId: string, updateData: Partial<User>): Promise<void> {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...updateData,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error("Error updating user:", error)
    throw error
  }
}

export async function updateUserRole(userId: string, role: "admin" | "staff" | "user"): Promise<void> {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      role,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error("Error updating user role:", error)
    throw error
  }
}

export async function updateUserStatus(userId: string, status: "active" | "inactive"): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId)
    await updateDoc(docRef, {
      status,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error("Error updating user status:", error)
    throw new Error("Failed to update user status")
  }
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId)
    await updateDoc(docRef, {
      lastLoginAt: new Date(),
      updatedAt: new Date()
    })
  } catch (error) {
    console.error("Error updating user last login:", error)
    throw new Error("Failed to update user last login")
  }
}

// Statistics and Analytics Functions
export async function getReservationStats(timeRange: string = "week"): Promise<any> {
  try {
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case "day":
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        break
      default:
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
    }
    
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      orderBy("createdAt", "desc")
    )
    
    const querySnapshot = await getDocs(q)
    const reservations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Reservation[]
    
    // Calculate statistics
    const totalReservations = reservations.length
    const totalAttendees = reservations.reduce((sum, r) => sum + r.attendees, 0)
    const pendingRequests = reservations.filter(r => r.status === "pending").length
    const approvedCount = reservations.filter(r => r.status === "approved").length
    const rejectedCount = reservations.filter(r => r.status === "rejected").length
    const approvalRate = totalReservations > 0 ? (approvedCount / totalReservations) * 100 : 0
    
    // Type distribution
    const typeCount: Record<string, number> = {}
    reservations.forEach(r => {
      typeCount[r.type] = (typeCount[r.type] || 0) + 1
    })
    const typeDistribution = Object.entries(typeCount).map(([name, value]) => ({ name, value }))
    
    // Popular time slots
    const timeSlotCount: Record<string, number> = {}
    reservations.filter(r => r.status === "approved").forEach(r => {
      timeSlotCount[r.startTime] = (timeSlotCount[r.startTime] || 0) + 1
    })
    const popularTimeSlots = Object.entries(timeSlotCount)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    // Top users
    const userCount: Record<string, { name: string; count: number }> = {}
    reservations.filter(r => r.status === "approved").forEach(r => {
      if (!userCount[r.userId]) {
        userCount[r.userId] = { name: r.name, count: 0 }
      }
      userCount[r.userId].count++
    })
    const topUsers = Object.entries(userCount)
      .map(([userId, { name, count }]) => ({ userId, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    return {
      totalReservations,
      totalAttendees,
      pendingRequests,
      approvedCount,
      rejectedCount,
      approvalRate,
      typeDistribution,
      popularTimeSlots,
      topUsers
    }
  } catch (error) {
    console.error("Error fetching reservation stats:", error)
    throw new Error("Failed to fetch reservation stats")
  }
}

export async function getUserStats(userId: string): Promise<any> {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
    
    const querySnapshot = await getDocs(q)
    const reservations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Reservation[]
      const totalReservations = reservations.length
    const approvedReservations = reservations.filter(r => r.status === "approved").length
    const pendingReservations = reservations.filter(r => r.status === "pending").length
    const rejectedReservations = reservations.filter(r => r.status === "rejected").length
    const cancelledReservations = reservations.filter(r => r.status === "cancelled").length
    const totalHours = reservations
      .filter(r => r.status === "approved")
      .reduce((sum, r) => {
        const start = new Date(`2000-01-01T${r.startTime}:00`)
        const end = new Date(`2000-01-01T${r.endTime}:00`)
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }, 0)
      return {
      totalReservations,
      approvedReservations,
      pendingReservations,
      rejectedReservations,
      cancelledReservations,
      totalHours
    }
  } catch (error) {    console.error("Error fetching user stats, returning default values:", error)
    // Return default stats instead of throwing to prevent app crashes
    return {
      totalReservations: 0,
      approvedReservations: 0,
      pendingReservations: 0,
      rejectedReservations: 0,
      cancelledReservations: 0,
      totalHours: 0
    }
  }
}

// Available Time Slots Function with Enhanced Validation
export async function getAvailableTimeSlots(
  date: Date,
): Promise<{ time: string; available: boolean; status: string; occupancy?: number; capacity?: number; conflicts?: Reservation[] }[]> {
  try {
    const [systemSettings, timeSlotSettings] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings()    ])
    
    // Check if date is a blackout date - use consistent timezone formatting
    const isBlackoutDate = timeSlotSettings.blackoutDates.some(
      bd => {
        const blackoutDateInPhilippines = new Date(bd.date.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
        const checkDateInPhilippines = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
        return blackoutDateInPhilippines.toDateString() === checkDateInPhilippines.toDateString()
      }
    )
    
    if (isBlackoutDate) {
      return []
    }// Get day schedule
    const dayOfWeek = date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule || !daySchedule.enabled) {
      return []
    }
      // Generate time slots based on day schedule
    const allTimeSlots: { 
      time: string, 
      available: boolean, 
      status: string, 
      occupancy?: number, 
      capacity?: number,
      conflicts?: Reservation[]
    }[] = []
    const interval = timeSlotSettings.timeSlotInterval
    const maxCapacity = systemSettings.maxOverlappingReservations || 1
    
    // Handle single time slot per day
    if (daySchedule.timeSlot) {
      const slot = daySchedule.timeSlot
      const startMinutes = timeToMinutes(slot.start)
      const endMinutes = timeToMinutes(slot.end)
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        const timeString = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
        
        allTimeSlots.push({
          time: timeString,
          available: true,
          status: "available",
          occupancy: 0,
          capacity: maxCapacity,
          conflicts: []
        })
      }
    }
    
    // Get existing reservations for the date
    const existingReservations = await getReservationsForDate(date)
    
    // Calculate precise occupancy and conflicts for each time slot
    const timeSlotOccupancy: Record<string, { count: number; reservations: Reservation[] }> = {}
      existingReservations.forEach(reservation => {
      const startMinutes = timeToMinutes(reservation.startTime)
      const endMinutes = timeToMinutes(reservation.endTime)
      
      allTimeSlots.forEach(slot => {
        const slotMinutes = timeToMinutes(slot.time)
        
        // Check if this time slot overlaps with the reservation
        // Include slots that are within the reservation period OR are the exact end time boundary
        if ((slotMinutes >= startMinutes && slotMinutes < endMinutes) ||
            (slotMinutes === endMinutes)) {
          if (!timeSlotOccupancy[slot.time]) {
            timeSlotOccupancy[slot.time] = { count: 0, reservations: [] }
          }
          timeSlotOccupancy[slot.time].count += 1
          timeSlotOccupancy[slot.time].reservations.push(reservation)
        }
      })
    })
      // Update slot availability based on precise occupancy calculations
    allTimeSlots.forEach(slot => {
      const occupancyData = timeSlotOccupancy[slot.time]
      const occupancy = occupancyData?.count || 0
      const conflicts = occupancyData?.reservations || []
      
      slot.occupancy = occupancy
      slot.conflicts = conflicts
      
      // Determine availability status based on system settings with explicit logic
      if (occupancy === 0) {
        // No reservations - completely available
        slot.status = "available"
        slot.available = true
      } else if (!systemSettings.allowOverlapping && occupancy > 0) {
        // Overlapping not allowed and has reservations - unavailable
        slot.status = "unavailable"
        slot.available = false
      } else if (systemSettings.allowOverlapping && occupancy < maxCapacity) {
        // Overlapping allowed and under capacity - limited availability
        slot.status = "limited"
        slot.available = true
      } else if (systemSettings.allowOverlapping && occupancy >= maxCapacity) {
        // At or over maximum capacity - full/unavailable
        slot.status = "full"
        slot.available = false
      } else {
        // Fallback case - mark as unavailable
        slot.status = "unavailable"
        slot.available = false
      }
    })
    
    return allTimeSlots.sort((a, b) => a.time.localeCompare(b.time))
    
  } catch (error) {
    console.error("Error fetching available time slots:", error)
    throw new Error("Failed to fetch available time slots")
  }
}

// Enhanced function to get detailed availability for a date range
export async function getDetailedAvailability(
  startDate: Date,
  endDate: Date
): Promise<{
  [dateKey: string]: {
    date: Date;
    isAvailable: boolean;
    totalSlots: number;
    availableSlots: number;
    limitedSlots: number;
    unavailableSlots: number;
    occupancyRate: number;
    timeSlots: Array<{
      time: string;
      available: boolean;
      status: string;
      occupancy: number;
      capacity: number;
    }>;
  }
}> {
  try {
    const systemSettings = await getSystemSettings()
    const maxCapacity = systemSettings.maxOverlappingReservations || 2
    const result: any = {}
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0]
      const timeSlots = await getAvailableTimeSlots(current)
      
      const totalSlots = timeSlots.length
      const availableSlots = timeSlots.filter(slot => slot.status === 'available').length
      const limitedSlots = timeSlots.filter(slot => slot.status === 'limited').length
      const unavailableSlots = timeSlots.filter(slot => ['unavailable', 'full'].includes(slot.status)).length
      
      const occupancyRate = totalSlots > 0 
        ? ((limitedSlots + unavailableSlots) / totalSlots) * 100 
        : 0
      
      result[dateKey] = {
        date: new Date(current),
        isAvailable: availableSlots > 0 || limitedSlots > 0,
        totalSlots,
        availableSlots,
        limitedSlots,
        unavailableSlots,
        occupancyRate,
        timeSlots: timeSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          status: slot.status,
          occupancy: slot.occupancy || 0,
          capacity: slot.capacity || maxCapacity
        }))
      }
      
      current.setDate(current.getDate() + 1)
    }
    
    return result
  } catch (error) {
    console.error("Error getting detailed availability:", error)
    return {}
  }
}

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Default settings functions
export function getDefaultSystemSettings(): SystemSettings {
  return {
    systemName: "Reservation System",
    contactEmail: "admin@example.com",
    requireApproval: true,
    allowOverlapping: true,
    maxOverlappingReservations: 2,
    reservationTypes: ["event", "training", "gym", "other"],
    use12HourFormat: true,
    minAdvanceBookingDays: 0,
    restrictEmailDomain: true,
    allowedEmailDomain: "@leadersics.edu.ph"
  }
}

function getDefaultTimeSlotSettings(): TimeSlotSettings {
  return {
    businessHours: {
      monday: {
        enabled: true,
        timeSlot: { id: "1", start: "08:00", end: "17:00" },
      },
      tuesday: {
        enabled: true,
        timeSlot: { id: "2", start: "08:00", end: "17:00" },
      },
      wednesday: {
        enabled: true,
        timeSlot: { id: "3", start: "08:00", end: "17:00" },
      },
      thursday: {
        enabled: true,
        timeSlot: { id: "4", start: "08:00", end: "17:00" },
      },
      friday: {
        enabled: true,
        timeSlot: { id: "5", start: "08:00", end: "17:00" },
      },
      saturday: {
        enabled: false,
        timeSlot: null,
      },
      sunday: {
        enabled: false,
        timeSlot: null,
      },
    },
    blackoutDates: [],
    minDuration: 30,
    maxDurationOptions: [30, 60, 90, 120, 180, 240],
    defaultMaxDuration: 120,
    timeSlotInterval: 30,
  }
}

function getDefaultEmailSettings(): EmailSettings {
  return {
    sendUserEmails: false,
    sendAdminEmails: false,
    templates: {
      approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
      rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
      notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
      submission: "Dear {name},\n\nThank you for submitting your reservation request. Your request has been received and is now pending approval.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}\n\nYou will receive an email notification once your request is approved or if any changes are needed.\n\nThank you for using our reservation system!",
      cancellation: "Dear {name},\n\nYour reservation has been cancelled.\n\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\n\nIf you have any questions about this cancellation, please contact us.\n\nThank you for using our reservation system.",
    },
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION))
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastLoginAt: doc.data().lastLoginAt?.toDate() || null,
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as User[]
  } catch (error) {
    console.error("Error fetching users:", error)
    throw new Error("Failed to fetch users")
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    // Use batch operations for atomic deletion
    const batch = writeBatch(db)
    
    // 1. Get user details first for logging and cleanup
    const userRef = doc(db, USERS_COLLECTION, userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      throw new Error("User not found")
    }
    
    const userData = userSnap.data() as User
    console.log(`Starting deletion for user: ${userData.email} (ID: ${userId})`)
    
    // 2. Delete all user's reservations
    const reservationsQuery = query(
      collection(db, RESERVATIONS_COLLECTION),
      where("userId", "==", userId)
    )
    const reservationsSnapshot = await getDocs(reservationsQuery)
    
    console.log(`Found ${reservationsSnapshot.size} reservations to delete for user ${userData.email}`)
    
    reservationsSnapshot.docs.forEach((reservationDoc) => {
      batch.delete(reservationDoc.ref)
    })
    
    // 3. Delete the user document
    batch.delete(userRef)
    
    // Commit the batch operation
    await batch.commit()
    
    console.log(`Successfully deleted user ${userData.email} and all associated data`)
    
  } catch (error) {
    console.error("Error deleting user and associated data:", error)
    throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Note: Admin-level cleanup is now handled in server actions to avoid client-side imports

export async function getStatistics(): Promise<any> {
  try {
    const [reservations, users] = await Promise.all([
      getDocs(collection(db, RESERVATIONS_COLLECTION)),
      getDocs(collection(db, USERS_COLLECTION))
    ])

    const reservationDocs = reservations.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string; status: string; [key: string]: any }>

    const userDocs = users.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string; status: string; [key: string]: any }>

    const totalReservations = reservationDocs.length
    const pendingReservations = reservationDocs.filter(r => r.status === "pending").length
    const approvedReservations = reservationDocs.filter(r => r.status === "approved").length
    const cancelledReservations = reservationDocs.filter(r => r.status === "cancelled").length
    const totalUsers = userDocs.length
    const activeUsers = userDocs.filter(u => u.status === "active").length

    return {
      totalReservations,
      pendingReservations,
      approvedReservations,
      cancelledReservations,
      totalUsers,
      activeUsers,
      monthlyReservations: [],
      popularTimeSlots: [],
      roomUtilization: totalReservations > 0 ? Math.round((approvedReservations / totalReservations) * 100) : 0
    }
  } catch (error) {
    console.error("Error fetching statistics:", error)
    throw new Error("Failed to fetch statistics")
  }
}

/**
 * Get suggested alternative dates when requested date is not available
 * 
 * Enhanced version with business rules and operational hours support
 */
export async function getAlternativeDates(
  requestedDate: Date,
  startTime: string,
  endTime: string,
  maxSuggestions: number = 5
): Promise<Date[]> {
  try {
    const alternatives: Date[] = []
    const maxDaysToCheck = 14 // Check next 2 weeks
    
    // Fetch time slot settings to check operational days
    const timeSlotSettings = await getTimeSlotSettingsDocument()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    
    // Start checking from the day after the requested date
    const checkDate = new Date(requestedDate)
    checkDate.setDate(checkDate.getDate() + 1)
    
    // Get any blackout dates
    const blackoutDates = await getBlackoutDates()
    const blackoutDatesSet = new Set(
      blackoutDates.map(bd => new Date(bd.date).toISOString().split('T')[0])
    )
    
    // Loop through days to check
    for (let i = 0; i < maxDaysToCheck && alternatives.length < maxSuggestions; i++) {
      const currentDate = new Date(checkDate)
      currentDate.setDate(currentDate.getDate() + i)
      
      // Skip blackout dates
      const currentDateString = currentDate.toISOString().split('T')[0]
      if (blackoutDatesSet.has(currentDateString)) {
        continue
      }
      
      // Skip non-operational days based on settings
      const dayOfWeek = currentDate.getDay()
      const dayName = dayNames[dayOfWeek]
      
      // If we have time slot settings, check if this day is operational
      if (timeSlotSettings?.businessHours) {
        const daySchedule = timeSlotSettings.businessHours[dayName]
        if (!daySchedule || !daySchedule.enabled || !daySchedule.timeSlot) {
          continue // Skip days that are not operational
        }
      } else {
        // Fallback: Skip weekends if time slot settings not available
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue
        }
      }
      
      try {
        // Check if this date has availability for the requested time slot
        const timeSlots = await getAvailableTimeSlots(currentDate)
        
        // Check for exact match with requested start time
        const requestedSlot = timeSlots.find(slot => slot.time === startTime)
        
        if (requestedSlot && requestedSlot.available) {
          // Also check if we can fit the entire reservation (start to end time)
          let canFitEntireReservation = true
          
          // If end time is specified, verify all slots between start and end are available
          if (endTime && endTime !== startTime) {
            // Find indices of start and end slots
            const startIndex = timeSlots.findIndex(slot => slot.time === startTime)
            const endIndex = timeSlots.findIndex(slot => slot.time === endTime || slot.time > endTime)
            
            // Check all slots in between
            if (startIndex !== -1 && endIndex !== -1) {
              for (let slotIndex = startIndex + 1; slotIndex < endIndex; slotIndex++) {
                if (!timeSlots[slotIndex].available) {
                  canFitEntireReservation = false
                  break
                }
              }
            }
          }
          
          if (canFitEntireReservation) {
            alternatives.push(currentDate)
          }
        }
      } catch (error) {
        console.warn(`Error checking availability for ${currentDate.toDateString()}:`, error)
        continue
      }
    }
    
    return alternatives
  } catch (error) {
    console.error("Error getting alternative dates:", error)
    return []
  }
}

// Enhanced real-time availability tracking with atomic operations
export async function getEnhancedTimeSlotAvailability(
  date: Date
): Promise<{
  timeSlots: Array<{
    time: string
    available: boolean
    status: "available" | "limited" | "full" | "unavailable"
    occupancy: number
    capacity: number
    conflicts: Reservation[]
    reservationAllowed: boolean
    warningMessage?: string
  }>
  totalSlots: number
  availableSlots: number
  fullyBookedSlots: number
  partiallyBookedSlots: number
  systemSettings: SystemSettings
}> {
  try {
    const [systemSettings, timeSlotSettings, existingReservations] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings(),
      getReservationsForDate(date)
    ])
    
    // Check if date is enabled for reservations
    const dayOfWeek = date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule?.enabled) {
      return {
        timeSlots: [],
        totalSlots: 0,
        availableSlots: 0,
        fullyBookedSlots: 0,
        partiallyBookedSlots: 0,
        systemSettings
      }
    }
      // Check if date is a blackout date - use consistent timezone formatting
    const isBlackoutDate = timeSlotSettings.blackoutDates.some(
      bd => {
        const blackoutDateInPhilippines = new Date(bd.date.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
        const checkDateInPhilippines = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
        return blackoutDateInPhilippines.toDateString() === checkDateInPhilippines.toDateString()
      }
    )
    
    if (isBlackoutDate) {
      return {
        timeSlots: [],
        totalSlots: 0,
        availableSlots: 0,
        fullyBookedSlots: 0,
        partiallyBookedSlots: 0,
        systemSettings
      }
    }
    
    const allTimeSlots: Array<{
      time: string
      available: boolean
      status: "available" | "limited" | "full" | "unavailable"
      occupancy: number
      capacity: number
      conflicts: Reservation[]
      reservationAllowed: boolean
      warningMessage?: string
    }> = []
    
    const interval = timeSlotSettings.timeSlotInterval || 30
    const maxCapacity = systemSettings.maxOverlappingReservations || 1
      // Generate all time slots
    if (daySchedule.timeSlot) {
      const slot = daySchedule.timeSlot
      const startMinutes = timeToMinutes(slot.start)
      const endMinutes = timeToMinutes(slot.end)
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const timeString = minutesToTimeString(minutes)        // Find overlapping reservations for this exact time slot
        const conflictingReservations = existingReservations.filter(reservation => {
          if (reservation.status === "cancelled" || reservation.status === "rejected") {
            return false
          }
          
          const reservationStartMinutes = timeToMinutes(reservation.startTime)
          const reservationEndMinutes = timeToMinutes(reservation.endTime)
          
          // Check if this time slot overlaps with the reservation
          // Include slots that are within the reservation period OR are the exact end time boundary
          return (minutes >= reservationStartMinutes && minutes < reservationEndMinutes) ||
                 (minutes === reservationEndMinutes)
        })
        
        const occupancy = conflictingReservations.length
        let status: "available" | "limited" | "full" | "unavailable" = "available"
        let available = true
        let reservationAllowed = true
        let warningMessage: string | undefined
        
        // Determine status based on business rules
        if (occupancy === 0) {
          status = "available"
          available = true
          reservationAllowed = true
        } else if (!systemSettings.allowOverlapping) {
          status = "unavailable"
          available = false
          reservationAllowed = false
          warningMessage = "Overlapping reservations not permitted"
        } else if (occupancy >= maxCapacity) {
          status = "full"
          available = false
          reservationAllowed = false
          warningMessage = `Maximum capacity reached (${occupancy}/${maxCapacity})`
        } else {
          status = "limited"
          available = true
          reservationAllowed = true
          warningMessage = `${occupancy} of ${maxCapacity} spots taken`
        }
          allTimeSlots.push({
          time: timeString,
          available,
          status,
          occupancy,
          capacity: maxCapacity,
          conflicts: conflictingReservations,
          reservationAllowed,
          warningMessage
        })
      }
    }
    
    // Calculate summary statistics
    const totalSlots = allTimeSlots.length
    const availableSlots = allTimeSlots.filter(slot => slot.status === "available").length
    const fullyBookedSlots = allTimeSlots.filter(slot => slot.status === "full" || slot.status === "unavailable").length
    const partiallyBookedSlots = allTimeSlots.filter(slot => slot.status === "limited").length
    
    return {
      timeSlots: allTimeSlots.sort((a, b) => a.time.localeCompare(b.time)),
      totalSlots,
      availableSlots,
      fullyBookedSlots,
      partiallyBookedSlots,
      systemSettings
    }
    
  } catch (error) {
    console.error("Error fetching enhanced time slot availability:", error)
    throw new Error("Failed to fetch time slot availability")
  }
}

// Comprehensive slot validation for reservation creation
export async function validateTimeSlotForReservation(
  date: Date,
  startTime: string,
  endTime: string,
  excludeReservationId?: string
): Promise<{
  isValid: boolean
  canProceed: boolean
  errors: string[]
  warnings: string[]
  conflictDetails: {
    overlappingReservations: Reservation[]
    totalConflicts: number
    worstOccupancy: number
    maxCapacity: number
    allowOverlapping: boolean
  }
  recommendedAlternatives: string[]
}> {
  try {
    const [systemSettings, timeSlotSettings] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings()
    ])
    
    const errors: string[] = []
    const warnings: string[] = []
    const recommendedAlternatives: string[] = []
    
    // Basic time validation
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    
    if (endMinutes <= startMinutes) {
      errors.push("End time must be after start time")
    }
    
    // Check operational hours
    const dayOfWeek = date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule?.enabled) {
      errors.push("Selected day is not available for reservations")
    }
    
    // Get all affected time slots for the requested duration
    const affectedSlots: string[] = []
    const interval = timeSlotSettings.timeSlotInterval || 30
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
      affectedSlots.push(minutesToTimeString(minutes))
    }
    
    // Get existing reservations
    const existingReservations = await getReservationsForDate(date)
    const activeReservations = existingReservations.filter(r => 
      r.status !== "cancelled" && 
      r.status !== "rejected" && 
      r.id !== excludeReservationId
    )
    
    // Check conflicts for each affected time slot
    let worstOccupancy = 0
    let totalConflicts = 0
    const allOverlappingReservations: Reservation[] = []
      affectedSlots.forEach(slotTime => {
      const slotMinutes = timeToMinutes(slotTime)
      
      const slotConflicts = activeReservations.filter(reservation => {
        const reservationStartMinutes = timeToMinutes(reservation.startTime)
        const reservationEndMinutes = timeToMinutes(reservation.endTime)
        
        // Include slots that are within the reservation period OR are the exact end time boundary
        return (slotMinutes >= reservationStartMinutes && slotMinutes < reservationEndMinutes) ||
               (slotMinutes === reservationEndMinutes)
      })
      
      if (slotConflicts.length > worstOccupancy) {
        worstOccupancy = slotConflicts.length
      }
      
      totalConflicts += slotConflicts.length
      
      // Add to overall overlapping reservations (avoid duplicates)
      slotConflicts.forEach(conflict => {
        if (!allOverlappingReservations.find(r => r.id === conflict.id)) {
          allOverlappingReservations.push(conflict)
        }
      })
    })
    
    const maxCapacity = systemSettings.maxOverlappingReservations || 1
    
    // Apply business logic
    if (!systemSettings.allowOverlapping && worstOccupancy > 0) {
      errors.push("Time slot conflicts with existing reservations. Overlapping is not allowed.")
    } else if (systemSettings.allowOverlapping && worstOccupancy >= maxCapacity) {
      errors.push(`Time slot is fully booked (maximum ${maxCapacity} concurrent reservations allowed)`)
    } else if (worstOccupancy > 0) {
      warnings.push(`This reservation will overlap with ${allOverlappingReservations.length} existing reservation(s)`)
    }
    
    // Generate alternatives if there are conflicts
    if (errors.length > 0) {
      // Find nearby available slots
      const availability = await getEnhancedTimeSlotAvailability(date)
      const availableSlots = availability.timeSlots.filter(slot => slot.reservationAllowed)
      
      // Suggest 3 closest available time slots
      const requestedMinutes = timeToMinutes(startTime)
      const sortedByDistance = availableSlots
        .map(slot => ({
          time: slot.time,
          distance: Math.abs(timeToMinutes(slot.time) - requestedMinutes)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map(slot => slot.time)
      
      recommendedAlternatives.push(...sortedByDistance)
    }
    
    return {
      isValid: errors.length === 0,
      canProceed: errors.length === 0,
      errors,
      warnings,
      conflictDetails: {
        overlappingReservations: allOverlappingReservations,
        totalConflicts,
        worstOccupancy,
        maxCapacity,
        allowOverlapping: systemSettings.allowOverlapping
      },
      recommendedAlternatives
    }
    
  } catch (error) {
    console.error("Error validating time slot for reservation:", error)
    return {
      isValid: false,
      canProceed: false,
      errors: ["Unable to validate time slot availability"],
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

// Helper function to convert minutes to time string
function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}
