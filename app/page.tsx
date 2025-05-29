"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
  addWeeks,
  isBefore,
  parse,
  addMinutes,
  differenceInMinutes,
} from "date-fns"
import { ChevronLeft, ChevronRight, Clock, Info, CalendarIcon, Users, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getPublicAvailability, getSystemSettings, getEnhancedAvailability, getTimeSlots } from "@/lib/actions"
import { TimeSlotGrid } from "@/components/calendar/time-slot-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Core state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number>(60) // Will be updated by settings
    // Data state
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({})
  const [timeSlots, setTimeSlots] = useState<
    { 
      time: string; 
      available: boolean; 
      status: "available" | "limited" | "full" | "unavailable"; 
      occupancy?: number;
      capacity?: number;
      conflicts?: Array<{
        id: string;
        name: string;
        startTime: string;
        endTime: string;
      }>;
    }[]
  >([])
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [timeSlotSettings, setTimeSlotSettings] = useState<any>(null)
  
  // Loading and error state
  const [isLoadingDates, setIsLoadingDates] = useState(true)
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [use12HourFormat, setUse12HourFormat] = useState(true)
  const [showOverlappingReservations, setShowOverlappingReservations] = useState(false)
  const [hasOverlappingReservations, setHasOverlappingReservations] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("time-selection")
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(540)
  const [hasOverlap, setHasOverlap] = useState(false)
    // Refs for cleanup
  const datesFetchRef = useRef<AbortController | null>(null)
  const timeSlotsFetchRef = useRef<AbortController | null>(null)
  
  // Dynamic operational hours based on selected date and settings
  const [operationalHours, setOperationalHours] = useState({ start: "08:00", end: "17:00" })
  
  // Calculate the minimum bookable date (1 week from now) - memoized
  const minBookableDate = useMemo(() => addWeeks(new Date(), 1), [])

  // Helper functions - memoized to prevent re-renders
  const formatTimeForDisplay = useCallback((time: string) => {
    if (!use12HourFormat) return time

    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }, [use12HourFormat])

  const formatDuration = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours === 0) {
      return `${mins} minutes`
    } else if (mins === 0) {
      return hours === 1 ? "1 hour" : `${hours} hours`
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minutes`
    }
  }, [])

  const formatBusinessHours = useCallback(() => {
    if (!timeSlotSettings?.businessHours) return []

    const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    return dayNames.map((dayName, index) => {
      const daySchedule = timeSlotSettings.businessHours[dayName]
      
      if (!daySchedule?.enabled || !daySchedule.timeSlots?.length) {
        return {
          day: dayLabels[index],
          hours: "Closed"
        }
      }

      const timeSlots = daySchedule.timeSlots.map((slot: { start: string; end: string }) => 
        `${formatTimeForDisplay(slot.start)} - ${formatTimeForDisplay(slot.end)}`
      ).join(", ")

      return {
        day: dayLabels[index],
        hours: timeSlots
      }
    })
  }, [timeSlotSettings, formatTimeForDisplay])
  const generateDurationOptions = useCallback((maxDuration: number) => {
    const options = []
    const minDuration = timeSlotSettings?.minDuration || 30
    const interval = timeSlotSettings?.timeSlotInterval || 30
    const adminMaxDuration = timeSlotSettings?.maxDuration || 540

    // Use the smaller of the passed maxDuration and admin's maxDuration
    const effectiveMaxDuration = Math.min(maxDuration, adminMaxDuration)

    // Generate options based on admin settings
    for (let duration = minDuration; duration <= effectiveMaxDuration; duration += interval) {
      options.push(duration)
    }
    
    if (options.length === 0) {
      options.push(minDuration)
    }
    return options
  }, [timeSlotSettings])

  // Fetch system settings - only once on mount
  useEffect(() => {
    let isMounted = true
    
    const fetchSettings = async () => {
      try {
        const [settings, timeSlotSettings] = await Promise.all([
          getSystemSettings(),
          getTimeSlots()
        ])
        
        if (isMounted) {
          setSystemSettings(settings)
          setTimeSlotSettings(timeSlotSettings)
          setUse12HourFormat(settings.use12HourFormat !== false)
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch system settings:", error)
          setError("Failed to load system settings. Please try again later.")        }
      }
    }

    fetchSettings()
      return () => {
      isMounted = false
    }
  }, []) // Only run once on mount

  // Update default duration based on time slot settings
  useEffect(() => {
    if (timeSlotSettings && selectedDuration === 60) {
      // Only update if still at default value
      const minDuration = timeSlotSettings.minDuration || 60
      setSelectedDuration(minDuration)
    }
  }, [timeSlotSettings, selectedDuration])

  // Calculate operational hours based on selected date and time slot settings
  useEffect(() => {
    if (timeSlotSettings && selectedDate) {
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
      } else {
        // Default operational hours if no schedule is found
        setOperationalHours({ start: "08:00", end: "17:00" })
      }
    }
  }, [timeSlotSettings, selectedDate])

  // Fetch available dates for the current month
  useEffect(() => {
    // Cancel previous request
    if (datesFetchRef.current) {
      datesFetchRef.current.abort()
    }
    
    const abortController = new AbortController()
    datesFetchRef.current = abortController
    
    const fetchAvailableDates = async () => {
      if (abortController.signal.aborted) return
      
      setIsLoadingDates(true)
      setError(null)
      
      try {
        const startDate = startOfMonth(currentMonth)
        const endDate = endOfMonth(currentMonth)
        
        const response = await getPublicAvailability(startDate, endDate, true)
        
        if (abortController.signal.aborted) return

        if (!response) {
          throw new Error("Invalid response from server")
        }

        setAvailableDates(response.availableDates || [])
        setAvailabilityMap(response.availabilityMap || {})
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch available dates:", error)
          setError("Failed to load available dates. Please try again later.")
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingDates(false)
        }
      }
    }

    fetchAvailableDates()
    
    return () => {
      abortController.abort()
      datesFetchRef.current = null
    }
  }, [currentMonth]) // Only depend on currentMonth

  // Fetch time slots when a date is selected
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([])
      setHasOverlappingReservations(false)
      return
    }
    
    // Cancel previous request
    if (timeSlotsFetchRef.current) {
      timeSlotsFetchRef.current.abort()
    }
    
    const abortController = new AbortController()
    timeSlotsFetchRef.current = abortController
      const fetchTimeSlots = async () => {
      if (abortController.signal.aborted) return
      
      setIsLoadingTimeSlots(true)
      setError(null)
      
      try {
        // Use enhanced availability for better data
        const response = await getEnhancedAvailability(selectedDate)
        
        if (abortController.signal.aborted) return

        if (!response || !response.timeSlots) {
          setTimeSlots([])
          setHasOverlappingReservations(false)
          return
        }

        const slots = response.timeSlots || []

        // Sort the time slots chronologically
        const sortedSlots = [...slots].sort((a, b) => {
          const timeA = a.time.split(":").map(Number)
          const timeB = b.time.split(":").map(Number)
          
          if (timeA[0] !== timeB[0]) {
            return timeA[0] - timeB[0]
          }
          return timeA[1] - timeB[1]
        })

        // Map to expected format for TimeSlotGrid
        const mappedSlots = sortedSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          status: slot.status as "available" | "limited" | "full" | "unavailable",
          occupancy: slot.occupancy,
          capacity: slot.capacity,
          conflicts: slot.conflicts?.map(conflict => ({
            id: conflict.id,
            name: conflict.name,
            startTime: conflict.startTime,
            endTime: conflict.endTime
          }))
        }))

        const hasOverlaps = mappedSlots.some((slot) => 
          slot.status === "limited" || (slot.occupancy && slot.occupancy > 0)
        )

        setHasOverlappingReservations(hasOverlaps)
        setTimeSlots(mappedSlots)
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch time slots:", error)
          setError("Failed to load time slots. Please try again later.")
          setTimeSlots([])
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingTimeSlots(false)
        }
      }
    }

    fetchTimeSlots()
    
    return () => {
      abortController.abort()
      timeSlotsFetchRef.current = null
    }
  }, [selectedDate]) // Only depend on selectedDate

  // Calculate max duration and end time when time is selected
  useEffect(() => {
    if (!selectedTime || timeSlots.length === 0) return

    const startTimeObj = parse(selectedTime, "HH:mm", new Date())
    const gymCloseTime = parse(operationalHours.end, "HH:mm", new Date())
    const minutesUntilClose = differenceInMinutes(gymCloseTime, startTimeObj)
    const calculatedMaxDuration = minutesUntilClose > 0 ? minutesUntilClose : 0
    
    setMaxPossibleDuration(calculatedMaxDuration)    // Adjust selected duration if it exceeds the maximum
    if (selectedDuration > calculatedMaxDuration) {
      const interval = timeSlotSettings?.timeSlotInterval || 30
      const newDuration = Math.floor(calculatedMaxDuration / interval) * interval
      setSelectedDuration(newDuration)
    }

    // Calculate end time based on selected duration
    const endTimeObj = addMinutes(startTimeObj, selectedDuration)
    const calculatedEndTime = format(endTimeObj, "HH:mm")
    setSelectedEndTime(calculatedEndTime)

    // Check for overlaps with existing bookings
    const startIndex = timeSlots.findIndex((slot) => slot.time === selectedTime)
    const endIndex = timeSlots.findIndex((slot) => slot.time === calculatedEndTime)

    let hasConflict = false
    for (let i = startIndex + 1; i < endIndex; i++) {
      if (i >= 0 && i < timeSlots.length && !timeSlots[i].available) {
        hasConflict = true
        break
      }
    }

    setHasOverlap(hasConflict)
  }, [selectedTime, selectedDuration, timeSlots, operationalHours.end])

  // Navigation handlers - memoized
  const nextMonth = useCallback(() => setCurrentMonth(addMonths(currentMonth, 1)), [currentMonth])
  const prevMonth = useCallback(() => setCurrentMonth(subMonths(currentMonth, 1)), [currentMonth])

  // Generate calendar days - memoized
  const { allDays, monthStart, monthEnd } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const startDay = monthStart.getDay()
    const endDay = 6 - monthEnd.getDay()

    const prevMonthDays = startDay > 0
      ? eachDayOfInterval({
          start: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - startDay),
          end: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - 1),
        })
      : []

    const nextMonthDays = endDay > 0
      ? eachDayOfInterval({
          start: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 1),
          end: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + endDay),
        })
      : []

    return {
      allDays: [...prevMonthDays, ...monthDays, ...nextMonthDays],
      monthStart,
      monthEnd
    }
  }, [currentMonth])

  // Date availability checker - memoized
  const getDateAvailability = useCallback((date: Date) => {
    if (!date) return "unavailable"
    const dateString = format(date, "yyyy-MM-dd")
    return availabilityMap[dateString] || "unavailable"
  }, [availabilityMap])

  // Event handlers - memoized
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setSelectedEndTime(null)
    setHasOverlap(false)
    setActiveTab("time-selection")
    setIsSheetOpen(true)
  }, [])

  const handleTimeSlotSelect = useCallback((time: string) => {
    setSelectedTime(time)
    
    if (time) {
      const startTimeObj = parse(time, "HH:mm", new Date())
      const endTimeObj = addMinutes(startTimeObj, selectedDuration)
      setSelectedEndTime(format(endTimeObj, "HH:mm"))
    }
    
    setActiveTab("reservation-details")
  }, [selectedDuration])

  const handleDurationChange = useCallback((value: string) => {
    const duration = Number.parseInt(value)
    setSelectedDuration(duration)
    
    if (selectedTime) {
      const startTimeObj = parse(selectedTime, "HH:mm", new Date())
      const endTimeObj = addMinutes(startTimeObj, duration)
      setSelectedEndTime(format(endTimeObj, "HH:mm"))
    }
  }, [selectedTime])

  const handleContinueToReservation = useCallback(async () => {
    if (!selectedDate || !selectedTime) return

    try {
      const response = await fetch('/api/reservation-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          duration: selectedDuration
        })
      })

      if (!response.ok) {
        throw new Error('Failed to store reservation session')
      }

      const { sessionId } = await response.json()

      if (user) {
        router.push(`/request?sessionId=${sessionId}`)
      } else {
        const deepLink = `/login?redirect=/request&sessionId=${sessionId}`
        router.push(deepLink)
      }
    } catch (error) {
      console.error('Error storing reservation data:', error)
      toast({
        title: "Error",
        description: "Failed to proceed with reservation. Please try again.",
        variant: "destructive",
      })
    }
  }, [selectedDate, selectedTime, selectedDuration, user, router, toast])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (datesFetchRef.current) {
        datesFetchRef.current.abort()
      }
      if (timeSlotsFetchRef.current) {
        timeSlotsFetchRef.current.abort()
      }
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Gymnasium Reservation Calendar</h1>
        <p className="text-muted-foreground mb-8">
          Select a date to view available time slots and make your gymnasium reservation.{" "}
          {!user && "Login is required to make a reservation."}
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}        <Alert className="mb-4">
          <Clock className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Gymnasium Hours</AlertTitle>
          <AlertDescription className="text-xs space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs">
              {formatBusinessHours().map((schedule) => (
                <div key={schedule.day} className="flex items-center gap-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    schedule.hours === "Closed" ? "bg-red-500" : "bg-green-500"
                  )} />
                  <span className="font-medium">{schedule.day.slice(0, 3)}:</span>
                  <span className={schedule.hours === "Closed" ? "text-muted-foreground" : ""}>
                    {schedule.hours === "Closed" ? "Closed" : schedule.hours}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              <span className="text-green-600">●</span> Available 
              <span className="text-amber-600 ml-2">●</span> Limited 
              <span className="text-red-600 ml-2">●</span> Full
              <span className="ml-2">• Book 1 week ahead • No weekends</span>
            </p>
          </AlertDescription>
        </Alert>

        {/* Date Selection Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Date</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevMonth}
                  disabled={isBefore(startOfMonth(currentMonth), startOfMonth(new Date()))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-center font-medium py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {isLoadingDates
                  ? // Loading skeleton
                    Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="aspect-square p-1">
                        <Skeleton className="h-full w-full rounded-md" />
                      </div>
                    ))
                  : // Actual calendar days
                    allDays.map((day) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                      const availability = isCurrentMonth ? getDateAvailability(day) : "unavailable"
                      const isToday = isSameDay(day, new Date())
                      const isPast = isBefore(day, minBookableDate)
                      const isBookable =
                        !isPast && availability !== "unavailable" && isCurrentMonth && !isWeekend(day)

                      return (
                        <div key={day.toString()} className="aspect-square p-1">
                          <button
                            className={cn(
                              "h-full w-full rounded-md flex items-center justify-center text-sm transition-colors",
                              isCurrentMonth ? "text-foreground" : "text-muted-foreground opacity-50",
                              isSelected && "bg-primary text-primary-foreground",                        !isSelected &&
                          isBookable &&
                          availability === "available" &&
                          "bg-green-100 hover:bg-green-200 text-green-800",
                        !isSelected &&
                          isBookable &&
                          availability === "limited" &&
                          "bg-amber-100 hover:bg-amber-200 text-amber-800",
                              !isSelected && !isBookable && isCurrentMonth && "bg-muted hover:bg-muted/80",
                              !isSelected &&
                                isCurrentMonth &&
                                availability === "unavailable" &&
                                !isPast &&
                                !isWeekend(day) &&
                                "bg-red-100 hover:bg-red-200 text-red-800",
                              isToday && !isSelected && "border border-primary",
                              isPast && "opacity-50 cursor-not-allowed",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                            )}
                            onClick={() => isBookable && handleDateSelect(day)}
                            disabled={!isBookable}
                            title={isPast ? "Reservations must be at least 1 week in advance" : ""}
                          >
                            {format(day, "d")}
                          </button>
                        </div>
                      )
                    })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                    Available
                  </Badge>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>
                    Limited
                  </Badge>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-red-100 text-red-800">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                    Unavailable
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>        {/* Time Slot Selection Sheet */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="w-full sm:max-w-md p-3 sm:p-6 flex flex-col overflow-hidden">
            <SheetHeader className="pb-2 flex-shrink-0">
              <SheetTitle>Make a Reservation</SheetTitle>
              {selectedDate && (
                <div className="flex items-center justify-center w-full text-sm font-medium bg-muted p-2 rounded-md mt-1">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </div>
              )}
            </SheetHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 w-full">
              <TabsList className="grid w-full grid-cols-2 mb-1 flex-shrink-0">
                <TabsTrigger value="time-selection" className="text-sm">Select Time</TabsTrigger>
                <TabsTrigger 
                  value="reservation-details" 
                  disabled={!selectedTime}
                  className="disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Details
                </TabsTrigger>
              </TabsList>
                <TabsContent value="time-selection" className="flex flex-col flex-1 min-h-0 w-full">
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-center w-full">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a date to view available time slots</p>
                  </div>
                ) : isLoadingTimeSlots ? (
                  <div className="grid grid-cols-3 gap-1 flex-1 content-start w-full">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
                    <TimeSlotGrid
                      timeSlots={timeSlots.map((slot) => ({
                        ...slot,
                        status: slot.status || (slot.available ? "available" : "unavailable"),
                      }))}
                      onSelectTimeSlot={handleTimeSlotSelect}
                      requiresLogin={!user}
                      selectedTime={selectedTime || undefined}
                      selectedDate={selectedDate}
                      use12HourFormat={use12HourFormat}
                      hasOverlappingReservations={hasOverlappingReservations}
                      timeSlotSettings={timeSlotSettings}
                      operationalHours={operationalHours}
                    />
                  </div>
                )}                
                {selectedDate && selectedTime && (
                  <div className="mt-4 flex gap-2 flex-shrink-0 sticky bottom-0 pt-2 bg-background border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsSheetOpen(false)} 
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("reservation-details")} 
                      className="flex-1 flex items-center justify-center"
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>                
              <TabsContent value="reservation-details" className="flex flex-col flex-1 min-h-0 w-full">
                {selectedDate && selectedTime ? (
                  <>
                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto space-y-3 pt-1">
                      <Alert className="w-full">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-sm font-semibold">Gymnasium Hours</AlertTitle>
                        <AlertDescription className="text-xs sm:text-sm">
                          The gymnasium is open from {formatTimeForDisplay(operationalHours.start)} to{" "}
                          {formatTimeForDisplay(operationalHours.end)}. Reservations must end by closing time.
                        </AlertDescription>
                      </Alert>                      <Card className="bg-muted/30">
                        <CardContent className="py-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-primary" />
                                <span className="font-medium">Start Time</span>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {formatTimeForDisplay(selectedTime)}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <Label htmlFor="duration">Duration</Label>
                                <span className="text-xs text-muted-foreground">Max: {formatDuration(maxPossibleDuration)}</span>
                              </div>
                              <Select value={selectedDuration.toString()} onValueChange={handleDurationChange}>
                                <SelectTrigger id="duration">
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                                <SelectContent>
                                  {generateDurationOptions(maxPossibleDuration).map((duration) => (
                                    <SelectItem key={duration} value={duration.toString()}>
                                      {formatDuration(duration)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <div className="pt-2">
                                <Progress value={(selectedDuration / maxPossibleDuration) * 100} className="h-2" />
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                  <span>{formatDuration(timeSlotSettings?.minDuration || 30)}</span>
                                  <span>{formatDuration(maxPossibleDuration)}</span>
                                </div>
                              </div>
                            </div>

                            {hasOverlap && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Scheduling Conflict</AlertTitle>
                                <AlertDescription>
                                  The selected duration overlaps with existing reservations. Please choose a shorter duration.
                                </AlertDescription>
                              </Alert>
                            )}

                            {selectedEndTime && (
                              <div className="p-3 bg-blue-50 text-blue-800 rounded-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-2" />
                                    <span className="font-medium">Reservation Time</span>
                                  </div>
                                </div>
                                <div className="mt-2 text-center">
                                  <p className="text-lg font-semibold">
                                    {formatTimeForDisplay(selectedTime)} - {formatTimeForDisplay(selectedEndTime)}
                                  </p>
                                  <p className="text-sm mt-1">{formatDuration(selectedDuration)}</p>
                                </div>
                              </div>
                            )}

                            {!user && (
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Login Required</AlertTitle>
                                <AlertDescription>
                                  You need to log in to complete your reservation. Click "Continue to Login" below.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-medium mb-2">Reservation Summary</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Date:</span>
                            <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Time:</span>
                            <span>{selectedEndTime ? `${formatTimeForDisplay(selectedTime)} - ${formatTimeForDisplay(selectedEndTime)}` : formatTimeForDisplay(selectedTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration:</span>
                            <span>{formatDuration(selectedDuration)}</span>
                          </div>
                        </div>
                      </div>
                    </div>                    {/* Sticky footer with buttons */}
                    <div className="flex gap-2 mt-2 pt-3 border-t bg-background flex-shrink-0">
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab("time-selection")} 
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button 
                        onClick={handleContinueToReservation} 
                        className="flex-1"
                        disabled={hasOverlap}
                      >
                        {user ? "Continue to Reservation" : "Continue to Login"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Please select a time slot first</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
