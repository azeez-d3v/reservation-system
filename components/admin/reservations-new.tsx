"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminReservationList } from "./admin-reservation-list"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Reservation } from "@/lib/types"
import { CheckCircle, Clock, XCircle } from "lucide-react"

export function AdminReservations() {
  const [reservations, setReservations] = useState<{
    approved: Reservation[],
    pending: Reservation[],
    cancelled: Reservation[],
    rejected: Reservation[]
  }>({
    approved: [],
    pending: [],
    cancelled: [],
    rejected: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set up real-time listener for all reservations
    const q = query(
      collection(db, "reservations"),
      orderBy("createdAt", "desc")
    )

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allReservations = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt?.toDate() || data.createdAt.toDate()
        }
      }) as Reservation[]
      
      // Categorize reservations by status
      const categorizedReservations = {
        approved: allReservations.filter(r => r.status === "approved"),
        pending: allReservations.filter(r => r.status === "pending"),
        cancelled: allReservations.filter(r => r.status === "cancelled"),
        rejected: allReservations.filter(r => r.status === "rejected")
      }
      
      setReservations(categorizedReservations)
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
    <Tabs defaultValue="approved" className="space-y-4">
      <TabsList>
        <TabsTrigger value="approved" className="flex items-center">
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
          Approved
        </TabsTrigger>
        <TabsTrigger value="pending" className="flex items-center">
          <Clock className="mr-2 h-4 w-4 text-amber-500" />
          Pending
        </TabsTrigger>
        <TabsTrigger value="cancelled" className="flex items-center">
          <XCircle className="mr-2 h-4 w-4 text-gray-500" />
          Cancelled
        </TabsTrigger>
        <TabsTrigger value="rejected" className="flex items-center">
          <XCircle className="mr-2 h-4 w-4 text-red-500" />
          Rejected
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="approved" className="space-y-4">
        <AdminReservationList
          reservations={reservations.approved}
          emptyMessage="No approved reservations found."
          isLoading={isLoading}
          onReservationUpdate={fetchReservations}
          showAdminActions={true}
          type="reservations"
        />
      </TabsContent>
      
      <TabsContent value="pending" className="space-y-4">
        <AdminReservationList
          reservations={reservations.pending}
          emptyMessage="No pending reservation requests found."
          isLoading={isLoading}
          onReservationUpdate={fetchReservations}
          showAdminActions={true}
          type="reservations"
        />
      </TabsContent>
      
      <TabsContent value="cancelled" className="space-y-4">
        <AdminReservationList
          reservations={reservations.cancelled}
          emptyMessage="No cancelled reservations found."
          isLoading={isLoading}
          onReservationUpdate={fetchReservations}
          showAdminActions={true}
          type="reservations"
        />
      </TabsContent>
      
      <TabsContent value="rejected" className="space-y-4">
        <AdminReservationList
          reservations={reservations.rejected}
          emptyMessage="No rejected reservations found."
          isLoading={isLoading}
          onReservationUpdate={fetchReservations}
          showAdminActions={true}
          type="reservations"
        />
      </TabsContent>
    </Tabs>
  )
}
