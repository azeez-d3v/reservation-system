"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { submitReservation, getSystemSettings } from "@/lib/actions"
import { useAuth } from "@/hooks/use-auth"
import { CalendarDays, Clock, Users, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import type { SystemSettings } from "@/lib/types"

interface ReservationDetailsFormProps {
  selectedDate: Date
  startTime: string
  endTime: string
  onBack: () => void
}

export function ReservationDetailsForm({ selectedDate, startTime, endTime, onBack }: ReservationDetailsFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reservationType, setReservationType] = useState("")
  const [purpose, setPurpose] = useState("")
  const [attendees, setAttendees] = useState("1")
  const [notes, setNotes] = useState("")
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Submission dialog state
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [submissionMessage, setSubmissionMessage] = useState("")
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([])
  const [redirectCountdown, setRedirectCountdown] = useState(5)
  
  // Fetch system settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const systemSettings = await getSystemSettings()
        setSettings(systemSettings)
        
        // Set default reservation type if available
        if (systemSettings?.reservationTypes?.length > 0) {
          setReservationType(systemSettings.reservationTypes[0])
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching system settings:", error)
        setIsLoading(false)
      }
    }
    
    fetchSettings()
  }, [])
  
  // Calculate the actual end time if it's not provided
  const displayEndTime = endTime || (() => {
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      // Default to 1 hour duration if no end time is provided
      const startTimeObj = new Date();
      startTimeObj.setHours(hours, minutes, 0);
      
      const endTimeObj = new Date(startTimeObj.getTime() + 60 * 60000); // 60 minutes = 1 hour
      const endTimeHours = endTimeObj.getHours().toString().padStart(2, '0');
      const endTimeMinutes = endTimeObj.getMinutes().toString().padStart(2, '0');
      return `${endTimeHours}:${endTimeMinutes}`;
    } catch (e) {
      console.error("Error calculating end time:", e);
      return "—";
    }
  })();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowSubmissionDialog(true)
    setSubmissionStatus('loading')
    setSubmissionMessage("Submitting your reservation request...")
    setSubmissionErrors([])

    try {
      const result = await submitReservation({
        userId: user?.id || "",
        name: user?.name || "",
        email: user?.email || "",
        date: selectedDate,
        startTime,
        endTime: displayEndTime,
        purpose,
        attendees: Number.parseInt(attendees, 10),
        type: reservationType,
        notes: notes || undefined,
      })

      if (!result.success) {
        // Handle validation errors
        if (result.errors && result.errors.length > 0) {
          setSubmissionStatus('error')
          setSubmissionMessage("Validation Failed")
          setSubmissionErrors(result.errors)
          return
        }
        
        throw new Error(result.message)
      }

      // Success case
      setSubmissionStatus('success')
      if (result.warnings && result.warnings.length > 0) {
        setSubmissionMessage("Reservation submitted with warnings")
        setSubmissionErrors(result.warnings)
      } else {
        setSubmissionMessage("Reservation request submitted successfully!")
        setSubmissionErrors([])
      }
      
      // Start countdown timer
      startRedirectCountdown()
      
    } catch (error) {
      console.error("Error submitting reservation:", error)
      setSubmissionStatus('error')
      setSubmissionMessage("Submission failed")
      setSubmissionErrors([error instanceof Error ? error.message : "There was a problem submitting your request."])
    } finally {
      setIsSubmitting(false)
    }
  }
  const startRedirectCountdown = () => {
    setRedirectCountdown(5)
  }

  // Handle countdown timer with useEffect
  useEffect(() => {
    if (submissionStatus === 'success' && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        if (redirectCountdown === 1) {
          router.push("/dashboard")
        } else {
          setRedirectCountdown(prev => prev - 1)
        }
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [submissionStatus, redirectCountdown, router])

  const handleManualRedirect = () => {
    router.push("/dashboard")
  }
  return (
    <>
      <Card className="w-full">
      <CardHeader>
        <CardTitle>Reservation Details</CardTitle>
        <CardDescription>Provide details for your reservation</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-md">
            <div className="flex items-center">
              <CalendarDays className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time</p>
                <p className="font-medium">
                  {startTime} - {endTime}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Reservation Type</Label>
            <Select value={reservationType} onValueChange={setReservationType} required disabled={isLoading}>
              <SelectTrigger id="type">
                <SelectValue placeholder={isLoading ? "Loading..." : "Select type"} />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : settings?.reservationTypes && settings.reservationTypes.length > 0 ? (
                  settings.reservationTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose of Reservation</Label>
            <Textarea
              id="purpose"
              placeholder="Briefly describe the purpose of your reservation"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="attendees" className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Number of Attendees
              </Label>
              <Input
                id="attendees"
                type="number"
                min="1"
                placeholder="1"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Additional Notes
              </Label>
              <Input
                id="notes"
                placeholder="Any special requirements"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            Back
          </Button>          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Reservation Request"
            )}
          </Button>        </CardFooter>
      </form>      </Card>

      {/* Submission Dialog */}
      <Dialog open={showSubmissionDialog} onOpenChange={setShowSubmissionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {submissionStatus === 'loading' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Submitting Request
                </>
              )}
              {submissionStatus === 'success' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Success
                </>
              )}
              {submissionStatus === 'error' && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Error
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {submissionMessage}
            </DialogDescription>
          </DialogHeader>
            <div className="py-4">            {submissionStatus === 'loading' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center space-y-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48 mx-auto" />
                      <Skeleton className="h-3 w-32 mx-auto" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Processing your reservation request...
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {submissionErrors.length > 0 && submissionStatus !== 'loading' && (
              <div className="space-y-2">
                {submissionStatus === 'error' ? (
                  <div className="text-sm text-red-600">
                    <ul className="list-disc list-inside space-y-1">
                      {submissionErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-amber-600">
                    <p className="font-medium mb-1">Warnings:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {submissionErrors.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {submissionStatus === 'success' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800 mb-2">
                  Your reservation request has been submitted and is pending approval.
                </p>
                <p className="text-sm text-green-700">
                  Redirecting to dashboard in {redirectCountdown} seconds...
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            {submissionStatus === 'error' && (
              <Button 
                variant="outline" 
                onClick={() => setShowSubmissionDialog(false)}
              >
                Close
              </Button>
            )}
            {submissionStatus === 'success' && (
              <Button onClick={handleManualRedirect}>
                Go to Dashboard
              </Button>
            )}
          </div>
        </DialogContent>      </Dialog>
    </>
  )
}
