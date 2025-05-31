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
import { useSession } from "next-auth/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock } from "lucide-react"
import {
  getSettings,
  updateSettings,
  getTimeSlots,
  updateTimeSlots,
  getEmailConfiguration,
  updateEmailConfiguration,
} from "@/lib/actions"
import type { TimeSlotSettings, SystemSettings, EmailSettings } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Save } from "lucide-react"
import { TimeSlotEditor } from "@/components/admin/time-slot-editor"
import { AdminUsers } from "@/components/admin/users"

export function AdminSettings() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("general")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Check if user has admin privileges (not staff)
  const isAdmin = session?.user?.role === "admin"
  const isStaff = session?.user?.role === "staff"

  // Settings states
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [timeSlotSettings, setTimeSlotSettings] = useState<TimeSlotSettings | null>(null)
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null)

  // Original states for change detection
  const [originalSystemSettings, setOriginalSystemSettings] = useState<SystemSettings | null>(null)
  const [originalTimeSlotSettings, setOriginalTimeSlotSettings] = useState<TimeSlotSettings | null>(null)
  const [originalEmailSettings, setOriginalEmailSettings] = useState<EmailSettings | null>(null)

  // Local storage keys
  const STORAGE_KEYS = {
    system: 'admin-settings-system-draft',
    timeSlots: 'admin-settings-timeslots-draft',
    email: 'admin-settings-email-draft',
    cache: 'admin-settings-cache',
    cacheTimestamp: 'admin-settings-cache-timestamp'
  }

  // Cache duration (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000

  // Helper functions for change detection
  const hasSystemChanges = () => {
    if (!systemSettings || !originalSystemSettings) return false
    return JSON.stringify(systemSettings) !== JSON.stringify(originalSystemSettings)
  }

  const hasTimeSlotChanges = () => {
    if (!timeSlotSettings || !originalTimeSlotSettings) return false
    return JSON.stringify(timeSlotSettings) !== JSON.stringify(originalTimeSlotSettings)
  }

  const hasEmailChanges = () => {
    if (!emailSettings || !originalEmailSettings) return false
    return JSON.stringify(emailSettings) !== JSON.stringify(originalEmailSettings)
  }

  // Local storage helpers
  const saveToLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }

  const loadFromLocalStorage = (key: string) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.warn('Failed to load from localStorage:', error)
      return null
    }
  }

  const clearLocalStorage = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }

  // Cache helpers
  const getCachedSettings = () => {
    const cached = loadFromLocalStorage(STORAGE_KEYS.cache)
    const timestamp = loadFromLocalStorage(STORAGE_KEYS.cacheTimestamp)
    
    if (cached && timestamp && (Date.now() - timestamp < CACHE_DURATION)) {
      return cached
    }
    
    return null
  }

  const setCachedSettings = (settings: any) => {
    saveToLocalStorage(STORAGE_KEYS.cache, settings)
    saveToLocalStorage(STORAGE_KEYS.cacheTimestamp, Date.now())
  }

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      try {
        // Check cache first
        const cachedSettings = getCachedSettings()
        if (cachedSettings) {
          const { system, timeSlots, email } = cachedSettings
          
          setSystemSettings(system)
          setOriginalSystemSettings(system)
          
          const processedTimeSlots = {
            ...timeSlots,
            blackoutDates: timeSlots.blackoutDates.map((bd: any) => ({
              ...bd,
              date: typeof bd.date === 'string' ? new Date(bd.date) : bd.date
            }))
          }
          setTimeSlotSettings(processedTimeSlots)
          setOriginalTimeSlotSettings(processedTimeSlots)
          
          setEmailSettings(email)
          setOriginalEmailSettings(email)

          // Check for local drafts
          const systemDraft = loadFromLocalStorage(STORAGE_KEYS.system)
          const timeSlotsDraft = loadFromLocalStorage(STORAGE_KEYS.timeSlots)
          const emailDraft = loadFromLocalStorage(STORAGE_KEYS.email)

          if (systemDraft) {
            setSystemSettings(systemDraft)
            toast({
              title: "Draft Restored",
              description: "Your unsaved system settings have been restored.",
            })
          }
          if (timeSlotsDraft) {
            setTimeSlotSettings(timeSlotsDraft)
            toast({
              title: "Draft Restored", 
              description: "Your unsaved time slot settings have been restored.",
            })
          }
          if (emailDraft) {
            setEmailSettings(emailDraft)
            toast({
              title: "Draft Restored",
              description: "Your unsaved email settings have been restored.",
            })
          }

          setIsLoading(false)
          return
        }

        // Fetch from server if no cache
        const [system, timeSlots, email] = await Promise.all([
          getSettings(),
          getTimeSlots(),
          getEmailConfiguration(),
        ])

        // Store originals for change detection
        setOriginalSystemSettings(system)
        setOriginalTimeSlotSettings(timeSlots)
        setOriginalEmailSettings(email)

        setSystemSettings(system)
        
        // Convert blackout date ISO strings back to Date objects
        const processedTimeSlots = {
          ...timeSlots,
          blackoutDates: timeSlots.blackoutDates.map(bd => ({
            ...bd,
            date: typeof bd.date === 'string' ? new Date(bd.date) : bd.date
          }))
        }
        setTimeSlotSettings(processedTimeSlots)
        setEmailSettings(email)

        // Cache the settings
        setCachedSettings({ system, timeSlots: processedTimeSlots, email })

        // Check for local drafts
        const systemDraft = loadFromLocalStorage(STORAGE_KEYS.system)
        const timeSlotsDraft = loadFromLocalStorage(STORAGE_KEYS.timeSlots)
        const emailDraft = loadFromLocalStorage(STORAGE_KEYS.email)

        if (systemDraft) {
          setSystemSettings(systemDraft)
          toast({
            title: "Draft Restored",
            description: "Your unsaved system settings have been restored.",
          })
        }
        if (timeSlotsDraft) {
          setTimeSlotSettings(timeSlotsDraft)
          toast({
            title: "Draft Restored",
            description: "Your unsaved time slot settings have been restored.",
          })
        }
        if (emailDraft) {
          setEmailSettings(emailDraft)
          toast({
            title: "Draft Restored",
            description: "Your unsaved email settings have been restored.",
          })
        }

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

  // Auto-save drafts to localStorage when settings change
  useEffect(() => {
    if (systemSettings && hasSystemChanges()) {
      saveToLocalStorage(STORAGE_KEYS.system, systemSettings)
    }
  }, [systemSettings])

  useEffect(() => {
    if (timeSlotSettings && hasTimeSlotChanges()) {
      saveToLocalStorage(STORAGE_KEYS.timeSlots, timeSlotSettings)
    }
  }, [timeSlotSettings])

  useEffect(() => {
    if (emailSettings && hasEmailChanges()) {
      saveToLocalStorage(STORAGE_KEYS.email, emailSettings)
    }
  }, [emailSettings])

  const handleSaveSystemSettings = async () => {
    if (!systemSettings || !hasSystemChanges()) {
      toast({
        title: "No Changes",
        description: "No changes detected in system settings.",
      })
      return
    }

    setIsSaving(true)
    try {
      await updateSettings(systemSettings)
      
      // Update original state and clear draft
      setOriginalSystemSettings(systemSettings)
      localStorage.removeItem(STORAGE_KEYS.system)
      
      // Update cache
      if (timeSlotSettings && emailSettings) {
        setCachedSettings({ 
          system: systemSettings, 
          timeSlots: timeSlotSettings, 
          email: emailSettings 
        })
      }
      
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
    if (!timeSlotSettings || !hasTimeSlotChanges()) {
      toast({
        title: "No Changes",
        description: "No changes detected in time slot settings.",
      })
      return
    }

    setIsSaving(true)
    try {
      await updateTimeSlots(timeSlotSettings)
      
      // Update original state and clear draft
      setOriginalTimeSlotSettings(timeSlotSettings)
      localStorage.removeItem(STORAGE_KEYS.timeSlots)
      
      // Update cache
      if (systemSettings && emailSettings) {
        setCachedSettings({ 
          system: systemSettings, 
          timeSlots: timeSlotSettings, 
          email: emailSettings 
        })
      }
      
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
    if (!emailSettings || !hasEmailChanges()) {
      toast({
        title: "No Changes",
        description: "No changes detected in email settings.",
      })
      return
    }

    setIsSaving(true)
    try {
      await updateEmailConfiguration(emailSettings)
      
      // Update original state and clear draft
      setOriginalEmailSettings(emailSettings)
      localStorage.removeItem(STORAGE_KEYS.email)
      
      // Update cache
      if (systemSettings && timeSlotSettings) {
        setCachedSettings({ 
          system: systemSettings, 
          timeSlots: timeSlotSettings, 
          email: emailSettings 
        })
      }
      
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

    toast({
      title: "Blackout Date Added",
      description: "A new blackout date has been added. Remember to save your changes.",
    })
  }

  const removeBlackoutDate = (id: string) => {
    if (!timeSlotSettings) return

    setTimeSlotSettings({
      ...timeSlotSettings,
      blackoutDates: timeSlotSettings.blackoutDates.filter((date) => date.id !== id),
    })

    toast({
      title: "Blackout Date Removed",
      description: "The blackout date has been removed. Remember to save your changes.",
    })
  }


  // Helper functions for reservation types
  const addReservationType = () => {
    if (!systemSettings) return

    setSystemSettings({
      ...systemSettings,
      reservationTypes: [...systemSettings.reservationTypes, ""],
    })

    toast({
      title: "Reservation Type Added",
      description: "A new reservation type has been added. Remember to save your changes.",
    })
  }

  const removeReservationType = (index: number) => {
    if (!systemSettings) return

    const newTypes = systemSettings.reservationTypes.filter((_, i) => i !== index)
    setSystemSettings({ ...systemSettings, reservationTypes: newTypes })

    toast({
      title: "Reservation Type Removed",
      description: "The reservation type has been removed. Remember to save your changes.",
    })
  }

  const updateReservationType = (index: number, value: string) => {
    if (!systemSettings) return

    const newTypes = [...systemSettings.reservationTypes]
    newTypes[index] = value
    setSystemSettings({ ...systemSettings, reservationTypes: newTypes })
  }

  // Helper function to show toast when settings change
  const showChangeNotification = (settingType: string) => {
    toast({
      title: "Settings Modified",
      description: `${settingType} settings have been modified. Remember to save your changes.`,
    })
  }
  if (isLoading) {
    return <div className="flex justify-center py-12">Loading settings...</div>
  }

  if (!systemSettings || !timeSlotSettings || !emailSettings) {
    return <div className="flex justify-center py-12">Failed to load settings</div>
  }

  // Staff users can only access user management and reservations, not system settings
  if (isStaff) {
    return (
      <div>
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            As a staff member, you have access to reservation management but cannot modify system settings. Only administrators can change system configuration.
          </AlertDescription>
        </Alert>
        <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>                <CardDescription>
                  Manage user accounts and access permissions. You can enable/disable user access but cannot change user roles (admin only).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUsers />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div>
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="timeslots">Time Slots</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
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
                />              </div>

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
              </div>              <div className="flex items-center justify-between">
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

              <div className="space-y-2">
                <Label htmlFor="maxConcurrentReservations">Maximum Concurrent Reservations</Label>
                <Input
                  id="maxConcurrentReservations"
                  type="number"
                  min="1"
                  max="10"
                  value={systemSettings.maxOverlappingReservations}
                  onChange={(e) => 
                    setSystemSettings({ 
                      ...systemSettings, 
                      maxOverlappingReservations: Math.max(1, Number.parseInt(e.target.value) || 1)
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of reservations allowed at the same time slot (default: 2)
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveSystemSettings} 
                disabled={isSaving || !hasSystemChanges()}
                className={hasSystemChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                {isSaving ? "Saving..." : hasSystemChanges() ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation Types</CardTitle>
              <CardDescription>Configure the types of reservations that can be made.</CardDescription>
            </CardHeader>            <CardContent className="space-y-4">
              {systemSettings.reservationTypes.map((type, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    value={type}
                    onChange={(e) => updateReservationType(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeReservationType(index)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addReservationType}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Type
              </Button>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveSystemSettings} 
                disabled={isSaving || !hasSystemChanges()}
                className={hasSystemChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                {isSaving ? "Saving..." : hasSystemChanges() ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="timeslots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>School Hours</CardTitle>
              <CardDescription>Set the hours when reservations can be made.</CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSlotEditor timeSlotSettings={timeSlotSettings} setTimeSlotSettings={setTimeSlotSettings} />
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveTimeSlotSettings} 
                disabled={isSaving || !hasTimeSlotChanges()}
                className={hasTimeSlotChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : hasTimeSlotChanges() ? "Save Changes" : "No Changes"}
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
                <p className="text-sm text-muted-foreground">No blackout dates configured.</p>              ) : (
                timeSlotSettings.blackoutDates.map((blackoutDate) => (
                  <div key={blackoutDate.id} className="flex items-start gap-3">
                    <div className="grid flex-1 gap-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`date-${blackoutDate.id}`}>Date</Label>
                          <Input
                            id={`date-${blackoutDate.id}`}
                            type="date"
                            value={
                              blackoutDate.date instanceof Date 
                                ? blackoutDate.date.toISOString().split("T")[0]
                                : new Date(blackoutDate.date).toISOString().split("T")[0]
                            }
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
                    <div className="flex items-center pt-6">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeBlackoutDate(blackoutDate.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                      >
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
              <Button 
                onClick={handleSaveTimeSlotSettings} 
                disabled={isSaving || !hasTimeSlotChanges()}
                className={hasTimeSlotChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : hasTimeSlotChanges() ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reservation Settings</CardTitle>
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
              <Button 
                onClick={handleSaveTimeSlotSettings} 
                disabled={isSaving || !hasTimeSlotChanges()}
                className={hasTimeSlotChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : hasTimeSlotChanges() ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Configure email notifications for the reservation system. These settings control all email notifications throughout the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  🔧 Email Notification Controls
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  These toggles control all email notifications sent by the system. When disabled, no emails of that type will be sent regardless of other settings.
                </p>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="sendUserEmails" className="text-base font-medium">User Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to users for confirmation, approval, rejection, and cancellation of their reservations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Affects: Submission confirmations, approval notifications, rejection notifications, cancellation notifications
                  </p>
                </div>
                <Switch
                  id="sendUserEmails"
                  checked={emailSettings.sendUserEmails}
                  onCheckedChange={(checked) => {
                    setEmailSettings({ ...emailSettings, sendUserEmails: checked })
                    showChangeNotification('User email')
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="sendAdminEmails" className="text-base font-medium">Admin Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications to administrators for new reservation requests and status changes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Affects: New reservation alerts, status change notifications, deletion notifications
                  </p>
                </div>
                <Switch
                  id="sendAdminEmails"
                  checked={emailSettings.sendAdminEmails}
                  onCheckedChange={(checked) => {
                    setEmailSettings({ ...emailSettings, sendAdminEmails: checked })
                    showChangeNotification('Admin email')
                  }}
                />
              </div>
              
              {(!emailSettings.sendUserEmails && !emailSettings.sendAdminEmails) && (
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                    ⚠️ All Email Notifications Disabled
                  </h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    Both user and admin email notifications are currently disabled. No emails will be sent by the system.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveEmailSettings} 
                disabled={isSaving || !hasEmailChanges()}
                className={hasEmailChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : hasEmailChanges() ? "Save Changes" : "No Changes"}
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
              </div>              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="submissionTemplate">Submission Confirmation Template</Label>
                <Textarea
                  id="submissionTemplate"
                  rows={5}
                  value={emailSettings.templates.submission}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      templates: {
                        ...emailSettings.templates,
                        submission: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{date}"}, {"{startTime}"}, {"{endTime}"}, {"{purpose}"}, {"{attendees}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancellationTemplate">Cancellation Email Template</Label>
                <Textarea
                  id="cancellationTemplate"
                  rows={5}
                  value={emailSettings.templates.cancellation}
                  onChange={(e) =>
                    setEmailSettings({
                      ...emailSettings,
                      templates: {
                        ...emailSettings.templates,
                        cancellation: e.target.value,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{date}"}, {"{startTime}"}, {"{endTime}"}, {"{purpose}"}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveEmailSettings} 
                disabled={isSaving || !hasEmailChanges()}
                className={hasEmailChanges() ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : hasEmailChanges() ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, roles, and access permissions. You can enable/disable user access and change user roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminUsers />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
