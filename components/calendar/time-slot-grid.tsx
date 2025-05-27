"use client"

import { useState, useEffect } from "react"
import { format, addMinutes, parse, differenceInMinutes } from "date-fns"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, Users, Info, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"

interface TimeSlotGridProps {
  timeSlots: {
    time: string
    available: boolean
    status: string
    occupancy?: number
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
          {/* Changed from grouped by hour to a simple responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
            {sortedTimeSlots.map((slot: { time: string; available: boolean; status: string; occupancy?: number }) => (
              <Button
                key={`slot-${slot.time}`}
                variant="outline"
                size="sm"
                className={cn(
                  "justify-center relative h-auto py-3 px-2 text-xs w-full",
                  slot.status === "available" && "border-green-500 bg-green-50 hover:bg-green-200 text-green-800",
                  slot.status === "limited" && "border-amber-500 bg-amber-50 hover:bg-amber-200 text-amber-800",
                  !slot.available &&
                    "border-red-300 bg-red-50 text-red-700 opacity-60 cursor-not-allowed hover:bg-red-50",
                  selectedStartTime === slot.time && "ring-2 ring-offset-2 ring-primary",
                )}
                onClick={() => slot.available && handleTimeSlotClick(slot.time)}
                disabled={!slot.available || requiresLogin}
              >
                <div className="flex flex-col items-center w-full">
                  <span className="font-medium leading-tight">{formatTimeForDisplay(slot.time)}</span>
                  {slot.occupancy !== undefined && slot.occupancy > 0 && (
                    <div className="flex items-center mt-0.5 text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      <span>{slot.occupancy}</span>
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
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
