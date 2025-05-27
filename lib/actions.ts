"use server"

import { v4 as uuidv4 } from "uuid"
import type { Reservation, ReservationRequest, SystemSettings, EmailSettings } from "./types"
import { format, addDays, isWeekend, addWeeks, isBefore } from "date-fns"

// In a real application, this would be stored in a database
const reservations: Reservation[] = [
  {
    id: "1",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-15"),
    startTime: "10:00",
    endTime: "12:00",
    purpose: "Team Meeting",
    attendees: 5,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-10"),
  },
  {
    id: "2",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-16"),
    startTime: "14:00",
    endTime: "16:00",
    purpose: "Client Presentation",
    attendees: 8,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-11"),
  },
  {
    id: "3",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-17"),
    startTime: "09:00",
    endTime: "11:00",
    purpose: "Project Planning",
    attendees: 4,
    type: "meeting",
    notes: "Need projector",
    status: "pending",
    createdAt: new Date("2025-05-12"),
  },
  {
    id: "4",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-17"),
    startTime: "13:00",
    endTime: "15:00",
    purpose: "Training Session",
    attendees: 12,
    type: "training",
    status: "pending",
    createdAt: new Date("2025-05-13"),
  },
  {
    id: "5",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-18"),
    startTime: "11:00",
    endTime: "13:00",
    purpose: "Department Meeting",
    attendees: 7,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-14"),
  },
  {
    id: "6",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-19"),
    startTime: "15:00",
    endTime: "17:00",
    purpose: "Product Demo",
    attendees: 10,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-14"),
  },
  {
    id: "7",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-20"),
    startTime: "09:00",
    endTime: "10:00",
    purpose: "Quick Sync",
    attendees: 3,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-15"),
  },
  // Add some reservations with limited availability
  {
    id: "8",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-28"),
    startTime: "10:00",
    endTime: "11:00",
    purpose: "Team Meeting",
    attendees: 5,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-10"),
  },
  {
    id: "9",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-28"),
    startTime: "10:30",
    endTime: "11:30",
    purpose: "Project Planning",
    attendees: 4,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-12"),
  },
  {
    id: "10",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-29"),
    startTime: "14:00",
    endTime: "15:00",
    purpose: "Client Meeting",
    attendees: 3,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-10"),
  },
  {
    id: "11",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-29"),
    startTime: "14:30",
    endTime: "15:30",
    purpose: "Interview",
    attendees: 2,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-12"),
  },
  // Add more reservations for May 29
  {
    id: "12",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-29"),
    startTime: "11:00",
    endTime: "12:00",
    purpose: "Team Standup",
    attendees: 6,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-15"),
  },
  {
    id: "13",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-29"),
    startTime: "15:30",
    endTime: "16:30",
    purpose: "Client Call",
    attendees: 2,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-16"),
  },
  // Add more reservations for May 30 (almost full)
  {
    id: "14",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-30"),
    startTime: "09:00",
    endTime: "10:00",
    purpose: "Morning Briefing",
    attendees: 8,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-20"),
  },
  {
    id: "15",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-30"),
    startTime: "10:00",
    endTime: "11:00",
    purpose: "Project Review",
    attendees: 5,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-21"),
  },
  {
    id: "16",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-30"),
    startTime: "11:00",
    endTime: "12:00",
    purpose: "Team Meeting",
    attendees: 7,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-22"),
  },
  {
    id: "17",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-30"),
    startTime: "13:00",
    endTime: "14:00",
    purpose: "Client Meeting",
    attendees: 3,
    type: "meeting",
    status: "approved",
    createdAt: new Date("2025-05-23"),
  },
  {
    id: "18",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-05-30"),
    startTime: "14:00",
    endTime: "15:00",
    purpose: "Product Demo",
    attendees: 10,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-24"),
  },
  // Add a completely booked day
  {
    id: "19",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-05-31"),
    startTime: "09:00",
    endTime: "17:00",
    purpose: "All-day Conference",
    attendees: 50,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-15"),
  },
  // Adding gym reservations
  {
    id: "20",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-06-02"),
    startTime: "08:00",
    endTime: "12:00",
    purpose: "Basketball Tournament",
    attendees: 15,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-20"),
  },
  {
    id: "21",
    userId: "3",
    name: "John Doe",
    email: "john@example.com",
    date: new Date("2025-06-03"),
    startTime: "14:00",
    endTime: "18:00",
    purpose: "Volleyball Practice",
    attendees: 12,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-21"),
  },
  {
    id: "22",
    userId: "2",
    name: "Regular User",
    email: "user@example.com",
    date: new Date("2025-06-04"),
    startTime: "09:00",
    endTime: "13:00",
    purpose: "Fitness Class",
    attendees: 20,
    type: "event",
    status: "approved",
    createdAt: new Date("2025-05-22"),
  },
]

