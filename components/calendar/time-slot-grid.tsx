"use client"

import { useState, useEffect } from "react"
import { format, addMinutes, parse, differenceInMinutes } from "date-fns"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, Users, Info, AlertCircle, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TimeSlotGridProps {
  timeSlots: {
    time: string
    available: boolean
    status: "available" | "limited" | "full" | "unavailable"
    occupancy?: number
    capacity?: number
    conflicts?: Array<{
      id: string
      name: string
      startTime: string
      endTime: string
    }>
  }[]
  onSelectTimeSlot: (time: string) => void
  requiresLogin?: boolean
  selectedTime?: string
  selectedDate?: Date
  use12HourFormat?: boolean
  hasOverlappingReservations?: boolean
}

export function TimeSlotGrid({
  timeSlots,
  onSelectTimeSlot,
  requiresLogin = false,
  selectedTime,
  selectedDate,
  use12HourFormat = true,
  hasOverlappingReservations = false,
}: TimeSlotGridProps) {
  const [sortedTimeSlots, setSortedTimeSlots] = useState<any[]>([])
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(selectedTime || null)
  const [selectedDuration, setSelectedDuration] = useState<number>(60)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [durationOptions, setDurationOptions] = useState<number[]>([30, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540])
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(540) // 9 hours max (8AM to 5PM)
  const [operationalHours, setOperationalHours] = useState({ start: "08:00", end: "17:00" })
  const [hasOverlap, setHasOverlap] = useState(false)

  // Sort time slots chronologically
  useEffect(() => {
    // Sort time slots chronologically
    const sorted = [...timeSlots].sort((a, b) => {
      const timeA = a.time.split(":").map(Number)
      const timeB = b.time.split(":").map(Number)

      if (timeA[0] !== timeB[0]) {
        return timeA[0] - timeB[0] // Sort by hour
      }
      return timeA[1] - timeB[1] // Sort by minute
    })

    setSortedTimeSlots(sorted)

    // If we have a selected time from props, use it
    if (selectedTime) {
      setSelectedStartTime(selectedTime)
    }
  }, [timeSlots, selectedTime])

  // Update available end times when start time changes
  useEffect(() => {
    if (selectedStartTime && timeSlots.length > 0) {
      // Find the selected time slot
      const selectedSlot = timeSlots.find((slot) => slot.time === selectedStartTime)
      if (!selectedSlot) return

      // Calculate the maximum possible duration based on operational hours
      const startTimeObj = parse(selectedStartTime, "HH:mm", new Date())
      const gymCloseTime = parse(operationalHours.end, "HH:mm", new Date())

      // Calculate minutes until gym closes
      const minutesUntilClose = differenceInMinutes(gymCloseTime, startTimeObj)

      // Set the maximum possible duration (until gym closes at 5PM)
      const calculatedMaxDuration = minutesUntilClose > 0 ? minutesUntilClose : 0
      setMaxPossibleDuration(calculatedMaxDuration)

      // Adjust selected duration if it exceeds the maximum
      if (selectedDuration > calculatedMaxDuration) {
        setSelectedDuration(Math.floor(calculatedMaxDuration / 30) * 30) // Round down to nearest 30 min
      }

      // Calculate end time based on selected duration
      const endTimeObj = addMinutes(startTimeObj, selectedDuration)
      const calculatedEndTime = format(endTimeObj, "HH:mm")
      setSelectedEndTime(calculatedEndTime)

      // Check for overlaps with existing bookings
      const startIndex = timeSlots.findIndex((slot) => slot.time === selectedStartTime)
      const endIndex = timeSlots.findIndex((slot) => slot.time === calculatedEndTime)

      let hasConflict = false
      for (let i = startIndex + 1; i < endIndex; i++) {
        if (i >= 0 && i < timeSlots.length && !timeSlots[i].available) {
          hasConflict = true
          break
        }
      }

      setHasOverlap(hasConflict)
    }
  }, [selectedStartTime, selectedDuration, timeSlots, operationalHours])

  // Format time for display (12-hour or 24-hour)
  const formatTimeForDisplay = (time: string) => {
    if (!use12HourFormat) return time

    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }

  // Handle time slot selection
  const handleTimeSlotClick = (time: string) => {
    setSelectedStartTime(time)
    onSelectTimeSlot(time)
  }

  // Handle duration selection
  const handleDurationChange = (value: string) => {
    setSelectedDuration(Number.parseInt(value))
  }

  // Format duration for display
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours === 0) {
      return `${mins} minutes`
    } else if (mins === 0) {
      return hours === 1 ? "1 hour" : `${hours} hours`
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minutes`
    }
  }

  // Generate duration options based on maximum possible duration
  const generateDurationOptions = (maxDuration: number) => {
    const options: number[] = []
    let duration = 30 // Start with 30 minute increments

    while (duration <= maxDuration && duration <= 540) { // Cap at 9 hours max (540 minutes)
      options.push(duration)

      // Use smaller increments for shorter durations, larger increments for longer durations
      if (duration < 120) { // Up to 2 hours: 30 min increments
        duration += 30
      } else if (duration < 240) { // 2-4 hours: 60 min increments
        duration += 60
      } else { // Over 4 hours: 120 min increments
        duration += 120
      }
    }

    return options
  }

  // Get the selected time slot details
  const getSelectedTimeSlotDetails = () => {
    if (!selectedStartTime) return null
    return timeSlots.find((slot) => slot.time === selectedStartTime)
  }

  const selectedSlot = getSelectedTimeSlotDetails()

  if (timeSlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No time slots available for this date</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col h-full w-full">
      <Alert className="flex-shrink-0 mb-4 w-full">
        <Info className="h-4 w-4" />
        <AlertTitle>Gymnasium Hours</AlertTitle>
        <AlertDescription>
          The gymnasium is open from {formatTimeForDisplay(operationalHours.start)} to{" "}
          {formatTimeForDisplay(operationalHours.end)}. Select a time slot to continue.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col flex-1 w-full min-h-0">
        <h3 className="text-sm font-medium mb-3 flex-shrink-0">Available Time Slots</h3>
        <div className="flex-1 overflow-y-auto pr-2 w-full">
          <TooltipProvider>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
              {sortedTimeSlots.map((slot) => {
                const isFullyBooked = slot.status === "full" || slot.status === "unavailable"
                const isLimited = slot.status === "limited"
                const isAvailable = slot.status === "available"
                const hasConflicts = slot.conflicts && slot.conflicts.length > 0
                
                const tooltipContent = (
                  <div className="max-w-xs p-2">
                    <div className="font-medium mb-2">{formatTimeForDisplay(slot.time)}</div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <Badge 
                          variant={
                            isAvailable ? "default" : 
                            isLimited ? "secondary" : 
                            "destructive"
                          }
                          className="text-xs"
                        >
                          {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                        </Badge>
                      </div>
                      
                      {slot.capacity && slot.occupancy !== undefined && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>Occupancy: {slot.occupancy}/{slot.capacity}</span>
                          <div className="flex-1 ml-2">
                            <Progress 
                              value={(slot.occupancy / slot.capacity) * 100} 
                              className="h-2"
                            />
                          </div>
                        </div>
                      )}
                      
                      {slot.occupancy !== undefined && slot.occupancy > 0 && !slot.capacity && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>Current bookings: {slot.occupancy}</span>
                        </div>
                      )}
                      
                      {hasConflicts && (
                        <div className="border-t pt-2 mt-2">
                          <div className="text-red-600 font-medium mb-1">
                            {slot.conflicts!.length} Conflict{slot.conflicts!.length > 1 ? 's' : ''}:
                          </div>
                          {slot.conflicts!.slice(0, 3).map((conflict: { id: string; name: string; startTime: string; endTime: string }, index: number) => (
                            <div key={index} className="text-xs text-red-600 pl-2">
                              • {conflict.name} ({conflict.startTime}-{conflict.endTime})
                            </div>
                          ))}
                          {slot.conflicts!.length > 3 && (
                            <div className="text-xs text-red-500 pl-2">
                              ... and {slot.conflicts!.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isAvailable && (
                        <div className="text-green-600 text-xs mt-2">
                          ✓ Available for booking
                        </div>
                      )}
                      
                      {isLimited && (
                        <div className="text-amber-600 text-xs mt-2">
                          ⚠ Limited availability
                        </div>
                      )}
                      
                      {isFullyBooked && (
                        <div className="text-red-600 text-xs mt-2">
                          ✗ Fully booked
                        </div>
                      )}
                    </div>
                  </div>
                )
                
                return (
                  <div key={`slot-${slot.time}`} className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-center relative h-auto py-3 px-2 text-xs w-full",
                            isAvailable && "border-green-500 bg-green-50 hover:bg-green-200 text-green-800",
                            isLimited && "border-amber-500 bg-amber-50 hover:bg-amber-200 text-amber-800",
                            isFullyBooked && "border-red-300 bg-red-50 text-red-700 opacity-60 cursor-not-allowed hover:bg-red-50",
                            selectedStartTime === slot.time && "ring-2 ring-offset-2 ring-primary",
                          )}
                          onClick={() => slot.available && handleTimeSlotClick(slot.time)}
                          disabled={!slot.available || requiresLogin}
                        >
                          <div className="flex flex-col items-center w-full">
                            <div className="flex items-center gap-1">
                              <span className="font-medium leading-tight">{formatTimeForDisplay(slot.time)}</span>
                              {isAvailable && <CheckCircle className="h-3 w-3 text-green-600" />}
                              {isLimited && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                              {isFullyBooked && <AlertCircle className="h-3 w-3 text-red-600" />}
                            </div>
                            
                            {slot.capacity && slot.occupancy !== undefined && (
                              <div className="flex items-center mt-0.5 text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                <span>{slot.occupancy}/{slot.capacity}</span>
                              </div>
                            )}
                            
                            {slot.occupancy !== undefined && slot.occupancy > 0 && !slot.capacity && (
                              <div className="flex items-center mt-0.5 text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                <span>{slot.occupancy}</span>
                              </div>
                            )}
                            
                            {hasConflicts && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                {slot.conflicts!.length} conflict{slot.conflicts!.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
                    
                    {selectedStartTime === slot.time && hasConflicts && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-10">
                        <Card className="p-2 bg-red-50 border-red-200">
                          <CardContent className="p-0">
                            <p className="text-xs text-red-700 font-medium mb-1">Conflicts:</p>
                            {slot.conflicts!.map((conflict: { id: string; name: string; startTime: string; endTime: string }, index: number) => (
                              <p key={index} className="text-xs text-red-600">
                                {conflict.name} ({conflict.startTime}-{conflict.endTime})
                              </p>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>

      {requiresLogin && selectedStartTime && (
        <Alert className="flex-shrink-0 mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Login Required</AlertTitle>
          <AlertDescription>
            You need to log in to complete your reservation. Click "Continue to Login" below.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
