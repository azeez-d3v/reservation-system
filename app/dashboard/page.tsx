"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarDays, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ReservationList } from "@/components/dashboard/reservation-list"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { getUserReservations, getUserStats } from "@/lib/actions"
import { useIsMobile } from "@/hooks/use-mobile"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState("approved")
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
      console.error("Failed to fetch user data:", error)    } finally {
      setIsLoadingData(false)
    }
  }

  const statusOptions = [
    { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-500" },
    { value: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
    { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-gray-500" },
    { value: "rejected", label: "Rejected", icon: XCircle, color: "text-red-500" }
  ]
  const renderReservationList = (status: string) => {
    const statusKey = status as keyof typeof reservations
    const emptyMessages: Record<keyof typeof reservations, string> = {
      approved: "You have no approved reservations.",
      pending: "You have no pending reservation requests.",
      cancelled: "You have no cancelled reservations.",
      rejected: "You have no rejected reservations."
    }

    return (
      <ReservationList
        reservations={reservations[statusKey]}
        emptyMessage={emptyMessages[statusKey]}
        isLoading={isLoadingData}
        onReservationUpdate={fetchData}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null // This will redirect in the useEffect
  }  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard"
        text="View and manage your reservations"
      />      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} isLoading={isLoadingData} />
      </div>

      {isMobile ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(() => {
                    const currentStatus = statusOptions.find(option => option.value === activeTab)
                    const Icon = currentStatus?.icon
                    return (
                      <div className="flex items-center">
                        {Icon && <Icon className={`mr-2 h-4 w-4 ${currentStatus.color}`} />}
                        {currentStatus?.label}
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <Icon className={`mr-2 h-4 w-4 ${option.color}`} />
                        {option.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          {renderReservationList(activeTab)}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            {statusOptions.map((option) => {
              const Icon = option.icon
              return (
                <TabsTrigger key={option.value} value={option.value} className="flex items-center">
                  <Icon className={`mr-2 h-4 w-4 ${option.color}`} />
                  {option.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
          
          {statusOptions.map((option) => (
            <TabsContent key={option.value} value={option.value} className="space-y-4">
              {renderReservationList(option.value)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </DashboardShell>
  )
}
