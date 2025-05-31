export interface Reservation {
  id: string
  userId: string
  name: string
  email: string
  date: Date
  startTime: string
  endTime: string
  purpose: string
  attendees: number
  type: string
  notes?: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  createdAt: Date
  updatedAt?: Date
}

export interface ReservationRequest {
  userId: string
  name: string
  email: string
  date: Date
  startTime: string
  endTime: string
  purpose: string
  attendees: number
  type: string
  notes?: string
}

export interface TimeSlotSettings {
  businessHours: {
    [key: string]: DaySchedule
  }
  blackoutDates: BlackoutDate[]
  minDuration: number
  maxDuration: number
  timeSlotInterval: number
  bufferTime: number
  timeSlots?: TimeSlot[]
}

export interface DaySchedule {
  enabled: boolean
  timeSlots: TimeSlot[]
}

export interface TimeSlot {
  id: string
  start: string
  end: string
}

export interface BlackoutDate {
  id: string
  date: Date
  reason: string
}

export interface SystemSettings {
  systemName: string
  organizationName: string
  contactEmail: string
  requireApproval: boolean
  allowOverlapping: boolean
  maxOverlappingReservations: number
  publicCalendar: boolean
  reservationTypes: string[]
  use12HourFormat: boolean
  maxAdvanceBookingDays?: number
}

export interface EmailSettings {
  sendUserEmails: boolean
  sendAdminEmails: boolean
  templates: EmailTemplates
}

export interface EmailTemplates {
  approval: string
  rejection: string
  notification: string
  submission: string
  cancellation: string
  confirmationSubject?: string
}

export interface User {
  id: string
  name: string
  email: string
  image?: string
  role: "admin" | "staff" | "user"
  status: "active" | "inactive"
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

// NextAuth type extensions
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      status: string
    }
  }

  interface User {
    role?: string
    status?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    status?: string
  }
}
