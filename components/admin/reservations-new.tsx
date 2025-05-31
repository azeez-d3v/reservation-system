"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminReservationList } from "@/components/admin/admin-reservation-list"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Reservation } from "@/lib/types"
import { CheckCircle, Clock, XCircle } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const [activeTab, setActiveTab] = useState("approved")
  const isMobile = useIsMobile()

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
  }, [])  // Legacy fetchReservations function for compatibility with onReservationUpdate
  const fetchReservations = async () => {
    // This is now handled by the real-time listener
    // But we keep this function for onReservationUpdate callback compatibility
    console.log("Real-time listener is handling data updates")
  }

  const statusOptions = [
    { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-500" },
    { value: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
    { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-gray-500" },
    { value: "rejected", label: "Rejected", icon: XCircle, color: "text-red-500" }
  ]

  const renderReservationList = (status: string) => {
    const statusKey = status as keyof typeof reservations
    const emptyMessages = {
      approved: "No approved reservations found.",
      pending: "No pending reservation requests found.",
      cancelled: "No cancelled reservations found.",
      rejected: "No rejected reservations found."
    }

    return (
      <AdminReservationList
        reservations={reservations[statusKey]}
        emptyMessage={emptyMessages[statusKey]}
        isLoading={isLoading}
        onReservationUpdate={fetchReservations}
        showAdminActions={true}
        type="reservations"
      />
    )
  }
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(() => {
                  const currentStatus = statusOptions.find(option => option.value === activeTab)
                  const Icon = currentStatus?.icon
                  return (
                    <div className="flex items-center">
                      {Icon && <Icon className={`mr-2 h-4 w-4 ${currentStatus.color}`} />}
                      {currentStatus?.label}
                    </div>
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => {
                const Icon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <Icon className={`mr-2 h-4 w-4 ${option.color}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        {renderReservationList(activeTab)}
      </div>
    )
  }
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        {statusOptions.map((option) => {
          const Icon = option.icon
          return (
            <TabsTrigger key={option.value} value={option.value} className="flex items-center">
              <Icon className={`mr-2 h-4 w-4 ${option.color}`} />
              {option.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
      
      {statusOptions.map((option) => (
        <TabsContent key={option.value} value={option.value} className="space-y-4">
          {renderReservationList(option.value)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
