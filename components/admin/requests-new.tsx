"use client"

import { useState, useEffect } from "react"
import { AdminReservationList } from "./admin-reservation-list"
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Reservation } from "@/lib/types"

export function AdminRequests() {
  const [pendingRequests, setPendingRequests] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set up real-time listener for pending reservations
    const q = query(
      collection(db, "reservations"),
      where("status", "==", "pending"),
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
      
      setPendingRequests(reservations)
      setIsLoading(false)
    }, (error) => {
      console.error("Failed to fetch pending requests:", error)
      setIsLoading(false)
    })

    // Cleanup listener on unmount
    return () => unsubscribe()
  }, [])

  // Legacy fetchRequests function for compatibility with onReservationUpdate
  const fetchRequests = async () => {
    // This is now handled by the real-time listener
    // But we keep this function for onReservationUpdate callback compatibility
    console.log("Real-time listener is handling data updates")
  }

  return (
    <AdminReservationList
      reservations={pendingRequests}
      emptyMessage="No pending reservation requests found."
      isLoading={isLoading}
      onReservationUpdate={fetchRequests}
      showAdminActions={true}
      type="requests"
    />
  )
}
