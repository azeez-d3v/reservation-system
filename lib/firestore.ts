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
  limit
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
    console.log("Creating reservation with data:", JSON.stringify({
      ...data,
      date: data.date.toString()  // Convert date to string for logging
    }, null, 2))
    
    // Create a more server-compatible version of the reservation data
    const reservationData = {
      ...data,
      // Use email as userId for consistency with Firestore rules
      userId: data.email || data.userId,
      status: "pending",
      createdAt: new Date(),
      date: Timestamp.fromDate(data.date),
    }
    
    console.log("Prepared reservation data for Firestore:", 
      JSON.stringify({...reservationData, createdAt: reservationData.createdAt.toString()}, null, 2)
    )
    
    // Use client SDK with updated Firestore rules that allow operations
    const docRef = await addDoc(collection(db, RESERVATIONS_COLLECTION), reservationData)
    console.log("Reservation created successfully with client SDK ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating reservation:", error)
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    
    throw new Error(`Failed to create reservation: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

export async function getReservationsForDate(date: Date): Promise<Reservation[]> {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
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
          date: bd.date.toDate()
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
    const docRef = doc(db, USERS_COLLECTION, userId)
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error("Error updating user:", error)
    throw new Error("Failed to update user")
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

// Available Time Slots Function
export async function getAvailableTimeSlots(
  date: Date,
): Promise<{ time: string; available: boolean; status: string; occupancy?: number }[]> {
  try {
    const [systemSettings, timeSlotSettings] = await Promise.all([
      getSystemSettings(),
      getTimeSlotSettings()
    ])
    
    // Check if date is a blackout date
    const isBlackoutDate = timeSlotSettings.blackoutDates.some(
      bd => bd.date.toDateString() === date.toDateString()
    )
    
    if (isBlackoutDate) {
      return []
    }
    
    // Get day schedule
    const dayOfWeek = date.getDay()
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]
    
    if (!daySchedule || !daySchedule.enabled) {
      return []
    }
    
    // Generate time slots based on day schedule
    const allTimeSlots: { time: string; available: boolean; status: string; occupancy?: number }[] = []
    const interval = timeSlotSettings.timeSlotInterval
    
    daySchedule.timeSlots.forEach(slot => {
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
          occupancy: 0
        })
      }
    })
    
    // Get existing reservations for the date
    const existingReservations = await getReservationsForDate(date)
    
    // Calculate occupancy for each time slot
    const timeSlotOccupancy: Record<string, number> = {}
    
    existingReservations.forEach(reservation => {
      const startMinutes = timeToMinutes(reservation.startTime)
      const endMinutes = timeToMinutes(reservation.endTime)
      
      allTimeSlots.forEach(slot => {
        const slotMinutes = timeToMinutes(slot.time)
        
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          timeSlotOccupancy[slot.time] = (timeSlotOccupancy[slot.time] || 0) + 1
        }
      })
    })
    
    // Update slot availability based on occupancy
    allTimeSlots.forEach(slot => {
      const occupancy = timeSlotOccupancy[slot.time] || 0
      slot.occupancy = occupancy
      
      if (occupancy === 0) {
        slot.status = "available"
        slot.available = true
      } else if (occupancy < systemSettings.maxOverlappingReservations) {
        slot.status = "limited"
        slot.available = systemSettings.allowOverlapping
      } else {
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

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Default settings functions
export function getDefaultSystemSettings(): SystemSettings {
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
    use12HourFormat: true
  }
}

function getDefaultTimeSlotSettings(): TimeSlotSettings {
  return {
    businessHours: {
      monday: {
        enabled: true,
        timeSlots: [
          { id: "1", start: "08:00", end: "12:00" },
          { id: "2", start: "13:00", end: "17:00" },
        ],
      },
      tuesday: {
        enabled: true,
        timeSlots: [
          { id: "3", start: "08:00", end: "12:00" },
          { id: "4", start: "13:00", end: "17:00" },
        ],
      },
      wednesday: {
        enabled: true,
        timeSlots: [
          { id: "5", start: "08:00", end: "12:00" },
          { id: "6", start: "13:00", end: "17:00" },
        ],
      },
      thursday: {
        enabled: true,
        timeSlots: [
          { id: "7", start: "08:00", end: "12:00" },
          { id: "8", start: "13:00", end: "17:00" },
        ],
      },
      friday: {
        enabled: true,
        timeSlots: [
          { id: "9", start: "08:00", end: "12:00" },
          { id: "10", start: "13:00", end: "17:00" },
        ],
      },
      saturday: {
        enabled: false,
        timeSlots: [],
      },
      sunday: {
        enabled: false,
        timeSlots: [],
      },
    },
    blackoutDates: [],
    minDuration: 30,
    maxDuration: 240,
    timeSlotInterval: 30,
    bufferTime: 15,
  }
}

function getDefaultEmailSettings(): EmailSettings {
  return {
    sendUserEmails: true,
    sendAdminEmails: true,
    notificationRecipients: [],
    templates: {
      approval: "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
      rejection: "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
      notification: "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
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
    await deleteDoc(doc(db, USERS_COLLECTION, userId))
  } catch (error) {
    console.error("Error deleting user:", error)
    throw new Error("Failed to delete user")
  }
}

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
