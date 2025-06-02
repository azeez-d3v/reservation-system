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
import { TimeSlotSettings } from "@/lib/types"

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
  timeSlotSettings?: TimeSlotSettings
  systemSettings?: any
  operationalHours?: { start: string; end: string }
}

export function TimeSlotGrid({
  timeSlots,
  onSelectTimeSlot,
  requiresLogin = false,
  selectedTime,
  selectedDate,
  use12HourFormat = true,
  hasOverlappingReservations = false,
  timeSlotSettings,
  systemSettings,
  operationalHours: propOperationalHours,
}: TimeSlotGridProps) {const [sortedTimeSlots, setSortedTimeSlots] = useState<any[]>([])
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(selectedTime || null)
  const [selectedDuration, setSelectedDuration] = useState<number>(timeSlotSettings?.minDuration || 60)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [durationOptions, setDurationOptions] = useState<number[]>([])
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(240)
  const [operationalHours, setOperationalHours] = useState(propOperationalHours || { start: "08:00", end: "17:00" })
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
  }, [timeSlots, selectedTime])  // Setup duration options and operational hours based on settings
  useEffect(() => {
    if (timeSlotSettings) {
      // Calculate dynamic duration options based on business hours
      const calculateMaxPossibleDuration = () => {
        if (!timeSlotSettings?.businessHours) return 540 // Default 9 hours

        let maxDuration = 0

        // Check all enabled days and find the longest possible duration
        const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        
        for (const dayName of dayNames) {
          const daySchedule = timeSlotSettings.businessHours[dayName]
          if (daySchedule?.enabled && daySchedule.timeSlot) {
            const startTime = parse(daySchedule.timeSlot.start, "HH:mm", new Date())
            const endTime = parse(daySchedule.timeSlot.end, "HH:mm", new Date())
            const dayDuration = differenceInMinutes(endTime, startTime)
            
            if (dayDuration > maxDuration) {
              maxDuration = dayDuration
            }
          }
        }

        return maxDuration > 0 ? maxDuration : 540 // Default to 9 hours if no valid days found
      }

      const maxPossibleDuration = calculateMaxPossibleDuration()
      const minDuration = timeSlotSettings?.minDuration || 30
      const interval = 30 // Generate options in 30-minute intervals
      
      // Generate dynamic options from minimum duration up to maximum possible duration
      const dynamicOptions: number[] = []
      
      for (let duration = minDuration; duration <= maxPossibleDuration; duration += interval) {
        dynamicOptions.push(duration)
      }
      
      // Ensure we have at least the minimum duration option
      if (dynamicOptions.length === 0 && maxPossibleDuration >= minDuration) {
        dynamicOptions.push(minDuration)
      }
      
      setDurationOptions(dynamicOptions)
      setMaxPossibleDuration(maxPossibleDuration)

      // Set initial duration if not already set
      if (!selectedTime && selectedDuration === (timeSlotSettings?.minDuration || 60)) {
        setSelectedDuration(minDuration)
      }// Set operational hours from business hours if available and selectedDate is provided
      if (timeSlotSettings.businessHours && selectedDate) {
        const dayOfWeek = selectedDate.getDay()
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]

        if (daySchedule && daySchedule.enabled && daySchedule.timeSlot) {
          setOperationalHours({
            start: daySchedule.timeSlot.start,
            end: daySchedule.timeSlot.end,
          })
        }
      }
    } else {
      // Fallback to default values when no settings are provided
      setDurationOptions([30, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540])
      setMaxPossibleDuration(540)
    }

    // Update operational hours from props if provided
    if (propOperationalHours) {
      setOperationalHours(propOperationalHours)
    }
  }, [timeSlotSettings, selectedDate, propOperationalHours, selectedTime, selectedDuration])

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
  }  // Generate duration options based on maximum possible duration and admin settings
  const generateDurationOptions = (maxDuration: number) => {
    const minDuration = timeSlotSettings?.minDuration || 30
    const interval = 30 // Generate options in 30-minute intervals
    const options: number[] = []

    // Generate dynamic options from minimum duration up to maxDuration
    for (let duration = minDuration; duration <= maxDuration; duration += interval) {
      options.push(duration)
    }

    // Ensure we have at least the minimum duration option
    if (options.length === 0 && maxDuration >= minDuration) {
      options.push(minDuration)
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
  }  return (
    <div className="flex flex-col h-full w-full">
      {hasOverlappingReservations && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 w-full">
          <div className="flex items-start">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Limited Availability</h4>
              <p className="text-xs sm:text-sm text-amber-800">
                Time slots with limited availability are shown in amber with a warning icon. Hover over any time slot for more details.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 w-full min-h-0">
        <h3 className="text-sm font-semibold mb-2 flex-shrink-0">Available Time Slots</h3>
        <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 w-full">
          <TooltipProvider delayDuration={100}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-2 w-full">
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
                        {systemSettings?.allowOverlapping && slot.capacity && slot.occupancy !== undefined && (
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
                      
                      {systemSettings?.allowOverlapping && slot.occupancy !== undefined && slot.occupancy > 0 && !slot.capacity && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>Current bookings: {slot.occupancy}</span>
                        </div>
                      )}
                        {hasConflicts && (
                        <div className="border-t pt-2 mt-2">
                          <div className="text-red-600 font-medium mb-1 flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            <span>{slot.conflicts!.length} Reservation{slot.conflicts!.length > 1 ? 's' : ''} at this time</span>
                          </div>
                          <div className="text-xs text-red-600">
                            This time slot has limited availability due to existing reservations.
                          </div>
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
                          size="sm"                          className={cn(
                            "justify-center relative h-10 py-2 px-1 text-xs sm:text-sm w-full",
                            isAvailable && "border-green-500 bg-green-50 hover:bg-green-100 text-green-800 shadow-sm",
                            isLimited && "border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-800 shadow-sm",
                            isFullyBooked && "border-red-300 bg-red-50 text-red-700 opacity-70 cursor-not-allowed hover:bg-red-50",
                            selectedStartTime === slot.time && "shadow",
                          )}
                          onClick={() => slot.available && handleTimeSlotClick(slot.time)}
                          disabled={!slot.available}
                        >
                          <div className="flex flex-col items-center w-full">
                            <div className="flex items-center gap-1">
                              <span className="font-medium leading-tight">{formatTimeForDisplay(slot.time)}</span>
                              {isAvailable && <CheckCircle className="h-3 w-3 text-green-600" />}
                              {isLimited && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                              {isFullyBooked && <AlertCircle className="h-3 w-3 text-red-600" />}
                            </div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" sideOffset={5} className="z-50 max-w-[200px] sm:max-w-xs">
                        {tooltipContent}
                      </TooltipContent>
                    </Tooltip>
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
