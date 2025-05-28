"use client"

import { useState, useEffect, useRef } from "react"
import { format, addMinutes, parse, differenceInMinutes } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAvailableSlots, getSettings, getTimeSlots, fetchAlternativeDates, validateTimeSlot, getEnhancedAvailability, type ValidationResult } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Clock, CalendarIcon, AlertCircle, Users, Info, Edit2, ChevronDown, ChevronUp, Check, Calendar } from "lucide-react"
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
  status: "available" | "limited" | "full" | "unavailable"
  occupancy: number
  capacity: number
  conflicts?: Array<{
    id: string
    name: string
    startTime: string
    endTime: string
  }>
}

interface ReservationTimeSlotsProps {
  selectedDate: Date
  onTimeSelected: (startTime: string, endTime: string) => void
  onBack: () => void
  initialStartTime?: string
  initialDuration?: number
}

export function ReservationTimeSlots({
  selectedDate,
  onTimeSelected,
  onBack,
  initialStartTime,
  initialDuration,
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
  const [timeSlotSettings, setTimeSlotSettings] = useState<any>(null)
  const [durationOptions, setDurationOptions] = useState<number[]>([30, 60, 90, 120, 180, 240])
  const [selectedDuration, setSelectedDuration] = useState<number>(initialDuration || 60)
  const [hasOverlap, setHasOverlap] = useState(false)
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(240)
  const [operationalHours, setOperationalHours] = useState({ start: "08:00", end: "17:00" })
  const [isTimePickerExpanded, setIsTimePickerExpanded] = useState(!initialStartTime)
  const [showReservationDetails, setShowReservationDetails] = useState(!!initialStartTime)
  const [alternativeDates, setAlternativeDates] = useState<Array<{ date: string; displayDate: string; relative?: string }>>([])
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  
  // Ref to track the last alternative dates request to prevent duplicates
  const lastAlternativesRequestRef = useRef<string>("")
  // Get selected slot information for display
  const selectedSlotInfo = selectedStartTime 
    ? timeSlots.find(slot => slot.time === selectedStartTime)
    : null

  // Fetch available time slots and system settings for the selected date
  useEffect(() => {
    // Use AbortController to cancel previous requests if component unmounts or effect reruns
    const abortController = new AbortController();
    
    const fetchData = async () => {
      setIsLoading(true)
      
      // Start a timeout to detect slow requests
      const timeoutId = setTimeout(() => {
        console.log("Time slots data fetch is taking longer than expected");
      }, 2000);
      
      try {        // Make the requests in parallel to improve performance
        const [enhancedData, settings, timeSlotSettings] = await Promise.all([
          getEnhancedAvailability(selectedDate), 
          getSettings(), 
          getTimeSlots()
        ])
        
        // Clear timeout as request completed
        clearTimeout(timeoutId);
        
        if (abortController.signal.aborted) return;

        // Process enhanced time slot data
        const timeSlots = enhancedData.timeSlots || []
        
        // Sort time slots chronologically
        const sortedSlots = [...timeSlots].sort((a, b) => {
          const timeA = a.time.split(":").map(Number)
          const timeB = b.time.split(":").map(Number)

          if (timeA[0] !== timeB[0]) {
            return timeA[0] - timeB[0] // Sort by hour
          }
          return timeA[1] - timeB[1] // Sort by minute
        })

        // Ensure proper data structure with enhanced information
        const slotsWithEnhancedData = sortedSlots.map((slot) => ({
          ...slot,
          occupancy: slot.occupancy || slot.conflicts?.length || 0,
          capacity: slot.capacity || (settings.maxOverlappingReservations || 3),
          status: (slot.status as "available" | "limited" | "full" | "unavailable") || "available",
          conflicts: slot.conflicts || []
        }))

        setTimeSlots(slotsWithEnhancedData)
        setSystemSettings(settings)
        setTimeSlotSettings(timeSlotSettings)
        setAllowOverlapping(settings.allowOverlapping)
        setUse12HourFormat(settings.use12HourFormat !== false) // Default to true if not specified

        // Set operational hours
        if (timeSlotSettings?.businessHours) {
          const dayOfWeek = selectedDate.getDay()
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
          const daySchedule = timeSlotSettings.businessHours[dayNames[dayOfWeek]]

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
        const minDuration = timeSlotSettings?.minDuration || 30
        const maxDuration = timeSlotSettings?.maxDuration || 240
        const interval = timeSlotSettings?.timeSlotInterval || 30

        const options: number[] = []
        for (let i = minDuration; i <= maxDuration; i += interval) {
          options.push(i)
        }
        setDurationOptions(options)
        
        // Set the initial duration - prioritize the passed initial duration
        const initialSelectedDuration = initialDuration || minDuration
        setSelectedDuration(initialSelectedDuration)

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
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()
    
    // Cleanup function to abort fetch if component unmounts or effect reruns
    return () => {
      abortController.abort();
    }
  }, [selectedDate, toast, initialStartTime, initialDuration])

  // Handle initial duration prop changes
  useEffect(() => {
    if (initialDuration) {
      setSelectedDuration(initialDuration)
    }
  }, [initialDuration])

  // Update available end times when start time changes
  useEffect(() => {
    if (selectedStartTime && timeSlots.length > 0 && timeSlotSettings) {
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
      const systemMinDuration = timeSlotSettings?.minDuration || 30
      const systemInterval = timeSlotSettings?.timeSlotInterval || 30
      
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
    timeSlotSettings,
  ])  // Real-time validation when time slot is selected
  useEffect(() => {
    const performValidation = async () => {
      if (!selectedStartTime || !selectedEndTime) {
        setValidationResult(null)
        return
      }

      setIsValidating(true)
      try {
        const backendResult = await validateTimeSlot(
          selectedDate,
          selectedStartTime,
          selectedEndTime,
          allowOverlapping ? undefined : "no-overlap"
        )
        
        // Map backend result to ValidationResult interface
        const mappedResult: ValidationResult = {
          isValid: backendResult.isValid,
          errors: backendResult.errors,
          warnings: backendResult.warnings,
          conflictingReservations: backendResult.conflictDetails.overlappingReservations,
          availabilityStatus: backendResult.canProceed ? 'available' : 'full',
          maxConcurrentReservations: backendResult.conflictDetails.maxCapacity,
          currentOccupancy: backendResult.conflictDetails.worstOccupancy,
          detailedConflictInfo: {
            worstSlotOccupancy: backendResult.conflictDetails.worstOccupancy,
            totalConflictingReservations: backendResult.conflictDetails.totalConflicts,
            affectedTimeSlots: [],
            recommendedAlternatives: backendResult.recommendedAlternatives
          }
        }
        
        setValidationResult(mappedResult)
      } catch (error) {
        console.error("Validation error:", error)
        setValidationResult({
          isValid: false,
          errors: ["Failed to validate time slot"],
          warnings: [],
          conflictingReservations: [],
          availabilityStatus: 'unavailable'
        })
      } finally {
        setIsValidating(false)
      }
    }

    performValidation()
  }, [selectedStartTime, selectedEndTime, selectedDate, allowOverlapping])  // Check if all slots are unavailable and fetch alternatives
  useEffect(() => {
    const checkAvailabilityAndFetchAlternatives = async () => {
      if (timeSlots.length === 0) return

      const allSlotsUnavailable = timeSlots.every(slot => 
        slot.status === "full" || slot.status === "unavailable" || !slot.available
      )

      if (allSlotsUnavailable && selectedStartTime && !isLoadingAlternatives) {
        // Create a unique key for this request
        const requestKey = `${selectedDate.toISOString().split('T')[0]}-${selectedStartTime}-${selectedEndTime || "18:00"}`
        
        // Skip if this is the same request as the last one
        if (lastAlternativesRequestRef.current === requestKey) {
          return
        }
        
        lastAlternativesRequestRef.current = requestKey
        setIsLoadingAlternatives(true)
        setShowAlternatives(true)
        
        try {
          const result = await fetchAlternativeDates(
            selectedDate.toISOString().split('T')[0],
            selectedStartTime,
            selectedEndTime || "18:00", // Default end time
            5
          )

          if (result.success) {
            setAlternativeDates(result.alternatives)
            if (result.alternatives.length > 0) {
              toast({
                title: "Alternative Dates Available",
                description: `Found ${result.alternatives.length} alternative date${result.alternatives.length > 1 ? 's' : ''} for the same time slot.`,
                variant: "default",
              })
            }
          } else {
            console.warn("No alternative dates found:", result.error)
          }
        } catch (error) {
          console.error("Error fetching alternative dates:", error)
        } finally {
          setIsLoadingAlternatives(false)
        }
      } else if (!allSlotsUnavailable) {
        setShowAlternatives(false)
        setAlternativeDates([])
        lastAlternativesRequestRef.current = "" // Reset the ref when alternatives are not needed
      }
    }

    checkAvailabilityAndFetchAlternatives()
  }, [timeSlots, selectedStartTime, selectedEndTime, selectedDate, toast])

  // Format time for display (12-hour or 24-hour)
  const formatTimeForDisplay = (time: string) => {
    if (!use12HourFormat) return time

    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }
  // Handle start time selection with enhanced validation and error handling
  const handleStartTimeClick = async (time: string) => {
    // Toggle selection if clicking the same time
    if (time === selectedStartTime) {
      setSelectedStartTime(null)
      setValidationResult(null)
      setIsTimePickerExpanded(true)
      setShowReservationDetails(false)
      return
    }

    // Set the selected time immediately for UI responsiveness
    setSelectedStartTime(time)
    setIsTimePickerExpanded(false)
    setShowReservationDetails(true)

    // Perform enhanced validation if we have enough information
    try {
      setIsValidating(true)
      setValidationResult(null)

      // Basic time slot validation
      const selectedSlot = timeSlots.find(slot => slot.time === time)
      if (!selectedSlot) {
        throw new Error('Selected time slot not found')
      }

      // Check if slot is available (unless overlapping is allowed)
      if (!allowOverlapping && !selectedSlot.available) {        setValidationResult({
          isValid: false,
          errors: ['This time slot is not available for new reservations'],
          warnings: [],
          conflictingReservations: [], // We'll map this properly later
          availabilityStatus: 'full',
          detailedConflictInfo: {
            worstSlotOccupancy: selectedSlot.occupancy,
            totalConflictingReservations: selectedSlot.conflicts?.length || 0,
            affectedTimeSlots: [time],
            recommendedAlternatives: [
              'Try selecting a different time slot',
              'Enable overlapping reservations if appropriate',
              'Check alternative dates using the suggestions above'
            ]
          }
        })
        return
      }

      // Enhanced validation for capacity and conflicts
      if (selectedSlot.occupancy >= selectedSlot.capacity && !allowOverlapping) {        setValidationResult({
          isValid: false,
          errors: ['This time slot has reached maximum capacity'],
          warnings: [],
          conflictingReservations: [], // We'll map this properly later
          availabilityStatus: 'full',
          maxConcurrentReservations: selectedSlot.capacity,
          currentOccupancy: selectedSlot.occupancy,
          detailedConflictInfo: {
            worstSlotOccupancy: selectedSlot.occupancy,
            totalConflictingReservations: selectedSlot.conflicts?.length || 0,
            affectedTimeSlots: [time],
            recommendedAlternatives: [
              'Select a different time slot with available capacity',
              'Consider enabling overlapping reservations',
              'Contact administration for capacity adjustments'
            ]
          }
        })
        return
      }

      // Success validation result
      const warnings: string[] = []
      if (selectedSlot.occupancy > 0) {
        warnings.push(`This time slot already has ${selectedSlot.occupancy} reservation${selectedSlot.occupancy > 1 ? 's' : ''}`)
      }
      if (allowOverlapping && selectedSlot.occupancy >= selectedSlot.capacity) {
        warnings.push('This slot is at or over capacity - overlapping is enabled')
      }      setValidationResult({
        isValid: true,
        errors: [],
        warnings,
        conflictingReservations: [], // We'll map this properly later
        availabilityStatus: selectedSlot.occupancy === 0 ? 'available' : 'limited',
        maxConcurrentReservations: selectedSlot.capacity,
        currentOccupancy: selectedSlot.occupancy,
        detailedConflictInfo: {
          worstSlotOccupancy: selectedSlot.occupancy,
          totalConflictingReservations: selectedSlot.conflicts?.length || 0,
          affectedTimeSlots: [time],
          recommendedAlternatives: []
        }
      })

    } catch (error) {
      console.error('Error during time slot selection:', error)
      
      // User-friendly error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      setValidationResult({
        isValid: false,
        errors: [
          'Unable to validate time slot selection',
          `Details: ${errorMessage}`,
          'Please try again or contact support if the issue persists'
        ],
        warnings: [],
        conflictingReservations: [],
        availabilityStatus: 'unavailable',
        detailedConflictInfo: {
          worstSlotOccupancy: 0,
          totalConflictingReservations: 0,
          affectedTimeSlots: [time],
          recommendedAlternatives: [
            'Refresh the page and try again',
            'Select a different time slot',
            'Contact technical support if the problem continues'
          ]
        }
      })

      // Show user-friendly toast notification
      toast({
        title: "Validation Error",
        description: "There was an issue validating your time slot selection. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
    }
  }

  // Handle duration selection
  const handleDurationChange = (value: string) => {
    setSelectedDuration(Number.parseInt(value))
  }
  // Handle continue button click with enhanced validation and conflict prevention
  const handleContinue = async () => {
    if (!selectedStartTime || !selectedEndTime) {
      toast({
        title: "Incomplete Selection",
        description: "Please select both start time and duration before continuing.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsValidating(true)

      // Final validation before proceeding to prevent race conditions
      const finalValidation = await validateTimeSlot(
        selectedDate,
        selectedStartTime,
        selectedEndTime,
        allowOverlapping ? undefined : "no-overlap"
      )

      if (!finalValidation.isValid) {
        // Show detailed validation errors
        const errorMessages = finalValidation.errors || ['Time slot validation failed']
        
        toast({
          title: "Validation Failed",
          description: errorMessages[0] || "Unable to proceed with this time slot",
          variant: "destructive",
        })

        // Update validation result to show the issues
        setValidationResult({
          isValid: false,
          errors: errorMessages,
          warnings: finalValidation.warnings || [],
          conflictingReservations: finalValidation.conflictDetails?.overlappingReservations || [],
          availabilityStatus: 'unavailable',
          detailedConflictInfo: {
            worstSlotOccupancy: finalValidation.conflictDetails?.worstOccupancy || 0,
            totalConflictingReservations: finalValidation.conflictDetails?.totalConflicts || 0,
            affectedTimeSlots: [selectedStartTime],
            recommendedAlternatives: finalValidation.recommendedAlternatives || [
              'Try selecting a different time slot',
              'Check alternative dates above',
              'Contact support for assistance'
            ]
          }
        })
        return
      }

      // Show any warnings but allow to proceed
      if (finalValidation.warnings && finalValidation.warnings.length > 0) {
        toast({
          title: "Important Information",
          description: finalValidation.warnings[0],
          variant: "default",
        })
      }

      // Success - proceed with the reservation
      toast({
        title: "Time Slot Confirmed",
        description: `Selected ${formatTimeForDisplay(selectedStartTime)} - ${formatTimeForDisplay(selectedEndTime)}`,
        variant: "default",
      })

      // Call the parent component's callback
      onTimeSelected(selectedStartTime, selectedEndTime)

    } catch (error) {
      console.error('Error during final validation:', error)
      
      toast({
        title: "Validation Error",
        description: "Unable to validate your selection. Please try again or contact support.",
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
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
                        {/* Changed from grouped display to single responsive grid */}                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {timeSlots.map((slot) => {
                            const hasConflicts = slot.conflicts && slot.conflicts.length > 0
                            const isFullyBooked = slot.status === "full" || slot.status === "unavailable"
                            const isLimited = slot.status === "limited"
                            const isAvailable = slot.status === "available"
                            
                            return (
                              <div key={`start-${slot.time}`} className="relative group">
                                <Button
                                  variant="outline"
                                  size="lg"
                                  className={cn(
                                    "h-auto py-4 px-3 relative flex flex-col items-center justify-center transition-all duration-200 w-full",
                                    "border-2 rounded-xl shadow-sm hover:shadow-md overflow-hidden",
                                    // Styling based on availability and overlapping settings
                                    allowOverlapping && "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 hover:border-blue-300",
                                    !allowOverlapping && isAvailable && "border-green-200 bg-green-50 hover:bg-green-100 text-green-800 hover:border-green-300",
                                    !allowOverlapping && isLimited && "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 hover:border-amber-300",
                                    !allowOverlapping && isFullyBooked && "border-red-200 bg-red-50 text-red-600 opacity-50 cursor-not-allowed hover:bg-red-50",
                                    selectedStartTime === slot.time && "ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg border-blue-400"
                                  )}
                                  onClick={() => (allowOverlapping || slot.available) && handleStartTimeClick(slot.time)}
                                  disabled={!allowOverlapping && !slot.available}
                                >
                                  <span className="text-sm font-semibold mb-1">
                                    {formatTimeForDisplay(slot.time)}
                                  </span>
                                  
                                  {/* Occupancy indicator */}
                                  {slot.occupancy > 0 && (
                                    <div className="flex items-center text-xs opacity-75 mb-1">
                                      <Users className="h-3 w-3 mr-1" />
                                      <span>{slot.occupancy}/{slot.capacity}</span>
                                    </div>
                                  )}
                                  
                                  {/* Status indicator */}
                                  <div className="text-xs mt-1 opacity-60">
                                    {allowOverlapping 
                                      ? "Available" 
                                      : isAvailable 
                                        ? "Open" 
                                        : isLimited 
                                          ? "Limited"
                                          : "Full"
                                    }
                                  </div>
                                  
                                  {/* Check mark for selected slot */}
                                  {selectedStartTime === slot.time && (
                                    <div className="absolute top-2 left-2">
                                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white stroke-2" />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Occupancy badge for overlapping mode */}
                                  {slot.occupancy > 0 && allowOverlapping && (
                                    <span className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">
                                      {slot.occupancy}
                                    </span>
                                  )}
                                </Button>
                                  {/* Conflict details tooltip */}
                                {hasConflicts && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none min-w-max">
                                    <div className="font-semibold mb-1">Existing Reservations:</div>
                                    {(slot.conflicts || []).map((conflict, index) => (
                                      <div key={conflict.id} className="text-xs">
                                        {index + 1}. {conflict.name} ({formatTimeForDisplay(conflict.startTime)} - {formatTimeForDisplay(conflict.endTime)})
                                      </div>
                                    ))}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>              {/* Alternative Dates Section */}
              {showAlternatives && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <Calendar className="h-5 w-5" />
                      Alternative Dates Available
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      The selected date appears to be fully booked. Here are alternative dates with the same time slot available.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingAlternatives ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : alternativeDates.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-orange-700 mb-4">
                          Click on any date below to view availability for the same time slot:
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {alternativeDates.map((altDate, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              className="h-auto p-4 text-left bg-white hover:bg-orange-100 border-orange-200 hover:border-orange-300 flex flex-col items-start"
                              onClick={() => {
                                // Create a new date object from the ISO string
                                const newDate = new Date(altDate.date);
                                
                                // Call the onBack function to return to the date picker
                                onBack();
                                
                                // Use a small timeout to ensure the UI updates properly
                                setTimeout(() => {
                                  // You would typically have a way to navigate to the selected date
                                  // This should be handled by the parent component
                                  toast({
                                    title: "Alternative Date Selected",
                                    description: `Redirecting to ${altDate.displayDate}`,
                                  });
                                  
                                  // For debugging
                                  console.log("Selected alternative date:", {
                                    date: newDate,
                                    isoString: altDate.date,
                                    startTime: selectedStartTime,
                                    endTime: selectedEndTime
                                  });
                                }, 100);
                              }}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="font-medium text-orange-800">
                                  {altDate.displayDate}
                                </div>
                                {altDate?.relative && (
                                  <Badge variant="outline" className="w-fit bg-orange-100 text-orange-800 border-orange-300 mt-1">
                                    {altDate.relative}
                                  </Badge>
                                )}
                                <div className="text-xs text-orange-600 mt-2">
                                  Same time slot available
                                </div>
                                <div className="text-xs text-orange-500 font-mono">
                                  {formatTimeForDisplay(selectedStartTime || "")} 
                                  {selectedEndTime && ` - ${formatTimeForDisplay(selectedEndTime)}`}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Alert className="border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="text-orange-800">No Alternative Dates Found</AlertTitle>
                        <AlertDescription className="text-orange-700">
                          No alternative dates are available for the same time slot in the next 2 weeks. 
                          Please try selecting a different time or check back later.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

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
                            {selectedSlot.occupancy === 0 ? "Available" : selectedSlot.occupancy >= selectedSlot.capacity ? "Full" : "Limited"}                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Real-time Validation Feedback */}
                    {(isValidating || validationResult) && (
                      <div className="space-y-3">
                        {isValidating ? (
                          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-600">Validating time slot...</span>
                          </div>
                        ) : validationResult ? (
                          <div className="space-y-2">
                            {/* Validation Status */}
                            <div className={cn(
                              "flex items-center gap-3 p-4 rounded-xl border shadow-sm",
                              validationResult.isValid
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                            )}>
                              <div className={cn(
                                "p-2 rounded-full",
                                validationResult.isValid
                                  ? "bg-green-100"
                                  : "bg-red-100"
                              )}>
                                {validationResult.isValid ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                              <div>
                                <div className={cn(
                                  "font-medium",
                                  validationResult.isValid
                                    ? "text-green-800"
                                    : "text-red-800"
                                )}>
                                  {validationResult.isValid
                                    ? "Time slot is available"
                                    : "Time slot has conflicts"
                                  }
                                </div>
                                <div className={cn(
                                  "text-sm",
                                  validationResult.isValid
                                    ? "text-green-600"
                                    : "text-red-600"
                                )}>
                                  {validationResult.isValid
                                    ? "You can proceed with this reservation"
                                    : "Please review the issues below"
                                  }
                                </div>
                              </div>
                            </div>

                            {/* Validation Errors */}
                            {validationResult.errors && validationResult.errors.length > 0 && (
                              <Alert className="border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-800">Validation Errors</AlertTitle>
                                <AlertDescription className="text-red-700">
                                  <ul className="list-disc list-inside space-y-1 mt-2">
                                    {validationResult.errors.map((error, index) => (
                                      <li key={index} className="text-sm">{error}</li>
                                    ))}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Validation Warnings */}
                            {validationResult.warnings && validationResult.warnings.length > 0 && (
                              <Alert className="border-amber-200 bg-amber-50">
                                <Info className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Important Information</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                  <ul className="list-disc list-inside space-y-1 mt-2">
                                    {validationResult.warnings.map((warning, index) => (
                                      <li key={index} className="text-sm">{warning}</li>
                                    ))}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}                            {/* Conflict Details */}
                            {validationResult.conflictingReservations && validationResult.conflictingReservations.length > 0 && (
                              <Alert className="border-orange-200 bg-orange-50">
                                <Users className="h-4 w-4 text-orange-600" />
                                <AlertTitle className="text-orange-800">Conflicting Reservations</AlertTitle>
                                <AlertDescription className="text-orange-700">
                                  <div className="space-y-2 mt-2">
                                    {validationResult.conflictingReservations.map((conflict, index) => (
                                      <div key={index} className="text-sm p-2 bg-white rounded border border-orange-200">
                                        <div className="font-medium">{conflict.name || "Anonymous"}</div>
                                        <div className="text-xs text-orange-600">
                                          {formatTimeForDisplay(conflict.startTime)} - {formatTimeForDisplay(conflict.endTime)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </AlertDescription>
                              </Alert>
                            )}                            {/* Suggestions */}
                            {validationResult.detailedConflictInfo?.recommendedAlternatives && validationResult.detailedConflictInfo.recommendedAlternatives.length > 0 && (
                              <Alert className="border-blue-200 bg-blue-50">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-800">Suggestions</AlertTitle>
                                <AlertDescription className="text-blue-700">
                                  <ul className="list-disc list-inside space-y-1 mt-2">
                                    {validationResult.detailedConflictInfo.recommendedAlternatives.map((suggestion, index) => (
                                      <li key={index} className="text-sm">{suggestion}</li>
                                    ))}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}

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
        </CardContent>        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
          <Button
            onClick={handleContinue}            disabled={
              !selectedStartTime || 
              !selectedEndTime || 
              (hasOverlap && !allowOverlapping) ||
              isValidating ||
              (validationResult !== null && !validationResult.isValid)
            }
            className="w-full sm:w-auto"
          >
            {isValidating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Validating...
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
