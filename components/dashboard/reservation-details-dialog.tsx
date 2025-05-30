"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CalendarDays, Clock, Users, MapPin, FileText, User, Mail } from "lucide-react"
import { format } from "date-fns"
import { ReservationTableData } from "./reservation-columns"

interface ReservationDetailsDialogProps {
  reservation: ReservationTableData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservationDetailsDialog({
  reservation,
  open,
  onOpenChange,
}: ReservationDetailsDialogProps) {
  if (!reservation) return null

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <Badge 
            variant="secondary"
            className={`text-xs sm:text-sm ${statusColors[reservation.status]}`}
          >
            {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
          </Badge>
        </div>
        <DialogHeader className="pr-16 sm:pr-20">
          <DialogTitle className="text-lg sm:text-xl">Reservation Details</DialogTitle>
          <DialogDescription className="text-sm">
            Reservation ID: {reservation.id}
          </DialogDescription>
        </DialogHeader>        <div className="space-y-4 sm:space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Purpose:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6 break-words">
                  {reservation.purpose}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Type:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  {reservation.type}
                </p>
              </div>
            </div>
          </div>

          <Separator />          {/* Date & Time */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Date & Time</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Date:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6 break-words">
                  {format(reservation.date, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Start Time:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  {reservation.startTime}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">End Time:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  {reservation.endTime}
                </p>
              </div>
            </div>
          </div>

          <Separator />          {/* Attendees */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Attendees</h3>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Number of attendees:</span>
              <span className="text-sm font-medium">{reservation.attendees}</span>
            </div>
          </div>

          <Separator />          {/* Contact Information */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Name:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6 break-words">
                  {reservation.name}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Email:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6 break-all">
                  {reservation.email}
                </p>
              </div>
            </div>
          </div>          {/* Notes */}
          {reservation.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Notes</h3>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm break-words whitespace-pre-wrap">{reservation.notes}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
