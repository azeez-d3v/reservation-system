"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { approveReservation, rejectReservation, cancelReservation } from "@/lib/actions"
import { toast } from "sonner"
import type { AdminReservationTableData } from "./admin-reservation-columns"

interface AdminActionDialogProps {
  reservation: AdminReservationTableData | null
  action: "approve" | "reject" | "cancel"
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function AdminActionDialog({
  reservation,
  action,
  open,
  onOpenChange,
  onComplete,
}: AdminActionDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  if (!reservation) return null

  const handleAction = async () => {
    setIsLoading(true)
    try {
      switch (action) {
        case "approve":
          await approveReservation(reservation.id)
          toast.success("Reservation approved successfully")
          break
        case "reject":
          await rejectReservation(reservation.id)
          toast.success("Reservation rejected")
          break
        case "cancel":
          await cancelReservation(reservation.id)
          toast.success("Reservation cancelled")
          break
      }
      onComplete()
    } catch (error) {
      console.error(`Failed to ${action} reservation:`, error)
      toast.error(`Failed to ${action} reservation`)
    } finally {
      setIsLoading(false)
    }
  }

  const getActionConfig = () => {
    switch (action) {
      case "approve":
        return {
          title: "Approve Reservation",
          description: "Are you sure you want to approve this reservation request?",
          icon: <CheckCircle className="h-6 w-6 text-green-600" />,
          buttonText: "Approve",
          buttonVariant: "default" as const,
          buttonClass: "bg-green-600 hover:bg-green-700",
        }
      case "reject":
        return {
          title: "Reject Reservation",
          description: "Are you sure you want to reject this reservation request? This action cannot be undone.",
          icon: <XCircle className="h-6 w-6 text-red-600" />,
          buttonText: "Reject",
          buttonVariant: "destructive" as const,
          buttonClass: "",
        }
      case "cancel":
        return {
          title: "Cancel Reservation",
          description: "Are you sure you want to cancel this approved reservation? This action cannot be undone.",
          icon: <Trash2 className="h-6 w-6 text-red-600" />,
          buttonText: "Cancel",
          buttonVariant: "destructive" as const,
          buttonClass: "",
        }
    }
  }

  const config = getActionConfig()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Reservation Details */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium">Reservation Details</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Purpose:</span> {reservation.purpose}
              </div>
              <div>
                <span className="font-medium">Requestor:</span> {reservation.name} ({reservation.email})
              </div>
              <div>
                <span className="font-medium">Date:</span> {format(reservation.date, "MMMM d, yyyy")}
              </div>
              <div>
                <span className="font-medium">Time:</span> {reservation.startTime} - {reservation.endTime}
              </div>
              <div>
                <span className="font-medium">Attendees:</span> {reservation.attendees}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Type:</span>
                <Badge variant="outline">{reservation.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <Badge variant="secondary">{reservation.status}</Badge>
              </div>
              {reservation.notes && (
                <div>
                  <span className="font-medium">Notes:</span> {reservation.notes}
                </div>
              )}
            </div>
          </div>

          {action === "reject" || action === "cancel" ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Warning</p>
                <p>This action cannot be undone. The user will be notified of this decision.</p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleAction}
            disabled={isLoading}
            className={config.buttonClass}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
