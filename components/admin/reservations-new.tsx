"use client"

import { useState, useEffect } from "react"
import { AdminReservationList } from "./admin-reservation-list"
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Reservation } from "@/lib/types"

export function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set up real-time listener for approved reservations
    const q = query(
      collection(db, "reservations"),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc")
    )

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reservations = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
        }
      }) as Reservation[]
      
      setReservations(reservations)
      setIsLoading(false)
    }, (error) => {
      console.error("Failed to fetch reservations:", error)
      setIsLoading(false)
    })

    // Cleanup listener on unmount
    return () => unsubscribe()
  }, [])

  // Legacy fetchReservations function for compatibility with onReservationUpdate
  const fetchReservations = async () => {
    // This is now handled by the real-time listener
    // But we keep this function for onReservationUpdate callback compatibility
    console.log("Real-time listener is handling data updates")
  }

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
