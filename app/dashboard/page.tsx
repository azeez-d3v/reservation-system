"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Clock, CheckCircle, XCircle } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ReservationList } from "@/components/dashboard/reservation-list"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { getUserReservations, getUserStats } from "@/lib/actions"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [reservations, setReservations] = useState<any>({
    approved: [],
    pending: [],
    cancelled: [],
    rejected: []
  })
  const [stats, setStats] = useState<any>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Cache key for localStorage
  const getCacheKey = (userId: string) => `dashboard_data_${userId}`

  // Load cached data from localStorage
  const loadCachedData = useCallback((userId: string) => {
    try {
      const cached = localStorage.getItem(getCacheKey(userId))
      if (cached) {
        const data = JSON.parse(cached)
        // Check if cache is less than 5 minutes old
        const cacheAge = Date.now() - data.timestamp
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes
          setReservations(data.reservations)
          setStats(data.stats)
          setIsLoadingData(false)
          setHasLoadedOnce(true)
          return true
        }
      }
    } catch (error) {
      console.error("Error loading cached data:", error)
    }
    return false
  }, [])

  // Save data to localStorage
  const saveCachedData = useCallback((userId: string, reservations: any, stats: any) => {
    try {
      const data = {
        reservations,
        stats,
        timestamp: Date.now()
      }
      localStorage.setItem(getCacheKey(userId), JSON.stringify(data))
    } catch (error) {
      console.error("Error saving cached data:", error)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !user) {
      redirect("/login")
    }

    if (user && !hasLoadedOnce) {
      // Try to load cached data first
      const hasCache = loadCachedData(user.id)
      
      // Always fetch fresh data, but in background if we have cache
      if (hasCache) {
        // Fetch in background without showing loading
        fetchDataSilently()
      } else {
        // No cache, show loading and fetch
        fetchData()
      }
    }
  }, [user, isLoading, hasLoadedOnce, loadCachedData])

  const fetchData = async () => {
    if (!user) return
    
    setIsLoadingData(true)
    await fetchDataInternal()
  }

  const fetchDataSilently = async () => {
    if (!user) return
    
    await fetchDataInternal()
  }

  const fetchDataInternal = async () => {
    if (!user) return
    
    try {
      console.log("User object:", user)
      console.log("User ID:", user.id)
      console.log("User email:", user.email)
      const [userReservations, userStats] = await Promise.all([getUserReservations(user.id), getUserStats(user.id)])
      console.log("Fetched reservations:", userReservations)
      console.log("Fetched stats:", userStats)
        // Transform the flat array of reservations into categorized groups
      const now = new Date()
      const categorizedReservations = {
        approved: userReservations.filter(r => r.status === "approved"),
        pending: userReservations.filter(r => r.status === "pending"),
        cancelled: userReservations.filter(r => r.status === "cancelled"),
        rejected: userReservations.filter(r => r.status === "rejected")
      }
      
      setReservations(categorizedReservations)
      setStats(userStats)
      setHasLoadedOnce(true)
      
      // Save to cache
      saveCachedData(user.id, categorizedReservations, userStats)
    } catch (error) {
      console.error("Failed to fetch user data:", error)
    } finally {
      setIsLoadingData(false)
    }
  }

  if (isLoading) {
    return <div className="container py-10">Loading...</div>
  }

  if (!user) {
    return null // This will redirect in the useEffect
  }  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        text="View and manage your reservations"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} isLoading={isLoadingData} />
      </div>

      <Tabs defaultValue="approved" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approved" className="flex items-center">
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-amber-500" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex items-center">
            <XCircle className="mr-2 h-4 w-4 text-gray-500" />
            Cancelled
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center">
            <XCircle className="mr-2 h-4 w-4 text-red-500" />
            Rejected
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="approved" className="space-y-4">
          <ReservationList
            reservations={reservations.approved}
            emptyMessage="You have no approved reservations."
            isLoading={isLoadingData}
            onReservationUpdate={fetchData}
          />
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          <ReservationList
            reservations={reservations.pending}
            emptyMessage="You have no pending reservation requests."
            isLoading={isLoadingData}
            onReservationUpdate={fetchData}
          />
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          <ReservationList
            reservations={reservations.cancelled}
            emptyMessage="You have no cancelled reservations."
            isLoading={isLoadingData}
            onReservationUpdate={fetchData}
          />
        </TabsContent>
        
        <TabsContent value="rejected" className="space-y-4">
          <ReservationList
            reservations={reservations.rejected}
            emptyMessage="You have no rejected reservations."
            isLoading={isLoadingData}
            onReservationUpdate={fetchData}
          />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
