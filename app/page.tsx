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
import { getDateAvailability } from "@/lib/date-availability"
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
  const [selectedDuration, setSelectedDuration] = useState<number>(60)
  
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

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
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

    const effectiveMaxDuration = Math.min(maxDuration, adminMaxDuration)

    for (let duration = minDuration; duration <= effectiveMaxDuration; duration += interval) {
      options.push(duration)
    }
    
    if (options.length === 0) {
      options.push(minDuration)
    }
    return options
  }, [timeSlotSettings])
  // Use shared date availability checker
  const checkDateAvailability = useCallback((date: Date) => {
    return getDateAvailability(date, timeSlotSettings, availabilityMap)
  }, [availabilityMap, timeSlotSettings])

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
          
          // Debug log the time slot settings
          console.log("Time slot settings loaded:", timeSlotSettings)
          console.log("Business hours:", timeSlotSettings?.businessHours)
        }
      } catch (error) {
        if (isMounted) {
          console.error("Failed to fetch system settings:", error)
          setError("Failed to load system settings. Please try again later.")
        }
      }
    }

    fetchSettings()
    return () => {
      isMounted = false
    }
  }, [])

  // Update default duration based on time slot settings
  useEffect(() => {
    if (timeSlotSettings && selectedDuration === 60) {
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
        setOperationalHours({ start: "08:00", end: "17:00" })
      }
    }
  }, [timeSlotSettings, selectedDate])

  // Fetch available dates for the current month
  useEffect(() => {
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

        console.log("Availability response:", response)
        console.log("Available dates:", response.availableDates)
        console.log("Availability map:", response.availabilityMap)

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
  }, [currentMonth])

  // Fetch time slots when a date is selected
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([])
      setHasOverlappingReservations(false)
      return
    }
    
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
        const response = await getEnhancedAvailability(selectedDate)
        
        if (abortController.signal.aborted) return

        if (!response || !response.timeSlots) {
          setTimeSlots([])
          setHasOverlappingReservations(false)
          return
        }

        const slots = response.timeSlots || []

        const sortedSlots = [...slots].sort((a, b) => {
          const timeA = a.time.split(":").map(Number)
          const timeB = b.time.split(":").map(Number)
          
          if (timeA[0] !== timeB[0]) {
            return timeA[0] - timeB[0]
          }
          return timeA[1] - timeB[1]
        })

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
  }, [selectedDate])

  // Calculate max duration and end time when time is selected
  useEffect(() => {
    if (!selectedTime || timeSlots.length === 0) return

    const startTimeObj = parse(selectedTime, "HH:mm", new Date())
    const gymCloseTime = parse(operationalHours.end, "HH:mm", new Date())
    const minutesUntilClose = differenceInMinutes(gymCloseTime, startTimeObj)
    const calculatedMaxDuration = minutesUntilClose > 0 ? minutesUntilClose : 0
    
    setMaxPossibleDuration(calculatedMaxDuration)
    
    if (selectedDuration > calculatedMaxDuration) {
      const interval = timeSlotSettings?.timeSlotInterval || 30
      const newDuration = Math.floor(calculatedMaxDuration / interval) * interval
      setSelectedDuration(newDuration)
    }

    const endTimeObj = addMinutes(startTimeObj, selectedDuration)
    const calculatedEndTime = format(endTimeObj, "HH:mm")
    setSelectedEndTime(calculatedEndTime)

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
        )}

        <Alert className="mb-4">
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
              <span className="text-red-600 ml-2">●</span> Full | Closed
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
                  ? Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="aspect-square p-1">
                        <Skeleton className="h-full w-full rounded-md" />
                      </div>
                    ))
                  : allDays.map((day) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                      const availability = isCurrentMonth ? checkDateAvailability(day) : "unavailable"
                      const isToday = isSameDay(day, new Date())
                      const isPast = isBefore(day, minBookableDate)
                      const isBookable = !isPast && availability !== "unavailable" && isCurrentMonth

                      // Debug log for problematic dates
                      if (isCurrentMonth && (day.getDay() === 5 || day.getDay() === 6)) {
                        console.log(`Day ${format(day, "yyyy-MM-dd")} (${day.getDay() === 5 ? 'Friday' : 'Saturday'}): availability=${availability}, isBookable=${isBookable}`)
                      }

                      return (
                        <div key={day.toString()} className="aspect-square p-1">
                          <button
                            className={cn(
                              "h-full w-full rounded-md flex items-center justify-center text-sm transition-colors",
                              isCurrentMonth ? "text-foreground" : "text-muted-foreground opacity-50",
                              isSelected && "bg-primary text-primary-foreground",
                              !isSelected &&
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
        </Card>
        
        {/* Reservation Sheet - Completely Redesigned */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col overflow-hidden">            {/* Header with Progress */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <div className="p-4 sm:p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Book Gymnasium</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === "time-selection" ? "Choose your preferred time" : "Review your reservation"}
                  </p>
                </div>
                  {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors",
                    activeTab === "time-selection" 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-muted text-muted-foreground border-muted-foreground/20"
                  )}>
                    1
                  </div>                  <div className={cn(
                    "w-12 h-1 rounded-full transition-colors",
                    "bg-primary" // Always show primary color for the connecting line
                  )} />
                  <div className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors",
                    activeTab === "reservation-details" && selectedTime
                      ? "bg-primary text-primary-foreground border-primary"
                      : selectedTime
                      ? "bg-background text-primary border-primary"
                      : "bg-muted text-muted-foreground border-muted-foreground/20"
                  )}>
                    2
                  </div>
                </div>
                
                {selectedDate && (
                  <div className="bg-background/60 backdrop-blur-sm border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "time-selection" && (
                <div className="h-full flex flex-col">
                  {!selectedDate ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Clock className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-medium mb-2">Select a Date First</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose a date from the calendar to view available time slots
                      </p>
                    </div>
                  ) : isLoadingTimeSlots ? (
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <h3 className="font-medium">Available Time Slots</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tap a time slot to select it for your reservation
                        </p>
                      </div>
                      
                      <div className="flex-1 overflow-hidden p-4">
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
                    </div>
                  )}

                  {/* Time Selection Footer */}
                  {selectedDate && selectedTime && (
                    <div className="border-t bg-background/95 backdrop-blur-sm">
                      <div className="p-4">
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm font-medium">Selected Time</span>
                            </div>
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {formatTimeForDisplay(selectedTime)}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsSheetOpen(false)} 
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => setActiveTab("reservation-details")} 
                            className="flex-1 gap-2"
                          >
                            Continue
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "reservation-details" && (
                <div className="h-full flex flex-col">
                  {selectedDate && selectedTime ? (
                    <>
                      {/* Scrollable Details Content */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="p-4 space-y-6">
                          {/* Gymnasium Hours Info */}
                          <Alert className="border-blue-200 bg-blue-50/50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-900">Gymnasium Hours</AlertTitle>
                            <AlertDescription className="text-blue-800">
                              Open from {formatTimeForDisplay(operationalHours.start)} to{" "}
                              {formatTimeForDisplay(operationalHours.end)}. All reservations must end by closing time.
                            </AlertDescription>
                          </Alert>

                          {/* Time & Duration Configuration */}
                          <Card className="border-0 bg-gradient-to-br from-muted/30 to-muted/60">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                Reservation Configuration
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Start Time Display */}
                              <div className="flex items-center justify-between p-3 bg-background/80 rounded-lg border">
                                <div>
                                  <p className="text-sm font-medium">Start Time</p>
                                  <p className="text-xs text-muted-foreground">When your session begins</p>
                                </div>
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                  {formatTimeForDisplay(selectedTime)}
                                </Badge>
                              </div>

                              {/* Duration Selection */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <Label htmlFor="duration" className="text-sm font-medium">Duration</Label>
                                    <p className="text-xs text-muted-foreground">How long you'll use the gymnasium</p>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    Max: {formatDuration(maxPossibleDuration)}
                                  </span>
                                </div>
                                
                                <Select value={selectedDuration.toString()} onValueChange={handleDurationChange}>
                                  <SelectTrigger id="duration" className="h-11">
                                    <SelectValue placeholder="Choose duration" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {generateDurationOptions(maxPossibleDuration).map((duration) => (
                                      <SelectItem key={duration} value={duration.toString()}>
                                        {formatDuration(duration)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <div className="space-y-2">
                                  <Progress value={(selectedDuration / maxPossibleDuration) * 100} className="h-2" />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Min: {formatDuration(timeSlotSettings?.minDuration || 30)}</span>
                                    <span>Max: {formatDuration(maxPossibleDuration)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* End Time Display */}
                              {selectedEndTime && (
                                <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-primary mb-1">Complete Reservation Time</p>
                                    <p className="text-lg font-semibold">
                                      {formatTimeForDisplay(selectedTime)} - {formatTimeForDisplay(selectedEndTime)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Total duration: {formatDuration(selectedDuration)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Conflict Warning */}
                              {hasOverlap && (
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertTitle>Scheduling Conflict</AlertTitle>
                                  <AlertDescription>
                                    Your selected duration conflicts with existing reservations. Please choose a shorter duration.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </CardContent>
                          </Card>

                          {/* Login Required Alert */}
                          {!user && (
                            <Alert className="border-amber-200 bg-amber-50/50">
                              <Info className="h-4 w-4 text-amber-600" />
                              <AlertTitle className="text-amber-900">Authentication Required</AlertTitle>
                              <AlertDescription className="text-amber-800">
                                Please log in to complete your gymnasium reservation.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Reservation Summary */}
                          <Card className="border-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Reservation Summary
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between py-2 border-b border-green-100">
                                  <span className="text-sm text-muted-foreground">Date</span>
                                  <span className="text-sm font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-green-100">
                                  <span className="text-sm text-muted-foreground">Time Slot</span>
                                  <span className="text-sm font-medium">
                                    {selectedEndTime 
                                      ? `${formatTimeForDisplay(selectedTime)} - ${formatTimeForDisplay(selectedEndTime)}` 
                                      : formatTimeForDisplay(selectedTime)
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm text-muted-foreground">Duration</span>
                                  <span className="text-sm font-medium">{formatDuration(selectedDuration)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Details Footer */}
                      <div className="border-t bg-background/95 backdrop-blur-sm">
                        <div className="p-4">
                          <div className="flex gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setActiveTab("time-selection")} 
                              className="flex-1 gap-2"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Back
                            </Button>
                            <Button 
                              onClick={handleContinueToReservation} 
                              className="flex-1 gap-2"
                              disabled={hasOverlap}
                            >
                              {user ? "Complete Booking" : "Continue to Login"}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium mb-2">No Time Selected</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Please go back and select a time slot to view reservation details
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab("time-selection")}
                        className="gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Select Time
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
