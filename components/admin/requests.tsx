"use client"

import { useState, useEffect } from "react"
import { AdminReservationList } from "./admin-reservation-list"
import { getReservationList } from "@/lib/actions"
import type { Reservation } from "@/lib/types"

export function AdminRequests() {
  const [requests, setRequests] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const data = await getReservationList("pending")
      setRequests(data as Reservation[])
    } catch (error) {
      console.error("Failed to fetch requests:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  return (
    <AdminReservationList
      reservations={requests}
      emptyMessage="No pending requests found."
      isLoading={isLoading}
      onReservationUpdate={fetchRequests}
      showAdminActions={true}
      type="requests"
    />
  )
}