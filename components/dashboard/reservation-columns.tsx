"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, CalendarDays, Clock, Users, MoreHorizontal, Info, Eye, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { cancelReservation } from "@/lib/actions"
import { toast } from "sonner"

// Type for our reservation data
export interface ReservationTableData {
  id: string
  purpose: string
  date: Date
  startTime: string
  endTime: string
  attendees: number
  type: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  notes?: string
  name: string
  email: string
}

// Props for column actions
interface ColumnActionsProps {
  onViewDetails: (reservation: ReservationTableData) => void
  onCancelReservation: (reservation: ReservationTableData) => void
}

export function createColumns({
  onViewDetails,
  onCancelReservation,
}: ColumnActionsProps): ColumnDef<ReservationTableData>[] {
  return [
  {
    accessorKey: "purpose",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Purpose
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },    cell: ({ row }) => {
      const reservation = row.original
      return (
        <div className="space-y-1">
          <div className="font-medium truncate max-w-[200px]" title={reservation.purpose}>
            {reservation.purpose}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className={cn(
                reservation.type === "meeting" && "bg-blue-100 text-blue-800 border-blue-300",
                reservation.type === "event" && "bg-green-100 text-green-800 border-green-300",
                reservation.type === "training" && "bg-amber-100 text-amber-800 border-amber-300",
                reservation.type === "other" && "bg-purple-100 text-purple-800 border-purple-300",
              )}
            >
              {reservation.type}
            </Badge>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ getValue }) => {
      const date = getValue() as Date
      return (
        <div className="font-medium">
          {format(new Date(date), "MMM d, yyyy")}
        </div>
      )
    },
  },
  {
    accessorKey: "startTime",
    header: () => (
      <div className="flex items-center">
        <Clock className="mr-2 h-4 w-4" />
        Time
      </div>
    ),
    cell: ({ row }) => {
      const reservation = row.original
      return (
        <div className="font-medium">
          {reservation.startTime} - {reservation.endTime}
        </div>
      )
    },
  },
  {
    accessorKey: "attendees",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          <Users className="mr-2 h-4 w-4" />
          Attendees
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ getValue }) => {
      const attendees = getValue() as number
      return (
        <Badge variant="outline">
          {attendees} attendee{attendees !== 1 ? 's' : ''}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2 lg:px-3"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ getValue }) => {
      const status = getValue() as string
      return (
        <Badge
          variant="outline"
          className={cn(
            status === "approved" && "bg-green-100 text-green-800 border-green-300",
            status === "pending" && "bg-amber-100 text-amber-800 border-amber-300",
            status === "rejected" && "bg-red-100 text-red-800 border-red-300",
            status === "cancelled" && "bg-gray-100 text-gray-800 border-gray-300",
          )}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },  {
    id: "actions",
    cell: ({ row }) => {
      const reservation = row.original

      const handleCancelReservation = async () => {
        try {
          const result = await cancelReservation(reservation.id, 'user')
          if (result.success) {
            toast.success("Reservation cancelled successfully")
            onCancelReservation(reservation)
          } else {
            toast.error(result.message || "Failed to cancel reservation")
          }
        } catch (error) {
          toast.error("An error occurred while cancelling the reservation")
        }
      }

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(reservation.id)}
            >
              Copy reservation ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onViewDetails(reservation)}
              className="cursor-pointer"
            >
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {reservation.status === "approved" && (
              <DropdownMenuItem 
                onClick={handleCancelReservation}
                className="text-red-600 cursor-pointer"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel reservation
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
}

// For expanded row details
export function ReservationDetails({ reservation }: { reservation: ReservationTableData }) {
  return (
    <div className="px-6 py-4 bg-gray-50 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-start">
            <Info className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <span className="font-medium text-sm">Requested by:</span>
              <p className="text-sm text-muted-foreground">{reservation.name}</p>
              <p className="text-sm text-muted-foreground">{reservation.email}</p>
            </div>
          </div>
        </div>
        {reservation.notes && (
          <div className="space-y-2">
            <div className="flex items-start">
              <Info className="mr-2 h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium text-sm">Notes:</span>
                <p className="text-sm text-muted-foreground">{reservation.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