// Mock system settings
const systemSettings: SystemSettings = {
  systemName: "Reservation System",
  organizationName: "Acme Corporation",
  contactEmail: "contact@example.com",
  timeZone: "America/New_York",
  requireApproval: true,
  allowOverlapping: true,
  maxOverlappingReservations: 2,
  publicCalendar: true,
  reservationTypes: ["meeting", "event", "training", "gym", "other"],
  use12HourFormat: true,
  timeSlotSettings: {
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
    blackoutDates: [
      {
        id: "1",
        date: new Date("2025-05-27"),
        reason: "Memorial Day",
      },
      {
        id: "2",
        date: new Date("2025-07-04"),
        reason: "Independence Day",
      },
    ],
    minDuration: 30,
    maxDuration: 240,
    timeSlotInterval: 30,
    bufferTime: 15,
  },
}

// Mock email settings
const emailSettings: EmailSettings = {
  sendUserEmails: true,
  sendAdminEmails: true,
  notificationRecipients: [
    {
      id: "1",
      name: "Admin User",
      email: "admin@example.com",
    },
    {
      id: "2",
      name: "Manager",
      email: "manager@example.com",
    },
  ],
  templates: {
    approval:
      "Dear {name},\n\nYour reservation request for {date} from {startTime} to {endTime} has been approved.\n\nPurpose: {purpose}\n\nThank you!",
    rejection:
      "Dear {name},\n\nWe regret to inform you that your reservation request for {date} from {startTime} to {endTime} has been rejected.\n\nPurpose: {purpose}\n\nPlease contact us if you have any questions.",
    notification:
      "New reservation request:\n\nName: {name}\nEmail: {email}\nDate: {date}\nTime: {startTime} - {endTime}\nPurpose: {purpose}\nAttendees: {attendees}",
  },
}

export async function createReservationRequest(request: ReservationRequest): Promise<string> {
  // Validate that the date is at least 1 week in the future
  const minBookableDate = addWeeks(new Date(), 1)
  if (request.date < minBookableDate) {
    throw new Error("Reservations must be made at least 1 week in advance")
  }

  const newReservation: Reservation = {
    id: uuidv4(),
    ...request,
    status: "pending",
    createdAt: new Date(),
  }

  reservations.push(newReservation)

  return newReservation.id
}

export async function getReservationRequests(): Promise<Reservation[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  return reservations
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function getApprovedReservations(): Promise<Reservation[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  return reservations
    .filter((r) => r.status === "approved")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export async function approveReservation(id: string): Promise<void> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const reservation = reservations.find((r) => r.id === id)
  if (!reservation) {
    throw new Error("Reservation not found")
  }

  reservation.status = "approved"
}

export async function rejectReservation(id: string): Promise<void> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const reservation = reservations.find((r) => r.id === id)
  if (!reservation) {
    throw new Error("Reservation not found")
  }

  reservation.status = "rejected"
}

export async function cancelReservation(id: string): Promise<void> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const index = reservations.findIndex((r) => r.id === id)
  if (index === -1) {
    throw new Error("Reservation not found")
  }

  // In a real application, you might want to keep a record of cancelled reservations
  // Here we're just removing it from the array
  reservations.splice(index, 1)
}

