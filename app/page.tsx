"use client"

import { useState, useEffect } from "react"
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
import { getPublicAvailability, getSystemSettings } from "@/lib/actions"
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

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number>(60)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({})
  const [timeSlots, setTimeSlots] = useState<
    { time: string; available: boolean; status: string; occupancy?: number }[]
  >([])
  const [isLoadingDates, setIsLoadingDates] = useState(true)
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false)
  const [earliestAvailable, setEarliestAvailable] = useState<Date | null>(null)
  const [use12HourFormat, setUse12HourFormat] = useState(true)
  const [showOverlappingReservations, setShowOverlappingReservations] = useState(false)
  const [hasOverlappingReservations, setHasOverlappingReservations] = useState(false)
  const [systemSettings, setSystemSettings] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("time-selection")
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null)
  const [maxPossibleDuration, setMaxPossibleDuration] = useState<number>(540) // 9 hours max (8AM to 5PM)
  const [hasOverlap, setHasOverlap] = useState(false)
  const [operationalHours] = useState({ start: "08:00", end: "17:00" })

  // Calculate the minimum bookable date (1 week from now)
  const minBookableDate = addWeeks(new Date(), 1)

  // Helper functions for duration and time formatting
  const formatTimeForDisplay = (time: string) => {
    if (!use12HourFormat) return time

    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }

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

  const generateDurationOptions = (maxDuration: number) => {
    const options = []
    // Generate options in 30-minute increments up to the maximum duration
    for (let i = 30; i <= maxDuration; i += 30) {
      options.push(i)
    }
    // Ensure we have at least a 30-minute option
    if (options.length === 0) {
      options.push(30)
    }
    return options
  }

  // Calculate max duration and end time when time is selected
  useEffect(() => {
    if (selectedTime && timeSlots.length > 0) {
      // Calculate the maximum possible duration based on operational hours
      const startTimeObj = parse(selectedTime, "HH:mm", new Date())
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
    }
  }, [selectedTime, selectedDuration, timeSlots, operationalHours])

  // Fetch system settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getSystemSettings()
        setSystemSettings(settings)
        setUse12HourFormat(settings.use12HourFormat !== false) // Default to true if not specified
      } catch (error) {
        console.error("Failed to fetch system settings:", error)
        setError("Failed to load system settings. Please try again later.")
      }
    }

    fetchSettings()
  }, [])

  // Fetch available dates for the current month
  useEffect(() => {
    const fetchAvailableDates = async () => {
      setIsLoadingDates(true)
      setError(null)
      try {
        const startDate = startOfMonth(currentMonth)
        const endDate = endOfMonth(currentMonth)
        const response = await getPublicAvailability(startDate, endDate, true)

        if (!response) {
          throw new Error("Invalid response from server")
        }

        if (response.availableDates) {
          setAvailableDates(response.availableDates)
        } else {
          setAvailableDates([])
        }

        if (response.availabilityMap) {
          setAvailabilityMap(response.availabilityMap)
        } else {
          setAvailabilityMap({})
        }

        if (response.earliestAvailable) {
          setEarliestAvailable(new Date(response.earliestAvailable))
        }
      } catch (error) {
        console.error("Failed to fetch available dates:", error)
        setError("Failed to load available dates. Please try again later.")
      } finally {
        setIsLoadingDates(false)
      }
    }

    fetchAvailableDates()
  }, [currentMonth])

  // Fetch time slots when a date is selected
  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!selectedDate) return

      setIsLoadingTimeSlots(true)
      setError(null)
      try {
        const response = await getPublicAvailability(selectedDate, selectedDate)

        if (!response || !response.timeSlots) {
          setTimeSlots([])
          setHasOverlappingReservations(false)
          return
        }

        const slots = response.timeSlots || []

        const hasOverlaps = slots.some((slot: { time: string; available: boolean; status: string; occupancy?: number }) => 
          slot.status === "limited" || (slot.occupancy && slot.occupancy > 0)
        )

        setHasOverlappingReservations(hasOverlaps)
        setTimeSlots(slots)
      } catch (error) {
        console.error("Failed to fetch time slots:", error)
        setError("Failed to load time slots. Please try again later.")
        setTimeSlots([])
      } finally {
        setIsLoadingTimeSlots(false)
      }
    }

    fetchTimeSlots()
  }, [selectedDate])

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  // Generate days for the current month view
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Add days from previous and next month to fill the calendar grid
  const startDay = monthStart.getDay()
  const endDay = 6 - monthEnd.getDay()

  const prevMonthDays =
    startDay > 0
      ? eachDayOfInterval({
          start: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - startDay),
          end: new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - 1),
        })
      : []

  const nextMonthDays =
    endDay > 0
      ? eachDayOfInterval({
          start: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 1),
          end: new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + endDay),
        })
      : []

  const allDays = [...prevMonthDays, ...monthDays, ...nextMonthDays]

  // Check if a date is available and get its status
  const getDateAvailability = (date: Date) => {
    if (!date) return "unavailable"
    const dateString = format(date, "yyyy-MM-dd")
    return availabilityMap[dateString] || "unavailable"
  }

  // Handle date selection and open time slots sheet
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setSelectedEndTime(null)
    setHasOverlap(false)
    setActiveTab("time-selection")
    setIsSheetOpen(true)
  }

  // Handle time slot selection
  const handleTimeSlotSelect = (time: string) => {
    setSelectedTime(time)
    // Automatically switch to reservation details tab when time is selected
    setActiveTab("reservation-details")
  }

  // Handle duration selection
  const handleDurationChange = (value: string) => {
    setSelectedDuration(Number.parseInt(value))
  }

  // Handle continue to reservation
  const handleContinueToReservation = () => {
    if (!selectedDate || !selectedTime) return

    const dateParam = format(selectedDate, "yyyy-MM-dd")

    if (user) {
      router.push(`/request?date=${dateParam}&time=${selectedTime}&duration=${selectedDuration}`)
    } else {
      const deepLink = `/login?redirect=/request&date=${dateParam}&time=${selectedTime}&duration=${selectedDuration}`
      router.push(deepLink)
    }
  }

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

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Reservation Policy</AlertTitle>
          <AlertDescription>
            Gymnasium reservations can only be made at least one week in advance. Available slots are shown in green,
            slots with limited availability are shown in orange, and fully booked slots are shown in red. The gymnasium
            is open from 8:00 AM to 5:00 PM.
          </AlertDescription>
        </Alert>

        {/* Date Selection Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Date</CardTitle>
                {earliestAvailable && (
                  <CardDescription>
                    Earliest available date: {format(earliestAvailable, "EEEE, MMMM d, yyyy")}
                  </CardDescription>
                )}
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
        </Card>

        {/* Time Slot Selection Sheet */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="w-full sm:max-w-md p-4 sm:p-6 flex flex-col overflow-hidden">
            <SheetHeader className="mb-4 flex-shrink-0">
              <SheetTitle>Make a Reservation</SheetTitle>
              {selectedDate && (
                <div className="flex items-center text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </div>
              )}
            </SheetHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 w-full">
              <TabsList className="grid w-full grid-cols-2 mb-2 flex-shrink-0">
                <TabsTrigger value="time-selection">Select Time</TabsTrigger>
                <TabsTrigger 
                  value="reservation-details" 
                  disabled={!selectedTime}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reservation Details
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="time-selection" className="mt-2 flex flex-col flex-1 min-h-0 w-full">
                {systemSettings?.allowOverlapping && hasOverlappingReservations && (
                  <div className="flex items-center space-x-2 mb-2 flex-shrink-0 w-full">
                    <Switch
                      id="show-overlapping"
                      checked={showOverlappingReservations}
                      onCheckedChange={setShowOverlappingReservations}
                    />
                    <Label htmlFor="show-overlapping" className="text-sm">Show overlapping reservations</Label>
                  </div>
                )}

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
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
                    <TimeSlotGrid
                      timeSlots={timeSlots.map((slot) => ({
                        ...slot,
                        occupancy: showOverlappingReservations ? slot.occupancy : undefined,
                      }))}
                      onSelectTimeSlot={handleTimeSlotSelect}
                      requiresLogin={!user}
                      selectedTime={selectedTime || undefined}
                      selectedDate={selectedDate}
                      use12HourFormat={use12HourFormat}
                      hasOverlappingReservations={showOverlappingReservations && hasOverlappingReservations}
                    />
                  </div>
                )}

                {selectedDate && selectedTime && (
                  <div className="mt-6 flex gap-2 flex-shrink-0">
                    <Button variant="outline" onClick={() => setIsSheetOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={() => setActiveTab("reservation-details")} className="flex-1">
                      Next
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="reservation-details" className="mt-2 w-full">
                {selectedDate && selectedTime ? (
                  <div className="space-y-4 w-full">
                    <Alert className="mb-2 w-full">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Gymnasium Hours</AlertTitle>
                      <AlertDescription>
                        The gymnasium is open from {formatTimeForDisplay(operationalHours.start)} to{" "}
                        {formatTimeForDisplay(operationalHours.end)}. Reservations must end by closing time.
                      </AlertDescription>
                    </Alert>

                    <Card className="bg-muted/30">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-primary" />
                              <span className="font-medium">Start Time</span>
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {formatTimeForDisplay(selectedTime)}
                            </Badge>
                          </div>

                          {(() => {
                            const selectedSlot = timeSlots.find((slot) => slot.time === selectedTime)
                            return selectedSlot && selectedSlot.occupancy !== undefined && selectedSlot.occupancy > 0 ? (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Current Bookings</span>
                                <div className="flex items-center">
                                  <Users className="h-3 w-3 mr-1 text-muted-foreground" />
                                  <span className="text-sm">{selectedSlot.occupancy}</span>
                                </div>
                              </div>
                            ) : null
                          })()}

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
                                <span>30m</span>
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

                    <div className="flex gap-2">
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
                  </div>
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
