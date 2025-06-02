"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import { addDays, startOfDay } from "date-fns"
import { getSettings } from "@/lib/actions"
import type { SystemSettings } from "@/lib/types"

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
  const [selectedDuration, setSelectedDuration] = useState<number | undefined>(undefined)
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  // Use refs to track if we've already processed URL parameters
  const initializedRef = useRef(false)

  // Calculate the minimum bookable date based on system settings
  // Use useMemo to recalculate when systemSettings changes
  const minBookableDate = useMemo(() => {
    if (!systemSettings) {
      // Return null while settings are loading to prevent incorrect initial calculation
      return null
    }
    return startOfDay(addDays(new Date(), systemSettings.minAdvanceBookingDays || 0))
  }, [systemSettings])

  // No maximum advance booking limit
  const maxBookableDate = null

  // Fetch system settings on component mount
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const settings = await getSettings()
        setSystemSettings(settings)
      } catch (error) {
        console.error("Failed to fetch system settings:", error)
        // Use default settings if fetch fails
        setSystemSettings({
          systemName: "Reservation System",
          contactEmail: "admin@example.com",
          requireApproval: true,
          allowOverlapping: true,
          maxOverlappingReservations: 2,
          publicCalendar: true,
          reservationTypes: ["event", "training", "gym", "other"],
          use12HourFormat: true,
          minAdvanceBookingDays: 0
        })
      }
    }

    fetchSystemSettings()
  }, [])

  // Check for URL parameters on initial load
  useEffect(() => {
    if (!authLoading && !user) {
      redirect("/login")
    }

    // Only process URL parameters once to prevent infinite loops
    if (!initializedRef.current && !authLoading) {
      initializedRef.current = true

      const sessionId = searchParams.get("sessionId")

      if (sessionId) {
        // Fetch reservation data from backend session
        const fetchSessionData = async () => {
          try {
            const response = await fetch(`/api/reservation-session?sessionId=${sessionId}`)
            
            if (!response.ok) {
              throw new Error('Session not found')
            }

            const sessionData = await response.json()
            
            if (sessionData.date) {
              const parsedDate = new Date(sessionData.date)
              if (!isNaN(parsedDate.getTime())) {
                setSelectedDate(parsedDate)
                if (sessionData.time) {
                  setSelectedStartTime(sessionData.time)
                  
                  // Calculate end time based on start time and duration
                  if (sessionData.duration) {
                    const [hours, minutes] = sessionData.time.split(':').map(Number);
                    const startTimeObj = new Date();
                    startTimeObj.setHours(hours, minutes, 0);
                    
                    const endTimeObj = new Date(startTimeObj.getTime() + sessionData.duration * 60000);
                    const endTimeHours = endTimeObj.getHours().toString().padStart(2, '0');
                    const endTimeMinutes = endTimeObj.getMinutes().toString().padStart(2, '0');
                    const calculatedEndTime = `${endTimeHours}:${endTimeMinutes}`;
                    
                    setSelectedEndTime(calculatedEndTime);
                  }
                  
                  setActiveTab("reservation-details")
                } else {
                  setActiveTab("time-selection")
                }
              }
            }

            if (sessionData.duration) {
              setSelectedDuration(sessionData.duration)
            }          } catch (error) {
            console.error('Error fetching session data:', error)
            // Fallback to URL parameters if session fetch fails
            const dateParam = searchParams.get("date")
            const timeParam = searchParams.get("time")
            const durationParam = searchParams.get("duration")

            if (dateParam) {
              try {
                const parsedDate = new Date(dateParam)
                if (!isNaN(parsedDate.getTime())) {
                  setSelectedDate(parsedDate)
                  if (timeParam) {
                    setSelectedStartTime(timeParam)
                    
                    // Calculate end time based on start time and duration
                    if (durationParam) {
                      try {
                        const parsedDuration = parseInt(durationParam)
                        if (!isNaN(parsedDuration) && parsedDuration > 0) {
                          const [hours, minutes] = timeParam.split(':').map(Number);
                          const startTimeObj = new Date();
                          startTimeObj.setHours(hours, minutes, 0);
                          
                          const endTimeObj = new Date(startTimeObj.getTime() + parsedDuration * 60000);
                          const endTimeHours = endTimeObj.getHours().toString().padStart(2, '0');
                          const endTimeMinutes = endTimeObj.getMinutes().toString().padStart(2, '0');
                          const calculatedEndTime = `${endTimeHours}:${endTimeMinutes}`;
                          
                          setSelectedEndTime(calculatedEndTime);
                        }
                      } catch (e) {
                        console.error("Invalid duration parameter:", e)
                      }
                    }
                    
                    setActiveTab("reservation-details")
                  } else {
                    setActiveTab("time-selection")
                  }
                }
              } catch (e) {
                console.error("Invalid date parameter:", e)
              }
            }

            if (durationParam) {
              try {
                const parsedDuration = parseInt(durationParam)
                if (!isNaN(parsedDuration) && parsedDuration > 0) {
                  setSelectedDuration(parsedDuration)
                }
              } catch (e) {
                console.error("Invalid duration parameter:", e)
              }
            }
          }
        }

        fetchSessionData()
      } else {
        // Fallback to URL parameters if no sessionId
        const dateParam = searchParams.get("date")
        const timeParam = searchParams.get("time")
        const durationParam = searchParams.get("duration")

        if (dateParam) {
          try {
            const parsedDate = new Date(dateParam)
            if (!isNaN(parsedDate.getTime())) {
              setSelectedDate(parsedDate)
              if (timeParam) {
                setSelectedStartTime(timeParam)
                
                // Calculate end time based on start time and duration
                if (durationParam) {
                  try {
                    const parsedDuration = parseInt(durationParam)
                    if (!isNaN(parsedDuration) && parsedDuration > 0) {
                      const [hours, minutes] = timeParam.split(':').map(Number);
                      const startTimeObj = new Date();
                      startTimeObj.setHours(hours, minutes, 0);
                      
                      const endTimeObj = new Date(startTimeObj.getTime() + parsedDuration * 60000);
                      const endTimeHours = endTimeObj.getHours().toString().padStart(2, '0');
                      const endTimeMinutes = endTimeObj.getMinutes().toString().padStart(2, '0');
                      const calculatedEndTime = `${endTimeHours}:${endTimeMinutes}`;
                      
                      setSelectedEndTime(calculatedEndTime);
                    }
                  } catch (e) {
                    console.error("Invalid duration parameter:", e)
                  }
                }
                
                setActiveTab("reservation-details")
              } else {
                setActiveTab("time-selection")
              }
            }
          } catch (e) {
            console.error("Invalid date parameter:", e)
          }
        }

        if (durationParam) {
          try {
            const parsedDuration = parseInt(durationParam)
            if (!isNaN(parsedDuration) && parsedDuration > 0) {
              setSelectedDuration(parsedDuration)
            }
          } catch (e) {
            console.error("Invalid duration parameter:", e)
          }
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
        <DashboardHeader heading="Request a Reservation" text="Follow the steps below to request a new reservation" />        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Reservation Policy</AlertTitle>          <AlertDescription>
            {systemSettings ? (
              <>
                {(systemSettings.minAdvanceBookingDays ?? 0) > 0 ? (
                  <>
                    Reservations must be made at least {systemSettings.minAdvanceBookingDays} day
                    {systemSettings.minAdvanceBookingDays !== 1 ? 's' : ''} in advance.
                  </>
                ) : (
                  "Same-day reservations are allowed."
                )}
                {" "}All reservation requests must be approved before they are confirmed. 
                {systemSettings.allowOverlapping && " Some time slots can accommodate multiple reservations."}
              </>
            ) : (
              "Loading reservation policy..."
            )}
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
              Details
            </TabsTrigger>
          </TabsList>        <TabsContent value="date-selection" className="mt-4 animate-in fade-in-50">
          {minBookableDate !== null ? (
            <ReservationDatePicker
              selectedDate={selectedDate}
              onDateSelected={handleDateSelected}
              minBookableDate={minBookableDate}
              maxBookableDate={maxBookableDate || undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md bg-muted/10 p-8 shadow-sm">
              <p className="text-muted-foreground">Loading reservation settings...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="time-selection" className="mt-4 animate-in fade-in-50">
          {selectedDate ? (
            <ReservationTimeSlots
              selectedDate={selectedDate}
              onTimeSelected={handleTimeSelected}
              onBack={() => setActiveTab("date-selection")}
              initialStartTime={selectedStartTime}
              initialDuration={selectedDuration}
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