// Mock data for available time slots
export async function getAvailableTimeSlots(
  date: Date,
): Promise<{ time: string; available: boolean; status: string; occupancy?: number }[]> {
  // Reduce API delay
  await new Promise((resolve) => setTimeout(resolve, 150))

  // Get day of week
  const dayOfWeek = date.getDay()

  // Check if it's a weekend (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return []
  }

  // Generate time slots from 8 AM to 5 PM
  const allTimeSlots: { time: string; available: boolean; status: string; occupancy?: number }[] = []

  // Business hours: 8 AM to 5 PM
  const startHour = 8
  const endHour = 17
  const interval = 30 // 30-minute intervals

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      allTimeSlots.push({
        time: timeString,
        available: true,
        status: "available",
      })
    }
  }

  // Check existing reservations for the date
  const dateReservations = reservations.filter(
    (r) => r.status === "approved" && new Date(r.date).toDateString() === date.toDateString(),
  )

  // Mark time slots as unavailable if they overlap with existing reservations
  // For our new system, we'll set a maximum of 2 overlapping reservations
  const timeSlotOccupancy: Record<string, number> = {}

  dateReservations.forEach((reservation) => {
    const [startHour, startMinute] = reservation.startTime.split(":").map(Number)
    const [endHour, endMinute] = reservation.endTime.split(":").map(Number)

    const reservationStartTime = startHour * 60 + startMinute
    const reservationEndTime = endHour * 60 + endMinute

    allTimeSlots.forEach((slot) => {
      const [slotHour, slotMinute] = slot.time.split(":").map(Number)
      const slotTime = slotHour * 60 + slotMinute

      // Check if this slot is within the reservation time
      if (slotTime >= reservationStartTime && slotTime < reservationEndTime) {
        // Increment the occupancy counter for this time slot
        timeSlotOccupancy[slot.time] = (timeSlotOccupancy[slot.time] || 0) + 1

        // If we've reached the maximum occupancy, mark as unavailable
        if (timeSlotOccupancy[slot.time] >= systemSettings.maxOverlappingReservations) {
          slot.available = false
          slot.status = "unavailable"
        } else {
          // Otherwise, it's limited
          slot.status = "limited"
        }

        // Add occupancy information
        slot.occupancy = timeSlotOccupancy[slot.time]
      }
    })
  })

  return allTimeSlots
}

export async function getPublicAvailability(
  startDate: Date,
  endDate: Date,
  includeAvailabilityMap = false,
): Promise<any> {
  // Reduce API delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Calculate the minimum bookable date (1 week from now)
  const minBookableDate = addWeeks(new Date(), 1)

  // For a single date, return time slots
  if (startDate.toDateString() === endDate.toDateString()) {
    const timeSlots = await getAvailableTimeSlots(startDate)
    return { timeSlots }
  }

  // For a date range, return available dates
  const availableDates: string[] = []
  const availabilityMap: Record<string, string> = {}

  let currentDate = new Date(startDate)
  let earliestAvailable: Date | null = null

  // Find the earliest available date from the minimum bookable date
  let checkDate = new Date(minBookableDate)

  // Check the next 60 days for availability
  for (let i = 0; i < 60; i++) {
    if (isWeekend(checkDate)) {
      checkDate = addDays(checkDate, 1)
      continue
    }

    const slots = await getAvailableTimeSlots(checkDate)
    const hasAvailableSlots = slots && slots.length > 0 && slots.some((slot) => slot.available)

    if (hasAvailableSlots && !earliestAvailable) {
      earliestAvailable = new Date(checkDate)
    }

    checkDate = addDays(checkDate, 1)
  }

  // Generate available dates within the requested range
  while (isBefore(currentDate, endDate) || currentDate.toDateString() === endDate.toDateString()) {
    if (!isWeekend(currentDate) && !isBefore(currentDate, minBookableDate)) {
      const slots = await getAvailableTimeSlots(currentDate)
      const hasAvailableSlots = slots && slots.length > 0 && slots.some((slot) => slot.available)
      const dateString = format(currentDate, "yyyy-MM-dd")

      if (hasAvailableSlots) {
        availableDates.push(dateString)

        // Calculate availability level
        const totalSlots = slots.length
        const availableSlots = slots.filter((slot) => slot.available).length
        const availabilityPercentage = (availableSlots / totalSlots) * 100

        if (availabilityPercentage > 70) {
          availabilityMap[dateString] = "available"
        } else if (availabilityPercentage > 30) {
          availabilityMap[dateString] = "limited"
        } else {
          availabilityMap[dateString] = "unavailable"
        }
      } else {
        availabilityMap[dateString] = "unavailable"
      }
    }

    currentDate = addDays(currentDate, 1)
  }

  const result: any = {
    availableDates,
    earliestAvailable,
  }

  if (includeAvailabilityMap) {
    result.availabilityMap = availabilityMap
  }

  return result
}

