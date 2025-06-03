"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminReservations } from "@/components/admin/reservations-new"
import { AdminSettings } from "@/components/admin/settings"
import { Calendar, Settings, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { redirect } from "next/navigation"
import { canModifySettings, type UserRole } from "@/lib/permissions"

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("reservations")
  // Check if user has permission to modify settings
  const hasSettingsAccess = user?.role ? canModifySettings(user.role as UserRole) : false
  
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== "admin" && user.role !== "staff"))) {
      redirect("/dashboard")
    }
  }, [user, isLoading])

  // If current tab is settings but user doesn't have access, switch to reservations
  useEffect(() => {
    if (activeTab === "settings" && !hasSettingsAccess) {
      setActiveTab("reservations")
    }
  }, [activeTab, hasSettingsAccess])

  if (isLoading) {
    return (
    <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>)
  }

  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    return null // This will redirect in the useEffect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>        
        <CardHeader>
          <CardTitle>Reservation Management</CardTitle>
          <CardDescription>Manage all reservations in one place.</CardDescription>
        </CardHeader><CardContent className="p-0">
          <Tabs defaultValue="reservations" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6">
              <TabsList className="mb-0">
                <TabsTrigger value="reservations">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Reservations</span>
                </TabsTrigger>
                {hasSettingsAccess && (
                  <TabsTrigger value="settings">
                    <Settings className="h-4 w-4 mr-2" />
                    <span>Settings</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
            <div className="p-6">
              <TabsContent value="reservations" className="m-0">
                <AdminReservations />
              </TabsContent>

              {hasSettingsAccess && (
                <TabsContent value="settings" className="m-0">
                  <AdminSettings />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
