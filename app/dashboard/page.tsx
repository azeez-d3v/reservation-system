"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Clock, CheckCircle } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ReservationList } from "@/components/dashboard/reservation-list"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { getUserReservations, getUserStats } from "@/lib/actions"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [reservations, setReservations] = useState<any>({
    active: [],
    pending: [],
    past: [],
  })
  const [stats, setStats] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      redirect("/login")
    }

    if (user) {
      const fetchData = async () => {
        setIsLoadingData(true)
        try {
          const [userReservations, userStats] = await Promise.all([getUserReservations(user.id), getUserStats(user.id)])
          setReservations(userReservations)
          setStats(userStats)
        } catch (error) {
          console.error("Failed to fetch user data:", error)
        } finally {
          setIsLoadingData(false)
        }
      }

      fetchData()
    }
  }, [user, isLoading])

  if (isLoading) {
    return <div className="container py-10">Loading...</div>
  }

  if (!user) {
    return null // This will redirect in the useEffect
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        text="View and manage your reservations"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} isLoading={isLoadingData} />
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="flex items-center">
            <CheckCircle className="mr-2 h-4 w-4" />
            Active
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="past" className="flex items-center">
            <CalendarDays className="mr-2 h-4 w-4" />
            Past
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-4">
          <ReservationList
            reservations={reservations.active}
            emptyMessage="You have no active reservations."
            isLoading={isLoadingData}
          />
        </TabsContent>
        <TabsContent value="pending" className="space-y-4">
          <ReservationList
            reservations={reservations.pending}
            emptyMessage="You have no pending reservation requests."
            isLoading={isLoadingData}
          />
        </TabsContent>
        <TabsContent value="past" className="space-y-4">
          <ReservationList
            reservations={reservations.past}
            emptyMessage="You have no past reservations."
            isLoading={isLoadingData}
          />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
