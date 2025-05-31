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
import { ArrowUpDown, CalendarDays, Clock, Users, MoreHorizontal, Eye, CheckCircle, XCircle, Trash2, Mail } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// Type for our admin reservation data
export interface AdminReservationTableData {
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
  createdAt: Date
}

// Props for column actions
interface AdminColumnActionsProps {
  onViewDetails: (reservation: AdminReservationTableData) => void
  onAdminAction: (reservation: AdminReservationTableData, action: "approve" | "reject" | "cancel") => void
  showAdminActions: boolean
  type: "requests" | "reservations"
}

export function createAdminColumns({
  onViewDetails,
  onAdminAction,
  showAdminActions,
  type,
}: AdminColumnActionsProps): ColumnDef<AdminReservationTableData>[] {
  const baseColumns: ColumnDef<AdminReservationTableData>[] = [
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
      },      cell: ({ row }) => {
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
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Requestor
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const reservation = row.original
        return (
          <div className="space-y-1">
            <div className="font-medium">{reservation.name}</div>
            <div className="text-sm text-muted-foreground flex items-center">
              <Mail className="mr-1 h-3 w-3" />
              {reservation.email}
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            <Clock className="mr-2 h-4 w-4" />
            Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
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
        return <div className="font-medium">{attendees}</div>
      },
    },    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <Badge
            variant={
              status === "approved"
                ? "default"
                : status === "pending"
                ? "secondary"
                : status === "rejected"
                ? "destructive"
                : "outline"
            }
            className={cn(
              status === "approved" && "bg-green-100 text-green-800 border-green-300",
              status === "pending" && "bg-yellow-100 text-yellow-800 border-yellow-300",
              status === "rejected" && "bg-red-100 text-red-800 border-red-300",
              status === "cancelled" && "bg-gray-100 text-gray-800 border-gray-300",
            )}
          >
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return (
          <div className="text-sm text-muted-foreground">
            {format(new Date(date), "MMM d, h:mm a")}
          </div>
        )
      },
    },
  ]

  // Add actions column if admin actions are enabled
  if (showAdminActions) {
    baseColumns.push({
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const reservation = row.original

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
              <DropdownMenuItem onClick={() => onViewDetails(reservation)}>
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>              <DropdownMenuSeparator />
              
              {reservation.status === "pending" && (
                <>
                  <DropdownMenuItem 
                    onClick={() => onAdminAction(reservation, "approve")}
                    className="text-green-600"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onAdminAction(reservation, "reject")}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
              
              {reservation.status === "approved" && (
                <DropdownMenuItem 
                  onClick={() => onAdminAction(reservation, "cancel")}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return baseColumns
}
