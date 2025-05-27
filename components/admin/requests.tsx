"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { getReservationList, approveReservation, cancelReservation } from "@/lib/actions"
import type { Reservation } from "@/lib/types"
import { format } from "date-fns"
import { AlertCircle, CheckCircle, XCircle, Filter, Search, Clock, Users, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function AdminRequests() {
  const { toast } = useToast()
  const [pendingRequests, setPendingRequests] = useState<Reservation[]>([])
  const [filteredRequests, setFilteredRequests] = useState<Reservation[]>([])
  const [approvedReservations, setApprovedReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<Reservation | null>(null)
  const [showOverlapDialog, setShowOverlapDialog] = useState(false)
  const [overlappingReservations, setOverlappingReservations] = useState<Reservation[]>([])

  // Filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined)
  const [filterType, setFilterType] = useState<string>("")

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [pending, approved] = await Promise.all([getReservationList("pending"), getReservationList("approved")])
      setPendingRequests(pending)
      setFilteredRequests(pending)
      setApprovedReservations(approved)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error",
        description: "Failed to load reservation data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Apply filters
    let filtered = [...pendingRequests]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (request) =>
          request.name.toLowerCase().includes(term) ||
          request.email.toLowerCase().includes(term) ||
          request.purpose.toLowerCase().includes(term),
      )
    }

    if (filterDate) {
      const dateString = filterDate.toDateString()
      filtered = filtered.filter((request) => new Date(request.date).toDateString() === dateString)
    }

    if (filterType && filterType !== "all") {
      filtered = filtered.filter((request) => request.type === filterType)
    }

    setFilteredRequests(filtered)
  }, [pendingRequests, searchTerm, filterDate, filterType])

  const calculateOverlapSeverity = (overlaps: Reservation[]) => {
    // Group by time slots to calculate maximum concurrent overlaps
    const timePoints: { time: number; isStart: boolean }[] = []

    if (!selectedRequest) return "low"

    // Helper function to convert time string to minutes
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(":").map(Number)
      return hours * 60 + minutes
    }

    // Add selected request time points
    timePoints.push({ time: timeToMinutes(selectedRequest.startTime), isStart: true })
    timePoints.push({ time: timeToMinutes(selectedRequest.endTime), isStart: false })

    // Add overlapping reservations time points
    overlaps.forEach((reservation) => {
      timePoints.push({ time: timeToMinutes(reservation.startTime), isStart: true })
      timePoints.push({ time: timeToMinutes(reservation.endTime), isStart: false })
    })

    // Sort by time
    timePoints.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time
      // If times are equal, process ends before starts
      return a.isStart ? 1 : -1
    })

    // Sweep through to find max concurrent overlaps
    let currentOverlaps = 0
    let maxOverlaps = 0

    timePoints.forEach((point) => {
      if (point.isStart) {
        currentOverlaps++
      } else {
        currentOverlaps--
      }
      maxOverlaps = Math.max(maxOverlaps, currentOverlaps)
    })

    // Define severity levels
    if (maxOverlaps <= 2) return "low"
    if (maxOverlaps <= 4) return "medium"
    return "high"
  }

  const checkForOverlaps = (request: Reservation) => {
    const requestDate = new Date(request.date).toDateString()
    const [requestStartHour, requestStartMinute] = request.startTime.split(":").map(Number)
    const [requestEndHour, requestEndMinute] = request.endTime.split(":").map(Number)

    const requestStartMinutes = requestStartHour * 60 + (requestStartMinute || 0)
    const requestEndMinutes = requestEndHour * 60 + (requestEndMinute || 0)

    const overlaps = approvedReservations.filter((reservation) => {
      const reservationDate = new Date(reservation.date).toDateString()
      if (reservationDate !== requestDate) return false

      const [reservationStartHour, reservationStartMinute] = reservation.startTime.split(":").map(Number)
      const [reservationEndHour, reservationEndMinute] = reservation.endTime.split(":").map(Number)

      const reservationStartMinutes = reservationStartHour * 60 + (reservationStartMinute || 0)
      const reservationEndMinutes = reservationEndHour * 60 + (reservationEndMinute || 0)

      // Check if there's any overlap in time ranges
      return (
        (requestStartMinutes < reservationEndMinutes && requestEndMinutes > reservationStartMinutes) ||
        (reservationStartMinutes < requestEndMinutes && reservationEndMinutes > requestStartMinutes)
      )
    })

    return overlaps
  }

  const handleApprove = async (request: Reservation) => {
    setSelectedRequest(request)

    // Check for overlapping reservations
    const overlaps = checkForOverlaps(request)

    if (overlaps.length > 0) {
      setOverlappingReservations(overlaps)
      setShowOverlapDialog(true)
    } else {
      await processApproval(request)
    }
  }

  const processApproval = async (request: Reservation) => {
    try {
      await approveReservation(request.id)
      toast({
        title: "Reservation Approved",
        description: "The reservation has been approved and the requester has been notified.",
      })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve reservation",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await cancelReservation(id)
      toast({
        title: "Reservation Rejected",
        description: "The reservation request has been rejected.",
      })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject reservation",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (date: Date, time: string) => {
    return `${format(new Date(date), "MMM d, yyyy")} at ${time}`
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilterDate(undefined)
    setFilterType("")
  }

  // Get overlap severity for UI coloring
  const overlapSeverity = calculateOverlapSeverity(overlappingReservations)

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
                      <SelectItem value="gym">Gym</SelectItem>
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

          <Button variant="outline" size="sm" className="h-9" onClick={fetchData}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="mx-auto h-12 w-12 mb-4" />
          <p>No pending reservation requests</p>
          {(searchTerm || filterDate || filterType) && (
            <Button variant="link" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold">{request.name}</h3>
                    <p className="text-sm text-muted-foreground">{request.email}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{request.attendees} attendees</Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          request.type === "meeting" && "bg-blue-100 text-blue-800 border-blue-300",
                          request.type === "event" && "bg-green-100 text-green-800 border-green-300",
                          request.type === "training" && "bg-amber-100 text-amber-800 border-amber-300",
                          request.type === "gym" && "bg-purple-100 text-purple-800 border-purple-300",
                          request.type === "other" && "bg-gray-100 text-gray-800 border-gray-300",
                        )}
                      >
                        {request.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Date:</span> {format(new Date(request.date), "PPP")}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Time:</span> {request.startTime} - {request.endTime}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Purpose:</span> {request.purpose}
                    </p>
                    {request.notes && (
                      <p className="text-sm">
                        <span className="font-medium">Notes:</span> {request.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    {/* Check for overlaps and show indicator if any exist */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {checkForOverlaps(request).length > 0 && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 mr-2">
                                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                {checkForOverlaps(request).length} overlap(s)
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>This reservation overlaps with existing approved reservations</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button variant="outline" size="sm" onClick={() => handleReject(request.id)}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(request)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overlap Dialog */}
      <Dialog open={showOverlapDialog} onOpenChange={setShowOverlapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertCircle
                className={cn(
                  "h-5 w-5 mr-2",
                  overlapSeverity === "low" && "text-amber-500",
                  overlapSeverity === "medium" && "text-orange-500",
                  overlapSeverity === "high" && "text-red-500",
                )}
              />
              Overlapping Reservations Detected
            </DialogTitle>
            <DialogDescription>
              This reservation overlaps with {overlappingReservations.length} existing
              {overlappingReservations.length === 1 ? " reservation" : " reservations"}.
              {overlappingReservations.length >= 2 ? (
                <span className="font-medium text-amber-700">
                  {" "}
                  Multiple overlaps detected, please review carefully.
                </span>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[300px] overflow-y-auto space-y-3 my-4">
            {overlappingReservations.map((reservation) => (
              <div key={reservation.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{reservation.name}</div>
                  <Badge
                    variant="outline"
                    className={cn(
                      reservation.type === "meeting" && "bg-blue-100 text-blue-800 border-blue-300",
                      reservation.type === "event" && "bg-green-100 text-green-800 border-green-300",
                      reservation.type === "training" && "bg-amber-100 text-amber-800 border-amber-300",
                      reservation.type === "gym" && "bg-purple-100 text-purple-800 border-purple-300",
                      reservation.type === "other" && "bg-gray-100 text-gray-800 border-gray-300",
                    )}
                  >
                    {reservation.type}
                  </Badge>
                </div>
                <div className="flex items-center mt-1">
                  <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(new Date(reservation.date), reservation.startTime)} - {reservation.endTime}
                  </div>
                </div>
                <div className="flex items-center mt-1">
                  <Users className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">{reservation.attendees} attendees</div>
                </div>
                <div className="text-sm mt-1">{reservation.purpose}</div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-3 rounded-md mb-4">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2 text-blue-500" />
              <div className="text-sm font-medium">System permits up to 2 concurrent reservations</div>
            </div>
            <div className="text-sm text-muted-foreground ml-6 mt-1">
              Based on current overlaps, this would result in a maximum of {overlappingReservations.length + 1}{" "}
              concurrent reservations.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverlapDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                processApproval(selectedRequest as Reservation)
                setShowOverlapDialog(false)
              }}
              className={cn(
                overlapSeverity === "low" && "bg-amber-500 hover:bg-amber-600",
                overlapSeverity === "medium" && "bg-orange-500 hover:bg-orange-600",
                overlapSeverity === "high" && "bg-destructive hover:bg-destructive/90",
              )}
            >
              Approve Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
