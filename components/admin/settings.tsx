"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  getSystemSettings,
  updateSystemSettings,
  getTimeSlotSettings,
  updateTimeSlotSettings,
  getEmailSettings,
  updateEmailSettings,
} from "@/lib/actions"
import type { TimeSlotSettings, SystemSettings, EmailSettings } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Save } from "lucide-react"
import { TimeSlotEditor } from "@/components/admin/time-slot-editor"

export function AdminSettings() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("general")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Settings states
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [timeSlotSettings, setTimeSlotSettings] = useState<TimeSlotSettings | null>(null)
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      try {
        const [system, timeSlots, email] = await Promise.all([
          getSystemSettings(),
          getTimeSlotSettings(),
          getEmailSettings(),
        ])

        setSystemSettings(system)
        setTimeSlotSettings(timeSlots)
        setEmailSettings(email)
      } catch (error) {
        console.error("Failed to fetch settings:", error)
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [toast])

  const handleSaveSystemSettings = async () => {
    if (!systemSettings) return

    setIsSaving(true)
    try {
      await updateSystemSettings(systemSettings)
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save system settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTimeSlotSettings = async () => {
    if (!timeSlotSettings) return

    setIsSaving(true)
    try {
      await updateTimeSlotSettings(timeSlotSettings)
      toast({
        title: "Settings Saved",
        description: "Time slot settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save time slot settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    if (!emailSettings) return

    setIsSaving(true)
    try {
      await updateEmailSettings(emailSettings)
      toast({
        title: "Settings Saved",
        description: "Email settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save email settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addBlackoutDate = () => {
    if (!timeSlotSettings) return

    const newDate = new Date()
    newDate.setDate(newDate.getDate() + 1) // Tomorrow

    setTimeSlotSettings({
      ...timeSlotSettings,
      blackoutDates: [
        ...timeSlotSettings.blackoutDates,
        {
          id: Date.now().toString(),
          date: newDate,
          reason: "Holiday",
        },
      ],
    })
  }

  const removeBlackoutDate = (id: string) => {
    if (!timeSlotSettings) return

    setTimeSlotSettings({
      ...timeSlotSettings,
      blackoutDates: timeSlotSettings.blackoutDates.filter((date) => date.id !== id),
    })
  }

  const addNotificationRecipient = () => {
    if (!emailSettings) return

    setEmailSettings({
      ...emailSettings,
      notificationRecipients: [
        ...emailSettings.notificationRecipients,
        {
          id: Date.now().toString(),
          email: "",
          name: "",
        },
      ],
    })
  }

  const removeNotificationRecipient = (id: string) => {
    if (!emailSettings) return

    setEmailSettings({
      ...emailSettings,
      notificationRecipients: emailSettings.notificationRecipients.filter((recipient) => recipient.id !== id),
    })
  }

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading settings...</div>
  }

  if (!systemSettings || !timeSlotSettings || !emailSettings) {
    return <div className="flex justify-center py-12">Failed to load settings</div>
  }

  return (
    <div>
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="timeslots">Time Slots</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure the basic settings for your reservation system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="systemName">System Name</Label>
                <Input
                  id="systemName"
                  value={systemSettings.systemName}
                  onChange={(e) => setSystemSettings({ ...systemSettings, systemName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  value={systemSettings.organizationName}
                  onChange={(e) => setSystemSettings({ ...systemSettings, organizationName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={systemSettings.contactEmail}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contactEmail: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select
                  value={systemSettings.timeZone}
                  onValueChange={(value) => setSystemSettings({ ...systemSettings, timeZone: value })}
                >
                  <SelectTrigger id="timeZone">
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireApproval">Require Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    All reservation requests must be approved by an administrator
                  </p>
                </div>
                <Switch
                  id="requireApproval"
                  checked={systemSettings.requireApproval}
                  onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, requireApproval: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allowOverlapping">Allow Overlapping Bookings</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow administrators to approve overlapping reservations
                  </p>
                </div>
                <Switch
                  id="allowOverlapping"
                  checked={systemSettings.allowOverlapping}
                  onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, allowOverlapping: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="use12HourFormat">Use 12-hour Time Format</Label>
                  <p className="text-sm text-muted-foreground">
                    Display times in 12-hour format (e.g., 2:00 PM) instead of 24-hour format (e.g., 14:00)
                  </p>
                </div>
                <Switch
                  id="use12HourFormat"
                  checked={systemSettings.use12HourFormat !== false} // Default to true if not specified
                  onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, use12HourFormat: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="publicCalendar">Public Calendar</Label>
                  <p className="text-sm text-muted-foreground">Make the calendar visible to everyone without login</p>
                </div>
                <Switch
                  id="publicCalendar"
                  checked={systemSettings.publicCalendar}
                  onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, publicCalendar: checked })}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSystemSettings} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation Types</CardTitle>
              <CardDescription>Configure the types of reservations that can be made.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemSettings.reservationTypes.map((type, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={type}
                    onChange={(e) => {
                      const newTypes = [...systemSettings.reservationTypes]
                      newTypes[index] = e.target.value
                      setSystemSettings({ ...systemSettings, reservationTypes: newTypes })
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newTypes = systemSettings.reservationTypes.filter((_, i) => i !== index)
                      setSystemSettings({ ...systemSettings, reservationTypes: newTypes })
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSystemSettings({
                    ...systemSettings,
                    reservationTypes: [...systemSettings.reservationTypes, ""],
                  })
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Type
              </Button>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSystemSettings} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="timeslots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Set the hours when reservations can be made.</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSlotEditor timeSlotSettings={timeSlotSettings} setTimeSlotSettings={setTimeSlotSettings} />
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveTimeSlotSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Time Slot Settings"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blackout Dates</CardTitle>
              <CardDescription>Set dates when no reservations can be made.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeSlotSettings.blackoutDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blackout dates configured.</p>
              ) : (
                timeSlotSettings.blackoutDates.map((blackoutDate) => (
                  <div key={blackoutDate.id} className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`date-${blackoutDate.id}`}>Date</Label>
                          <Input
                            id={`date-${blackoutDate.id}`}
                            type="date"
                            value={new Date(blackoutDate.date).toISOString().split("T")[0]}
                            onChange={(e) => {
                              const newBlackoutDates = timeSlotSettings.blackoutDates.map((date) => {
                                if (date.id === blackoutDate.id) {
                                  return { ...date, date: new Date(e.target.value) }
                                }
                                return date
                              })
                              setTimeSlotSettings({ ...timeSlotSettings, blackoutDates: newBlackoutDates })
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`reason-${blackoutDate.id}`}>Reason</Label>
                          <Input
                            id={`reason-${blackoutDate.id}`}
                            value={blackoutDate.reason}
                            onChange={(e) => {
                              const newBlackoutDates = timeSlotSettings.blackoutDates.map((date) => {
                                if (date.id === blackoutDate.id) {
                                  return { ...date, reason: e.target.value }
                                }
                                return date
                              })
                              setTimeSlotSettings({ ...timeSlotSettings, blackoutDates: newBlackoutDates })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end pb-2">
                      <Button variant="ghost" size="icon" onClick={() => removeBlackoutDate(blackoutDate.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" onClick={addBlackoutDate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Blackout Date
              </Button>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveTimeSlotSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Blackout Dates"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation Duration</CardTitle>
              <CardDescription>Configure minimum and maximum reservation duration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minDuration">Minimum Duration (minutes)</Label>
                  <Input
                    id="minDuration"
                    type="number"
                    min="15"
                    step="15"
                    value={timeSlotSettings.minDuration}
                    onChange={(e) =>
                      setTimeSlotSettings({
                        ...timeSlotSettings,
                        minDuration: Number.parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Maximum Duration (minutes)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    min="15"
                    step="15"
                    value={timeSlotSettings.maxDuration}
                    onChange={(e) =>
                      setTimeSlotSettings({
                        ...timeSlotSettings,
                        maxDuration: Number.parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeSlotInterval">Time Slot Interval (minutes)</Label>
                <Select
                  value={timeSlotSettings.timeSlotInterval.toString()}
                  onValueChange={(value) =>
                    setTimeSlotSettings({
                      ...timeSlotSettings,
                      timeSlotInterval: Number.parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id="timeSlotInterval">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bufferTime">Buffer Time Between Reservations (minutes)</Label>
                <Input
                  id="bufferTime"
                  type="number"
                  min="0"
                  step="5"
                  value={timeSlotSettings.bufferTime}
                  onChange={(e) =>
                    setTimeSlotSettings({
                      ...timeSlotSettings,
                      bufferTime: Number.parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Buffer time is added after each reservation to allow for cleanup or preparation.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveTimeSlotSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Duration Settings"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure email notifications for the reservation system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sendUserEmails">User Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to users when their reservation status changes
                  </p>
                </div>
                <Switch
                  id="sendUserEmails"
                  checked={emailSettings.sendUserEmails}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendUserEmails: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sendAdminEmails">Admin Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to administrators for new reservation requests
                  </p>
                </div>
                <Switch
                  id="sendAdminEmails"
                  checked={emailSettings.sendAdminEmails}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendAdminEmails: checked })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Notification Recipients</Label>
                <p className="text-sm text-muted-foreground">
                  Add email addresses that should receive notifications about reservations
                </p>

                {emailSettings.notificationRecipients.map((recipient) => (
                  <div key={recipient.id} className="flex items-center space-x-2 mt-2">
                    <div className="grid flex-1 gap-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`name-${recipient.id}`} className="sr-only">
                            Name
                          </Label>
                          <Input
                            id={`name-${recipient.id}`}
                            placeholder="Name"
                            value={recipient.name}
                            onChange={(e) => {
                              const newRecipients = emailSettings.notificationRecipients.map((r) => {
                                if (r.id === recipient.id) {
                                  return { ...r, name: e.target.value }
                                }
                                return r
                              })
                              setEmailSettings({ ...emailSettings, notificationRecipients: newRecipients })
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`email-${recipient.id}`} className="sr-only">
                            Email
                          </Label>
                          <Input
                            id={`email-${recipient.id}`}
                            type="email"
                            placeholder="Email"
                            value={recipient.email}
                            onChange={(e) => {
                              const newRecipients = emailSettings.notificationRecipients.map((r) => {
                                if (r.id === recipient.id) {
                                  return { ...r, email: e.target.value }
                                }
                                return r
                              })
                              setEmailSettings({ ...emailSettings, notificationRecipients: newRecipients })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeNotificationRecipient(recipient.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addNotificationRecipient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveEmailSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Email Settings"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Customize the email templates sent to users and administrators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="approvalTemplate">Approval Email Template</Label>
                <Textarea
                  id="approvalTemplate"
                  rows={5}
                  value={emailSettings.templates.approval}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      templates: {
                        ...emailSettings.templates,
                        approval: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{date}"}, {"{startTime}"}, {"{endTime}"}, {"{purpose}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectionTemplate">Rejection Email Template</Label>
                <Textarea
                  id="rejectionTemplate"
                  rows={5}
                  value={emailSettings.templates.rejection}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      templates: {
                        ...emailSettings.templates,
                        rejection: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{date}"}, {"{startTime}"}, {"{endTime}"}, {"{purpose}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationTemplate">Admin Notification Template</Label>
                <Textarea
                  id="notificationTemplate"
                  rows={5}
                  value={emailSettings.templates.notification}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      templates: {
                        ...emailSettings.templates,
                        notification: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{email}"}, {"{date}"}, {"{startTime}"}, {"{endTime}"},{" "}
                  {"{purpose}"}, {"{attendees}"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveEmailSettings} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Email Templates"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
