"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { ReservationDataTable } from "@/components/dashboard/reservation-data-table"
import { createAdminColumns, type AdminReservationTableData } from "@/components/admin/admin-reservation-columns"
import { ReservationDetailsDialog } from "@/components/dashboard/reservation-details-dialog"
import { AdminActionDialog } from "@/components/admin/admin-action-dialog"
import type { Reservation } from "@/lib/types"

interface AdminReservationListProps {
  reservations: Reservation[]
  emptyMessage: string
  isLoading: boolean
  onReservationUpdate?: () => void
  showAdminActions?: boolean
  type: "requests" | "reservations"
}

export function AdminReservationList({ 
  reservations, 
  emptyMessage, 
  isLoading, 
  onReservationUpdate,
  showAdminActions = true,
  type
}: AdminReservationListProps) {
  const [selectedReservation, setSelectedReservation] = useState<AdminReservationTableData | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject" | "cancel" | null>(null)
  // Helper function to check if reservation is past its date and time
  const isReservationPast = (date: Date, endTime: string) => {
    const now = new Date()
    const reservationDate = new Date(date)
    const [hours, minutes] = endTime.split(':').map(Number)
    reservationDate.setHours(hours, minutes, 0, 0)
    return reservationDate < now
  }

  // Filter out past reservations and transform the remaining data
  const futureReservations = reservations.filter(reservation => 
    !isReservationPast(new Date(reservation.date), reservation.endTime)
  )

  const tableData: AdminReservationTableData[] = futureReservations.map((reservation) => ({
    id: reservation.id,
    purpose: reservation.purpose,
    date: new Date(reservation.date),
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    attendees: reservation.attendees,
    type: reservation.type,
    status: reservation.status,
    notes: reservation.notes,
    name: reservation.name,
    email: reservation.email,
    createdAt: new Date(reservation.createdAt),
  }))

  const handleViewDetails = (reservation: AdminReservationTableData) => {
    setSelectedReservation(reservation)
    setDetailsDialogOpen(true)
  }

  const handleAdminAction = (reservation: AdminReservationTableData, action: "approve" | "reject" | "cancel") => {
    setSelectedReservation(reservation)
    setActionType(action)
    setActionDialogOpen(true)
  }

  const handleActionComplete = () => {
    setActionDialogOpen(false)
    setSelectedReservation(null)
    setActionType(null)
    if (onReservationUpdate) {
      onReservationUpdate()
    }
  }

  const columns = createAdminColumns({
    onViewDetails: handleViewDetails,
    onAdminAction: handleAdminAction,
    showAdminActions,
    type,
  })
  // If no future reservations and not loading, show empty state
  if (!isLoading && (!futureReservations || futureReservations.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          {type === "requests" && (
            <Button asChild className="mt-4">
              <Link href="/request">Create a Reservation</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }
  return (
    <>
      <ReservationDataTable
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />
      
      <ReservationDetailsDialog
        reservation={selectedReservation}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      {selectedReservation && actionType && (
        <AdminActionDialog
          reservation={selectedReservation}
          action={actionType}
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          onComplete={handleActionComplete}
        />
      )}
    </>
  )
}
