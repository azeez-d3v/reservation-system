"use client"

import { useState, useEffect } from "react"
import { format, addMinutes, parse, differenceInMinutes } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAvailableTimeSlots, getSystemSettings } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Clock, CalendarIcon, AlertCircle, Users, Info, Edit2, ChevronDown, ChevronUp, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface TimeSlot {
  time: string
  available: boolean
  status: string
  occupancy: number
  capacity: number
}

interface ReservationTimeSlotsProps {
  selectedDate: Date
  onTimeSelected: (startTime: string, endTime: string) => void
  onBack: () => void
  initialStartTime?: string
}

export function ReservationTimeSlots({
  selectedDate,
  onTimeSelected,
  onBack,
  initialStartTime,
}: ReservationTimeSlotsProps) {
  const { toast } = useToast()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(initialStartTime || null)
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [availableEndTimes, setAvailableEndTimes] = useState<string[]>([])
  const [allowOverlapping, setAllowOverlapping] = useState(false)
  const [use12HourFormat, setUse12HourFormat] = useState(true)
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [durationOptions, setDurationOptions] = useState<number[]>([30, 60, 90, 120, 180, 240])
  const [selectedDuration, setSelectedDuration] = useState<number>(60)
  const [hasOverlap, setHasOverlap] = useState(false)
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(240)
  const [operationalHours, setOperationalHours] = useState({ start: "08:00", end: "17:00" })
  const [isTimePickerExpanded, setIsTimePickerExpanded] = useState(!initialStartTime)
  const [showReservationDetails, setShowReservationDetails] = useState(!!initialStartTime)

  // Fetch available time slots and system settings for the selected date
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [slots, settings] = await Promise.all([getAvailableTimeSlots(selectedDate), getSystemSettings()])

        // Sort time slots chronologically
        const sortedSlots = [...slots].sort((a, b) => {
          const timeA = a.time.split(":").map(Number)
          const timeB = b.time.split(":").map(Number)

          if (timeA[0] !== timeB[0]) {
            return timeA[0] - timeB[0] // Sort by hour
          }
          return timeA[1] - timeB[1] // Sort by minute
        })

        // Add occupancy info to time slots
        const slotsWithOccupancy = sortedSlots.map((slot) => ({
          ...slot,
          occupancy: slot.status === "available" ? 0 : slot.status === "limited" ? 1 : 2,
          capacity: 3, // Mock capacity value - in a real app, this would come from the backend
        }))

        setTimeSlots(slotsWithOccupancy)
        setSystemSettings(settings)
        setAllowOverlapping(settings.allowOverlapping)
        setUse12HourFormat(settings.use12HourFormat !== false) // Default to true if not specified

        // Set operational hours
        if (settings.timeSlotSettings?.businessHours) {
          const dayOfWeek = selectedDate.getDay()
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
          const daySchedule = settings.timeSlotSettings.businessHours[dayNames[dayOfWeek]]

          if (daySchedule && daySchedule.enabled && daySchedule.timeSlots.length > 0) {
            const firstSlot = daySchedule.timeSlots[0]
            const lastSlot = daySchedule.timeSlots[daySchedule.timeSlots.length - 1]

            setOperationalHours({
              start: firstSlot.start,
              end: lastSlot.end,
            })
          }
        }

        // Set duration options based on system settings
        const minDuration = settings.timeSlotSettings?.minDuration || 30
        const maxDuration = settings.timeSlotSettings?.maxDuration || 240
        const interval = settings.timeSlotSettings?.timeSlotInterval || 30

        const options: number[] = []
        for (let i = minDuration; i <= maxDuration; i += interval) {
          options.push(i)
        }
        setDurationOptions(options)
        setSelectedDuration(minDuration)

        // If we have an initial start time, select it
        if (initialStartTime) {
          setSelectedStartTime(initialStartTime)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
        toast({
          title: "Error",
          description: "Failed to load available time slots",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedDate, toast, initialStartTime])

  // Update available end times when start time changes
  useEffect(() => {
    if (selectedStartTime && timeSlots.length > 0 && systemSettings) {
      // Find the index of the selected start time
      const startIndex = timeSlots.findIndex((slot) => slot.time === selectedStartTime)
      if (startIndex === -1) return

      // Calculate the maximum possible duration based on operational hours
      const startTimeObj = parse(selectedStartTime, "HH:mm", new Date())
      const gymCloseTime = parse(operationalHours.end, "HH:mm", new Date())

      // Calculate minutes until gym closes
      const minutesUntilClose = differenceInMinutes(gymCloseTime, startTimeObj)

      // Set the maximum possible duration based on gym closing time only
      const calculatedMaxDuration = minutesUntilClose
      setMaxPossibleDuration(calculatedMaxDuration)

      // Update duration options based on the new maximum duration
      const systemMinDuration = systemSettings?.timeSlotSettings?.minDuration || 30
      const systemInterval = systemSettings?.timeSlotSettings?.timeSlotInterval || 30
      
      const newDurationOptions: number[] = []
      for (let duration = systemMinDuration; duration <= calculatedMaxDuration; duration += systemInterval) {
        newDurationOptions.push(duration)
      }
      
      // Only update duration options if they're actually different
      setDurationOptions(prev => {
        if (prev.length !== newDurationOptions.length || 
            !prev.every((val, index) => val === newDurationOptions[index])) {
          return newDurationOptions
        }
        return prev
      })

      // Adjust selected duration if it exceeds the maximum
      if (selectedDuration > calculatedMaxDuration) {
        setSelectedDuration(Math.floor(calculatedMaxDuration / 30) * 30) // Round down to nearest 30 min
      }

      // Calculate end time based on selected duration
      const endTimeObj = addMinutes(startTimeObj, selectedDuration)
      const calculatedEndTime = format(endTimeObj, "HH:mm")

      // Check for overlaps with existing bookings
      let hasConflict = false
      for (let i = startIndex; i < timeSlots.length; i++) {
        const currentTime = timeSlots[i].time
        // If we've reached or passed the end time, break
        if (currentTime >= calculatedEndTime) break

        // If this slot is not available and we're not allowing overlaps, there's a conflict
        if (!timeSlots[i].available && !allowOverlapping) {
          hasConflict = true
          break
        }
      }

      setHasOverlap(hasConflict)

      // Generate available end times based on operational hours and existing bookings
      const endTimes: string[] = []

      // Use the newly calculated duration options directly
      const availableDurations = newDurationOptions

      for (const duration of availableDurations) {
        const potentialEndTime = format(addMinutes(startTimeObj, duration), "HH:mm")

        // Check if end time is within operational hours
        if (potentialEndTime <= operationalHours.end) {
          // Check if all slots between start and end are available or we allow overlapping
          let isAvailable = true

          if (!allowOverlapping) {
            // Find the end time index
            const endTimeIndex = timeSlots.findIndex((slot) => slot.time === potentialEndTime)

            // Check all slots between start and end
            for (let i = startIndex + 1; i < endTimeIndex; i++) {
              if (i >= 0 && i < timeSlots.length && !timeSlots[i].available) {
                isAvailable = false
                break
              }
            }
          }

          if (isAvailable || allowOverlapping) {
            endTimes.push(potentialEndTime)
          }
        }
      }

      setAvailableEndTimes(endTimes)

      // Set the end time if it's valid
      if (endTimes.includes(calculatedEndTime)) {
        setSelectedEndTime(calculatedEndTime)
      } else if (endTimes.length > 0) {
        // Otherwise, select the first available end time
        setSelectedEndTime(endTimes[0])
      } else {
        setSelectedEndTime(null)
      }
    }
  }, [
    selectedStartTime,
    selectedDuration,
    timeSlots,
    allowOverlapping,
    operationalHours,
    systemSettings,
  ])

  // Format time for display (12-hour or 24-hour)
  const formatTimeForDisplay = (time: string) => {
    if (!use12HourFormat) return time

    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }

  // Handle start time selection
  const handleStartTimeClick = (time: string) => {
    setSelectedStartTime(time === selectedStartTime ? null : time)
    if (time !== selectedStartTime) {
      // Auto-collapse time picker and show reservation details when time is selected
      setIsTimePickerExpanded(false)
      setShowReservationDetails(true)
    }
  }

  // Handle duration selection
  const handleDurationChange = (value: string) => {
    setSelectedDuration(Number.parseInt(value))
  }

  // Handle continue button click
  const handleContinue = () => {
    if (selectedStartTime && selectedEndTime) {
      onTimeSelected(selectedStartTime, selectedEndTime)
    }
  }

  // Handle edit time button click
  const handleEditTime = () => {
    setIsTimePickerExpanded(true)
    setShowReservationDetails(false)
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

  // Toggle allowing overlapping reservations
  const handleOverlappingToggle = (checked: boolean) => {
    setAllowOverlapping(checked)
  }

  // Get the selected time slot details
  const getSelectedTimeSlotDetails = () => {
    if (!selectedStartTime) return null
    return timeSlots.find((slot) => slot.time === selectedStartTime)
  }

  const selectedSlot = getSelectedTimeSlotDetails()

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Time Selection Card */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Select Time
              </CardTitle>
              <CardDescription>Choose a start time and duration for your reservation</CardDescription>
            </div>
            <div className="flex items-center text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
              <Skeleton className="h-8 w-full mt-4" />
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No available time slots for the selected date.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Operational Hours Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Gymnasium Hours</AlertTitle>
                <AlertDescription>
                  The gymnasium is open from {formatTimeForDisplay(operationalHours.start)} to{" "}
                  {formatTimeForDisplay(operationalHours.end)}. Reservations must end by closing time.
                </AlertDescription>
              </Alert>

              {/* Overlapping Toggle */}
              {systemSettings?.allowOverlapping && (
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                  <Switch id="allow-overlapping" checked={allowOverlapping} onCheckedChange={handleOverlappingToggle} />
                  <Label htmlFor="allow-overlapping" className="text-sm font-medium">
                    Allow overlapping reservations
                  </Label>
                </div>
              )}

              {/* Collapsible Time Picker */}
              <Collapsible open={isTimePickerExpanded} onOpenChange={setIsTimePickerExpanded}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "w-full justify-between p-4 h-auto",
                      selectedStartTime && "bg-blue-50 border-blue-200 hover:bg-blue-100"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">
                          {selectedStartTime ? "Time Selected" : "Select Time Slot"}
                        </div>
                        {selectedStartTime && (
                          <div className="text-sm text-muted-foreground">
                            {formatTimeForDisplay(selectedStartTime)}
                          </div>
                        )}
                      </div>
                    </span>
                    {isTimePickerExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-4">
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        Available Time Slots
                      </CardTitle>
                      <CardDescription>
                        Select your preferred start time from the available slots below
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[60vh] overflow-y-auto pr-2">
                        {/* Changed from grouped display to single responsive grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {timeSlots.map((slot) => (
                            <Button
                              key={`start-${slot.time}`}
                              variant="outline"
                              size="lg"
                              className={cn(
                                "h-auto py-4 px-3 relative flex flex-col items-center justify-center transition-all duration-200 group",
                                "border-2 rounded-xl shadow-sm hover:shadow-md overflow-hidden",
                                // Styling based on availability and overlapping settings
                                allowOverlapping && "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 hover:border-blue-300",
                                !allowOverlapping &&
                                  slot.status === "available" &&
                                  "border-green-200 bg-green-50 hover:bg-green-100 text-green-800 hover:border-green-300",
                                !allowOverlapping &&
                                  slot.status === "limited" &&
                                  "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:border-amber-300",
                                !allowOverlapping &&
                                  !slot.available &&
                                  "border-red-200 bg-red-50 text-red-600 opacity-50 cursor-not-allowed hover:bg-red-50",
                                selectedStartTime === slot.time && "ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg border-blue-400"
                              )}
                              onClick={() => (allowOverlapping || slot.available) && handleStartTimeClick(slot.time)}
                              disabled={!allowOverlapping && !slot.available}
                            >
                              <span className="text-sm font-semibold mb-1">
                                {formatTimeForDisplay(slot.time)}
                              </span>
                              {slot.occupancy > 0 && (
                                <div className="flex items-center text-xs opacity-75">
                                  <Users className="h-3 w-3 mr-1" />
                                  <span>{slot.occupancy}/{slot.capacity}</span>
                                </div>
                              )}
                              <div className="text-xs mt-1 opacity-60">
                                {allowOverlapping 
                                  ? "Available" 
                                  : slot.status === "available" 
                                    ? "Open" 
                                    : slot.status === "limited" 
                                      ? "Limited" 
                                      : "Full"
                                }
                              </div>
                              
                              {/* Check mark positioned in top-left corner */}
                              {selectedStartTime === slot.time && (
                                <div className="absolute top-2 left-2">
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white stroke-2" />
                                  </div>
                                </div>
                              )}
                              
                              {/* Occupancy badge positioned in top-right corner */}
                              {slot.occupancy > 0 && allowOverlapping && (
                                <span className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">
                                  {slot.occupancy}
                                </span>
                              )}
                            </Button>

                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {/* Reservation Details Section */}
              {selectedStartTime && showReservationDetails && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Clock className="h-5 w-5 text-blue-600" />
                          </div>
                          Reservation Details
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Review and customize your reservation settings
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditTime}
                        className="flex items-center gap-2 bg-white hover:bg-blue-50 border-blue-200"
                      >
                        <Edit2 className="h-4 w-4" />
                        Change Time
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Selected Time Display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-full">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Start Time</div>
                            <div className="text-sm text-gray-500">Selected slot</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 px-3 py-1 text-sm font-semibold">
                          {formatTimeForDisplay(selectedStartTime)}
                        </Badge>
                      </div>

                      {/* Availability Info */}
                      {selectedSlot && (
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">Availability</div>
                              <div className="text-sm text-gray-500">
                                {selectedSlot.occupancy}/{selectedSlot.capacity} reserved
                              </div>
                            </div>
                          </div>
                          <Badge 
                            variant={selectedSlot.occupancy === 0 ? "default" : selectedSlot.occupancy >= selectedSlot.capacity ? "destructive" : "secondary"}
                            className="px-3 py-1 text-sm font-semibold"
                          >
                            {selectedSlot.occupancy === 0 ? "Available" : selectedSlot.occupancy >= selectedSlot.capacity ? "Full" : "Limited"}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Duration Selection */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <Label htmlFor="duration" className="text-base font-medium text-gray-900">Duration</Label>
                          <p className="text-sm text-gray-500 mt-1">How long do you need the gymnasium?</p>
                        </div>
                        <span className="text-sm text-blue-600 font-medium">
                          Max: {formatDuration(maxPossibleDuration)}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <Select value={selectedDuration.toString()} onValueChange={handleDurationChange}>
                          <SelectTrigger id="duration" className="bg-white border-blue-200 h-12 text-base">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            {durationOptions
                              .filter((duration) => duration <= maxPossibleDuration)
                              .map((duration) => (
                                <SelectItem key={duration} value={duration.toString()} className="text-base">
                                  {formatDuration(duration)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <div className="space-y-3">
                          <Progress value={(selectedDuration / maxPossibleDuration) * 100} className="h-3" />
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>30 min</span>
                            <span className="font-medium">{formatDuration(selectedDuration)}</span>
                            <span>{Math.floor(maxPossibleDuration / 60)}h max</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Conflict Warning */}
                    {hasOverlap && !allowOverlapping && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Scheduling Conflict</AlertTitle>
                        <AlertDescription>
                          The selected time slot overlaps with existing reservations. Please choose a different
                          time or enable "Allow overlapping reservations".
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Final Reservation Summary */}
                    {selectedEndTime && (
                      <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg">
                        <div className="text-center space-y-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="p-2 bg-white/20 rounded-full">
                              <Clock className="h-5 w-5" />
                            </div>
                            <span className="text-lg font-semibold">Final Reservation</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {formatTimeForDisplay(selectedStartTime)} - {formatTimeForDisplay(selectedEndTime)}
                          </div>
                          <div className="text-blue-100 font-medium">
                            Duration: {formatDuration(selectedDuration)}
                          </div>
                          <div className="text-sm text-blue-100 mt-2">
                            {format(selectedDate, "EEEE, MMMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Button
            onClick={handleContinue}
            disabled={!selectedStartTime || !selectedEndTime || (hasOverlap && !allowOverlapping)}
            className="w-full sm:w-auto"
          >
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
