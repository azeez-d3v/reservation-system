"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { TimeSlotSettings, DaySchedule, TimeSlot } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"

interface TimeSlotEditorProps {
  timeSlotSettings: TimeSlotSettings
  setTimeSlotSettings: React.Dispatch<React.SetStateAction<TimeSlotSettings | null>>
}

export function TimeSlotEditor({ timeSlotSettings, setTimeSlotSettings }: TimeSlotEditorProps) {
  const [activeDay, setActiveDay] = useState("monday")

  const days = [
    { id: "monday", label: "Monday" },
    { id: "tuesday", label: "Tuesday" },
    { id: "wednesday", label: "Wednesday" },
    { id: "thursday", label: "Thursday" },
    { id: "friday", label: "Friday" },
    { id: "saturday", label: "Saturday" },
    { id: "sunday", label: "Sunday" },
  ]

  const timeOptions = Array.from({ length: 24 * 4 }).map((_, i) => {
    const hour = Math.floor(i / 4)
    const minute = (i % 4) * 15
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  })

  const updateDaySchedule = (dayId: string, newSchedule: DaySchedule) => {
    setTimeSlotSettings({
      ...timeSlotSettings,
      businessHours: {
        ...timeSlotSettings.businessHours,
        [dayId]: newSchedule,
      },
    })
  }

  const setTimeSlot = (dayId: string, timeSlot: TimeSlot | null) => {
    const daySchedule = timeSlotSettings.businessHours[dayId as keyof typeof timeSlotSettings.businessHours]

    updateDaySchedule(dayId, {
      ...daySchedule,
      timeSlot: timeSlot,
    })
  }

  const copyToAllDays = () => {
    const sourceDay = timeSlotSettings.businessHours[activeDay as keyof typeof timeSlotSettings.businessHours]

    const newBusinessHours = { ...timeSlotSettings.businessHours }

    days.forEach((day) => {
      if (day.id !== activeDay) {
        newBusinessHours[day.id as keyof typeof newBusinessHours] = {
          ...sourceDay,
          timeSlot: sourceDay.timeSlot ? {
            ...sourceDay.timeSlot,
            id: Date.now().toString() + Math.random().toString(36).substring(2),
          } : null,
        }
      }
    })

    setTimeSlotSettings({
      ...timeSlotSettings,
      businessHours: newBusinessHours,
    })
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={activeDay} value={activeDay} onValueChange={setActiveDay}>
        <TabsList className="mb-4 flex w-full flex-wrap h-auto">
          {days.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="flex-1 min-w-[80px]">
              <span className="hidden sm:inline">{day.label}</span>
              <span className="sm:hidden">{day.label.substring(0, 3)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {days.map((day) => {
          const daySchedule = timeSlotSettings.businessHours[day.id as keyof typeof timeSlotSettings.businessHours]

          return (
            <TabsContent key={day.id} value={day.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={`enable-${day.id}`}>Enable {day.label}</Label>
                  <p className="text-sm text-muted-foreground">Allow reservations on {day.label}</p>
                </div>
                <Switch
                  id={`enable-${day.id}`}
                  checked={daySchedule.enabled}
                  onCheckedChange={(checked) => {
                    updateDaySchedule(day.id, {
                      ...daySchedule,
                      enabled: checked,
                    })
                  }}
                />
              </div>

              {daySchedule.enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Operating Hours</Label>
                    
                    {!daySchedule.timeSlot ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">No operating hours configured for {day.label}.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setTimeSlot(day.id, {
                            id: Date.now().toString(),
                            start: "08:00",
                            end: "17:00",
                          })}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Set Operating Hours
                        </Button>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="grid flex-1 gap-2 grid-cols-1 sm:grid-cols-2">
                              <div>
                                <Label htmlFor={`start-${daySchedule.timeSlot.id}`}>Start Time</Label>
                                <Select
                                  value={daySchedule.timeSlot.start}
                                  onValueChange={(value) => {
                                    setTimeSlot(day.id, {
                                      ...daySchedule.timeSlot!,
                                      start: value
                                    })
                                  }}
                                >
                                  <SelectTrigger id={`start-${daySchedule.timeSlot.id}`}>
                                    <SelectValue placeholder="Select start time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={`start-${time}`} value={time}>
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`end-${daySchedule.timeSlot.id}`}>End Time</Label>
                                <Select
                                  value={daySchedule.timeSlot.end}
                                  onValueChange={(value) => {
                                    setTimeSlot(day.id, {
                                      ...daySchedule.timeSlot!,
                                      end: value
                                    })
                                  }}
                                >
                                  <SelectTrigger id={`end-${daySchedule.timeSlot.id}`}>
                                    <SelectValue placeholder="Select end time" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={`end-${time}`} value={time} disabled={time <= daySchedule.timeSlot!.start}>
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center pt-6">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setTimeSlot(day.id, null)}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={copyToAllDays}>
          Copy {days.find((d) => d.id === activeDay)?.label} Schedule to All Days
        </Button>
      </div>
    </div>
  )
}
