"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { ReservationDataTable } from "./reservation-data-table"
import { createColumns, type ReservationTableData } from "./reservation-columns"
import { ReservationDetailsDialog } from "./reservation-details-dialog"
import { toast } from "sonner"

interface ReservationListProps {
  reservations: any[]
  emptyMessage: string
  isLoading: boolean
  onReservationUpdate?: () => void
}

export function ReservationList({ 
  reservations, 
  emptyMessage, 
  isLoading, 
  onReservationUpdate 
}: ReservationListProps) {
  const [selectedReservation, setSelectedReservation] = useState<ReservationTableData | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
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

  const tableData: ReservationTableData[] = futureReservations.map((reservation) => ({
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
  }))

  const handleViewDetails = (reservation: ReservationTableData) => {
    setSelectedReservation(reservation)
    setDetailsDialogOpen(true)
  }

  const handleCancelReservation = (reservation: ReservationTableData) => {
    // Refresh the reservation list after cancellation
    if (onReservationUpdate) {
      onReservationUpdate()
    }
  }

  const columns = createColumns({
    onViewDetails: handleViewDetails,
    onCancelReservation: handleCancelReservation,
  })
  // If no future reservations and not loading, show empty state
  if (!isLoading && (!futureReservations || futureReservations.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          <Button asChild className="mt-4">
            <Link href="/request">Create a Reservation</Link>
          </Button>
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
    </>
  )
}
