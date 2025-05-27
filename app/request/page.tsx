"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ReservationDatePicker } from "@/components/reservation/date-picker"
import { ReservationTimeSlots } from "@/components/reservation/time-slots"
import { ReservationDetailsForm } from "@/components/reservation/details-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Info } from "lucide-react"
import { addWeeks } from "date-fns"

// Define the tabs in the reservation process
type ReservationTab = "date-selection" | "time-selection" | "reservation-details"

export default function RequestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()

  // State for the tabs
  const [activeTab, setActiveTab] = useState<ReservationTab>("date-selection")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedStartTime, setSelectedStartTime] = useState<string>("")
  const [selectedEndTime, setSelectedEndTime] = useState<string>("")

  // Use refs to track if we've already processed URL parameters
  const initializedRef = useRef(false)

  // Calculate the minimum bookable date (1 week from now)
  const minBookableDate = addWeeks(new Date(), 1)

  // Check for URL parameters on initial load
  useEffect(() => {
    if (!authLoading && !user) {
      redirect("/login")
    }

    // Only process URL parameters once to prevent infinite loops
    if (!initializedRef.current && !authLoading) {
      initializedRef.current = true

      // Get date and time from URL parameters
      const dateParam = searchParams.get("date")
      const timeParam = searchParams.get("time")

      if (dateParam) {
        try {
          const parsedDate = new Date(dateParam)
          if (!isNaN(parsedDate.getTime())) {
            setSelectedDate(parsedDate)
            // If we have a date from URL, move to time selection tab
            if (timeParam) {
              setSelectedStartTime(timeParam)
              setActiveTab("reservation-details")
            } else {
              setActiveTab("time-selection")
            }
          }
        } catch (e) {
          console.error("Invalid date parameter:", e)
        }
      }
    }
  }, [user, authLoading, searchParams])

  // Handle date selection
  const handleDateSelected = (date: Date) => {
    setSelectedDate(date)
    setActiveTab("time-selection")
  }

  // Handle time selection
  const handleTimeSelected = (startTime: string, endTime: string) => {
    setSelectedStartTime(startTime)
    setSelectedEndTime(endTime)
    setActiveTab("reservation-details")
  }

  if (authLoading) {
    return <div className="container py-10">Loading...</div>
  }

  if (!user) {
    return null // This will redirect in the useEffect
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto w-full">
        <DashboardHeader heading="Request a Reservation" text="Follow the steps below to request a new reservation" />

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Reservation Policy</AlertTitle>
          <AlertDescription>
            Reservations can only be made at least one week in advance. All reservation requests must be approved before
            they are confirmed. Some time slots can accommodate multiple reservations.
          </AlertDescription>
        </Alert>
      
        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="date-selection">
              Select Date
            </TabsTrigger>
            <TabsTrigger 
              value="time-selection" 
              disabled={!selectedDate}
            >
              Select Time
            </TabsTrigger>
            <TabsTrigger 
              value="reservation-details" 
              disabled={!selectedStartTime || !selectedDate}
            >
              Reservation Details
            </TabsTrigger>
          </TabsList>
        
        <TabsContent value="date-selection" className="mt-4 animate-in fade-in-50">
          <ReservationDatePicker
            selectedDate={selectedDate}
            onDateSelected={handleDateSelected}
            minBookableDate={minBookableDate}
          />
        </TabsContent>

        <TabsContent value="time-selection" className="mt-4 animate-in fade-in-50">
          {selectedDate ? (
            <ReservationTimeSlots
              selectedDate={selectedDate}
              onTimeSelected={handleTimeSelected}
              onBack={() => setActiveTab("date-selection")}
              initialStartTime={selectedStartTime}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md bg-muted/10 p-8 shadow-sm">
              <p className="text-muted-foreground">Please select a date first</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservation-details" className="mt-4 animate-in fade-in-50">
          {selectedDate && selectedStartTime ? (
            <ReservationDetailsForm
              selectedDate={selectedDate}
              startTime={selectedStartTime}
              endTime={selectedEndTime}
              onBack={() => setActiveTab("time-selection")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md bg-muted/10 p-8 shadow-sm">
              <p className="text-muted-foreground">Please select a date and time first</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </DashboardShell>
  )
}
