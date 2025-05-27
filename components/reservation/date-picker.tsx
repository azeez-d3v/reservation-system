"use client"

import { useState, useEffect } from "react"
import {
  format,
  isWeekend,
  isBefore,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { getPublicAvailability } from "@/lib/actions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ReservationDatePickerProps {
  selectedDate?: Date
  onDateSelected: (date: Date) => void
  minBookableDate: Date
}

export function ReservationDatePicker({ selectedDate, onDateSelected, minBookableDate }: ReservationDatePickerProps) {
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDateState, setSelectedDateState] = useState<Date | null>(selectedDate || null)
  const [earliestAvailable, setEarliestAvailable] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())

  // Fetch available dates for the current month
  useEffect(() => {
    const fetchAvailableDates = async () => {
      setIsLoading(true)
      try {
        // Get the first and last day of the current month
        const firstDay = startOfMonth(currentMonth)
        const lastDay = endOfMonth(currentMonth)

        const response = await getPublicAvailability(firstDay, lastDay, true)
        setAvailabilityMap(response.availabilityMap || {})

        if (response.earliestAvailable) {
          setEarliestAvailable(new Date(response.earliestAvailable))
        }
      } catch (error) {
        console.error("Failed to fetch available dates:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAvailableDates()
  }, [currentMonth])

  // Check if a date is available and get its status
  const getDateAvailability = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return "unavailable"
    }

    const dateString = format(date, "yyyy-MM-dd")
    return availabilityMap[dateString] || "unavailable"
  }

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
              {earliestAvailable && (
                <span className="block mt-1">
                  Earliest available date: {format(earliestAvailable, "EEEE, MMMM d, yyyy")}
                </span>
              )}
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