export async function getSystemSettings() {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { ...systemSettings }
}

export async function updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  Object.assign(systemSettings, settings)
  return { ...systemSettings }
}

export async function getTimeSlotSettings() {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200))
  return { ...systemSettings.timeSlotSettings }
}

export async function updateTimeSlotSettings(settings: any) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  systemSettings.timeSlotSettings = settings
  return { ...systemSettings.timeSlotSettings }
}

export async function getUserReservations(userId: string): Promise<any> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const userReservations = reservations.filter((r) => r.userId === userId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const active = userReservations
    .filter((r) => r.status === "approved" && new Date(r.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const pending = userReservations
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const past = userReservations
    .filter((r) => r.status === "approved" && new Date(r.date) < today)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { active, pending, past }
}

export async function getUserStats(userId: string): Promise<any> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  const userReservations = reservations.filter((r) => r.userId === userId)

  const totalReservations = userReservations.length
  const totalAttendees = userReservations.reduce((sum, r) => sum + r.attendees, 0)
  const pendingRequests = userReservations.filter((r) => r.status === "pending").length
  const approvedCount = userReservations.filter((r) => r.status === "approved").length
  const rejectedCount = userReservations.filter((r) => r.status === "rejected").length

  const approvalRate =
    totalReservations > 0 ? Math.round((approvedCount / (approvedCount + rejectedCount || 1)) * 100) : 0

  return {
    totalReservations,
    pendingRequests,
    approvedCount,
    rejectedCount,
    approvalRate,
  }
}

export async function getReservationStats(timeRange = "week"): Promise<any> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Calculate basic stats
  const totalReservations = reservations.length
  const totalAttendees = reservations.reduce((sum, r) => sum + r.attendees, 0)
  const pendingRequests = reservations.filter((r) => r.status === "pending").length
  const approvedCount = reservations.filter((r) => r.status === "approved").length
  const rejectedCount = reservations.filter((r) => r.status === "rejected").length
  const approvalRate = Math.round((approvedCount / (approvedCount + rejectedCount || 1)) * 100)

  // Calculate overlapping reservations
  const overlappingReservations = calculateOverlappingReservations()

  // Generate trend data based on time range
  const trends: { name: string; value: number }[] = []

  if (timeRange === "daily") {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateString = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      const count = reservations.filter((r) => {
        const reservationDate = new Date(r.date)
        return reservationDate.toDateString() === date.toDateString()
      }).length

      trends.push({ name: dateString, value: count })
    }
  } else if (timeRange === "week") {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i * 7)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const weekString = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`

      const count = reservations.filter((r) => {
        const reservationDate = new Date(r.date)
        return reservationDate >= weekStart && reservationDate <= weekEnd
      }).length

      trends.push({ name: weekString, value: count })
    }
  } else {
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthString = date.toLocaleDateString("en-US", { month: "long" })

      const count = reservations.filter((r) => {
        const reservationDate = new Date(r.date)
        return reservationDate.getMonth() === date.getMonth() && reservationDate.getFullYear() === date.getFullYear()
      }).length

      trends.push({ name: monthString, value: count })
    }
  }

  // Calculate type distribution
  const typeCount: Record<string, number> = {}
  reservations.forEach((r) => {
    typeCount[r.type] = (typeCount[r.type] || 0) + 1
  })

  const typeDistribution = Object.entries(typeCount).map(([name, value]) => ({ name, value }))

  // Calculate popular time slots
  const timeSlotCount: Record<string, number> = {}
  reservations.forEach((r) => {
    timeSlotCount[r.startTime] = (timeSlotCount[r.startTime] || 0) + 1
  })

  const popularTimeSlots = Object.entries(timeSlotCount)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Calculate user statistics
  const userStats = reservations.reduce((acc: Record<string, any>, reservation) => {
    const { userId, name } = reservation

    if (!acc[userId]) {
      acc[userId] = {
        userId,
        name,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      }
    }

    acc[userId].total += 1

    if (reservation.status === "approved") {
      acc[userId].approved += 1
    } else if (reservation.status === "pending") {
      acc[userId].pending += 1
    } else if (reservation.status === "rejected") {
      acc[userId].rejected += 1
    }

    return acc
  }, {})

  const topUsers = Object.values(userStats)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 5)

  return {
    totalReservations,
    totalAttendees,
    pendingRequests,
    approvedCount,
    rejectedCount,
    approvalRate,
    overlappingReservations,
    trends,
    typeDistribution,
    popularTimeSlots,
    topUsers,
  }
}

// Helper function to calculate overlapping reservations
function calculateOverlappingReservations() {
  const overlaps: { date: string; count: number; maxOverlap: number }[] = []
  const dateMap: Record<string, { overlaps: number; maxOverlap: number }> = {}

  // Only consider approved reservations
  const approvedReservations = reservations.filter((r) => r.status === "approved")

  // Group reservations by date
  approvedReservations.forEach((reservation) => {
    const dateStr = format(new Date(reservation.date), "yyyy-MM-dd")

    if (!dateMap[dateStr]) {
      dateMap[dateStr] = { overlaps: 0, maxOverlap: 0 }
    }

    // Check for overlaps with other reservations on the same date
    const overlappingReservations = approvedReservations.filter((r) => {
      if (format(new Date(r.date), "yyyy-MM-dd") !== dateStr || r.id === reservation.id) {
        return false
      }

      // Convert times to minutes for easier comparison
      const rStart = timeToMinutes(r.startTime)
      const rEnd = timeToMinutes(r.endTime)
      const thisStart = timeToMinutes(reservation.startTime)
      const thisEnd = timeToMinutes(reservation.endTime)

      // Check for overlap
      return thisStart < rEnd && thisEnd > rStart
    })

    if (overlappingReservations.length > 0) {
      dateMap[dateStr].overlaps += overlappingReservations.length

      // Calculate maximum concurrent overlaps
      const timePoints: { time: number; isStart: boolean }[] = []

      // Add this reservation's start and end
      timePoints.push({ time: timeToMinutes(reservation.startTime), isStart: true })
      timePoints.push({ time: timeToMinutes(reservation.endTime), isStart: false })

      // Add overlapping reservations' starts and ends
      overlappingReservations.forEach((r) => {
        timePoints.push({ time: timeToMinutes(r.startTime), isStart: true })
        timePoints.push({ time: timeToMinutes(r.endTime), isStart: false })
      })

      // Sort by time
      timePoints.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time
        // If times are equal, process ends before starts to avoid overcounting
        return a.isStart ? 1 : -1
      })

      // Sweep through to find max concurrent overlaps
      let currentOverlaps = 0
      let maxOverlaps = 0

      timePoints.forEach((point) => {
        if (point.isStart) {
          currentOverlaps++
        } else {
          currentOverlaps--
        }
        maxOverlaps = Math.max(maxOverlaps, currentOverlaps)
      })

      dateMap[dateStr].maxOverlap = Math.max(dateMap[dateStr].maxOverlap, maxOverlaps)
    }
  })

  // Convert to array for easier consumption
  Object.entries(dateMap).forEach(([date, data]) => {
    if (data.overlaps > 0) {
      overlaps.push({
        date,
        count: data.overlaps,
        maxOverlap: data.maxOverlap,
      })
    }
  })

  // Sort by max overlap (highest first)
  return overlaps.sort((a, b) => b.maxOverlap - a.maxOverlap)
}

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Mock function to create a reservation
export async function createReservation(data: any) {
  // In a real application, this would save to a database
  console.log("Creating reservation:", data)

  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return a mock reservation ID
  return {
    id: `res-${Math.random().toString(36).substring(2, 10)}`,
    ...data,
  }
}

export async function getEmailSettings(): Promise<EmailSettings> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200))

  return { ...emailSettings }
}

export async function updateEmailSettings(settings: EmailSettings): Promise<EmailSettings> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // In a real application, this would update the database
  Object.assign(emailSettings, settings)

  return { ...emailSettings }
}
