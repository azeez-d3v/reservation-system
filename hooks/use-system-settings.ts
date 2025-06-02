"use client"

import { useState, useEffect } from "react"
import { SystemSettings } from "@/lib/types"
import { getSettings } from "@/lib/actions"

export function useSystemSettings() {
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true)
        const settings = await getSettings()
        setSystemSettings(settings)
        setError(null)
      } catch (err) {
        console.error("Failed to fetch system settings:", err)
        setError("Failed to load system settings")
        // Set fallback values
        setSystemSettings({
          systemName: "Reservation System",
          contactEmail: "admin@example.com",
          requireApproval: true,
          allowOverlapping: true,
          maxOverlappingReservations: 2,
          publicCalendar: true,
          reservationTypes: ["event", "training", "gym", "other"],
          use12HourFormat: true,
          minAdvanceBookingDays: 0
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return { systemSettings, isLoading, error }
}
