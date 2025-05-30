"use client"

import { useState, useEffect } from "react"
import { AdminReservationList } from "./admin-reservation-list"
import { getReservationList } from "@/lib/actions"
import type { Reservation } from "@/lib/types"

export function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchReservations = async () => {
    setIsLoading(true)
    try {
      const data = await getReservationList("approved")
      setReservations(data as Reservation[])
    } catch (error) {
      console.error("Failed to fetch reservations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReservations()
  }, [])

  return (
    <AdminReservationList
      reservations={reservations}
      emptyMessage="No approved reservations found."
      isLoading={isLoading}
      onReservationUpdate={fetchReservations}
      showAdminActions={true}
      type="reservations"
    />
  )
}
