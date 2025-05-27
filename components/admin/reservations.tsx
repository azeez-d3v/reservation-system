"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { getApprovedReservations, cancelReservation } from "@/lib/actions"
import type { Reservation } from "@/lib/types"
import { format } from "date-fns"
import { CalendarIcon, Search, Filter, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function AdminReservations() {
  const { toast } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined)
  const [filterType, setFilterType] = useState<string>("")

  const fetchReservations = async () => {
    setIsLoading(true)
    try {
      const data = await getApprovedReservations()
      setReservations(data)
      setFilteredReservations(data)
    } catch (error) {
      console.error("Failed to fetch reservations:", error)
      toast({
        title: "Error",
        description: "Failed to load approved reservations",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReservations()
  }, [])

  useEffect(() => {
    // Apply filters
    let filtered = [...reservations]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (reservation) =>
          reservation.name.toLowerCase().includes(term) ||
          reservation.email.toLowerCase().includes(term) ||
          reservation.purpose.toLowerCase().includes(term),
      )
    }

    if (filterDate) {
      const dateString = filterDate.toDateString()
      filtered = filtered.filter((reservation) => new Date(reservation.date).toDateString() === dateString)
    }

    if (filterType && filterType !== "all") {
      filtered = filtered.filter((reservation) => reservation.type === filterType)
    }

    setFilteredReservations(filtered)
  }, [reservations, searchTerm, filterDate, filterType])

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return

    try {
      await cancelReservation(reservationToCancel.id)
      toast({
        title: "Reservation Cancelled",
        description: "The reservation has been cancelled successfully.",
      })
      fetchReservations()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel reservation",
        variant: "destructive",
      })
    } finally {
      setShowCancelDialog(false)
      setReservationToCancel(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilterDate(undefined)
    setFilterType("")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or purpose..."
            className="w-full pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {(filterDate || filterType) && (
                  <Badge variant="secondary" className="ml-2 rounded-sm px-1">
                    {(filterDate ? 1 : 0) + (filterType ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Date</h4>
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={setFilterDate}
                    className="rounded-md border"
                  />
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Type</h4>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="h-9" onClick={fetchReservations}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>Loading reservations...</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarIcon className="mx-auto h-12 w-12 mb-4" />
          <p>No approved reservations found</p>
          {(searchTerm || filterDate || filterType) && (
            <Button variant="link" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map((reservation) => (
            <Card key={reservation.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold">{reservation.name}</h3>
                    <p className="text-sm text-muted-foreground">{reservation.email}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{reservation.attendees} attendees</Badge>
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

                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Date:</span> {format(new Date(reservation.date), "PPP")}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Time:</span> {reservation.startTime} - {reservation.endTime}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Purpose:</span> {reservation.purpose}
                    </p>
                    {reservation.notes && (
                      <p className="text-sm">
                        <span className="font-medium">Notes:</span> {reservation.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setReservationToCancel(reservation)
                        setShowCancelDialog(true)
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel Reservation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this reservation? This action cannot be undone.
              {reservationToCancel && (
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <p>
                    <strong>{reservationToCancel.name}</strong>
                  </p>
                  <p className="text-sm">
                    {format(new Date(reservationToCancel.date), "PPP")} at {reservationToCancel.startTime} -{" "}
                    {reservationToCancel.endTime}
                  </p>
                  <p className="text-sm">{reservationToCancel.purpose}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelReservation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Reservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
