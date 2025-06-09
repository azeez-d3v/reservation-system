"use client"

import { formatDateKey } from "@/lib/utils"
import { useState, useEffect } from "react"
import {
  format,
  isBefore,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { getDateAvailability } from "@/lib/date-availability"
import { getTimeSlots } from "@/lib/actions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, Star, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ReservationDatePickerProps {
  selectedDate?: Date
  onDateSelected: (date: Date) => void
  minBookableDate: Date | null
  maxBookableDate?: Date
}

export function ReservationDatePicker({ selectedDate, onDateSelected, minBookableDate, maxBookableDate }: ReservationDatePickerProps) {
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({})
  const [timeSlotSettings, setTimeSlotSettings] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDateState, setSelectedDateState] = useState<Date | null>(selectedDate || null)
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())
  const [earliestAvailableDate, setEarliestAvailableDate] = useState<Date | null>(null)

  // Fetch time slot settings on component mount
  useEffect(() => {
    const fetchTimeSlotSettings = async () => {
      try {
        const settings = await getTimeSlots()
        setTimeSlotSettings(settings)
        // console.log("Date picker - Time slot settings loaded:", settings)
        // console.log("Date picker - Business hours:", settings?.businessHours)
      } catch (error) {
        console.error("Date picker - Failed to fetch time slot settings:", error)
      }
    }

    fetchTimeSlotSettings()
  }, [])
  // Fetch available dates for the current month
  useEffect(() => {
    // Use AbortController to cancel previous requests if component unmounts or effect reruns
    const abortController = new AbortController();

    const fetchAvailableDates = async () => {
      setIsLoading(true)
      try {
        // Get the first and last day of the current month
        const firstDay = startOfMonth(currentMonth)
        const lastDay = endOfMonth(currentMonth)

        // Start a timeout to track slow requests
        const timeoutId = setTimeout(() => {
          console.log("Date availability fetch is taking longer than expected");
        }, 2000);        // Use the API route instead of direct server action
        const response = await fetch(
          `/api/availability?startDate=${formatDateKey(firstDay)}&endDate=${formatDateKey(lastDay)}&includeAvailabilityMap=true`,
          {
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
        
        // Clear the timeout since request completed
        clearTimeout(timeoutId);

        if (abortController.signal.aborted) return;

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch availability')
        }        
        setAvailabilityMap(result.data.availabilityMap || {})
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch available dates:", error)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchAvailableDates()
    
    // Cleanup function to abort fetch if component unmounts or effect reruns
    return () => {
      abortController.abort();
    }
  }, [currentMonth, selectedDateState])  // Use shared date availability checker
  const checkDateAvailability = (date: Date) => {
    return getDateAvailability(date, timeSlotSettings, availabilityMap)
  }
  // Find the earliest available date (including limited availability)
  const findEarliestAvailableDate = () => {
    if (!timeSlotSettings || !minBookableDate) return null

    const startDate = minBookableDate
    const endDate = maxBookableDate || addDays(startDate, 90) // Check up to 3 months ahead if no max date
    
    // Start from the minimum bookable date and check each day
    let currentDate = new Date(startDate)
    let daysChecked = 0
    const maxDaysToCheck = 90 // Limit search to avoid infinite loops

    while (currentDate <= endDate && daysChecked < maxDaysToCheck) {
      const availability = checkDateAvailability(currentDate)
      const isPast = isBefore(currentDate, minBookableDate)
      const isTooFarInFuture = maxBookableDate ? currentDate > maxBookableDate : false
      
      if (!isPast && !isTooFarInFuture && (availability === "available" || availability === "limited")) {
        return currentDate
      }
      
      currentDate = addDays(currentDate, 1)
      daysChecked++
    }
    
    return null
  }

  // Update earliest available date when data changes
  useEffect(() => {
    if (!isLoading && timeSlotSettings && availabilityMap) {
      const earliest = findEarliestAvailableDate()
      setEarliestAvailableDate(earliest)
    }
  }, [isLoading, timeSlotSettings, availabilityMap, minBookableDate, maxBookableDate])

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDateState(date)
    onDateSelected(date) // Automatically proceed to next tab
  }

  // Handle continue button click
  const handleContinue = () => {
    if (selectedDateState) {
      onDateSelected(selectedDateState)
    }
  }

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  // Generate days for the current month view
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Add days from previous and next month to fill the calendar grid
  const startDay = monthStart.getDay() // 0 = Sunday, 1 = Monday, etc.
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">          
          <div>
            <CardTitle>Select a Date</CardTitle>
            <CardDescription>
              Choose a date for your reservation. Color indicates availability.
            </CardDescription>
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
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-center font-medium py-2">
                  {day}
                </div>
              ))}
              {/* Loading skeleton */}
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square p-1">
                  <Skeleton className="h-full w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : (
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
              {allDays.map((day) => {                
                const isCurrentMonth = isSameMonth(day, currentMonth)                
                const isSelected = selectedDateState ? isSameDay(day, selectedDateState) : false
                const availability = isCurrentMonth ? checkDateAvailability(day) : "unavailable"
                const isToday = isSameDay(day, new Date())
                const isPast = minBookableDate ? isBefore(day, minBookableDate) : false
                const isTooFarInFuture = maxBookableDate ? day > maxBookableDate : false
                const isBookable = !isPast && !isTooFarInFuture && availability !== "unavailable" && isCurrentMonth
                const isEarliestAvailable = earliestAvailableDate ? isSameDay(day, earliestAvailableDate) : false

                // Determine the tooltip message
                let tooltipMessage = ""
                if (isPast) {
                  tooltipMessage = "Reservations must be made in advance"
                } else if (isTooFarInFuture) {
                  tooltipMessage = "Date is too far in advance for booking"
                } else if (isEarliestAvailable) {
                  tooltipMessage = "Earliest available date"
                }

                return (
                  <div key={day.toString()} className="aspect-square p-1">
                    <button
                      className={cn(
                        "h-full w-full rounded-md flex items-center justify-center text-sm transition-colors relative",
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
                          !isTooFarInFuture &&
                          "bg-red-100 hover:bg-red-200 text-red-800",
                        isToday && !isSelected && "border border-primary",
                        (isPast || isTooFarInFuture) && "opacity-50 cursor-not-allowed",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                      onClick={() => isBookable && handleDateSelect(day)}
                      disabled={!isBookable}
                      title={tooltipMessage}
                    >
                      <span className="flex items-center justify-center">
                        {format(day, "d")}
                        {isEarliestAvailable && (
                          <Star className="w-3 h-3 ml-1 fill-current text-yellow-500" />
                        )}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4">
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
              <div className="flex items-center">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Star className="w-3 h-3 mr-1 fill-current text-yellow-500" />
                  Earliest Available
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleContinue} disabled={!selectedDateState} className="ml-auto">
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
